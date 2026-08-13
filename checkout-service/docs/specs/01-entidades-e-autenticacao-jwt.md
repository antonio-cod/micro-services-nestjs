# SPEC: Entidades de checkout e autenticação JWT

**Serviço:** checkout-service  
**Porta:** 3003  
**Escopo:** modelo de persistência, autenticação global, health check e documentação Swagger  
**Status:** Pendente  
**Criado em:** 2026-08-13

---

## 1. Objetivo

Preparar a fundação de domínio e de segurança do `checkout-service` mediante a criação das entidades de carrinho, item de carrinho e pedido, o registro dos respectivos módulos de persistência e a validação global dos tokens JWT emitidos pelo `users-service`.

A entrega também deve disponibilizar um health check público e a documentação Swagger básica do serviço. Não faz parte deste escopo criar operações de carrinho ou pedido, nem alterar a integração existente com RabbitMQ.

---

## 2. Contexto e premissas

- O `checkout-service` é uma aplicação NestJS disponível na porta `3003`.
- O serviço utiliza um banco PostgreSQL próprio, exposto localmente na porta `5436`.
- O TypeORM e sua conexão com o banco já estão configurados, mas nenhuma entidade de domínio está registrada atualmente.
- O `EventsModule` e o `PaymentQueueService` existentes são responsáveis pela integração com RabbitMQ e devem permanecer inalterados.
- O `users-service` é a única origem dos tokens de acesso e emite JWTs com as claims `sub`, `email` e `role`.
- A claim `sub` contém o UUID do usuário; `role` possui o valor `seller` ou `buyer`.
- O `checkout-service` deve validar tokens com o mesmo `JWT_SECRET` usado pelo `users-service`.
- A autenticação deve reproduzir o padrão já adotado pelo `products-service`: `AuthModule`, `JwtStrategy`, `JwtAuthGuard` global e decorator `@Public()`.
- As tabelas poderão ser materializadas pelo mecanismo de sincronização do TypeORM já configurado para ambientes não produtivos. A definição de migrations não integra esta especificação.

---

## 3. Modelo de domínio e persistência

### RF-01: Entidade Cart

O serviço deve possuir uma entidade TypeORM `Cart`, persistida como tabela do banco do `checkout-service`, com os seguintes campos e restrições:

| Campo | Tipo | Restrições |
|---|---|---|
| `id` | UUID | Chave primária gerada automaticamente. |
| `userId` | UUID | Obrigatório; referência lógica ao usuário do `users-service`, sem chave estrangeira entre serviços. |
| `status` | enum | Obrigatório; valores permitidos: `active`, `completed` e `abandoned`; padrão `active`. |
| `total` | decimal (10,2) | Obrigatório; padrão `0`. |
| `items` | relação | Relação um-para-muitos com `CartItem`, com carregamento eager e operações em cascata. |
| `createdAt` | timestamp | Preenchido automaticamente na criação. |
| `updatedAt` | timestamp | Atualizado automaticamente a cada alteração. |

O enum de status deve fazer parte do modelo de domínio e impedir a persistência de valores diferentes dos três estados definidos.

### RF-02: Entidade CartItem

O serviço deve possuir uma entidade TypeORM `CartItem`, persistida como tabela do banco do `checkout-service`, com os seguintes campos e restrições:

| Campo | Tipo | Restrições |
|---|---|---|
| `id` | UUID | Chave primária gerada automaticamente. |
| `cart` | relação | Relação muitos-para-um obrigatória com `Cart`; a exclusão do carrinho deve excluir seus itens. |
| `cartId` | UUID | Obrigatório; chave estrangeira correspondente ao carrinho relacionado. |
| `productId` | UUID | Obrigatório; referência lógica ao produto do `products-service`, sem chave estrangeira entre serviços. |
| `productName` | varchar (255) | Obrigatório. |
| `price` | decimal (10,2) | Obrigatório. |
| `quantity` | inteiro | Obrigatório; padrão `1`. |
| `subtotal` | decimal (10,2) | Obrigatório. |
| `createdAt` | timestamp | Preenchido automaticamente na criação. |

