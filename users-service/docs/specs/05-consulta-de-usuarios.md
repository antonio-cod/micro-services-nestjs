# SPEC: Consulta de usuários no users-service

**Serviço:** users-service  
**Escopo:** consulta de perfil, vendedores ativos e usuário por ID  
**Status:** Pendente  
**Criado em:** 2026-08-12

---

## 1. Objetivo

Disponibilizar as consultas essenciais de usuários necessárias ao funcionamento do marketplace: os dados atualizados do usuário autenticado, a relação de vendedores ativos e os dados de um usuário identificado por UUID.

Esta especificação cobre exclusivamente endpoints de leitura. Todos os endpoints definidos são protegidos pela autenticação JWT global já existente.

---

## 2. Requisitos funcionais

### RF-01: Consulta do perfil autenticado

O serviço deve disponibilizar o endpoint `GET /users/profile`.

O endpoint deve:

- Identificar o usuário pelo valor de `req.user.id`, proveniente do JWT validado.
- Consultar o banco de dados pelo ID identificado, garantindo que a resposta reflita os dados persistidos no momento da requisição e não apenas os dados contidos no token.
- Retornar status HTTP `200 OK` com os dados completos e atualizados do usuário autenticado.
- Nunca retornar o campo `password` nem o hash da senha.

### RF-02: Consulta de vendedores ativos

O serviço deve disponibilizar o endpoint `GET /users/sellers` para consumo pelo frontend e pelo `products-service`.

O endpoint deve:

- Consultar todos os usuários que atendam simultaneamente aos critérios `role` igual a `seller` e `status` igual a `active`.
- Retornar status HTTP `200 OK` com uma lista de usuários.
- Retornar uma lista vazia quando não existirem vendedores que atendam aos dois critérios.
- Não incluir usuários compradores, vendedores inativos ou qualquer usuário que não satisfaça ambos os critérios.
- Nunca retornar o campo `password` nem hashes de senha em qualquer item da lista.

### RF-03: Consulta de usuário por ID

O serviço deve disponibilizar o endpoint `GET /users/:id`.

O endpoint deve:

- Receber no parâmetro de rota `id` o UUID do usuário a ser consultado.
- Consultar o banco de dados pelo UUID informado.
- Retornar status HTTP `200 OK` com os dados do usuário encontrado, independentemente de seu papel ou status.
- Retornar status HTTP `404 Not Found` quando não existir usuário com o UUID informado.
- Nunca retornar o campo `password` nem o hash da senha.

### RF-04: Proteção dos endpoints

Os três endpoints desta especificação devem permanecer protegidos pelo `JwtAuthGuard` global.

- Nenhum deles deve ser público.
- Toda requisição deve exigir um JWT válido.
- Token ausente, inválido, expirado ou malformado deve resultar em `401 Unauthorized`, conforme o comportamento de autenticação já existente.
- Em uma falha de autenticação, a consulta não deve ser processada.

### RF-05: Componentes do módulo de usuários

O `UsersModule` deve disponibilizar as responsabilidades de consulta desta especificação por meio de:

- Um `UsersService` responsável pelas consultas de usuários.
- Um `UsersController` responsável pelos três endpoints definidos.
- Registro do controller e do service no `UsersModule`.

Não devem ser criados endpoints adicionais no módulo para atender a esta especificação.

### RF-06: Prioridade das rotas

As rotas estáticas devem ter prioridade sobre a rota dinâmica.

- `/users/profile` deve ser reconhecida como a consulta do perfil autenticado.
- `/users/sellers` deve ser reconhecida como a consulta de vendedores ativos.
- Nenhuma dessas rotas pode ser interpretada como `/users/:id`.
- No controller, as rotas estáticas `profile` e `sellers` devem ser declaradas antes da rota dinâmica `:id`.

---

## 3. Estrutura de dados de saída

### 3.1 Usuário

As respostas que representam um usuário devem conter:

| Campo | Tipo | Descrição |
|---|---|---|
| id | UUID | Identificador do usuário. |
| email | string | Email do usuário. |
| firstName | string | Nome do usuário. |
| lastName | string | Sobrenome do usuário. |
| role | string | Papel do usuário. |
| status | string | Status do usuário. |
| createdAt | data/hora | Data e hora de criação do usuário. |
| updatedAt | data/hora | Data e hora da última atualização do usuário. |

O campo `password` não deve estar presente em nenhuma resposta, inclusive com valor nulo, vazio ou indefinido.

### 3.2 Lista de vendedores

A resposta de `GET /users/sellers` deve ser uma lista. Cada item deve seguir a estrutura de usuário definida na seção 3.1 e representar exclusivamente um vendedor ativo.

---

## 4. Respostas esperadas

