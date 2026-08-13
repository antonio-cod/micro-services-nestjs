# SPEC: Gerenciamento do carrinho

**Serviço:** checkout-service  
**Porta:** 3003  
**Escopo:** consulta do carrinho ativo, adição e remoção de itens  
**Status:** Pendente  
**Criado em:** 2026-08-13

---

## 1. Objetivo

Implementar o gerenciamento do carrinho de compras no `checkout-service`, permitindo que usuários autenticados consultem seu carrinho ativo, adicionem produtos válidos e removam itens.

O serviço deve consultar o `products-service` ao adicionar um produto, armazenar um snapshot dos dados comerciais necessários e manter os valores do item e do carrinho consistentes. Esta entrega não abrange finalização do carrinho, criação de pedido ou processamento de pagamento.

---

## 2. Contexto e premissas

- O `checkout-service` utiliza NestJS, PostgreSQL e TypeORM.
- As entidades `Cart`, `CartItem` e `Order` e os módulos de carrinho e pedidos já existem.
- `Cart` possui os estados `active`, `completed` e `abandoned`.
- As rotas são protegidas por padrão pelo guard JWT global.
- Após autenticação, `req.user` contém `id`, `email` e `role`.
- Tanto usuários `seller` quanto `buyer` podem manter um carrinho.
- O `products-service` está disponível pela URL definida em `PRODUCTS_SERVICE_URL` e expõe publicamente `GET /products/:id`.
- A consulta de produto retorna, entre outros dados, `id`, `name`, `price`, `stock`, `isActive` e `sellerId`.
- Cada usuário pode possuir no máximo um carrinho no estado `active`.
- Valores monetários expostos pela API devem ser números, mesmo quando o driver do banco representar colunas decimais internamente como strings.

---

## 3. Integração com o products-service

### RF-01: Cliente de produtos

O `checkout-service` deve possuir um `ProductsClientService` responsável exclusivamente pela comunicação HTTP necessária com o `products-service`.

O cliente deve:

- utilizar o `HttpModule` fornecido por `@nestjs/axios`;
- obter a URL base por meio da variável de ambiente `PRODUCTS_SERVICE_URL`;
- rejeitar configuração em que a URL esteja ausente ou vazia;
- disponibilizar a operação `getProduct(productId)`;
- consultar `GET /products/:id` com o UUID recebido;
- retornar ao domínio do carrinho os dados do produto necessários para validação e criação do snapshot;
- não acessar diretamente o banco de dados do `products-service`.

Quando o `products-service` responder que o produto não existe, o checkout deve tratar o produto como não encontrado. Falhas de comunicação ou indisponibilidade do serviço externo devem ser diferenciadas de produto inexistente e informadas como indisponibilidade temporária da dependência.

### RF-02: Contrato do produto consultado

Para esta funcionalidade, o cliente deve reconhecer ao menos os seguintes campos da resposta do produto:

| Campo | Tipo esperado | Uso no carrinho |
|---|---|---|
| `id` | UUID | Identificação do produto. |
| `name` | string | Snapshot do nome em `CartItem`. |
| `price` | decimal | Snapshot do preço e cálculo do subtotal. |
| `stock` | inteiro | Informação recebida, sem reserva ou validação de estoque nesta entrega. |
| `isActive` | boolean | Determina se o produto pode ser adicionado. |
| `sellerId` | UUID | Informação de catálogo, sem regra adicional nesta entrega. |

O preço recebido deve ser normalizado como valor monetário válido antes de participar de cálculos ou ser persistido.

---

## 4. Adição de item

### RF-03: Endpoint para adicionar item

O serviço deve disponibilizar o endpoint protegido `POST /cart/items`.

A requisição deve aceitar exclusivamente:

| Campo | Tipo | Validação |
|---|---|---|
| `productId` | UUID | Obrigatório e em formato UUID válido. |
| `quantity` | inteiro | Obrigatório e maior ou igual a `1`. |

Campos adicionais devem ser rejeitados pela validação global já configurada no serviço.

O usuário do carrinho deve ser obtido exclusivamente de `req.user.id`. A requisição não pode aceitar `userId`, preço, nome, subtotal ou total fornecidos pelo cliente.

### RF-04: Validação do produto

Antes de adicionar ou incrementar um item, o serviço deve consultar o produto por meio do `ProductsClientService`.

A adição deve ser recusada quando:

