# SPEC: Criação de produto

**Serviço:** products-service  
**Porta:** 3001  
**Escopo:** cadastro de produtos por usuários vendedores autenticados  
**Status:** Pendente  
**Criado em:** 2026-08-13

---

## 1. Objetivo

Permitir que um usuário autenticado com role `seller` cadastre um produto no `products-service`, associando o novo registro à sua própria identidade obtida do token JWT.

O cadastro deve aceitar somente os dados comerciais definidos nesta especificação. A identidade do vendedor e o estado inicial do produto devem ser determinados automaticamente pelo serviço.

---

## 2. Contexto e premissas

- O `products-service` possui scaffold NestJS e utiliza PostgreSQL na porta 5434.
- A entidade `Product` já existe com os campos `id`, `name`, `description`, `price`, `stock`, `sellerId`, `isActive`, `createdAt` e `updatedAt`.
- A autenticação JWT é global e disponibiliza em `req.user` os campos `id`, `email` e `role` para tokens válidos.
- O endpoint de criação é protegido e não deve ser marcado como público.
- Os valores válidos de role neste contexto são `seller` e `buyer`.
- Esta especificação abrange somente a criação de um produto.

---

## 3. Requisitos funcionais

### RF-01: Componentes de produtos

O domínio de produtos deve possuir um `ProductsController` para receber a requisição de criação e um `ProductsService` responsável pelo caso de uso de cadastro.

Ambos devem estar registrados no `ProductsModule`, que deve continuar disponibilizando o acesso à entidade `Product`.

### RF-02: Endpoint de criação

O serviço deve disponibilizar o endpoint protegido `POST /products`.

O endpoint deve receber os dados válidos do produto, cadastrar um novo registro no banco de dados e responder com status `201 Created` e o produto criado.

### RF-03: Identificação do vendedor

O `sellerId` do novo produto deve ser obtido exclusivamente de `req.user.id`.

O campo `sellerId` não deve fazer parte do corpo aceito pela requisição. O cliente não pode escolher, substituir ou sobrescrever a identidade do vendedor, ainda que envie esse campo no body.

### RF-04: Autorização para criação

Antes do cadastro, o serviço deve verificar a role presente em `req.user.role`.

- Usuários com role `seller` podem criar produtos.
- Usuários com role `buyer` devem receber `403 Forbidden`.
- Uma tentativa proibida não deve criar nem alterar registros no banco de dados.

A autenticação inválida ou ausente continua sob responsabilidade da proteção JWT global e deve resultar em `401 Unauthorized`.

### RF-05: Estado inicial do produto

Todo produto criado por este endpoint deve possuir `isActive` igual a `true`.

O campo `isActive` não deve fazer parte do corpo aceito pela requisição e não pode ser definido ou sobrescrito pelo cliente.

### RF-06: Validação da entrada

O corpo da requisição deve ser validado integralmente antes da criação do produto, de acordo com o contrato desta especificação.

Quando um ou mais campos forem inválidos:

- A resposta deve ser `400 Bad Request`.
- Nenhum produto deve ser persistido.
- A resposta deve identificar de forma clara os campos inválidos e as respectivas restrições não atendidas.
- Campos não previstos no contrato, incluindo `sellerId` e `isActive`, devem tornar a requisição inválida em conformidade com a validação global do serviço.

### RF-07: Persistência e retorno

Após a validação e autorização bem-sucedidas, o produto deve ser persistido com:

- Os dados comerciais recebidos no corpo.
- `sellerId` igual ao ID do usuário autenticado.
- `isActive` igual a `true`.
- Identificador e datas de criação e atualização gerados conforme a entidade existente.

A resposta de sucesso deve representar o registro efetivamente criado, incluindo os valores definidos automaticamente pelo serviço.

---

## 4. Contrato de entrada

O body de `POST /products` deve aceitar exclusivamente os seguintes campos:

| Campo | Tipo | Obrigatoriedade | Restrições |
|---|---|---|---|
| `name` | string | Obrigatório | Deve possuir conteúdo e ter no máximo 255 caracteres. |
| `description` | string | Obrigatório | Deve possuir conteúdo; texto livre. |
| `price` | número decimal | Obrigatório | Valor mínimo de `0.01` e no máximo 2 casas decimais. |
| `stock` | número inteiro | Obrigatório | Valor mínimo de `0`. |

As seguintes condições devem ser consideradas inválidas:

- Campo obrigatório ausente, nulo ou vazio.
- `name` com mais de 255 caracteres.
- `price` que não seja numérico, seja menor que `0.01` ou possua mais de 2 casas decimais.
- `stock` que não seja inteiro ou seja negativo.
- Presença de qualquer campo não definido no contrato.

`sellerId` e `isActive` não pertencem ao contrato de entrada.

---

## 5. Respostas esperadas

