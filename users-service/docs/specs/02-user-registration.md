# SPEC: Registro de usuário no users-service

**Serviço:** users-service  
**Endpoint:** POST /auth/register  
**Status:** Pendente  
**Criado em:** 2026-08-12

---

## 1. Objetivo

Disponibilizar o registro de novos usuários no `users-service`, garantindo validação dos dados recebidos, unicidade de email, armazenamento seguro da senha e ausência da senha em qualquer resposta da operação.

Esta especificação cobre exclusivamente o cadastro de usuários. Login, emissão ou validação de tokens e outros endpoints de autenticação não fazem parte deste escopo.

---

## 2. Requisitos funcionais

### RF-01: Módulo de autenticação

O serviço deve possuir um `AuthModule`, responsável pelo fluxo de registro, contendo:

- Um controller de autenticação para expor o endpoint de registro.
- Um service de autenticação para executar as regras do cadastro.
- Acesso à persistência da entidade `User` já existente.

O `AuthModule` deve fazer parte da composição do `users-service` para que sua rota esteja disponível quando a aplicação for iniciada.

### RF-02: Endpoint de registro

O serviço deve disponibilizar o endpoint `POST /auth/register`.

O endpoint deve:

- Receber os campos `email`, `password`, `firstName`, `lastName` e `role`.
- Validar integralmente os dados antes de tentar cadastrar o usuário.
- Verificar se já existe um usuário com o email informado.
- Criar um novo registro na base de dados quando os dados forem válidos e o email estiver disponível.
- Retornar o usuário criado com status HTTP `201 Created`.

### RF-03: Unicidade de email

Antes da criação, o serviço deve verificar a existência de um usuário com o mesmo email.

Quando o email já estiver cadastrado:

- Nenhum novo usuário deve ser criado.
- A operação deve retornar status HTTP `409 Conflict`.
- A resposta deve informar claramente que o email já está cadastrado.

A duplicidade também deve resultar em `409 Conflict` caso seja detectada pela restrição de unicidade do banco de dados durante tentativas concorrentes.

### RF-04: Proteção da senha

A senha deve ser transformada em hash com bcrypt, usando 10 salt rounds, antes da persistência.

- A senha recebida em texto plano nunca deve ser armazenada no banco de dados.
- O valor persistido no campo `password` deve ser somente o hash resultante.
- O campo `password` nunca deve constar em respostas de sucesso ou de erro.

### RF-05: Status inicial

Todo usuário registrado por este endpoint deve receber automaticamente o status `active`.

- O cliente não deve precisar informar o status.
- Um eventual campo `status` enviado pelo cliente deve ser rejeitado como campo não permitido.

### RF-06: Validação da entrada

Dados inválidos devem impedir a criação do usuário e resultar em status HTTP `400 Bad Request`.

A resposta deve conter uma lista de erros de validação. Cada erro deve identificar o campo inválido e apresentar uma mensagem clara sobre a regra não atendida. Quando mais de um campo for inválido, todos os erros identificados devem ser retornados na mesma resposta.

Campos não previstos no DTO de criação devem ser rejeitados conforme a política global de validação do serviço.

---

## 3. Estrutura de dados de entrada

### 3.1 DTO de criação

| Campo | Tipo | Obrigatório | Regras de validação |
|---|---|---:|---|
| email | string | Sim | Deve possuir formato de email válido. |
| password | string | Sim | Deve possuir no mínimo 6 caracteres. |
| firstName | string | Sim | Deve possuir no máximo 100 caracteres. |
| lastName | string | Sim | Deve possuir no máximo 100 caracteres. |
| role | string | Sim | Deve aceitar exclusivamente `seller` ou `buyer`. |

Valores ausentes, nulos ou de tipo incompatível devem ser considerados inválidos.

O DTO não deve aceitar os campos gerenciados pelo serviço ou pelo banco de dados: `id`, `status`, `createdAt` e `updatedAt`.

---

## 4. Estrutura de dados de saída

### 4.1 Usuário criado

A resposta de sucesso deve representar o usuário persistido com os seguintes campos:

| Campo | Tipo | Descrição |
|---|---|---|
| id | UUID | Identificador único gerado para o usuário. |
| email | string | Email cadastrado. |
| firstName | string | Nome do usuário. |
| lastName | string | Sobrenome do usuário. |
| role | string | Papel cadastrado: `seller` ou `buyer`. |
| status | string | Status inicial, sempre `active`. |
| createdAt | data/hora | Data e hora de criação do registro. |
| updatedAt | data/hora | Data e hora da última atualização do registro. |

O campo `password` não deve fazer parte da estrutura de saída.

### 4.2 Erro de validação

A resposta de validação deve conter:

| Campo | Tipo | Descrição |
|---|---|---|
| statusCode | número | Valor `400`. |
| message | lista | Lista dos erros de validação encontrados. |
| error | string | Identificação do erro como requisição inválida. |

Cada item da lista de erros deve permitir identificar o campo e a regra violada.

### 4.3 Erro de email duplicado

A resposta de conflito deve conter:

| Campo | Tipo | Descrição |
|---|---|---|
| statusCode | número | Valor `409`. |
| message | string | Informação clara de que o email já está cadastrado. |
| error | string | Identificação do erro como conflito. |

