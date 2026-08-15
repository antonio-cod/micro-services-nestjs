# SPEC: Finalização do pedido

**Serviço:** checkout-service  
**Porta:** 3003  
**Escopo:** finalização do carrinho, criação e consulta de pedidos, solicitação de pagamento e consumo do resultado
**Status:** Pendente  
**Criado em:** 2026-08-15
**Atualizado em:** 2026-08-15

---

## 1. Objetivo

Implementar a finalização do carrinho no `checkout-service`, transformando o carrinho ativo de um usuário autenticado em um pedido pendente e enviando ao `payments-service`, por meio do RabbitMQ, os dados necessários para o processamento assíncrono do pagamento.

Também devem ser disponibilizadas consultas para listar os pedidos do usuário autenticado e visualizar um pedido específico de sua propriedade. Após o processamento, o checkout deve consumir o resultado publicado pelo `payments-service` e atualizar o estado do pedido.

O processamento e a decisão financeira permanecem exclusivamente sob responsabilidade do `payments-service`. O `checkout-service` é responsável por refletir no pedido o resultado assíncrono recebido, sem realizar ou simular a cobrança.

---

## 2. Contexto e premissas

- O `checkout-service` utiliza NestJS, PostgreSQL e TypeORM e está disponível na porta `3003`.
- As entidades `Cart`, `CartItem` e `Order` já existem.
- O carrinho funcional já permite adicionar, consultar e remover itens.
- As rotas são protegidas por padrão pelo guard JWT global, e o identificador do usuário autenticado está disponível em `req.user.id`.
- Um carrinho elegível para checkout deve pertencer ao usuário autenticado, possuir status `active` e conter ao menos um item.
- A entidade `Order` admite os status `pending`, `paid`, `failed` e `cancelled`; todo pedido desta entrega deve ser criado com status `pending`.
- O `PaymentQueueService` já disponibiliza `publishPaymentOrder` e publica no exchange `payments` com a routing key `payment.order`.
- O `payments-service` consome as mensagens por meio da queue `payment_queue` e realiza o processamento de forma assíncrona.
- Após persistir o pagamento final, o `payments-service` publica `PaymentResultMessage` no exchange `payments` com a routing key `payment.result`.
- A entidade `Order` deve mapear pagamento `approved` para `paid` e pagamento `rejected` para `failed`.
- Valores monetários expostos pela API ou enviados na mensagem devem ser representados como números válidos.
- Todas as funções, variáveis e parâmetros adicionados ou alterados por esta entrega devem possuir tipagem explícita e adequada. Não devem ser introduzidos usos implícitos ou explícitos de `any` para contornar a definição dos contratos.

---

## 3. Finalização do carrinho

### RF-01: Endpoint de checkout

O serviço deve disponibilizar o endpoint protegido `POST /cart/checkout`.

A requisição deve aceitar exclusivamente o campo abaixo:

| Campo | Tipo | Validação |
|---|---|---|
| `paymentMethod` | enum textual | Obrigatório; deve possuir exatamente um dos valores `credit_card`, `debit_card`, `pix` ou `boleto`. |

Campos adicionais devem ser rejeitados pela validação global do serviço. O `userId`, os itens, o total e o status do pedido não podem ser recebidos do cliente.

O endpoint deve responder com `201 Created` e a representação do pedido criado quando a finalização for concluída com sucesso.

### RF-02: Validação do carrinho elegível

O checkout deve localizar o carrinho com status `active` pertencente ao usuário autenticado, sempre utilizando `req.user.id` como identidade confiável.

A finalização deve ser recusada quando:

- não existir carrinho ativo para o usuário;
- o carrinho ativo não possuir itens;
- o total do carrinho não for um valor monetário válido e maior que zero.

Uma finalização recusada não deve criar pedido, alterar o status do carrinho nem publicar mensagem de pagamento.

Carrinhos `completed` ou `abandoned` não são elegíveis e não podem ser reutilizados pelo checkout.

### RF-03: Criação do pedido

Para um carrinho elegível, deve ser criada uma `Order` com os seguintes dados:

| Campo | Origem ou valor esperado |
|---|---|
| `userId` | ID do usuário autenticado. |
| `cartId` | ID do carrinho ativo finalizado. |
| `total` | Total persistido do carrinho. |
| `paymentMethod` | Método de pagamento válido recebido na requisição. |
| `status` | `pending`. |

O total do pedido deve constituir o valor definitivo enviado para pagamento nesta etapa e não pode ser obtido ou substituído por dados fornecidos pelo cliente.

### RF-04: Conclusão do carrinho

Após originar o pedido, o carrinho deve ter seu status alterado de `active` para `completed`.

A criação do pedido e a conclusão do carrinho devem formar uma alteração persistente consistente. Uma falha nessa etapa não pode deixar apenas o pedido criado ou apenas o carrinho concluído.

Após uma finalização bem-sucedida:

- o carrinho não deve mais ser retornado por `GET /cart`;
- o carrinho não deve aceitar inclusão ou remoção de itens pelas operações destinadas ao carrinho ativo;
- uma nova tentativa de checkout sobre o mesmo carrinho não deve criar outro pedido nem publicar outra solicitação de pagamento.

### RF-05: Publicação da solicitação de pagamento

Depois que o pedido e a conclusão do carrinho estiverem persistidos com sucesso, o checkout deve solicitar a publicação de um `PaymentOrderMessage` por meio do `PaymentQueueService.publishPaymentOrder`.

A mensagem deve respeitar o contrato abaixo:

| Campo | Origem ou valor esperado |
|---|---|
| `orderId` | ID do pedido criado. |
| `userId` | ID do usuário autenticado e proprietário do pedido. |
| `amount` | Total numérico do pedido. |
| `items` | Lista não vazia formada pelos itens do carrinho finalizado. |
| `items[].productId` | ID do produto armazenado no item do carrinho. |
| `items[].quantity` | Quantidade inteira e positiva armazenada no item. |
| `items[].price` | Preço unitário numérico armazenado no item. |
| `paymentMethod` | Método de pagamento armazenado no pedido. |
| `description` | Campo opcional, quando houver descrição pertinente ao pedido. |
| `createdAt` | Data de criação do pedido, quando incluída. |

A mensagem não deve conter dados de pagamento sensíveis, credenciais, token JWT ou informações fornecidas pelo cliente fora do contrato validado.

O checkout não deve aguardar o processamento do pagamento pelo consumidor. A resposta `201 Created` representa a criação do pedido pendente e o encaminhamento da solicitação, e não a aprovação do pagamento.

Se a publicação não for aceita pelo mecanismo de mensageria, a operação não deve retornar `201 Created` nem declarar que o pagamento foi encaminhado. O pedido não deve ser marcado como `paid`, `failed` ou `cancelled` pelo fluxo de checkout.

---

## 4. Consulta de pedidos

### RF-06: Listagem dos pedidos do usuário

O serviço deve disponibilizar o endpoint protegido `GET /orders`.

O endpoint deve:

- retornar exclusivamente pedidos cujo `userId` corresponda a `req.user.id`;
- retornar todos os pedidos do usuário, independentemente de seu status;
- ordenar os pedidos por `createdAt` em ordem decrescente, do mais recente para o mais antigo;
- responder com `200 OK` e um array vazio quando o usuário ainda não possuir pedidos.

Identificadores de usuário recebidos por payload, query string ou headers adicionais não podem alterar o escopo da consulta.

### RF-07: Detalhe de um pedido

O serviço deve disponibilizar o endpoint protegido `GET /orders/:id`, em que `id` deve ser um UUID válido.

O endpoint deve retornar `200 OK` com o pedido quando o identificador existir e o respectivo `userId` corresponder ao usuário autenticado.

Deve retornar `404 Not Found` tanto quando o pedido não existir quanto quando pertencer a outro usuário. A resposta não deve revelar a existência de pedidos de terceiros.

Um identificador que não seja um UUID válido deve resultar em `400 Bad Request`.

---

## 5. Contrato das respostas de pedido

As respostas de criação, listagem e detalhe devem representar cada pedido com, no mínimo, os seguintes campos:

| Campo | Descrição |
|---|---|
| `id` | UUID do pedido. |
| `userId` | UUID do proprietário autenticado. |
| `cartId` | UUID do carrinho que originou o pedido. |
| `total` | Valor total numérico do pedido. |
| `status` | Estado atual do pedido. Na criação, sempre `pending`. |
| `paymentMethod` | Método de pagamento escolhido no checkout. |
| `createdAt` | Data de criação do pedido. |
| `updatedAt` | Data da última atualização do pedido. |

As respostas não devem expor dados de outros usuários, detalhes internos da mensageria ou informações sensíveis de pagamento.

---

## 6. Composição do módulo

### RF-08: OrdersModule

O `OrdersModule` deve concentrar as responsabilidades de criação e consulta de pedidos previstas nesta especificação.

Além do registro da entidade `Order` no contexto de persistência, o módulo deve importar:

- `CartModule`, para integrar o fluxo de finalização ao domínio do carrinho;
- `EventsModule`, para disponibilizar a publicação da solicitação de pagamento.

O módulo deve disponibilizar os componentes necessários aos endpoints de pedidos e à operação de checkout, preservando os limites de responsabilidade dos módulos existentes.

### RF-09: Contrato do resultado do pagamento

O checkout deve receber o seguinte contrato, definido pelo produtor `payments-service`:

```ts
interface PaymentResultMessage {
  paymentId: string;
  orderId: string;
  userId: string;
  amount: number;
  paymentMethod: string;
  status: 'approved' | 'rejected';
  transactionId: string | null;
  rejectionReason: string | null;
  processedAt: string;
}
```

Todos os campos são obrigatórios. Os campos anuláveis devem estar presentes como `null` quando não forem aplicáveis, `processedAt` deve ser uma data ISO 8601 válida e o status deve ser exclusivamente `approved` ou `rejected`.

### RF-10: Consumer do resultado

O `EventsModule` deve declarar um consumer para a fila durável `payment_result_queue`, vinculada ao exchange tópico `payments` pela routing key `payment.result`.

A topologia de retorno deve incluir:

- fila principal `payment_result_queue`;
- fila de retry `payment_result_queue.retry`;
- dead-letter queue `payment_result_queue.dlq`;
- tentativas limitadas e ACK somente depois do processamento bem-sucedido.

Ao receber uma mensagem, o consumer deve validar o contrato e encaminhá-lo a uma operação de domínio responsável por atualizar o pedido. Falhas de validação ou processamento devem ser propagadas para retry e, depois do limite, DLQ.

### RF-11: Atualizar o status do pedido

A atualização deve ser transacional e seguir esta sequência:

1. Localizar o pedido pelo `orderId` recebido.
2. Confirmar que `userId`, `amount` e `paymentMethod` correspondem exatamente ao pedido persistido.
3. Alterar o pedido de `pending` para `paid` quando `status` for `approved`.
4. Alterar o pedido de `pending` para `failed` quando `status` for `rejected`.
5. Persistir o novo estado antes de permitir o ACK da mensagem.

Pedido inexistente ou divergência de usuário, valor ou método não deve criar nem modificar pedido e deve provocar retry/DLQ. O checkout não deve persistir dados financeiros do pagamento além do status correspondente do pedido.

---

## 7. Regras de negócio e consistência

### RN-01: Identidade e isolamento

Todas as operações devem derivar a identidade exclusivamente do usuário autenticado. Nenhum usuário pode finalizar carrinho, listar pedido ou consultar pedido pertencente a outro usuário.

### RN-02: Estado inicial do pedido

Todo pedido criado pelo checkout deve iniciar com status `pending`. A publicação da mensagem não autoriza o checkout a antecipar o resultado do pagamento.

### RN-03: Snapshot comercial

O pedido e a mensagem devem refletir o total e os itens armazenados no carrinho no momento de sua finalização. O checkout não deve reprecificar itens nem depender de nova consulta ao `products-service` para concluir esta operação.

### RN-04: Uma finalização por carrinho

Um carrinho pode originar no máximo um pedido. Requisições concorrentes não podem criar pedidos duplicados nem múltiplas publicações de checkout bem-sucedidas para o mesmo carrinho.

### RN-05: Tipagem obrigatória

Todas as funções, variáveis e parâmetros criados ou modificados para esta funcionalidade devem possuir tipos definidos. Os contratos de entrada, saída, identidade autenticada, pedido e mensagem de pagamento devem ser tipados e coerentes entre seus consumidores.

