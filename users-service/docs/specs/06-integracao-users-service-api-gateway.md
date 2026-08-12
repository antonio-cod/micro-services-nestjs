# SPEC: Integração do users-service com o api-gateway

**Serviços:** users-service e api-gateway  
**Escopo:** integração dos fluxos de autenticação e consulta de usuários via gateway  
**Status:** Pendente  
**Criado em:** 2026-08-12

---

## 1. Objetivo

Finalizar a integração entre o `users-service` e o `api-gateway`, garantindo que registro, login e consultas de usuários funcionem de ponta a ponta por meio do gateway.

Esta especificação complementa as funcionalidades já existentes nos dois serviços. O mecanismo atual de proxy, circuit breaker, retry, timeout e os guards do gateway devem ser preservados.

---

## 2. Requisitos funcionais do users-service

### RF-US-01: Validação do token

O `users-service` deve disponibilizar o endpoint `GET /auth/validate-token`.

O endpoint deve:

- Ser protegido e exigir um JWT válido.
- Retornar os dados do usuário autenticado extraídos do token validado.
- Retornar os campos `userId`, `email` e `role`.
- Retornar em `userId` o identificador do usuário autenticado.
- Ser consumível internamente pelo `api-gateway` para validação de tokens.
- Recusar com `401 Unauthorized` requisições sem token ou com token inválido, expirado ou malformado.
- Não retornar senha, hash de senha, segredo JWT ou o próprio token.

### RF-US-02: Health check

O `users-service` deve disponibilizar o endpoint público `GET /health`.

O endpoint deve:

- Ser acessível sem autenticação.
- Retornar status HTTP `200 OK` quando o serviço estiver disponível.
- Retornar um objeto com `status` igual a `ok` e `service` igual a `users-service`.
- Ser consumível pelo health check do `api-gateway`.

### RF-US-03: Documentação Swagger/OpenAPI

O `users-service` deve disponibilizar documentação automática da API em `/api`.

A documentação deve:

- Apresentar o título `Users Service`.
- Apresentar a versão `1.0`.
- Informar suporte à autenticação Bearer para as rotas protegidas.
- Incluir os endpoints públicos e protegidos expostos pelo serviço.
- Permitir identificar quais operações exigem um JWT.

---

## 3. Requisitos funcionais do api-gateway

### RF-GW-01: Endereço do users-service

O `api-gateway` deve possuir a variável de ambiente `USERS_SERVICE_URL` com o valor `http://localhost:3000` no ambiente local.

O gateway deve utilizar esse endereço como destino das requisições destinadas ao `users-service`.

### RF-GW-02: Encaminhamento das rotas

O proxy existente do `api-gateway` deve encaminhar corretamente:

- Requisições em `/auth/*` para as rotas equivalentes do `users-service`.
- Requisições em `/users/*` para as rotas equivalentes do `users-service`.
- O método HTTP, os parâmetros de rota, os parâmetros de consulta e o corpo recebidos, quando aplicáveis.
- A resposta do `users-service` ao cliente, preservando o status HTTP e os dados relevantes.

### RF-GW-03: Propagação da autenticação

O `api-gateway` deve repassar ao `users-service` o header `Authorization` recebido nas requisições encaminhadas.

O token Bearer apresentado ao gateway deve chegar ao `users-service` sem alteração. A ausência do header não deve ser ocultada nem substituída por credenciais geradas pelo gateway.

### RF-GW-04: Preservação da infraestrutura existente

A integração deve utilizar o mecanismo de proxy e os guards já existentes no `api-gateway`.

O comportamento existente de circuit breaker, retry, timeout, autenticação, health checks e Swagger do gateway não deve ser substituído ou reimplementado para atender a esta especificação.

---

## 4. Fluxos completos esperados via gateway

Todos os fluxos desta seção devem ser acessíveis pelo `api-gateway` na porta `3005`.

### FL-01: Registro de usuário

1. O cliente envia `POST /auth/register` ao gateway com dados válidos de um novo usuário.
2. O gateway encaminha a requisição ao `users-service`.
3. O `users-service` registra o usuário conforme o contrato já existente.
4. O cliente recebe por meio do gateway a resposta do registro, com o status HTTP e os dados esperados.

### FL-02: Login e obtenção de JWT

1. O cliente envia `POST /auth/login` ao gateway com credenciais válidas.
2. O gateway encaminha a requisição ao `users-service`.
3. O `users-service` autentica o usuário e emite o JWT conforme o contrato já existente.
4. O cliente recebe o token por meio do gateway.

### FL-03: Consulta do perfil autenticado

1. O cliente envia `GET /users/profile` ao gateway com o JWT obtido no login.
2. O gateway valida o token conforme o fluxo de autenticação já existente.
3. O gateway encaminha a requisição e o header `Authorization` ao `users-service`.
4. O `users-service` valida o JWT e retorna o perfil do usuário autenticado.
5. O cliente recebe o perfil por meio do gateway.

### FL-04: Consulta de vendedores

1. O cliente envia `GET /users/sellers` ao gateway com um JWT válido.
2. O gateway valida o token conforme o fluxo de autenticação já existente.
3. O gateway encaminha a requisição e o header `Authorization` ao `users-service`.
4. O `users-service` retorna a lista de vendedores ativos conforme o contrato já existente.
5. O cliente recebe a lista por meio do gateway.

