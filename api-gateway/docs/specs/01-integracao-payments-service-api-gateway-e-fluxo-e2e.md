# SPEC: Integração do payments-service ao api-gateway e fluxo E2E do marketplace

**Projeto:** marketplace-ms  
**Serviços afetados:** api-gateway e checkout-service  
**Escopo:** exposição da consulta de pagamentos pelo gateway, remoção de endpoint temporário e validação E2E do marketplace  
**Status:** Pendente  
**Criado em:** 2026-08-15

---

## 1. Objetivo

Completar a integração dos serviços do marketplace por meio do `api-gateway`, expondo a consulta de pagamentos do `payments-service` para clientes autenticados e validando o fluxo E2E desde o cadastro dos usuários até o processamento assíncrono do pagamento.

O cenário deve comprovar tanto a aprovação de uma compra com preço normal quanto a rejeição de uma compra cujo produto tenha preço terminado em `.99`, conforme o comportamento existente do gateway de pagamento falso. Também deve ser removido do `checkout-service` o endpoint temporário usado para publicar mensagens de teste.

Ao final, todas as operações de negócio executadas pelo cliente E2E devem passar exclusivamente pelo gateway na porta `3005`.

## 2. Contrato da rota de pagamentos

| Responsabilidade | Método | Rota no api-gateway | Destino no payments-service | Autenticação |
|---|---|---|---|---|
| Consultar pagamento de um pedido | GET | `/payments/:orderId` | `GET /payments/:orderId` | JWT obrigatório |

O identificador `orderId` deve ser preservado no encaminhamento. A resposta e o status HTTP fornecidos pelo `payments-service` devem permanecer compatíveis ao atravessar o gateway.

## 3. Requisitos funcionais do api-gateway

### RF-01: Disponibilizar o PaymentsModule

O `api-gateway` deve possuir um `PaymentsModule` responsável por agrupar a integração com o `payments-service`.

O módulo deve disponibilizar um `PaymentsProxyController`, responsável pela consulta do pagamento associado a um pedido.

### RF-02: Expor a consulta de pagamento

O `PaymentsProxyController` deve expor `GET /payments/:orderId` e encaminhar a consulta para `GET /payments/:orderId` do `payments-service`.

A rota deve:

- Exigir autenticação por JWT.
- Preservar o valor de `orderId` recebido.
- Repassar integralmente o header `Authorization` recebido pelo gateway.
- Identificar `payments` como o serviço de destino.
- Utilizar a configuração existente de pagamentos, com URL `http://localhost:3004` e timeout de `10000` ms.
- Preservar o contrato de resposta do serviço de destino.

Requisições sem JWT, com JWT inválido ou expirado devem ser rejeitadas pelo gateway e não devem chegar ao `payments-service`.

### RF-03: Registrar a integração na aplicação

O `PaymentsModule` deve ser registrado no `AppModule` do `api-gateway`, tornando a rota de consulta acessível quando o gateway for iniciado.

O registro deve preservar os módulos e as rotas existentes de autenticação, usuários, produtos, checkout e saúde.

### RF-04: Preservar a infraestrutura de proxy existente

A integração deve utilizar o contrato de proxy e as políticas de resiliência já existentes no gateway. Timeout, retry, circuit breaker e fallback aplicáveis ao destino `payments` devem continuar funcionando sem alteração de suas regras.

## 4. Limpeza do checkout-service

### RF-05: Remover o endpoint temporário de mensagens

O endpoint de teste `POST /test/send-message` deve ser removido do `AppController` do `checkout-service`.

Após a limpeza, a superfície básica da aplicação deve manter somente:

- `GET /`.
- `GET /health`.

A remoção deve abranger as dependências do `AppController` que existam exclusivamente para atender ao endpoint temporário, sem alterar a publicação de pagamentos realizada pelo fluxo real de checkout.

Nenhuma outra rota, regra de negócio ou integração do `checkout-service` deve ser modificada.

## 5. Teste E2E completo via gateway

Deve existir uma validação E2E reproduzível do marketplace com `users-service` na porta `3000`, `products-service` na porta `3001`, `checkout-service` na porta `3003`, `payments-service` na porta `3004`, RabbitMQ na porta `5672` e `api-gateway` na porta `3005`.

Todas as chamadas do cliente de teste devem ser direcionadas ao gateway. Os acessos diretos aos demais serviços são permitidos apenas para verificações técnicas de preparação ou diagnóstico, e não podem substituir nenhuma etapa funcional do cenário.

### Cenário 1: Preparação de usuários e produtos

1. Registrar um usuário vendedor.
2. Registrar um usuário comprador distinto.
3. Autenticar o vendedor e obter seu JWT.
4. Criar, como vendedor, um produto disponível com preço normal, que não termine em `.99`.
5. Criar, como vendedor, outro produto disponível cujo preço termine em `.99`.
6. Autenticar o comprador e obter seu JWT.

Os cadastros devem usar dados identificáveis por execução para que o teste possa ser repetido sem conflito com registros anteriores.

### Cenário 2: Compra com pagamento aprovado

1. Com o JWT do comprador, navegar pelo catálogo e confirmar que o produto de preço normal está disponível.
2. Adicionar o produto de preço normal ao carrinho.
3. Consultar o carrinho e confirmar o produto, a quantidade e o valor esperados.
4. Finalizar a compra.
5. Capturar o identificador do pedido criado.
6. Consultar o pedido pelo gateway e confirmar que ele corresponde ao checkout realizado.
7. Consultar o pagamento por `GET /payments/:orderId` até que o processamento assíncrono seja concluído, respeitando um limite de tempo definido para o teste.
8. Confirmar que o pagamento pertence ao pedido criado, contém os valores esperados e está com status aprovado.

