# SPEC: Login de usuário com JWT no users-service

**Serviço:** users-service  
**Endpoint:** POST /auth/login  
**Status:** Pendente  
**Criado em:** 2026-08-12

---

## 1. Objetivo

Disponibilizar a autenticação de usuários cadastrados no `users-service` por meio de email e senha. Quando as credenciais pertencerem a uma conta ativa, o serviço deve emitir um token JWT válido por 24 horas e retornar esse token junto aos dados públicos do usuário.

Esta especificação cobre exclusivamente o login e a emissão de um JWT básico. O cadastro de usuários já existente permanece inalterado.

---

## 2. Requisitos funcionais

### RF-01: Endpoint de login

O serviço deve disponibilizar o endpoint `POST /auth/login` no módulo de autenticação já existente.

O endpoint deve:

- Receber `email` e `password` no corpo da requisição.
- Validar integralmente os dados recebidos antes de autenticar o usuário.
- Retornar status HTTP `200 OK` quando a autenticação for concluída com sucesso.

### RF-02: Identificação do usuário

O serviço deve buscar no banco de dados o usuário correspondente ao email informado.

Quando nenhum usuário for encontrado:

- A autenticação deve ser recusada.
- A resposta deve possuir status HTTP `401 Unauthorized`.
- A mensagem deve ser exatamente `Credenciais inválidas`.
- A resposta não deve revelar que o email não está cadastrado.

### RF-03: Validação da senha

A senha em texto plano recebida na requisição deve ser comparada com o hash armazenado para o usuário por meio do bcrypt.

Quando a senha não corresponder ao hash:

- A autenticação deve ser recusada.
- A resposta deve possuir status HTTP `401 Unauthorized`.
- A mensagem deve ser exatamente `Credenciais inválidas`.
- A resposta não deve revelar que a senha foi o dado incorreto.

A mesma mensagem e o mesmo status devem ser usados para email inexistente e senha incorreta, de modo que a resposta não permita confirmar a existência de uma conta.

### RF-04: Verificação do status da conta

Somente usuários cujo status seja `active` podem concluir o login.

Quando as credenciais forem válidas, mas o usuário possuir status diferente de `active`:

- A autenticação deve ser recusada.
- Nenhum token deve ser emitido.
- A resposta deve possuir status HTTP `401 Unauthorized`.
- A mensagem deve ser exatamente `Conta inativa`.

A verificação de conta inativa somente deve produzir a mensagem específica depois que email e senha válidos identificarem o usuário. Credenciais inválidas não devem permitir descobrir o status da conta.

### RF-05: Emissão do token JWT

Após a validação das credenciais e do status da conta, o serviço deve emitir um token JWT:

- Assinado com o segredo definido pela variável de ambiente `JWT_SECRET`.
- Com validade de 24 horas a partir de sua emissão.
- Com os dados de identificação e autorização definidos na seção 4.

O segredo não deve ser fixado na aplicação, incluído na resposta ou registrado em logs. A emissão de tokens não deve estar disponível quando `JWT_SECRET` estiver ausente ou vazio.

### RF-06: Retorno do usuário autenticado

O login bem-sucedido deve retornar um objeto contendo:

- `user`: dados do usuário autenticado.
- `token`: JWT emitido para o usuário.

O objeto `user` deve refletir o usuário persistido e não deve conter o campo `password` nem o hash da senha. Nenhuma resposta de sucesso ou erro deve expor a senha recebida, o hash armazenado, o segredo JWT ou detalhes internos da aplicação.

---

## 3. Estrutura de dados de entrada

### 3.1 DTO de login

| Campo | Tipo | Obrigatório | Regras de validação |
|---|---|---:|---|
| email | string | Sim | Deve possuir formato de email válido. |
| password | string | Sim | Deve possuir no mínimo 6 caracteres. |

Valores ausentes, nulos, vazios ou de tipo incompatível devem ser considerados inválidos.

Campos diferentes de `email` e `password` devem ser rejeitados conforme a política global de validação do serviço.

---

## 4. Estrutura do payload JWT

O payload de negócio do JWT deve conter:

| Claim | Tipo | Descrição |
|---|---|---|
| sub | UUID | ID do usuário autenticado. |
| email | string | Email do usuário autenticado. |
| role | string | Papel do usuário autenticado, com valor `seller` ou `buyer`. |

O token deve representar os valores atuais do usuário no momento do login e possuir informação de expiração compatível com a validade de 24 horas.

O payload não deve conter `password`, hash de senha, `JWT_SECRET` ou qualquer outro dado sensível.

---

## 5. Estrutura de dados de saída

### 5.1 Login bem-sucedido

| Campo | Tipo | Descrição |
|---|---|---|
| user | objeto | Dados públicos do usuário autenticado. |
| token | string | Token JWT válido por 24 horas. |

O objeto `user` deve conter:

| Campo | Tipo | Descrição |
|---|---|---|
| id | UUID | Identificador do usuário. |
| email | string | Email do usuário. |
| firstName | string | Nome do usuário. |
| lastName | string | Sobrenome do usuário. |
| role | string | Papel do usuário: `seller` ou `buyer`. |
| status | string | Status do usuário, com valor `active` no login bem-sucedido. |
| createdAt | data/hora | Data e hora de criação do usuário. |
| updatedAt | data/hora | Data e hora da última atualização do usuário. |

O objeto `user` não deve conter o campo `password`.

### 5.2 Falha de autenticação

A resposta de autenticação recusada deve conter:

| Campo | Tipo | Descrição |
|---|---|---|
| statusCode | número | Valor `401`. |
| message | string | `Credenciais inválidas` ou `Conta inativa`, conforme a condição. |
| error | string | Identificação do erro como não autorizado. |