---

## 5. Respostas e comportamentos esperados

| Operação via gateway | Condição | Resultado esperado |
|---|---|---|
| `POST /auth/register` | Dados válidos de novo usuário | Registro processado pelo `users-service` e resposta entregue pelo gateway. |
| `POST /auth/login` | Credenciais válidas | JWT emitido pelo `users-service` e entregue pelo gateway. |
| `GET /users/profile` | JWT válido | Perfil do usuário autenticado retornado pelo `users-service` por meio do gateway. |
| `GET /users/sellers` | JWT válido | Lista de vendedores ativos retornada pelo `users-service` por meio do gateway. |
| Rota protegida | Token ausente, inválido, expirado ou malformado | `401 Unauthorized`, sem acesso ao recurso protegido. |
| Rota destinada ao `users-service` | Serviço indisponível ou falha de comunicação | Resposta de indisponibilidade conforme o comportamento já existente do proxy do gateway. |

---

## 6. Critérios de aceite

### CA-01: Validação de token no users-service

- [ ] `GET /auth/validate-token` deve exigir autenticação JWT.
- [ ] Com um JWT válido, o endpoint deve retornar `userId`, `email` e `role` correspondentes ao usuário autenticado.
- [ ] Sem um JWT válido, o endpoint deve retornar `401 Unauthorized`.
- [ ] A resposta não deve expor dados sensíveis.
- [ ] O endpoint deve poder ser utilizado pelo fluxo de validação do `api-gateway`.

### CA-02: Health check do users-service

- [ ] `GET /health` deve ser acessível sem token.
- [ ] Quando o serviço estiver disponível, o endpoint deve retornar `200 OK`.
- [ ] A resposta deve conter `status` igual a `ok` e `service` igual a `users-service`.
- [ ] O health check do gateway deve conseguir consultar esse endpoint.

### CA-03: Swagger do users-service

- [ ] A documentação deve estar acessível em `/api`.
- [ ] A documentação deve apresentar o título `Users Service` e a versão `1.0`.
- [ ] A documentação deve oferecer suporte a Bearer Auth.
- [ ] As rotas protegidas devem ser identificáveis como operações autenticadas.

### CA-04: Configuração e roteamento do gateway

- [ ] No ambiente local, `USERS_SERVICE_URL` deve possuir o valor `http://localhost:3000`.
- [ ] O gateway deve encaminhar `/auth/*` ao `users-service`.
- [ ] O gateway deve encaminhar `/users/*` ao `users-service`.
- [ ] O header `Authorization` deve ser preservado no encaminhamento.
- [ ] Os mecanismos existentes de proxy e autenticação do gateway devem continuar sendo utilizados sem alteração de seu funcionamento.

### CA-05: Fluxo de registro e login pelo gateway

- [ ] Um usuário deve poder ser registrado por `POST /auth/register` na porta `3005`.
- [ ] O usuário registrado deve poder efetuar login por `POST /auth/login` na porta `3005`.
- [ ] O login válido deve retornar um JWT utilizável nas rotas protegidas via gateway.

### CA-06: Fluxo de consultas protegidas pelo gateway

- [ ] O JWT retornado pelo login deve permitir consultar `GET /users/profile` na porta `3005`.
- [ ] A consulta do perfil deve retornar os dados do usuário autenticado conforme o contrato existente.
- [ ] O mesmo JWT deve permitir consultar `GET /users/sellers` na porta `3005`.
- [ ] A consulta de vendedores deve retornar uma lista conforme o contrato existente.
- [ ] As duas requisições protegidas devem chegar ao `users-service` com o header `Authorization` original.

### CA-07: Validação ponta a ponta

- [ ] O fluxo de registro, login, consulta de perfil e consulta de vendedores deve ser executável em sequência por `curl` ou Postman, sempre por meio da porta `3005`.
- [ ] Nenhuma etapa funcional do teste deve exigir acesso direto do cliente à porta `3000`.
- [ ] O JWT obtido pelo login via gateway deve ser reutilizável nas consultas protegidas do mesmo fluxo.
- [ ] Falhas de autenticação e indisponibilidade do `users-service` devem produzir respostas coerentes com os comportamentos já existentes dos serviços.

### CA-08: Regressão e qualidade

- [ ] Os fluxos diretos já existentes no `users-service` devem continuar funcionando.
- [ ] Os health checks e a documentação já existentes no `api-gateway` devem continuar funcionando.
- [ ] O lint dos serviços afetados deve ser executado com sucesso antes da conclusão da implementação.
- [ ] Cada etapa de implementação deve ser registrada em commit próprio após a validação do lint correspondente.

---

## 7. Fora de escopo

Não fazem parte desta especificação:

- Alterações no mecanismo de proxy do `api-gateway`.
- Alterações ou substituição dos guards existentes no `api-gateway`.
- Implementação ou alteração de gerenciamento de sessão.
- Criação de novos fluxos de autenticação além da validação JWT já definida.
- Refresh token, revogação de token ou logout.
- Mudanças nos contratos existentes de registro, login, perfil e listagem de vendedores, exceto os requisitos de integração explicitamente descritos nesta especificação.