Nenhuma resposta de erro deve expor senha, hash de senha, detalhes internos do banco de dados ou stack trace.

---

## 5. Respostas esperadas

| Status HTTP | Condição | Resultado esperado |
|---:|---|---|
| 201 Created | Dados válidos e email ainda não cadastrado. | Usuário criado e retornado sem o campo `password`, com status `active`. |
| 400 Bad Request | Um ou mais campos ausentes, inválidos, fora dos limites ou não permitidos. | Cadastro não realizado e lista clara dos erros de validação. |
| 409 Conflict | Email já cadastrado ou conflito de unicidade detectado na persistência. | Cadastro não realizado e mensagem informando a duplicidade do email. |

---

## 6. Fluxo funcional

1. O cliente envia os dados ao endpoint `POST /auth/register`.
2. O serviço valida o corpo da requisição conforme o DTO de criação.
3. Se houver dados inválidos, o serviço encerra a operação com `400 Bad Request` e retorna a lista de erros.
4. O serviço verifica se o email já está cadastrado.
5. Se o email já existir, o serviço encerra a operação com `409 Conflict`.
6. O serviço protege a senha com bcrypt e 10 salt rounds.
7. O serviço define o status do usuário como `active`.
8. O usuário é persistido no banco de dados.
9. O serviço retorna `201 Created` com os dados persistidos, sem o campo `password`.

---

## 7. Critérios de aceite

### CA-01: Registro realizado com sucesso

- [ ] Dado um corpo válido com uma das roles permitidas e um email ainda não cadastrado, quando `POST /auth/register` for chamado, então a resposta deve possuir status `201 Created`.
- [ ] O usuário deve existir no banco de dados com os dados recebidos e status `active`.
- [ ] A resposta deve conter `id`, `email`, `firstName`, `lastName`, `role`, `status`, `createdAt` e `updatedAt`.
- [ ] A resposta não deve conter o campo `password` nem o hash da senha.

### CA-02: Senha armazenada com segurança

- [ ] O valor persistido em `password` deve ser diferente da senha enviada pelo cliente.
- [ ] O hash persistido deve ser válido para a senha enviada quando verificado com bcrypt.
- [ ] A geração do hash deve utilizar 10 salt rounds.

### CA-03: Email duplicado

- [ ] Dado um email já cadastrado, uma nova tentativa de registro com esse email deve retornar `409 Conflict`.
- [ ] A resposta deve informar claramente que o email já está cadastrado.
- [ ] A tentativa não deve criar um segundo usuário.
- [ ] Duas tentativas concorrentes com o mesmo email não devem resultar em dois registros; a tentativa conflitante deve retornar `409 Conflict`.

### CA-04: Campos obrigatórios

- [ ] A ausência de qualquer um dos campos `email`, `password`, `firstName`, `lastName` ou `role` deve retornar `400 Bad Request`.
- [ ] A resposta deve identificar cada campo obrigatório ausente.
- [ ] Nenhum usuário deve ser criado quando a validação falhar.

### CA-05: Regras de formato e tamanho

- [ ] Um `email` em formato inválido deve retornar `400 Bad Request` com mensagem referente ao campo.
- [ ] Uma `password` com menos de 6 caracteres deve retornar `400 Bad Request` com mensagem referente ao tamanho mínimo.
- [ ] Um `firstName` com mais de 100 caracteres deve retornar `400 Bad Request` com mensagem referente ao tamanho máximo.
- [ ] Um `lastName` com mais de 100 caracteres deve retornar `400 Bad Request` com mensagem referente ao tamanho máximo.
- [ ] Uma `role` diferente de `seller` ou `buyer` deve retornar `400 Bad Request` e indicar os valores aceitos.

### CA-06: Tipos e campos não permitidos

- [ ] Valores nulos ou de tipo incompatível devem retornar `400 Bad Request` e identificar o campo inválido.
- [ ] O envio de campos não previstos no DTO deve retornar `400 Bad Request`.
- [ ] O cliente não deve conseguir definir `id`, `status`, `createdAt` ou `updatedAt` durante o registro.

### CA-07: Múltiplos erros de validação

- [ ] Quando a requisição possuir mais de um campo inválido, a resposta `400 Bad Request` deve listar todos os erros identificados.
- [ ] As mensagens devem permitir relacionar cada erro ao respectivo campo e à regra violada.

### CA-08: Confidencialidade nas respostas

- [ ] Nenhuma resposta do endpoint, inclusive erros de validação, conflito ou falhas internas, deve conter a senha em texto plano ou seu hash.
- [ ] Respostas de erro não devem expor detalhes internos do banco de dados ou stack trace.

### CA-09: Disponibilidade do módulo e da rota

- [ ] O `AuthModule` deve estar integrado ao `users-service` e conter controller e service responsáveis pelo registro.
- [ ] Com o serviço iniciado, somente a rota `POST /auth/register` prevista nesta SPEC deve ser disponibilizada pelo módulo de autenticação.

---

## 8. Fora de escopo

- Login de usuários.
- JWT, refresh token ou qualquer outro mecanismo de token.
- Logout.
- Recuperação ou alteração de senha.
- Verificação de email.
- Autorização e controle de acesso.
- Consulta, atualização ou exclusão de usuários.
- Qualquer outro endpoint de autenticação ou de usuários.
