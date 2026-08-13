# SPEC: Validação de JWT no products-service

**Serviço:** products-service  
**Porta:** 3001  
**Escopo:** autenticação global de rotas por meio de tokens emitidos pelo users-service  
**Status:** Pendente  
**Criado em:** 2026-08-13

---

## 1. Objetivo

Proteger as rotas do `products-service` por padrão, validando os tokens JWT emitidos pelo `users-service` e disponibilizando os dados do usuário autenticado durante o processamento da requisição.

O `products-service` deve atuar somente como consumidor e validador desses tokens. A autenticação de credenciais, o cadastro de usuários e a emissão de JWT permanecem sob responsabilidade exclusiva do `users-service`.

---

## 2. Contexto e premissas

- O `users-service` emite JWTs com as claims `sub`, `email` e `role`.
- A claim `sub` contém o UUID do usuário autenticado.
- A claim `role` possui um dos valores `seller` ou `buyer`.
- O `JWT_SECRET` possui o mesmo valor no `users-service` e no `products-service`.
- O `products-service` não deve consultar o `users-service` nem seu banco de dados para validar cada requisição.
- A solução deve seguir exatamente o padrão de autenticação JWT já adotado pelo `users-service`, adaptando-o apenas para o contexto do `products-service`.
- Devem ser utilizadas as dependências `@nestjs/jwt`, `@nestjs/passport`, `passport` e `passport-jwt`.

---

## 3. Requisitos funcionais

### RF-01: Módulo de autenticação

O `products-service` deve possuir um `AuthModule` responsável pela validação de JWT e pela proteção global das rotas.

O módulo deve reunir e disponibilizar a estratégia JWT, o guard JWT e o suporte ao decorator `@Public()`, seguindo as mesmas responsabilidades e o mesmo padrão funcional existentes no `users-service`.

O módulo não deve possuir controller, endpoints de autenticação ou operações de emissão de token.

### RF-02: Configuração do segredo compartilhado

O serviço deve obter o segredo usado na validação a partir da variável de ambiente `JWT_SECRET`.

O valor configurado deve ser o mesmo utilizado pelo `users-service` para assinar os tokens. A aplicação não deve iniciar a autenticação com um segredo ausente, vazio ou com valor padrão implícito.

A configuração de ambiente de referência do `products-service` deve declarar a variável `JWT_SECRET`.

### RF-03: Estratégia JWT

O serviço deve possuir uma `JwtStrategy` integrada ao Passport e equivalente à estratégia do `users-service`.

A estratégia deve:

- Obter o token exclusivamente do header HTTP `Authorization`, usando o esquema `Bearer`.
- Validar a assinatura com o `JWT_SECRET` compartilhado.
- Validar automaticamente a expiração do token.
- Considerar autenticada somente a requisição cujo token tenha assinatura válida e não esteja expirado.
- Extrair as claims `sub`, `email` e `role` do payload validado.
- Disponibilizar em `req.user` os campos `id`, `email` e `role`, sendo `id` correspondente à claim `sub`.

O objeto autenticado não deve expor o token, o segredo JWT, senha, hash de senha ou outros dados sensíveis.

### RF-04: Guard de autenticação JWT

O serviço deve possuir um `JwtAuthGuard`, seguindo o mesmo comportamento do guard existente no `users-service`.

O guard deve:

- Verificar se a rota ou o controller está identificado como público.
- Permitir requisições a recursos públicos sem exigir autenticação.
- Exigir um JWT válido em todos os recursos não públicos.
- Impedir que uma requisição não autenticada alcance o controller de uma rota protegida.

### RF-05: Proteção global

O `JwtAuthGuard` deve ser registrado como guard global por meio de `APP_GUARD`.

Como consequência:

- Todas as rotas atuais e futuras do `products-service` devem ser protegidas por padrão.
- Controllers e rotas não devem precisar declarar individualmente o guard JWT.
- Somente recursos explicitamente marcados com `@Public()` devem dispensar autenticação.

### RF-06: Decorator de rota pública

O serviço deve possuir um decorator `@Public()` equivalente ao utilizado pelo `users-service`.

O decorator deve:

- Identificar o recurso com o metadata `isPublic`.
- Ser reconhecido pelo guard global tanto em uma rota quanto em um controller.
- Dispensar a autenticação somente no escopo em que for aplicado.

Esta especificação não determina a criação de uma rota pública. O decorator deverá ser aplicado somente a rotas que outra especificação ou requisito de negócio definir explicitamente como públicas.

### RF-07: Tratamento de acesso não autorizado

Uma requisição a uma rota protegida deve resultar em `401 Unauthorized` quando:

- O header `Authorization` estiver ausente.
- O header não utilizar o esquema `Bearer` esperado.
- O token estiver ausente após o esquema `Bearer`.
- O token estiver expirado.
- A assinatura for inválida, inclusive quando o token tiver sido assinado com outro segredo.
- O token estiver malformado ou não puder ser validado.

Em qualquer uma dessas condições, a requisição não deve disponibilizar um usuário autenticado nem alcançar o controller da rota protegida.

### RF-08: Limites de responsabilidade

O `products-service` não deve:

- Criar endpoints de login ou registro.
- Emitir ou renovar JWTs.
- Validar senha ou credenciais de usuário.
- Implementar `RoleGuard`.
- Bloquear o acesso apenas com base no valor de `role` durante a autenticação JWT.

Quando necessária, a verificação de `role` será responsabilidade direta dos controllers ou services abrangidos por especificações próprias.