---

## 6. Respostas esperadas

| Status HTTP | Condição | Resultado esperado |
|---:|---|---|
| 200 OK | Email e senha válidos e conta com status `active`. | Retorna `{ user, token }`, sem `password`, com JWT válido por 24 horas. |
| 400 Bad Request | Corpo ausente, campos inválidos, campos obrigatórios ausentes ou campos não permitidos. | Login não realizado e erros de validação identificando os campos inválidos. |
| 401 Unauthorized | Email não cadastrado ou senha incorreta. | Login não realizado, sem token, com a mensagem `Credenciais inválidas`. |
| 401 Unauthorized | Credenciais válidas, mas conta com status diferente de `active`. | Login não realizado, sem token, com a mensagem `Conta inativa`. |

---

## 7. Fluxo funcional

1. O cliente envia `email` e `password` para `POST /auth/login`.
2. O serviço valida os dados de entrada.
3. O serviço identifica o usuário pelo email.
4. O serviço valida a senha recebida contra o hash armazenado.
5. O serviço confirma que a conta possui status `active`.
6. O serviço emite um JWT válido por 24 horas com `sub`, `email` e `role`.
7. O serviço retorna status `200 OK` com o usuário sem `password` e o token.

Qualquer falha encerra o fluxo sem emissão de token e produz a resposta definida para sua condição.

---

## 8. Critérios de aceite

### CA-01: Login realizado com sucesso

- [ ] Dado um usuário cadastrado com status `active`, quando forem enviados seu email e sua senha corretos para `POST /auth/login`, então a resposta deve possuir status `200 OK`.
- [ ] A resposta deve conter somente os campos de primeiro nível `user` e `token`.
- [ ] O token retornado deve ser uma string JWT assinada e válida.
- [ ] O objeto `user` deve conter `id`, `email`, `firstName`, `lastName`, `role`, `status`, `createdAt` e `updatedAt`.
- [ ] O objeto `user` e o restante da resposta não devem conter `password` nem o hash da senha.

### CA-02: Conteúdo e validade do JWT

- [ ] O payload do token deve conter `sub` igual ao UUID do usuário autenticado.
- [ ] O payload do token deve conter `email` igual ao email do usuário autenticado.
- [ ] O payload do token deve conter `role` igual a `seller` ou `buyer`, conforme o usuário autenticado.
- [ ] O token deve expirar 24 horas após sua emissão.
- [ ] O token deve ser verificável exclusivamente com o segredo configurado em `JWT_SECRET`.
- [ ] O payload não deve conter senha, hash de senha ou segredo JWT.

### CA-03: Email não cadastrado

- [ ] Dado um email que não pertença a nenhum usuário, a tentativa deve retornar `401 Unauthorized`.
- [ ] A mensagem deve ser exatamente `Credenciais inválidas`.
- [ ] Nenhum token deve ser emitido.
- [ ] A resposta não deve indicar que o email não existe.

### CA-04: Senha incorreta

- [ ] Dado o email de um usuário cadastrado e uma senha incorreta, a tentativa deve retornar `401 Unauthorized`.
- [ ] A mensagem deve ser exatamente `Credenciais inválidas`.
- [ ] Nenhum token deve ser emitido.
- [ ] Status e mensagem devem ser os mesmos do cenário de email não cadastrado.

### CA-05: Conta inativa

- [ ] Dadas as credenciais corretas de um usuário com status `inactive`, a tentativa deve retornar `401 Unauthorized`.
- [ ] A mensagem deve ser exatamente `Conta inativa`.
- [ ] Nenhum token deve ser emitido.
- [ ] Dado um usuário inativo e uma senha incorreta, a mensagem deve continuar sendo `Credenciais inválidas`, sem revelar o status da conta.

### CA-06: Validação do DTO

- [ ] A ausência de `email` ou `password` deve retornar `400 Bad Request` e identificar cada campo ausente.
- [ ] Um email em formato inválido deve retornar `400 Bad Request` e identificar o campo `email`.
- [ ] Uma senha com menos de 6 caracteres deve retornar `400 Bad Request` e identificar o campo `password`.
- [ ] Valores nulos, vazios ou de tipo incompatível devem retornar `400 Bad Request` e identificar o campo inválido.
- [ ] Campos não previstos no DTO de login devem retornar `400 Bad Request`.
- [ ] Nenhuma falha de validação deve iniciar uma autenticação ou emitir token.

### CA-07: Configuração do segredo

- [ ] O segredo usado para assinar o JWT deve ser obtido da variável de ambiente `JWT_SECRET`.
- [ ] Alterar `JWT_SECRET` deve alterar o segredo com o qual novos tokens são assinados.
- [ ] Na ausência de um valor não vazio para `JWT_SECRET`, o serviço não deve emitir tokens.
- [ ] O segredo não deve aparecer em respostas ou logs.

### CA-08: Confidencialidade

- [ ] Nenhuma resposta deve expor a senha em texto plano, o hash armazenado ou o segredo JWT.
- [ ] Respostas de erro não devem expor stack trace, detalhes do banco de dados ou dados do usuário.
- [ ] Os cenários de email inexistente e senha incorreta devem ser indistinguíveis pelo status HTTP e pela mensagem retornada.

---

## 9. Fora de escopo

- Proteção de rotas ou uso de guards.
- Validação do JWT em endpoints protegidos.
- Refresh tokens ou renovação de tokens.
- Sessions ou autenticação baseada em cookies.
- Logout ou revogação de tokens.
- Recuperação ou alteração de senha.
- Verificação de email.
- Autenticação multifator.
- Bloqueio por tentativas, rate limiting ou CAPTCHA.
- Alterações no fluxo de registro de usuários.