A associação entre `Cart` e `CartItem` deve usar `cartId` como chave estrangeira local e ser navegável nos dois sentidos.

### RF-03: Entidade Order

O serviço deve possuir uma entidade TypeORM `Order`, persistida como tabela do banco do `checkout-service`, com os seguintes campos e restrições:

| Campo | Tipo | Restrições |
|---|---|---|
| `id` | UUID | Chave primária gerada automaticamente. |
| `userId` | UUID | Obrigatório; referência lógica ao usuário do `users-service`, sem chave estrangeira entre serviços. |
| `cartId` | UUID | Obrigatório; identifica o carrinho que originou o pedido. |
| `total` | decimal (10,2) | Obrigatório. |
| `status` | enum | Obrigatório; valores permitidos: `pending`, `paid`, `failed` e `cancelled`; padrão `pending`. |
| `paymentMethod` | varchar (50) | Obrigatório. |
| `createdAt` | timestamp | Preenchido automaticamente na criação. |
| `updatedAt` | timestamp | Atualizado automaticamente a cada alteração. |

O enum de status deve fazer parte do modelo de domínio e impedir a persistência de valores diferentes dos quatro estados definidos. `cartId` representa a origem do pedido; esta especificação não exige uma associação TypeORM entre `Order` e `Cart`.

### RF-04: Módulo de carrinho

O serviço deve possuir um `CartModule` que registre `Cart` e `CartItem` no contexto do TypeORM por meio de `TypeOrmModule.forFeature`.

O módulo deve fornecer a base de persistência para funcionalidades futuras de carrinho, sem incluir controller, service ou endpoint nesta entrega.

### RF-05: Módulo de pedidos

O serviço deve possuir um `OrdersModule` que registre `Order` no contexto do TypeORM por meio de `TypeOrmModule.forFeature`.

O módulo deve fornecer a base de persistência para funcionalidades futuras de pedidos, sem incluir controller, service ou endpoint nesta entrega.

---

## 4. Autenticação JWT

### RF-06: Módulo de autenticação

O serviço deve possuir um `AuthModule` responsável pela validação de JWT e pela proteção global das rotas.

O módulo deve seguir o mesmo padrão funcional e a mesma separação de responsabilidades do `AuthModule` do `products-service`. Não deve possuir controller, endpoint de autenticação ou capacidade de emitir tokens.

### RF-07: Configuração do segredo compartilhado

O `checkout-service` deve obter o segredo de validação da variável de ambiente `JWT_SECRET`. O valor deve ser o mesmo utilizado pelo `users-service` na assinatura dos tokens.

A configuração não deve aceitar segredo ausente, vazio ou substituído silenciosamente por valor padrão. A variável deve permanecer declarada na configuração de ambiente de referência do serviço.

### RF-08: Estratégia JWT

O serviço deve possuir uma `JwtStrategy` equivalente à existente no `products-service`.

A estratégia deve:

- extrair o JWT exclusivamente do header `Authorization`, sob o esquema `Bearer`;
- validar assinatura e expiração com o `JWT_SECRET` compartilhado;
- aceitar o contrato de payload composto por `sub`, `email` e `role`;
- disponibilizar no contexto da requisição autenticada os campos `id`, `email` e `role`, com `id` correspondente a `sub`;
- não expor token, segredo, senha, hash ou outros dados sensíveis.

A validação deve ser local e não pode depender de chamada ao `users-service` ou de acesso ao banco de usuários.

### RF-09: Guard global e rotas públicas

O serviço deve possuir um `JwtAuthGuard` registrado como guard global por meio de `APP_GUARD`.

Como resultado, toda rota atual ou futura deve exigir um JWT válido por padrão. A autenticação somente poderá ser dispensada quando o controller ou a rota estiver explicitamente marcado com o decorator `@Public()`.