- o produto não existir;
- o produto possuir `isActive` diferente de `true`;
- os dados essenciais retornados pelo catálogo forem inválidos ou insuficientes para identificar e precificar o produto.

Esta entrega não deve reservar estoque nem recusar a operação com base em `stock`. A validação e reserva de disponibilidade serão responsabilidades de um fluxo posterior.

### RF-05: Obtenção ou criação do carrinho ativo

Após validar o produto, o serviço deve localizar o carrinho `active` pertencente ao usuário autenticado.

- Se existir, o item deve ser incluído nesse carrinho.
- Se não existir, um novo carrinho `active` deve ser criado para o usuário.
- A operação deve preservar a regra de no máximo um carrinho ativo por usuário, inclusive diante de requisições concorrentes.
- Carrinhos `completed` ou `abandoned` não devem ser reutilizados nem alterados.

### RF-06: Inclusão de produto novo no carrinho

Quando o produto ainda não estiver entre os itens do carrinho ativo, deve ser criado um `CartItem` contendo:

- `productId` igual ao produto validado;
- `productName` igual ao nome retornado pelo catálogo;
- `price` igual ao preço retornado pelo catálogo;
- `quantity` igual à quantidade solicitada;
- `subtotal` igual ao preço multiplicado pela quantidade.

O nome e o preço devem constituir um snapshot do produto no momento da primeira adição ao carrinho. Alterações posteriores no catálogo não devem modificar automaticamente o item já armazenado.

### RF-07: Incremento de produto existente

Quando o carrinho ativo já possuir um item com o mesmo `productId`:

- não deve ser criada uma segunda linha para o mesmo produto;
- a quantidade solicitada deve ser somada à quantidade existente;
- o subtotal deve ser recalculado multiplicando o preço já armazenado no item pela nova quantidade total;
- o snapshot de `productName` e `price` existente deve ser preservado.

A consulta ao catálogo continua obrigatória para assegurar que o produto ainda existe e permanece ativo, mesmo quando já está no carrinho.

### RF-08: Atualização e resposta do carrinho

Após incluir ou incrementar um item, o total do carrinho deve ser recalculado como a soma dos subtotais de todos os seus itens.

A atualização do item e do total deve ser persistida como uma única operação consistente: não pode haver estado definitivo em que o item tenha sido salvo e o total permaneça desatualizado, ou o inverso.

O endpoint deve retornar `200 OK` com o carrinho ativo completo, incluindo todos os itens e o total atualizado.

---

## 5. Consulta do carrinho

### RF-09: Endpoint para consultar o carrinho

O serviço deve disponibilizar o endpoint protegido `GET /cart`.

Quando o usuário possuir um carrinho ativo, o endpoint deve retornar `200 OK` com o carrinho completo, seus itens e o total persistido.

Carrinhos `completed` ou `abandoned`, inclusive os pertencentes ao mesmo usuário, não devem ser retornados por essa consulta.

### RF-10: Representação de carrinho vazio

Quando o usuário não possuir carrinho ativo, `GET /cart` deve retornar `200 OK` com uma representação vazia contendo:

| Campo | Valor esperado |
|---|---|
| `id` | `null` |
| `userId` | ID do usuário autenticado |
| `status` | `active` |
| `items` | array vazio |
| `total` | `0` |
| `createdAt` | `null` |
| `updatedAt` | `null` |

A simples consulta não deve persistir um novo carrinho vazio. O carrinho deve ser criado somente quando o primeiro produto válido for adicionado.

---

## 6. Remoção de item

### RF-11: Endpoint para remover item

O serviço deve disponibilizar o endpoint protegido `DELETE /cart/items/:itemId`, em que `itemId` deve ser um UUID válido.

O endpoint deve:

- localizar o item exclusivamente dentro do carrinho `active` do usuário autenticado;
- remover o item quando ele pertencer a esse carrinho;
- recalcular o total como a soma dos subtotais restantes;
- persistir a remoção e a atualização do total de forma consistente;
- retornar `200 OK` com o carrinho atualizado.

Se o item removido for o último, o carrinho deve permanecer `active`, com `items` vazio e `total` igual a `0`.

Quando o item não existir, pertencer a outro usuário ou estiver em um carrinho não ativo, a resposta deve ser `404 Not Found`. A resposta não deve revelar se o identificador pertence a outro usuário.

---

## 7. Regras de negócio

### RN-01: Isolamento por usuário

Todas as consultas e alterações devem combinar o identificador do recurso com `req.user.id`. Um usuário nunca pode consultar, incrementar ou remover itens de carrinhos pertencentes a outro usuário.