---

## 4. Contrato do usuário autenticado

Após a validação bem-sucedida, `req.user` deve conter:

| Campo | Origem no JWT | Resultado esperado |
|---|---|---|
| `id` | `sub` | UUID do usuário autenticado. |
| `email` | `email` | Email presente no token validado. |
| `role` | `role` | Papel presente no token: `seller` ou `buyer`. |

Os valores devem corresponder ao payload do token validado, sem consulta adicional ao `users-service`.

---

## 5. Fluxo funcional

1. Uma requisição chega ao `products-service`.
2. O guard global verifica se a rota ou o controller está marcado com `@Public()`.
3. Se o recurso for público, a requisição prossegue sem autenticação obrigatória.
4. Se o recurso for protegido, o token é obtido de `Authorization: Bearer <token>`.
5. A assinatura e a expiração são validadas com o segredo compartilhado.
6. Se a validação falhar, a requisição é encerrada com `401 Unauthorized` antes do controller.
7. Se a validação for bem-sucedida, `id`, `email` e `role` são disponibilizados em `req.user`.
8. O controller processa a requisição e pode consultar os dados do usuário autenticado.

---

## 6. Critérios de aceite

### CA-01: Estrutura e aderência ao padrão

- [ ] O `products-service` possui um `AuthModule`, uma `JwtStrategy`, um `JwtAuthGuard` e o decorator `@Public()`.
- [ ] A abordagem e os comportamentos desses componentes são equivalentes aos adotados no `users-service`.
- [ ] As dependências `@nestjs/jwt`, `@nestjs/passport`, `passport` e `passport-jwt` constam nas dependências do serviço.
- [ ] O `AuthModule` não expõe controllers ou endpoints de autenticação.

### CA-02: Segredo compartilhado

- [ ] O `products-service` declara e utiliza `JWT_SECRET` para validar tokens.
- [ ] Um token emitido pelo `users-service` com o segredo compartilhado é aceito enquanto estiver válido.
- [ ] Um token com payload equivalente, mas assinado com outro segredo, retorna `401 Unauthorized`.
- [ ] A ausência ou o valor vazio de `JWT_SECRET` impede que a configuração JWT seja considerada válida.

### CA-03: Proteção global por padrão

- [ ] O `JwtAuthGuard` está registrado globalmente por meio de `APP_GUARD`.
- [ ] Toda rota sem metadata `isPublic` exige autenticação, sem declarar o guard individualmente.
- [ ] Uma nova rota não marcada como pública nasce protegida automaticamente.
- [ ] Uma requisição recusada pelo guard não alcança o controller.

### CA-04: Token válido

- [ ] Dada uma rota protegida e um token válido emitido pelo `users-service`, enviado como `Authorization: Bearer <token>`, a requisição alcança o controller.
- [ ] `req.user.id` é igual à claim `sub` do token.
- [ ] `req.user.email` é igual à claim `email` do token.
- [ ] `req.user.role` é igual à claim `role` do token.
- [ ] Tokens válidos de usuários `seller` e `buyer` passam pela autenticação JWT.
- [ ] `req.user` não expõe o token, segredo, senha ou hash de senha.

### CA-05: Token ausente ou formato inadequado

- [ ] Uma rota protegida chamada sem o header `Authorization` retorna `401 Unauthorized`.
- [ ] Uma rota protegida chamada sem o esquema `Bearer` esperado retorna `401 Unauthorized`.
- [ ] Uma rota protegida chamada com o esquema `Bearer`, mas sem token, retorna `401 Unauthorized`.
- [ ] Nenhuma dessas requisições alcança o controller.

### CA-06: Token expirado ou inválido

- [ ] Uma rota protegida chamada com token expirado retorna `401 Unauthorized`.
- [ ] Uma rota protegida chamada com assinatura inválida retorna `401 Unauthorized`.
- [ ] Uma rota protegida chamada com token malformado retorna `401 Unauthorized`.
- [ ] Nenhuma dessas requisições disponibiliza `req.user` ou alcança o controller.

### CA-07: Recurso público

- [ ] O decorator `@Public()` identifica o recurso com o metadata `isPublic`.
- [ ] O guard reconhece o metadata aplicado tanto em uma rota quanto em um controller.
- [ ] Uma rota marcada como pública pode ser acessada sem o header `Authorization`.
- [ ] Um token inválido ou expirado enviado a uma rota pública não causa, por si só, `401 Unauthorized`.
- [ ] Marcar uma rota como pública não torna públicas outras rotas protegidas do mesmo controller.

### CA-08: Separação de responsabilidades

- [ ] Nenhum endpoint de login, registro, renovação ou emissão de token é criado no `products-service`.
- [ ] A validação do token não depende de chamada HTTP ao `users-service` nem de acesso ao banco de usuários.
- [ ] Nenhum `RoleGuard` é implementado.
- [ ] A autenticação não rejeita um token válido somente porque seu usuário possui role `seller` ou `buyer`.

---

## 7. Fora de escopo

- Login, registro e validação de credenciais.
- Emissão, renovação, revogação ou logout de JWT.
- Refresh tokens e gerenciamento de sessão.
- Implementação de `RoleGuard` ou de outro guard de autorização.
- Definição das regras de negócio específicas para `seller` e `buyer`.
- Criação de endpoints para testar autenticação.
- Alteração do payload ou do prazo de expiração dos tokens emitidos pelo `users-service`.
- Comunicação com o `users-service` para revalidar usuários a cada requisição.