O decorator `@Public()` deve usar o metadata `isPublic` e ser reconhecido pelo guard tanto no nível do controller quanto no nível do método.

Uma rota protegida deve responder com `401 Unauthorized`, sem alcançar o controller, quando o token estiver ausente, malformado, expirado, sem o esquema `Bearer` ou assinado com segredo diferente.

Tokens válidos com role `seller` ou `buyer` devem passar pela autenticação. Regras de autorização por papel não fazem parte desta especificação.

---

## 5. Health check

### RF-10: Endpoint público de saúde

O serviço deve disponibilizar `GET /health` sem exigir autenticação.

Quando o processo estiver disponível, a rota deve responder com status HTTP `200` e corpo JSON contendo exatamente:

| Campo | Valor |
|---|---|
| `status` | `ok` |
| `service` | `checkout-service` |

A rota deve estar explicitamente identificada com `@Public()` para documentar e assegurar sua exceção à proteção global.

---

## 6. Swagger

### RF-11: Documentação básica da API

O `checkout-service` deve possuir a dependência oficial do Swagger para NestJS e inicializar sua documentação durante o bootstrap da aplicação.

A documentação deve:

- identificar a API como pertencente ao `checkout-service`;
- ser publicada no caminho `/api`;
- declarar autenticação Bearer JWT para uso nas futuras rotas protegidas;
- incluir o endpoint público de health check e sua resposta de sucesso;
- não introduzir endpoints adicionais apenas para fins de documentação.

---

## 7. Registro no AppModule

### RF-12: Composição da aplicação

O `AppModule` deve registrar `CartModule`, `OrdersModule`, `AuthModule` e o módulo responsável pelo health check, além dos módulos de configuração e TypeORM já existentes.

O `EventsModule` deve continuar registrado exatamente com sua responsabilidade atual. Nenhuma configuração, provider, contrato ou comportamento da integração RabbitMQ pode ser removido ou alterado por esta entrega.

---

## 8. Estrutura lógica esperada

Ao final da implementação, o código-fonte deve estar organizado nas áreas de responsabilidade abaixo:

- `auth`: módulo de autenticação, estratégia JWT, guard global e decorator de rota pública;
- `cart`: módulo e entidades `Cart` e `CartItem`;
- `orders`: módulo e entidade `Order`;
- `health`: módulo e controller do health check;
- configuração de Swagger integrada ao bootstrap;
- composição de todos esses módulos no `AppModule`.

Essa organização não determina detalhes internos de implementação além das responsabilidades e contratos desta especificação.

---

## 9. Critérios de aceite

### CA-01: Entidades e tabelas

- [ ] A inicialização do serviço com PostgreSQL disponível reconhece as entidades `Cart`, `CartItem` e `Order` sem erro de metadata do TypeORM.
- [ ] O banco contém tabelas correspondentes às três entidades, com os tipos, nulabilidade, tamanhos, precisão, escala e valores padrão definidos nesta spec.
- [ ] Os identificadores primários das três entidades são UUIDs gerados automaticamente.
- [ ] Os enums do carrinho e do pedido aceitam somente os valores especificados e aplicam respectivamente os padrões `active` e `pending`.
- [ ] `createdAt` é preenchido automaticamente nas três entidades.
- [ ] `updatedAt` é preenchido e atualizado automaticamente em `Cart` e `Order`.

### CA-02: Relacionamento de carrinho

- [ ] Um `Cart` pode possuir vários `CartItem`, e cada `CartItem` pertence a exatamente um `Cart` por meio de `cartId`.
- [ ] Ao carregar um carrinho, seus itens são carregados automaticamente.
- [ ] Operações persistidas no carrinho são propagadas aos itens conforme a configuração de cascade.
- [ ] Excluir um carrinho exclui do banco todos os seus itens associados.
- [ ] `productId` e `userId` permanecem referências lógicas, sem criação de chaves estrangeiras para bancos de outros microserviços.

