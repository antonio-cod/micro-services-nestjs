# SPEC: Integração do checkout-service ao api-gateway

**Projeto:** marketplace-ms  
**Serviços afetados:** api-gateway  
**Escopo:** exposição das rotas de carrinho e pedidos do checkout-service por meio do api-gateway  
**Status:** Pendente  
**Criado em:** 2026-08-15

---

## 1. Objetivo

Integrar as operações existentes de carrinho e pedidos do `checkout-service` ao `api-gateway`, permitindo que clientes autenticados realizem o fluxo completo de compra exclusivamente pela porta `3005` do gateway.

A integração deve reutilizar a autenticação JWT e o mecanismo de proxy já existentes. O gateway deve preservar os contratos HTTP oferecidos pelo `checkout-service`, encaminhar a identidade autenticada por meio do header `Authorization` e manter em funcionamento os comportamentos atuais de timeout, retry, circuit breaker e fallback aplicáveis ao serviço `checkout`.

## 2. Contrato das rotas expostas

| Responsabilidade | Método | Rota no api-gateway | Destino no checkout-service | Autenticação |
|---|---|---|---|---|
| Adicionar item ao carrinho | POST | `/cart/items` | `POST /cart/items` | JWT obrigatório |
| Consultar carrinho | GET | `/cart` | `GET /cart` | JWT obrigatório |
| Remover item do carrinho | DELETE | `/cart/items/:itemId` | `DELETE /cart/items/:itemId` | JWT obrigatório |
| Finalizar compra | POST | `/cart/checkout` | `POST /cart/checkout` | JWT obrigatório |
| Listar pedidos | GET | `/orders` | `GET /orders` | JWT obrigatório |
| Consultar pedido | GET | `/orders/:id` | `GET /orders/:id` | JWT obrigatório |

Os parâmetros de rota e os corpos das requisições devem chegar ao `checkout-service` sem alteração de significado ou formato. As respostas do serviço de destino, incluindo corpo e status HTTP, devem permanecer compatíveis com seu contrato atual.

## 3. Requisitos funcionais

### RF-01: Disponibilizar o CheckoutModule no gateway

O `api-gateway` deve possuir um `CheckoutModule` responsável por agrupar a integração com o `checkout-service`.

O módulo deve disponibilizar exatamente dois controllers de proxy:

- `CartProxyController`, responsável pelas operações de gerenciamento do carrinho.
- `OrdersProxyController`, responsável pela finalização da compra e pelas consultas de pedidos.

### RF-02: Expor as operações de carrinho

O `CartProxyController` deve atender sob o prefixo `/cart` e exigir autenticação por `JwtAuthGuard` em todas as suas operações.

Devem ser expostas:

- Adição de item por `POST /cart/items`, encaminhada para `POST /cart/items` do `checkout-service`.
- Consulta do carrinho por `GET /cart`, encaminhada para `GET /cart` do `checkout-service`.
- Remoção de item por `DELETE /cart/items/:itemId`, encaminhada para `DELETE /cart/items/:itemId` do `checkout-service`, preservando `itemId`.

### RF-03: Expor checkout e consultas de pedidos

O `OrdersProxyController` deve exigir autenticação por `JwtAuthGuard` em todas as suas operações.

Devem ser expostas:

- Finalização da compra por `POST /cart/checkout`, encaminhada para `POST /cart/checkout` do `checkout-service`.
- Listagem de pedidos por `GET /orders`, encaminhada para `GET /orders` do `checkout-service`.
- Consulta de um pedido por `GET /orders/:id`, encaminhada para `GET /orders/:id` do `checkout-service`, preservando `id`.

### RF-04: Encaminhar a autorização

Todas as seis operações devem repassar ao `checkout-service` o header `Authorization` recebido pelo gateway, preservando integralmente seu valor.

Requisições sem JWT, com JWT inválido ou expirado devem ser rejeitadas pelo gateway e não devem ser encaminhadas ao `checkout-service`.

### RF-05: Registrar a integração na aplicação

O `CheckoutModule` deve ser registrado no `AppModule` do `api-gateway`, tornando as seis rotas acessíveis quando o gateway for iniciado.

O registro não deve alterar nem remover os módulos e as rotas existentes de autenticação, usuários, produtos ou saúde.

### RF-06: Utilizar o contrato de proxy existente

