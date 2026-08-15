# SPEC: Processamento de pagamento

**Projeto:** marketplace-ms  
**Serviço afetado:** payments-service  
**Porta do serviço:** 3004  
**Escopo:** processamento assíncrono e consulta de pagamentos  
**Status:** Pendente  
**Criado em:** 2026-08-15

---

## 1. Objetivo

Implementar o processamento de pagamentos recebidos pelo `payments-service` por meio da fila `payment_queue`, persistindo o resultado no PostgreSQL e disponibilizando uma consulta HTTP pelo identificador do pedido.

O processamento deve utilizar exclusivamente um gateway simulado e determinístico. A integração existente com RabbitMQ, incluindo retry e DLQ, bem como os endpoints atuais de DLQ e métricas, deve permanecer disponível e sem alteração de contrato.

## 2. Contexto atual

- O `payments-service` é uma aplicação NestJS disponível na porta `3004`.
- A persistência utiliza PostgreSQL na porta `5435` e TypeORM.
- O `checkout-service` publica uma mensagem ao finalizar um pedido.
- O consumer recebe mensagens da fila `payment_queue` e já valida o contrato `PaymentOrderMessage`, composto por `orderId`, `userId`, `amount`, `items` e `paymentMethod`.
- O processamento posterior à validação ainda não existe: atualmente a mensagem é apenas registrada em log.
- Retry, DLQ e os endpoints de DLQ e métricas já estão configurados.
- Existe um health check do consumer em `GET /metrics/health`; ele não substitui o health check geral solicitado nesta SPEC.

## 3. Entidade Payment

Deve ser criada a entidade persistente `Payment`, com os seguintes campos e restrições:

| Campo | Tipo | Obrigatoriedade e regra |
|---|---|---|
| `id` | UUID | Obrigatório e identificador primário |
| `orderId` | UUID | Obrigatório |
| `userId` | UUID | Obrigatório |
| `amount` | decimal com precisão 10 e escala 2 | Obrigatório |
| `status` | enum | Obrigatório; valores permitidos: `pending`, `approved` e `rejected`; padrão `pending` |
| `paymentMethod` | varchar de até 50 caracteres | Obrigatório |
| `transactionId` | varchar de até 255 caracteres | Opcional |
| `rejectionReason` | varchar de até 255 caracteres | Opcional |
| `processedAt` | timestamp | Opcional |
| `createdAt` | timestamp | Obrigatório; representa a criação do registro |
| `updatedAt` | timestamp | Obrigatório; representa a última atualização do registro |

Os valores monetários devem preservar duas casas decimais na persistência. Os campos de resultado devem ser coerentes com o estado final:

- Um pagamento `approved` deve possuir `transactionId` e `processedAt`, sem `rejectionReason`.
- Um pagamento `rejected` deve possuir `rejectionReason` e `processedAt`, sem exigir `transactionId`.
- Um pagamento `pending` ainda não possui resultado final e, portanto, não deve possuir `transactionId`, `rejectionReason` ou `processedAt`.

## 4. Requisitos funcionais

### RF-01: Disponibilizar o domínio de pagamentos

O serviço deve disponibilizar os componentes necessários para persistência, processamento e consulta de pagamentos, registrados na aplicação e acessíveis tanto pelo consumer RabbitMQ quanto pelo controller HTTP.

### RF-02: Simular o gateway de pagamento

Deve existir um `FakePaymentGatewayService` que simule uma operação externa com latência entre `500` milissegundos e `2` segundos por processamento.

O resultado deve seguir estas regras determinísticas, nesta ordem:

1. Pagamentos com valor superior a `10000,00` devem ser rejeitados com o motivo `Limite excedido`.
2. Para os demais valores, pagamentos cuja representação monetária com duas casas decimais termine em `.99` devem ser rejeitados com o motivo `Cartão recusado pela operadora`.
3. Todos os outros pagamentos devem ser aprovados.

O resultado do gateway deve conter:

- `approved`, indicando aprovação ou rejeição;
- `transactionId`, preenchido para pagamentos aprovados e adequado para identificar a transação simulada;
- `rejectionReason`, preenchido com o motivo aplicável quando o pagamento for rejeitado.

O gateway não deve se comunicar com qualquer provedor real de pagamentos.

### RF-03: Processar e persistir um pagamento

O `PaymentsService` deve oferecer a operação `processPayment(message)` para:

1. Criar e persistir um `Payment` com os dados `orderId`, `userId`, `amount` e `paymentMethod` recebidos, inicialmente com status `pending`.
2. Solicitar o processamento ao `FakePaymentGatewayService`.
3. Quando aprovado, atualizar o pagamento para `approved`, registrar o `transactionId` retornado e preencher `processedAt`.
4. Quando rejeitado, atualizar o pagamento para `rejected`, registrar o `rejectionReason` retornado e preencher `processedAt`.
5. Persistir e retornar o pagamento em seu estado final.

Uma rejeição de negócio pelo gateway é um resultado processado com sucesso, não uma falha técnica do consumer.

Se ocorrer uma falha técnica antes da obtenção ou persistência do resultado final, o erro deve permanecer observável pelo fluxo de consumo existente, permitindo que as políticas já configuradas de retry e DLQ sejam aplicadas.

### RF-04: Consultar pagamento por pedido

O `PaymentsService` deve oferecer a operação `findByOrderId(orderId)`, que retorna o pagamento correspondente ao `orderId` informado.

Quando nenhum pagamento for encontrado, a operação deve produzir uma resposta de recurso não encontrado, com status HTTP `404` quando utilizada pelo controller.

### RF-05: Completar o consumer de pagamentos

Após a validação já existente da `PaymentOrderMessage`, o `PaymentConsumerService` deve chamar `PaymentsService.processPayment()` com a mensagem recebida, substituindo o processamento pendente atual.