### CA-03: Registro dos módulos de domínio

- [ ] `CartModule` registra `Cart` e `CartItem` com `TypeOrmModule.forFeature`.
- [ ] `OrdersModule` registra `Order` com `TypeOrmModule.forFeature`.
- [ ] Ambos os módulos estão importados pelo `AppModule`.
- [ ] Nenhum controller, service ou endpoint CRUD de carrinho ou pedido é criado nesta entrega.

### CA-04: Autenticação compartilhada

- [ ] O serviço possui `AuthModule`, `JwtStrategy`, `JwtAuthGuard` e decorator `@Public()` equivalentes ao padrão do `products-service`.
- [ ] O guard está registrado globalmente com `APP_GUARD` e toda rota sem metadata `isPublic` nasce protegida.
- [ ] Um token válido emitido pelo `users-service` permite alcançar uma rota protegida.
- [ ] Após a validação, o contexto autenticado contém `id`, `email` e `role` correspondentes a `sub`, `email` e `role` do token.
- [ ] Tokens válidos para `seller` e `buyer` são aceitos sem autorização adicional por papel.
- [ ] A validação não realiza chamadas ao `users-service` nem consulta o banco desse serviço.

### CA-05: Recusa de autenticação inválida

- [ ] Uma rota protegida retorna `401 Unauthorized` quando o header `Authorization` está ausente.
- [ ] Uma rota protegida retorna `401 Unauthorized` quando o esquema não é `Bearer` ou não há token após o esquema.
- [ ] Uma rota protegida retorna `401 Unauthorized` para token expirado, malformado ou com assinatura inválida.
- [ ] Um token assinado com segredo diferente do `JWT_SECRET` compartilhado retorna `401 Unauthorized`.
- [ ] Requisições recusadas pelo guard não alcançam o controller e não disponibilizam usuário autenticado.
- [ ] A aplicação considera inválida a configuração em que `JWT_SECRET` está ausente ou vazio.

### CA-06: Health check público

- [ ] `GET /health`, sem header de autenticação, retorna HTTP `200`.
- [ ] A resposta contém exatamente `status` igual a `ok` e `service` igual a `checkout-service`.
- [ ] O endpoint possui o metadata público reconhecido pelo guard global.
- [ ] Tornar o health check público não libera outras rotas protegidas.

### CA-07: Swagger

- [ ] A documentação Swagger está acessível em `/api` com o serviço em execução.
- [ ] A documentação identifica o `checkout-service` e declara o esquema Bearer JWT.
- [ ] O health check e sua resposta de sucesso aparecem na documentação.
- [ ] Nenhum endpoint artificial ou CRUD é criado para preencher a documentação.

### CA-08: Regressão e integração existente

- [ ] O `AppModule` registra os módulos de autenticação, carrinho, pedidos e health check sem remover os módulos existentes.
- [ ] O `EventsModule`, seus providers e seus contratos permanecem inalterados.
- [ ] A configuração e o comportamento existentes de RabbitMQ continuam funcionais após a implementação.
- [ ] O projeto compila e os testes automatizados aplicáveis passam.

---

## 10. Fora de escopo

- Endpoints CRUD ou qualquer operação HTTP de carrinho, itens ou pedidos.
- Services, DTOs e regras de negócio para adicionar, remover ou atualizar itens.
- Cálculo automático de `subtotal` ou `total`.
- Fluxo de checkout, criação de pedido e processamento de pagamento.
- Publicação ou consumo de novos eventos RabbitMQ.
- Qualquer alteração no `EventsModule` ou no `PaymentQueueService` existente.
- Login, cadastro, emissão, renovação ou revogação de JWT.
- Refresh tokens, sessões e autorização baseada em roles.
- Chamadas ao `users-service` para revalidar tokens ou usuários.
- Chamadas ao `products-service` para validar ou enriquecer produtos.
- Migrations de banco de dados e estratégia de implantação em produção.