| Status | Condição | Resultado esperado |
|---|---|---|
| `201 Created` | Usuário `seller` autenticado e body válido. | Produto persistido e retornado com `sellerId` do token e `isActive` igual a `true`. |
| `400 Bad Request` | Um ou mais dados de entrada são inválidos ou existem campos não permitidos. | Erros claros por campo e nenhum produto criado. |
| `401 Unauthorized` | Token ausente, inválido, expirado ou malformado. | Requisição recusada pela autenticação e nenhum produto criado. |
| `403 Forbidden` | Usuário autenticado possui role diferente de `seller`, incluindo `buyer`. | Criação recusada e nenhum produto criado. |

---

## 6. Fluxo funcional

1. Um cliente envia uma requisição para `POST /products`.
2. A proteção JWT global valida o token e disponibiliza o usuário autenticado.
3. A entrada é validada conforme o contrato de criação.
4. A role do usuário autenticado é verificada.
5. Se o usuário não for `seller`, a requisição é encerrada com `403 Forbidden` sem persistência.
6. O produto recebe o `sellerId` de `req.user.id` e `isActive` igual a `true`.
7. O produto é persistido no banco de dados.
8. O serviço retorna `201 Created` com o produto criado.

---

## 7. Critérios de aceite

### CA-01: Estrutura do domínio

- [ ] O `ProductsController` e o `ProductsService` existem e estão registrados no `ProductsModule`.
- [ ] O módulo mantém a entidade `Product` disponível para o caso de uso de criação.
- [ ] O endpoint `POST /products` está disponível e protegido pela autenticação global.

### CA-02: Criação por seller

- [ ] Dado um token válido de um usuário com role `seller` e um body válido, a resposta é `201 Created`.
- [ ] Exatamente um novo produto é persistido no banco de dados.
- [ ] O produto retornado corresponde ao registro persistido.
- [ ] O produto possui identificador, `createdAt` e `updatedAt` preenchidos.

### CA-03: Associação segura ao vendedor

- [ ] O `sellerId` persistido é exatamente igual a `req.user.id` do token validado.
- [ ] O contrato de entrada não aceita `sellerId`.
- [ ] Uma tentativa de enviar `sellerId` no body retorna `400 Bad Request` e não cria produto.
- [ ] O cliente não consegue cadastrar um produto em nome de outro usuário.

### CA-04: Estado inicial

- [ ] Todo produto criado possui `isActive` igual a `true`.
- [ ] O contrato de entrada não aceita `isActive`.
- [ ] Uma tentativa de enviar `isActive` no body retorna `400 Bad Request` e não cria produto.

### CA-05: Restrição por role

- [ ] Um usuário autenticado com role `seller` pode criar um produto.
- [ ] Um usuário autenticado com role `buyer` recebe `403 Forbidden`.
- [ ] Uma role diferente de `seller` recebe `403 Forbidden`.
- [ ] Requisições recusadas com `403 Forbidden` não persistem produto.

### CA-06: Autenticação

- [ ] Uma requisição sem token retorna `401 Unauthorized`.
- [ ] Uma requisição com token inválido, expirado ou malformado retorna `401 Unauthorized`.
- [ ] Requisições recusadas com `401 Unauthorized` não alcançam a criação nem persistem produto.

### CA-07: Validação de name e description

- [ ] A ausência ou o valor vazio de `name` retorna `400 Bad Request` com indicação do campo.
- [ ] Um `name` com mais de 255 caracteres retorna `400 Bad Request` com indicação do limite.
- [ ] A ausência ou o valor vazio de `description` retorna `400 Bad Request` com indicação do campo.
- [ ] Nenhuma entrada inválida cria produto.

### CA-08: Validação de price

- [ ] A ausência de `price` retorna `400 Bad Request` com indicação do campo.
- [ ] Um `price` não numérico retorna `400 Bad Request`.
- [ ] Um `price` menor que `0.01` retorna `400 Bad Request`.
- [ ] Um `price` com mais de 2 casas decimais retorna `400 Bad Request`.
- [ ] Os valores `0.01` e números positivos com até 2 casas decimais são aceitos.

### CA-09: Validação de stock

- [ ] A ausência de `stock` retorna `400 Bad Request` com indicação do campo.
- [ ] Um `stock` não inteiro retorna `400 Bad Request`.
- [ ] Um `stock` negativo retorna `400 Bad Request`.
- [ ] O valor `0` e números inteiros positivos são aceitos.

### CA-10: Campos não permitidos e atomicidade

- [ ] Um body com qualquer campo não previsto retorna `400 Bad Request` e identifica a propriedade não permitida.
- [ ] Em toda resposta `400`, `401` ou `403`, a quantidade de produtos no banco permanece inalterada.

---

## 8. Fora de escopo

- Consulta ou listagem de produtos.
- Atualização de produtos.
- Exclusão ou desativação de produtos.
- Upload ou gerenciamento de imagens.
- Categorias de produtos.
- Implementação de um mecanismo genérico de autorização por roles para outras rotas.
- Alterações na autenticação JWT ou na emissão de tokens.
- Integração com outros microserviços.
