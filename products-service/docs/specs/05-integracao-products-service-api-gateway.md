# SPEC: Integração do products-service com o api-gateway

**Serviços:** products-service e api-gateway  
**Escopo:** integração dos fluxos de criação e consulta de produtos via gateway  
**Status:** Pendente  
**Criado em:** 2026-08-13

---

## 1. Objetivo

Finalizar a integração entre o `products-service` e o `api-gateway`, garantindo que a criação e as consultas de produtos funcionem de ponta a ponta por meio do gateway.

Esta especificação complementa as funcionalidades já existentes nos dois serviços. O mecanismo atual de proxy, os guards, o circuit breaker e os demais recursos de infraestrutura do gateway devem ser preservados.

---

## 2. Contexto e premissas

- O `products-service` é executado na porta `3001`.
- A entidade `Product`, a autenticação JWT, a criação de produtos e os endpoints de consulta já estão implementados.
- `POST /products` é uma rota protegida e restrita a usuários vendedores.
- `GET /products`, `GET /products/:id` e `GET /products/seller/:sellerId` seguem os contratos de consulta já definidos pelo `products-service`.
- O `api-gateway` é executado na porta `3005` e já possui proxy com circuit breaker, health checks e Swagger.
- O gateway já possui infraestrutura para encaminhar requisições em `/products/*` ao `products-service`.
- A autenticação e a emissão do JWT são realizadas pelo `users-service` por meio das rotas de autenticação expostas no gateway.

---

## 3. Requisitos funcionais do products-service

### RF-PS-01: Health check

O `products-service` deve disponibilizar o endpoint `GET /health`.

O endpoint deve:

- Ser público e acessível sem autenticação.
- Retornar `200 OK` quando o serviço estiver disponível.
- Retornar um objeto com `status` igual a `ok` e `service` igual a `products-service`.
- Ser consumível pelo health check do `api-gateway`.

### RF-PS-02: Documentação Swagger/OpenAPI

O `products-service` deve disponibilizar documentação automática da API em `/api`.

A documentação deve:

- Apresentar o título `Products Service`.
- Apresentar a versão `1.0`.
- Oferecer suporte à autenticação Bearer.
- Incluir os endpoints públicos e protegidos expostos pelo serviço.
- Permitir identificar as operações que exigem um JWT.

---

## 4. Verificações funcionais do api-gateway

### RF-GW-01: Endereço do products-service

O `api-gateway` deve possuir a variável de ambiente `PRODUCTS_SERVICE_URL` configurada com o valor `http://localhost:3001` no ambiente local.

O gateway deve utilizar esse endereço como destino das requisições destinadas ao `products-service`.

### RF-GW-02: Encaminhamento das rotas de produtos

O proxy existente do `api-gateway` deve encaminhar corretamente as requisições em `/products` e `/products/*` para as rotas equivalentes do `products-service`.

O encaminhamento deve preservar, conforme aplicável:

- O método HTTP.
- Os parâmetros de rota.
- Os parâmetros de consulta.
- O corpo da requisição.
- O status HTTP e os dados relevantes da resposta do `products-service`.

### RF-GW-03: Propagação da autenticação

O `api-gateway` deve repassar ao `products-service` o header `Authorization` recebido nas requisições encaminhadas.

O token Bearer apresentado ao gateway deve chegar ao `products-service` sem alteração. A ausência do header não deve ser ocultada nem substituída por credenciais geradas pelo gateway.

### RF-GW-04: Preservação da infraestrutura existente

A integração deve utilizar o mecanismo de proxy e os guards já existentes no `api-gateway`.

O funcionamento existente do proxy, circuit breaker, autenticação, health checks e Swagger do gateway não deve ser substituído, reimplementado ou ter seu contrato alterado para atender a esta especificação.

---

## 5. Fluxo completo esperado via gateway

Todo o fluxo desta seção deve ser executado pelo cliente por meio do `api-gateway` na porta `3005`.

### FL-01: Login de vendedor

1. O cliente envia `POST /auth/login` ao gateway com credenciais válidas de um usuário vendedor.
2. O gateway encaminha a requisição ao `users-service`.
3. O `users-service` autentica o vendedor e emite o JWT conforme o contrato existente.
4. O cliente recebe o JWT por meio do gateway.

### FL-02: Criação de produto

1. O cliente envia `POST /products` ao gateway com os dados válidos do produto e o JWT obtido no login.
2. O gateway encaminha ao `products-service` o corpo da requisição e o header `Authorization` original.
3. O `products-service` autentica e autoriza o vendedor conforme as regras existentes.
4. O `products-service` cria o produto conforme seu contrato atual.
5. O cliente recebe por meio do gateway a resposta da criação, com o status HTTP e os dados esperados.

### FL-03: Listagem do catálogo

1. O cliente envia `GET /products` ao gateway.
2. O gateway encaminha a requisição ao `products-service`.
3. O `products-service` retorna o catálogo conforme o contrato de consulta existente.
4. O cliente recebe a lista de produtos por meio do gateway.

### FL-04: Consulta de produto por ID

1. O cliente envia `GET /products/:id` ao gateway, utilizando o identificador de um produto existente.
2. O gateway encaminha a requisição ao `products-service`, preservando o parâmetro da rota.
3. O `products-service` retorna o produto conforme o contrato de consulta existente.
4. O cliente recebe os dados do produto por meio do gateway.