O `userId` informado por payload, query string ou outro parâmetro não deve substituir a identidade autenticada.

### RN-02: Unicidade do carrinho ativo

Cada usuário pode possuir no máximo um carrinho com status `active`. A regra deve ser preservada tanto no fluxo normal quanto em adições concorrentes.

Carrinhos históricos com status `completed` ou `abandoned` podem coexistir para o mesmo usuário.

### RN-03: Unicidade de produto no carrinho

Um carrinho ativo deve possuir no máximo um `CartItem` para cada `productId`. Novas adições do mesmo produto incrementam a quantidade do item existente.

### RN-04: Snapshot do produto

`productName` e `price` pertencem ao snapshot registrado na primeira adição do produto ao carrinho. Consultas posteriores ao carrinho não devem depender do `products-service` e alterações no catálogo não devem reescrever automaticamente esse snapshot.

### RN-05: Consistência monetária

- O subtotal de cada item deve ser igual ao seu preço armazenado multiplicado pela quantidade.
- O total do carrinho deve ser igual à soma dos subtotais de todos os itens.
- Um carrinho sem itens deve possuir total igual a zero.
- Os cálculos devem respeitar duas casas decimais e não podem produzir `NaN`, infinito ou valores monetários negativos.

### RN-06: Papéis de usuário

Tokens válidos com role `seller` ou `buyer` devem poder utilizar todos os endpoints desta especificação. Nenhuma restrição adicional por papel deve ser introduzida.

---

## 8. Contrato das respostas

Um carrinho persistido retornado pelos três endpoints deve conter:

| Campo | Descrição |
|---|---|
| `id` | UUID do carrinho. |
| `userId` | UUID do usuário autenticado. |
| `status` | Sempre `active` nestes endpoints. |
| `total` | Soma numérica dos subtotais. |
| `items` | Lista completa dos itens do carrinho. |
| `createdAt` | Data de criação do carrinho. |
| `updatedAt` | Data da última atualização. |

Cada item retornado deve conter `id`, `cartId`, `productId`, `productName`, `price`, `quantity`, `subtotal` e `createdAt`. A propriedade de navegação interna `cart` não deve ser serializada dentro de cada item.

---

## 9. Respostas e erros esperados

| Operação | Status | Condição |
|---|---|---|
| `POST /cart/items` | `200 OK` | Produto válido incluído ou quantidade incrementada. |
| `POST /cart/items` | `400 Bad Request` | Payload inválido, UUID inválido, quantidade ausente, fracionária ou menor que 1. |
| `POST /cart/items` | `404 Not Found` | Produto não encontrado no catálogo. |
| `POST /cart/items` | `422 Unprocessable Entity` | Produto encontrado, mas inativo ou sem dados válidos para inclusão. |
| `POST /cart/items` | `503 Service Unavailable` | `products-service` indisponível ou inacessível. |
| `GET /cart` | `200 OK` | Carrinho ativo existente ou representação de carrinho vazio. |
| `DELETE /cart/items/:itemId` | `200 OK` | Item pertencente ao carrinho ativo removido. |
| `DELETE /cart/items/:itemId` | `400 Bad Request` | `itemId` não é um UUID válido. |
| `DELETE /cart/items/:itemId` | `404 Not Found` | Item ausente ou não pertencente ao carrinho ativo do usuário. |
| Qualquer endpoint da spec | `401 Unauthorized` | JWT ausente, inválido ou expirado. |

---

## 10. Critérios de aceite

### CA-01: Cliente do catálogo

- [ ] O `ProductsClientService` utiliza `HttpModule` e a URL definida em `PRODUCTS_SERVICE_URL`.
- [ ] `getProduct(productId)` consulta `GET /products/:id` com o UUID recebido.
- [ ] A inicialização ou utilização do cliente rejeita `PRODUCTS_SERVICE_URL` ausente ou vazia.
- [ ] A resposta válida do catálogo é convertida para o contrato esperado pelo domínio do carrinho.
- [ ] Preços recebidos como número ou representação decimal válida são normalizados corretamente.
- [ ] Um `404` do catálogo é tratado como produto não encontrado.
- [ ] Erros de rede e indisponibilidade do catálogo resultam em `503 Service Unavailable`.

### CA-02: Validação da adição