### Cenário 3: Compra com pagamento rejeitado

1. Garantir que o carrinho do comprador esteja apto para uma nova compra e não contenha itens residuais do cenário aprovado.
2. Navegar pelo catálogo e confirmar que o produto com preço terminado em `.99` está disponível.
3. Adicionar esse produto ao carrinho.
4. Consultar o carrinho e confirmar o produto, a quantidade e o valor esperados.
5. Finalizar a compra.
6. Capturar o novo identificador de pedido e confirmar que ele é diferente do pedido aprovado.
7. Consultar o novo pedido pelo gateway e confirmar que ele corresponde ao segundo checkout.
8. Consultar o pagamento por `GET /payments/:orderId` até que o processamento assíncrono seja concluído, respeitando o limite de tempo do teste.
9. Confirmar que o pagamento pertence ao segundo pedido, contém os valores esperados e está com status rejeitado.

O teste deve considerar a natureza assíncrona da comunicação entre checkout e pagamentos. Uma ausência temporária do pagamento enquanto a mensagem ainda está sendo processada não deve ser confundida com o resultado final do cenário.

## 6. Critérios de aceite

### CA-01: Estrutura e registro no gateway

- [ ] O `api-gateway` possui um `PaymentsModule` registrado no `AppModule`.
- [ ] O módulo disponibiliza um `PaymentsProxyController`.
- [ ] `GET /payments/:orderId` está acessível pela porta `3005` com um JWT válido.
- [ ] Os módulos e rotas existentes de usuários, produtos e checkout continuam disponíveis sem regressões.

### CA-02: Segurança e encaminhamento

- [ ] A consulta de pagamento é rejeitada quando o JWT está ausente, inválido ou expirado.
- [ ] Requisições não autorizadas não são encaminhadas ao `payments-service`.
- [ ] O `orderId` e o header `Authorization` são preservados no encaminhamento.
- [ ] A chamada utiliza o destino `payments` configurado com porta `3004` e timeout de `10000` ms.
- [ ] O status HTTP e o corpo retornados pelo `payments-service` permanecem compatíveis por meio do gateway.
- [ ] As políticas existentes de timeout, retry, circuit breaker e fallback permanecem aplicáveis.

### CA-03: Limpeza do checkout-service

- [ ] `POST /test/send-message` não está mais disponível no `checkout-service`.
- [ ] O `AppController` não expõe mais a rota temporária, e o `checkout-service` mantém disponíveis `GET /` e `GET /health`.
- [ ] Dependências exclusivas do endpoint removido deixam de fazer parte do `AppController`.
- [ ] O checkout real continua publicando pedidos para processamento de pagamentos via RabbitMQ.
- [ ] Nenhum outro comportamento do `checkout-service` é alterado.

### CA-04: Fluxo E2E aprovado

- [ ] Seller e buyer distintos são registrados pelo gateway.
- [ ] O seller autenticado cria pelo gateway um produto de preço normal e outro com preço terminado em `.99`.
- [ ] O buyer autenticado consulta o catálogo, adiciona o produto normal ao carrinho e valida o conteúdo do carrinho pelo gateway.
- [ ] O checkout cria um pedido que pode ser consultado pelo gateway.
- [ ] O pagamento do pedido é processado pelo consumer e pode ser consultado pelo gateway.
- [ ] O pagamento do produto de preço normal termina com status aprovado e mantém associação e valores coerentes com o pedido.

### CA-05: Fluxo E2E rejeitado

- [ ] O segundo fluxo não reutiliza itens residuais do primeiro carrinho.
- [ ] O buyer adiciona o produto com preço terminado em `.99`, consulta o carrinho e realiza um novo checkout pelo gateway.
- [ ] Um segundo pedido, com identificador próprio, pode ser consultado pelo gateway.
- [ ] O pagamento do segundo pedido é processado pelo consumer e pode ser consultado pelo gateway.
- [ ] O pagamento do produto com preço terminado em `.99` termina com status rejeitado e mantém associação e valores coerentes com o segundo pedido.

### CA-06: Reprodutibilidade e qualidade

- [ ] O cliente E2E utiliza exclusivamente a porta `3005` em todas as etapas funcionais.
- [ ] O teste aguarda o processamento assíncrono com limite de tempo e falha de forma clara caso o pagamento não alcance o estado esperado.
- [ ] Os dados de teste permitem novas execuções sem depender de usuários, produtos, carrinhos, pedidos ou pagamentos residuais.
- [ ] Testes dos controllers comprovam destino, método, caminho, parâmetro e header de autorização da nova rota.
- [ ] As suítes de testes, lint e build de `api-gateway` e `checkout-service` passam sem regressões.
- [ ] O fluxo aprovado e o fluxo rejeitado são comprovados com todos os serviços e RabbitMQ ativos.

## 7. Fora de escopo

- Alterar entidade, persistência, consumer, regras de processamento, endpoint ou health check do `payments-service`.
- Alterar o `checkout-service` além da remoção de `POST /test/send-message` e de dependências do `AppController` exclusivas dessa rota.
- Implementar webhook ou qualquer outro mecanismo de atualização do status do pedido após o processamento do pagamento.
- Modificar a regra existente que aprova preços normais e rejeita preços terminados em `.99`.
- Criar novas rotas de pagamento além de `GET /payments/:orderId` no gateway.
- Alterar as URLs, portas ou timeouts já configurados para os serviços.
- Modificar contratos de autenticação, usuários, produtos, carrinho ou pedidos.
- Criar interface de usuário ou cliente visual para o marketplace.