O processamento da mensagem somente deve ser considerado bem-sucedido após a conclusão da operação do `PaymentsService`. Erros técnicos devem continuar sendo propagados ao mecanismo existente de consumo para acionar retry e, quando aplicável, DLQ.

As validações atuais da mensagem e o contrato `PaymentOrderMessage` devem ser preservados.

### RF-06: Expor a consulta HTTP

Deve existir um `PaymentsController` com a seguinte operação:

| Método | Rota | Resultado |
|---|---|---|
| GET | `/payments/:orderId` | Pagamento associado ao pedido informado |

Para um `orderId` existente, a resposta deve usar status HTTP `200` e apresentar os dados persistidos do pagamento, incluindo seu status e os campos de resultado aplicáveis. Para um `orderId` sem pagamento associado, a resposta deve usar status HTTP `404`.

### RF-07: Expor health check geral

O serviço deve disponibilizar `GET /health` como health check geral do `payments-service`.

Quando a aplicação estiver operacional, a rota deve responder com status HTTP `200` e um corpo que indique explicitamente estado saudável. Essa rota deve coexistir com `GET /metrics/health`, sem substituir ou alterar o endpoint atual.

## 5. Requisitos de qualidade e testes

- As regras do fake gateway devem possuir cobertura automatizada para aprovação e para cada motivo de rejeição, incluindo os valores de fronteira.
- O processamento deve possuir cobertura para a transição de `pending` ao estado final e para a persistência dos campos correspondentes.
- A consulta deve possuir cobertura para pagamento existente e inexistente.
- O consumer deve possuir cobertura que comprove a chamada ao processamento após uma mensagem válida e a propagação de falhas técnicas.
- O health check geral deve possuir cobertura de seu contrato HTTP.
- Os testes existentes de RabbitMQ, retry, DLQ e métricas devem continuar passando.

## 6. Critérios de aceite

### CA-01: Persistência

- [ ] A entidade `Payment` existe com todos os campos, tipos, limites, nulabilidade, timestamps e valor padrão especificados.
- [ ] Um novo processamento cria inicialmente um registro com status `pending`.
- [ ] O valor monetário é persistido com precisão 10 e duas casas decimais.
- [ ] `createdAt` e `updatedAt` refletem, respectivamente, criação e atualização do pagamento.

### CA-02: Gateway simulado

- [ ] Toda simulação leva entre `500` milissegundos e `2` segundos.
- [ ] O valor `10000,01` é rejeitado com `Limite excedido`.
- [ ] O valor `10000,00` não é rejeitado pela regra de limite.
- [ ] Um valor não superior a `10000,00` e terminado em `.99`, como `25,99`, é rejeitado com `Cartão recusado pela operadora`.
- [ ] Um valor que não satisfaça nenhuma regra de rejeição, como `25,00`, é aprovado.
- [ ] Uma aprovação retorna `approved` igual a verdadeiro e um `transactionId` preenchido.
- [ ] Uma rejeição retorna `approved` igual a falso e o `rejectionReason` correspondente.
- [ ] Nenhuma integração com gateway real é realizada.

### CA-03: Processamento

- [ ] `processPayment(message)` persiste o pagamento antes de solicitar o resultado ao gateway, com status inicial `pending`.
- [ ] Em uma aprovação, o registro termina como `approved`, com `transactionId` e `processedAt` preenchidos e sem `rejectionReason`.
- [ ] Em uma rejeição, o registro termina como `rejected`, com `rejectionReason` e `processedAt` preenchidos.
- [ ] Rejeições de negócio são concluídas normalmente e não acionam retry ou DLQ.
- [ ] Falhas técnicas são propagadas para que o fluxo existente possa aplicar retry e DLQ.

### CA-04: Consumer

- [ ] Uma mensagem válida consumida de `payment_queue` é encaminhada integralmente para `PaymentsService.processPayment()`.
- [ ] A mensagem só é contabilizada como sucesso após o término bem-sucedido do processamento.
- [ ] As validações atuais de `PaymentOrderMessage` permanecem ativas.
- [ ] Um erro técnico do processamento não é ocultado pelo consumer.

### CA-05: Consulta HTTP

- [ ] `GET /payments/:orderId` retorna status `200` e o pagamento correspondente quando ele existe.
- [ ] A resposta permite identificar `orderId`, `userId`, `amount`, `paymentMethod`, `status`, timestamps e os campos de resultado aplicáveis.
- [ ] `GET /payments/:orderId` retorna status `404` quando não existe pagamento para o pedido informado.

### CA-06: Saúde e regressão

- [ ] `GET /health` retorna status `200` e indica que o serviço está saudável quando a aplicação está operacional.
- [ ] `GET /metrics/health` continua disponível com seu contrato atual.
- [ ] Os endpoints existentes de DLQ, métricas e summary continuam disponíveis e inalterados.
- [ ] O serviço continua executando na porta `3004` e utilizando o PostgreSQL configurado na porta `5435`.
- [ ] Build, lint e testes do `payments-service` passam sem regressões.

## 7. Fora de escopo

- Integrar Stripe ou qualquer outro gateway de pagamento real.
- Criar webhook ou outro mecanismo para notificar o `checkout-service` sobre o resultado.
- Alterar o contrato publicado pelo `checkout-service` ou o contrato validado de `PaymentOrderMessage`.
- Alterar filas, exchanges, regras de retry ou DLQ já configuradas.
- Alterar, remover ou renomear endpoints existentes de DLQ e métricas.
- Expor a consulta de pagamentos por meio do `api-gateway`.
- Implementar estorno, cancelamento, captura posterior ou reprocessamento manual de pagamentos.