### RN-06: Limite do processamento assíncrono

O fluxo síncrono deve apenas registrar o pedido pendente e publicar a solicitação. A confirmação ou recusa não integra a resposta de `POST /cart/checkout`; ela é aplicada posteriormente pelo consumer do resultado.

### RN-07: Idempotência e estados terminais

Receber novamente o mesmo resultado para um pedido que já esteja no estado correspondente deve ser tratado como sucesso, sem nova alteração. Um resultado conflitante para pedido já terminal (`paid`, `failed` ou `cancelled`) não pode sobrescrever o estado e deve seguir retry/DLQ.

Somente pedidos `pending` podem transicionar em razão de `PaymentResultMessage`. Nenhuma mensagem de pagamento pode retirar um pedido de um estado terminal.

---

## 8. Respostas e erros esperados

| Operação | Status | Condição |
|---|---|---|
| `POST /cart/checkout` | `201 Created` | Pedido pendente criado, carrinho concluído e solicitação de pagamento encaminhada. |
| `POST /cart/checkout` | `400 Bad Request` | Payload ausente ou inválido, método não permitido ou campos adicionais. |
| `POST /cart/checkout` | `422 Unprocessable Entity` | Carrinho ativo inexistente, vazio ou com total inválido para finalização. |
| `POST /cart/checkout` | `503 Service Unavailable` | A solicitação não pôde ser aceita pela infraestrutura de mensageria. |
| `GET /orders` | `200 OK` | Lista de pedidos do usuário, inclusive quando vazia. |
| `GET /orders/:id` | `200 OK` | Pedido encontrado e pertencente ao usuário autenticado. |
| `GET /orders/:id` | `400 Bad Request` | O parâmetro `id` não é um UUID válido. |
| `GET /orders/:id` | `404 Not Found` | Pedido inexistente ou pertencente a outro usuário. |
| Qualquer endpoint desta spec | `401 Unauthorized` | JWT ausente, inválido ou expirado. |

---

## 9. Critérios de aceite

### CA-01: Validação do checkout

- [ ] `POST /cart/checkout` exige autenticação JWT.
- [ ] O endpoint aceita `paymentMethod` com os valores `credit_card`, `debit_card`, `pix` e `boleto`.
- [ ] Campo ausente, valor diferente dos quatro permitidos ou campo adicional retorna `400 Bad Request`.
- [ ] O usuário do checkout é obtido de `req.user.id` e não pode ser informado pelo cliente.
- [ ] Usuário sem carrinho ativo recebe `422 Unprocessable Entity`.
- [ ] Carrinho ativo sem itens ou com total inválido recebe `422 Unprocessable Entity`.
- [ ] Uma requisição recusada não cria pedido, não conclui carrinho e não publica mensagem.

### CA-02: Criação do pedido e conclusão do carrinho

- [ ] Um carrinho ativo, não vazio e com total positivo origina uma única `Order`.
- [ ] A ordem criada contém `userId`, `cartId`, `total` e `paymentMethod` correspondentes ao usuário, ao carrinho e à requisição válidos.
- [ ] A ordem é criada com status `pending`.
- [ ] O carrinho muda de `active` para `completed`.
- [ ] A criação da ordem e a conclusão do carrinho não permanecem parcialmente aplicadas em caso de falha de persistência.
- [ ] A resposta de sucesso é `201 Created`, contém os campos definidos no contrato e apresenta o total como número.
- [ ] Depois do checkout, `GET /cart` não retorna o carrinho concluído e as operações do carrinho ativo não o alteram.
- [ ] Tentativas sequenciais ou concorrentes não fazem o mesmo carrinho originar mais de um pedido.

### CA-03: Mensagem de pagamento