---

## 6. Respostas e comportamentos esperados

| Operação via gateway | Condição | Resultado esperado |
|---|---|---|
| `POST /auth/login` | Credenciais válidas de vendedor | JWT emitido pelo `users-service` e entregue pelo gateway. |
| `POST /products` | Dados válidos e JWT de vendedor | Produto criado pelo `products-service` e resposta entregue pelo gateway. |
| `POST /products` | Token ausente, inválido, expirado ou malformado | `401 Unauthorized`, sem criação do produto. |
| `POST /products` | JWT válido de usuário sem permissão de vendedor | Acesso recusado conforme a regra de autorização existente. |
| `GET /products` | Consulta válida | Catálogo retornado pelo `products-service` por meio do gateway. |
| `GET /products/:id` | Produto existente | Produto correspondente retornado por meio do gateway. |
| `GET /products/:id` | Produto inexistente | `404 Not Found` propagado ao cliente. |
| Rota destinada ao `products-service` | Serviço indisponível ou falha de comunicação | Resposta de indisponibilidade conforme o comportamento já existente do proxy do gateway. |

---

## 7. Critérios de aceite

### CA-01: Health check do products-service

- [ ] `GET /health` deve ser acessível sem token.
- [ ] Quando o serviço estiver disponível, o endpoint deve retornar `200 OK`.
- [ ] A resposta deve conter `status` igual a `ok` e `service` igual a `products-service`.
- [ ] O health check do gateway deve conseguir consultar o endpoint utilizando a URL configurada para o serviço.

### CA-02: Swagger do products-service

- [ ] A documentação deve estar acessível em `/api`.
- [ ] A documentação deve apresentar o título `Products Service` e a versão `1.0`.
- [ ] A documentação deve oferecer suporte a Bearer Auth.
- [ ] As rotas protegidas devem ser identificáveis como operações autenticadas.

### CA-03: Configuração e roteamento do gateway

- [ ] No ambiente local, `PRODUCTS_SERVICE_URL` deve possuir o valor `http://localhost:3001`.
- [ ] O gateway deve encaminhar `POST /products` ao `products-service`.
- [ ] O gateway deve encaminhar `GET /products` ao `products-service`.
- [ ] O gateway deve encaminhar `GET /products/:id` ao `products-service`.
- [ ] As demais rotas existentes sob `/products/*`, incluindo a consulta por vendedor, devem continuar sendo encaminhadas corretamente.
- [ ] O header `Authorization` deve ser preservado no encaminhamento.
- [ ] O proxy e os guards existentes no gateway devem continuar sendo utilizados sem alteração de seu funcionamento.

### CA-04: Login e criação de produto pelo gateway

- [ ] Um vendedor deve conseguir efetuar login por `POST /auth/login` na porta `3005`.
- [ ] O login válido deve retornar um JWT utilizável na criação de produto via gateway.
- [ ] Com esse JWT, o vendedor deve conseguir criar um produto por `POST /products` na porta `3005`.
- [ ] A requisição de criação deve chegar ao `products-service` com o header `Authorization` original.
- [ ] O produto criado deve possuir um identificador que possa ser utilizado nas consultas subsequentes.

### CA-05: Consultas de produto pelo gateway

- [ ] `GET /products` na porta `3005` deve retornar o catálogo conforme o contrato existente do `products-service`.
- [ ] O produto criado durante o fluxo deve aparecer na listagem quando atender aos critérios do catálogo.
- [ ] `GET /products/:id` na porta `3005` deve retornar o produto criado quando utilizado o seu identificador.
- [ ] A consulta de um identificador inexistente deve resultar em `404 Not Found` por meio do gateway.

### CA-06: Validação ponta a ponta

- [ ] O fluxo de login, criação, listagem e consulta por ID deve ser executável em sequência por `curl` ou Postman.
- [ ] Todas as requisições do cliente durante o fluxo devem utilizar a porta `3005`.
- [ ] Nenhuma etapa funcional do teste deve exigir acesso direto do cliente à porta `3001`.
- [ ] O JWT obtido pelo login via gateway deve ser reutilizável na criação do produto no mesmo fluxo.
- [ ] O produto criado via gateway deve ser recuperável pela listagem e pela consulta por ID também via gateway.
- [ ] Falhas de autenticação, autorização, produto inexistente e indisponibilidade do serviço devem produzir respostas coerentes com os contratos já existentes.

### CA-07: Regressão e preservação da infraestrutura

- [ ] Os fluxos diretos já existentes no `products-service` devem continuar funcionando.
- [ ] Os health checks e a documentação já existentes no `api-gateway` devem continuar funcionando.
- [ ] A proteção de `POST /products` e o acesso público às consultas devem permanecer inalterados.
- [ ] O mecanismo de proxy, os guards e o circuit breaker do gateway não devem ser alterados.

---

## 8. Fora de escopo

Não fazem parte desta especificação:

- Alterações no mecanismo de proxy do `api-gateway`.
- Alterações ou substituição dos guards existentes no `api-gateway`.
- Mudanças nos contratos existentes de autenticação, criação ou consulta de produtos.
- Criação de novas regras de autenticação ou autorização.
- Atualização, exclusão ou desativação de produtos.
- Paginação, filtros adicionais, busca, categorias ou gerenciamento de imagens.
- Alterações no circuit breaker, retry, timeout, health checks ou Swagger do `api-gateway`.