- [ ] `POST /cart/items` exige autenticação JWT.
- [ ] Tokens válidos de `seller` e `buyer` são aceitos.
- [ ] `productId` ausente ou inválido retorna `400 Bad Request`.
- [ ] `quantity` ausente, fracionária, igual a zero ou negativa retorna `400 Bad Request`.
- [ ] Campos não previstos no payload retornam `400 Bad Request`.
- [ ] O usuário do carrinho é obtido de `req.user.id`.
- [ ] Produto inexistente retorna `404 Not Found` e não altera o carrinho.
- [ ] Produto inativo retorna `422 Unprocessable Entity` e não altera o carrinho.
- [ ] Falha de comunicação com o catálogo retorna `503 Service Unavailable` e não altera o carrinho.

### CA-03: Criação do carrinho e primeiro item

- [ ] Ao adicionar um produto válido sem carrinho ativo existente, é criado um único carrinho `active` para o usuário.
- [ ] O novo item armazena `productId`, `productName` e `price` obtidos do catálogo.
- [ ] O novo item armazena a quantidade solicitada.
- [ ] O subtotal é igual ao preço multiplicado pela quantidade.
- [ ] O total do carrinho é igual ao subtotal do único item.
- [ ] A resposta é `200 OK` e contém o carrinho completo.

### CA-04: Adições subsequentes

- [ ] Adicionar um produto diferente cria outro item no mesmo carrinho ativo.
- [ ] O total passa a representar a soma de todos os subtotais.
- [ ] Adicionar novamente o mesmo produto não cria item duplicado.
- [ ] A quantidade solicitada é somada à quantidade existente.
- [ ] O subtotal é recalculado com o preço armazenado e a quantidade total.
- [ ] O snapshot existente de nome e preço é preservado.
- [ ] Carrinhos `completed` ou `abandoned` não são reutilizados.
- [ ] Adições concorrentes não criam mais de um carrinho ativo nem linhas duplicadas do mesmo produto.

### CA-05: Consulta do carrinho

- [ ] `GET /cart` exige autenticação JWT.
- [ ] Quando existe carrinho ativo, a resposta contém somente o carrinho do usuário autenticado.
- [ ] A resposta inclui todos os itens e o total numérico.
- [ ] Carrinhos não ativos não são retornados.
- [ ] Quando não existe carrinho ativo, a resposta possui os campos e valores definidos para o carrinho vazio.
- [ ] Consultar um carrinho inexistente não cria registro no banco.
- [ ] A consulta não chama o `products-service`.

### CA-06: Remoção de item

- [ ] `DELETE /cart/items/:itemId` exige autenticação JWT.
- [ ] Remover um item pertencente ao carrinho ativo retorna `200 OK` com os itens restantes.
- [ ] O total é recalculado após a remoção.
- [ ] Remover o último item mantém o carrinho ativo, com lista vazia e total zero.
- [ ] UUID inválido retorna `400 Bad Request`.
- [ ] Item inexistente, de outro usuário ou de carrinho não ativo retorna `404 Not Found`.
- [ ] Uma tentativa de remover item de outro usuário não altera nenhum registro nem revela sua existência.

### CA-07: Integridade e regressão

- [ ] Toda alteração de itens mantém subtotais e total consistentes após a persistência.
- [ ] Falhas durante uma alteração não deixam item e total parcialmente atualizados.
- [ ] O banco preserva no máximo um carrinho ativo por usuário.
- [ ] O banco preserva no máximo um item por produto dentro do mesmo carrinho.
- [ ] Nenhum endpoint de finalização, pedido ou alteração direta de quantidade é criado.
- [ ] A autenticação global, o health check, o Swagger e a integração RabbitMQ existentes continuam funcionando.
- [ ] O projeto compila e os testes unitários, de integração e HTTP aplicáveis passam.

---

## 11. Fora de escopo

- Finalização do carrinho ou checkout.
- Alteração do status do carrinho para `completed` ou `abandoned`.
- Criação, atualização ou cancelamento de pedidos.
- Publicação de mensagens para pagamento.
- Endpoint dedicado para alterar quantidade.
- Limpeza automática de carrinhos abandonados.
- Reserva, baixa ou validação de estoque disponível.
- Reprecificação automática de itens já adicionados.
- Cupons, descontos, frete, impostos ou outras composições de preço.
- Paginação dos itens do carrinho.
- Compartilhamento ou transferência de carrinho entre usuários.
- Alterações no `products-service`, `users-service`, `payments-service` ou nos contratos RabbitMQ existentes.