- [ ] Cada checkout bem-sucedido solicita uma única publicação por `publishPaymentOrder`.
- [ ] A publicação utiliza o contrato `PaymentOrderMessage` destinado ao exchange `payments` e à routing key `payment.order` já configurados.
- [ ] `orderId`, `userId`, `amount` e `paymentMethod` correspondem exatamente ao pedido criado.
- [ ] `items` possui um elemento para cada item do carrinho finalizado, com `productId`, `quantity` e `price` corretamente mapeados e tipados.
- [ ] `amount` e `items[].price` são números válidos, e `items[].quantity` é um inteiro positivo.
- [ ] A mensagem não contém token, credenciais ou dados sensíveis de pagamento.
- [ ] Falha de publicação não retorna `201 Created` e não altera o pedido para um status de resultado de pagamento.
- [ ] O endpoint não aguarda nem simula o processamento realizado pelo `payments-service`.

### CA-04: Listagem de pedidos

- [ ] `GET /orders` exige autenticação JWT.
- [ ] A resposta é `200 OK` e contém somente os pedidos do usuário autenticado.
- [ ] Pedidos com todos os status válidos podem constar da listagem.
- [ ] Os pedidos são ordenados por `createdAt` do mais recente para o mais antigo.
- [ ] Um usuário sem pedidos recebe um array vazio.
- [ ] Nenhum parâmetro fornecido pelo cliente permite listar pedidos de outro usuário.

### CA-05: Detalhe do pedido

- [ ] `GET /orders/:id` exige autenticação JWT.
- [ ] Um UUID válido de pedido pertencente ao usuário retorna `200 OK` com o pedido correto.
- [ ] Um UUID inexistente retorna `404 Not Found`.
- [ ] O UUID de um pedido de outro usuário retorna a mesma resposta `404 Not Found` e não revela sua existência.
- [ ] Um identificador inválido retorna `400 Bad Request`.

### CA-06: Módulos, tipagem e regressão

- [ ] O `OrdersModule` registra a persistência de `Order` e importa `CartModule` e `EventsModule`.
- [ ] Os componentes necessários à finalização e às consultas estão registrados e disponíveis nos limites dos respectivos módulos.
- [ ] Todas as funções, variáveis e parâmetros adicionados ou modificados estão tipados, sem introdução de `any` para contornar contratos.
- [ ] Os contratos de requisição, resposta e `PaymentOrderMessage` são validados por testes unitários e HTTP aplicáveis.
- [ ] O projeto compila sem erros de tipagem.
- [ ] Os testes existentes de carrinho, autenticação, entidades, health check e mensageria continuam passando.

### CA-07: Consumo do resultado do pagamento

- [ ] O checkout declara e consome `payment_result_queue` por meio de `payments:payment.result`.
- [ ] O consumer valida todos os campos de `PaymentResultMessage` e aceita somente `approved` ou `rejected`.
- [ ] O resultado é encaminhado à operação de domínio com tipagem explícita.
- [ ] A mensagem só recebe ACK depois da persistência bem-sucedida.
- [ ] Falhas de validação ou processamento seguem retry e chegam à `payment_result_queue.dlq` após o limite.

### CA-08: Atualização e idempotência do pedido

- [ ] `approved` altera um pedido `pending` para `paid`.
- [ ] `rejected` altera um pedido `pending` para `failed`.
- [ ] `orderId`, `userId`, `amount` e `paymentMethod` são validados contra o pedido persistido.
- [ ] Pedido inexistente ou payload divergente não altera dados.
- [ ] Repetir um resultado equivalente para um pedido já atualizado é um sucesso idempotente.
- [ ] Resultado conflitante não sobrescreve pedido terminal e segue retry/DLQ.
- [ ] `GET /orders/:id` passa a refletir o estado atualizado pelo consumer.
- [ ] Testes cobrem aprovação, rejeição, duplicata, conflito, divergência, pedido inexistente e falha de persistência.

---

## 10. Fora de escopo

- Processar, aprovar ou recusar pagamentos no `checkout-service`.
- Aguardar resposta síncrona do `payments-service` antes de responder ao checkout.
- Implementar cancelamento de pedido.
- Implementar verificação, reserva ou baixa de estoque.
- Reprecificar produtos durante o checkout.
- Implementar atualização manual do status do pedido por endpoints; a atualização ocorre exclusivamente pelo consumer.
- Implementar cupons, descontos, frete, impostos ou parcelamento.
- Alterar a topologia existente de solicitação `payment.order`; esta entrega adiciona somente o consumo de `payment.result` e suas filas.
- Alterar o `payments-service`, o `products-service` ou o `users-service`.