Todos os encaminhamentos devem identificar `checkout` como serviço de destino e utilizar a configuração já existente para a porta `3003` e timeout de `10000` ms.

Os comportamentos existentes de circuit breaker, retry, timeout e fallback devem continuar sendo aplicados sem mudanças em suas regras ou implementações.

## 4. Teste E2E pelo gateway

Deve existir cobertura E2E do fluxo completo de compra, com todas as chamadas do cliente direcionadas ao `api-gateway` na porta `3005`:

1. Autenticar um usuário e obter um JWT válido.
2. Adicionar ao carrinho um produto válido e disponível.
3. Consultar o carrinho e confirmar a presença do item adicionado.
4. Finalizar a compra a partir do carrinho.
5. Listar os pedidos e confirmar a presença do pedido criado.
6. Consultar o pedido criado pelo identificador e validar sua correspondência com o resultado do checkout.

O mesmo JWT obtido no login deve ser enviado no header `Authorization` das etapas protegidas. O teste deve comprovar a integração real entre gateway e checkout, sem acessar diretamente a porta `3003` como cliente do fluxo.

Os dados usados no cenário devem permitir execução repetível e não depender de pedidos residuais de execuções anteriores.

## 5. Critérios de aceite

### CA-01: Estrutura e registro

- [ ] O `api-gateway` possui um `CheckoutModule` registrado no `AppModule`.
- [ ] O módulo disponibiliza `CartProxyController` e `OrdersProxyController`.
- [ ] As rotas de users-service e products-service continuam disponíveis sem regressões.

### CA-02: Rotas de carrinho

- [ ] `POST /cart/items` no gateway encaminha a requisição para a rota equivalente do `checkout-service` e preserva seu corpo.
- [ ] `GET /cart` no gateway retorna o carrinho do usuário autenticado.
- [ ] `DELETE /cart/items/:itemId` no gateway remove o item correspondente ao identificador informado.
- [ ] As três rotas de carrinho exigem JWT válido.

### CA-03: Rotas de checkout e pedidos

- [ ] `POST /cart/checkout` no gateway finaliza o carrinho do usuário autenticado por meio do `checkout-service`.
- [ ] `GET /orders` no gateway retorna os pedidos do usuário autenticado.
- [ ] `GET /orders/:id` no gateway retorna o pedido correspondente ao identificador informado.
- [ ] As três rotas de checkout e pedidos exigem JWT válido.

### CA-04: Propagação de autenticação e respostas

- [ ] Cada uma das seis rotas repassa integralmente o header `Authorization` ao `checkout-service`.
- [ ] Uma requisição sem token recebe resposta de não autorizado no gateway e não alcança o serviço de destino.
- [ ] Tokens inválidos ou expirados não permitem acesso às rotas.
- [ ] Status HTTP e corpos retornados pelo `checkout-service` permanecem compatíveis quando atravessam o gateway.

### CA-05: Resiliência e limites de escopo

- [ ] As chamadas utilizam o destino `checkout` já configurado no gateway.
- [ ] Timeout, retry, circuit breaker e fallback existentes continuam aplicáveis à integração.
- [ ] Nenhuma alteração é feita no mecanismo de proxy existente.
- [ ] Nenhuma alteração é feita no `checkout-service`.
- [ ] Nenhuma rota de payments é criada ou exposta.

### CA-06: Validação automatizada

- [ ] Testes dos controllers comprovam o destino, método, caminho, payload, parâmetro de rota e header de autorização esperados para cada operação.
- [ ] O teste E2E executa com sucesso a sequência login, adição ao carrinho, consulta do carrinho, checkout, listagem de pedidos e consulta do pedido.
- [ ] Durante o teste E2E, o cliente utiliza apenas a porta `3005` para as chamadas da API.
- [ ] Build, lint e suíte de testes do `api-gateway` passam sem regressões.

## 6. Fora de escopo

- Criar, alterar ou expor rotas de pagamentos.
- Alterar endpoints, regras de negócio, entidades, DTOs, persistência ou autenticação do `checkout-service`.
- Modificar a implementação ou as políticas do `ProxyService`, circuit breaker, retry, timeout ou fallback.
- Alterar a URL ou o timeout de `checkout` já definidos na configuração do gateway.
- Criar novas regras de autenticação ou modificar o `JwtAuthGuard`.
- Alterar contratos ou rotas dos serviços de usuários e produtos.
- Implementar interface de usuário ou qualquer cliente de checkout.