| Endpoint | Status HTTP | Condição | Resultado esperado |
|---|---:|---|---|
| `GET /users/profile` | 200 OK | JWT válido e usuário autenticado consultado pelo ID de `req.user`. | Dados atualizados do usuário, sem `password`. |
| `GET /users/sellers` | 200 OK | JWT válido. | Lista de vendedores ativos, possivelmente vazia, sem `password`. |
| `GET /users/:id` | 200 OK | JWT válido e usuário existente. | Dados do usuário identificado, sem `password`. |
| `GET /users/:id` | 404 Not Found | JWT válido e usuário inexistente. | Indicação de que o usuário não foi encontrado. |
| Todos | 401 Unauthorized | Token ausente, inválido, expirado ou malformado. | Requisição recusada pelo guard global antes da consulta. |

O status `404 Not Found` desta especificação aplica-se somente a `GET /users/:id`.

---

## 5. Critérios de aceite

### CA-01: Perfil do usuário autenticado

- [ ] Dado um JWT válido, `GET /users/profile` deve retornar `200 OK`.
- [ ] A busca deve usar `req.user.id` como identificador do usuário autenticado.
- [ ] Alterações persistidas no usuário após a emissão do token devem aparecer na resposta, comprovando que os dados foram consultados no banco.
- [ ] A resposta deve conter `id`, `email`, `firstName`, `lastName`, `role`, `status`, `createdAt` e `updatedAt`.
- [ ] A resposta não deve conter `password` nem o hash da senha.

### CA-02: Listagem de vendedores ativos

- [ ] Dado um JWT válido, `GET /users/sellers` deve retornar `200 OK` e uma lista.
- [ ] Todos os itens retornados devem possuir `role` igual a `seller` e `status` igual a `active`.
- [ ] Nenhum usuário com papel diferente de `seller` deve ser retornado.
- [ ] Nenhum usuário com status diferente de `active` deve ser retornado.
- [ ] Quando não houver vendedores ativos, a resposta deve ser uma lista vazia com status `200 OK`.
- [ ] Nenhum item deve conter `password` nem o hash da senha.

### CA-03: Consulta de usuário por ID

- [ ] Dado um JWT válido e o UUID de um usuário existente, `GET /users/:id` deve retornar `200 OK` com o usuário correspondente.
- [ ] A consulta deve poder retornar usuários de qualquer papel e status.
- [ ] A resposta deve conter `id`, `email`, `firstName`, `lastName`, `role`, `status`, `createdAt` e `updatedAt`.
- [ ] A resposta não deve conter `password` nem o hash da senha.
- [ ] Dado um UUID sem usuário correspondente, o endpoint deve retornar `404 Not Found`.

### CA-04: Autenticação obrigatória

- [ ] Cada um dos três endpoints deve retornar `401 Unauthorized` quando chamado sem token.
- [ ] Cada um dos três endpoints deve retornar `401 Unauthorized` quando chamado com token inválido, expirado ou malformado.
- [ ] Nenhum dos endpoints deve estar marcado como público.
- [ ] Uma requisição recusada pelo guard não deve executar a consulta correspondente.

### CA-05: Resolução correta das rotas

- [ ] `GET /users/profile` deve executar a consulta do usuário autenticado e não a consulta por ID.
- [ ] `GET /users/sellers` deve executar a listagem de vendedores ativos e não a consulta por ID.
- [ ] As rotas estáticas `profile` e `sellers` devem estar declaradas antes da rota dinâmica `:id` no controller.

### CA-06: Integração do módulo

- [ ] O `UsersService` deve conter as responsabilidades de consulta exigidas pelos três endpoints.
- [ ] O `UsersController` deve expor somente os três endpoints definidos nesta especificação.
- [ ] O controller e o service devem estar registrados no `UsersModule`.
- [ ] A inclusão das consultas não deve alterar o comportamento das rotas existentes de registro, login e autenticação JWT.

### CA-07: Confidencialidade das respostas

- [ ] O campo `password` não deve existir na resposta de sucesso de nenhum dos endpoints.
- [ ] O campo `password` não deve existir em nenhum item da lista de vendedores.
- [ ] Respostas de erro não devem expor senha, hash de senha, token, segredo JWT ou detalhes internos do banco de dados.

---

## 6. Fora de escopo

Não fazem parte desta especificação:

- Criação, atualização ou exclusão de usuários.
- Alteração de senha ou recuperação de senha.
- Listagem geral de usuários.
- Paginação, filtros adicionais, busca ou ordenação da lista de vendedores.
- Alteração de papel ou status de usuário.
- Autorização adicional baseada em papel para os endpoints.
- Mudanças nos fluxos de registro, login ou emissão e validação de JWT.
