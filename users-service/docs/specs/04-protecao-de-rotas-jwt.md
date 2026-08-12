# SPEC: Proteção de rotas com JWT no users-service

**Serviço:** users-service  
**Escopo:** autenticação global de rotas com JWT  
**Status:** Pendente  
**Criado em:** 2026-08-12

---

## 1. Objetivo

Proteger automaticamente as rotas do `users-service`, permitindo acesso somente a requisições autenticadas por um JWT válido, exceto quando a rota estiver explicitamente marcada como pública.

Esta especificação cobre exclusivamente a validação de JWT, a disponibilização dos dados do usuário autenticado na requisição e a identificação das rotas públicas já existentes.

---

## 2. Requisitos funcionais

### RF-01: Estratégia de autenticação JWT

O serviço deve possuir uma estratégia JWT integrada ao Passport para autenticar requisições protegidas.

A estratégia deve:

- Obter o token do header HTTP `Authorization`, no formato `Bearer <token>`.
- Validar a assinatura do token com o segredo JWT configurado no serviço.
- Validar automaticamente a expiração do token.
- Considerar autenticada somente a requisição cujo token seja válido e não esteja expirado.
- Extrair do payload as claims `sub`, `email` e `role`.
- Disponibilizar em `req.user` um objeto contendo `id`, `email` e `role`, em que `id` corresponde à claim `sub`.

O objeto disponibilizado em `req.user` não deve conter o token, senha, hash de senha, segredo JWT ou outros dados sensíveis.

### RF-02: Guard de autenticação JWT

O serviço deve possuir um guard de autenticação JWT baseado no guard do Passport.

O guard deve:

- Verificar se a rota ou o controller possui o metadata `isPublic` antes de exigir autenticação.
- Permitir o acesso sem token quando o metadata `isPublic` estiver presente e indicar que o recurso é público.
- Exigir e validar o JWT quando a rota não estiver marcada como pública.
- Recusar a requisição quando uma rota protegida não receber um token válido.

### RF-03: Proteção global das rotas

O guard de autenticação JWT deve ser registrado como guard global por meio do mecanismo `APP_GUARD` do NestJS.

Com o registro global:

- Todas as rotas atuais e futuras do `users-service` devem ser protegidas por padrão.
- Uma rota somente deve aceitar acesso sem autenticação quando estiver explicitamente marcada como pública.
- Controllers e rotas não devem precisar declarar individualmente o guard JWT para obter proteção.

### RF-04: Identificação de rotas públicas

O serviço deve possuir um decorator `@Public()` para identificar rotas que não exigem autenticação.

O decorator deve:

- Associar o metadata `isPublic` ao recurso marcado.
- Permitir que o guard global reconheça o recurso como público.
- Poder marcar uma rota ou um controller quando todo o recurso correspondente for público.

### RF-05: Rotas públicas existentes

As seguintes rotas devem ser explicitamente marcadas como públicas:

- `POST /auth/register`
- `POST /auth/login`

Essas rotas devem continuar acessíveis sem o header `Authorization`. A presença de um token ausente, inválido ou expirado não deve impedir o acesso a elas.

### RF-06: Tratamento de acesso não autorizado

Uma requisição a uma rota protegida deve retornar `401 Unauthorized` quando:

- O header `Authorization` estiver ausente.
- O header não fornecer um token no formato Bearer esperado.
- O token estiver expirado.
- A assinatura do token for inválida.
- O token estiver malformado ou não puder ser validado.

Uma falha de autenticação não deve disponibilizar um usuário autenticado nem permitir que o controller da rota protegida processe a requisição.

---

## 3. Dados do usuário autenticado

Após a autenticação bem-sucedida, `req.user` deve conter:

| Campo | Origem no JWT | Descrição |
|---|---|---|
| id | `sub` | Identificador do usuário autenticado. |
| email | `email` | Email do usuário autenticado. |
| role | `role` | Papel do usuário autenticado. |

Os valores devem corresponder exatamente ao payload validado do token apresentado na requisição.

---

## 4. Fluxo funcional

1. A requisição chega ao `users-service`.
2. O guard global verifica se a rota ou o controller está marcado com `isPublic` por meio de `@Public()`.
3. Se o recurso for público, o guard permite o acesso sem exigir token.
4. Se o recurso não for público, o guard exige um JWT no header `Authorization` no formato Bearer.
5. A estratégia JWT valida a assinatura e a expiração do token.
6. Se o token for inválido, ausente ou expirado, a requisição é encerrada com `401 Unauthorized` antes de chegar ao controller.
7. Se o token for válido, os dados `id`, `email` e `role` são disponibilizados em `req.user`.
8. O controller processa normalmente a requisição autenticada.

---

## 5. Respostas esperadas

| Condição | Resultado esperado |
|---|---|
| Rota pública, com ou sem token | A requisição segue normalmente, sem autenticação obrigatória. |
| Rota protegida com token válido | A requisição segue normalmente e o controller recebe `req.user` com `id`, `email` e `role`. |
| Rota protegida sem token | `401 Unauthorized`; o controller não processa a requisição. |
| Rota protegida com token expirado | `401 Unauthorized`; o controller não processa a requisição. |
| Rota protegida com assinatura inválida | `401 Unauthorized`; o controller não processa a requisição. |
| Rota protegida com token malformado ou esquema de autenticação inadequado | `401 Unauthorized`; o controller não processa a requisição. |

---

## 6. Critérios de aceite

### CA-01: Proteção global por padrão

- [ ] O guard JWT deve estar registrado globalmente por meio de `APP_GUARD`.
- [ ] Toda rota sem metadata público deve exigir autenticação, sem precisar declarar o guard individualmente.
- [ ] Uma nova rota não marcada como pública deve nascer protegida automaticamente.

### CA-02: Acesso às rotas públicas

- [ ] `POST /auth/register` deve ser acessível sem header `Authorization`.
- [ ] `POST /auth/login` deve ser acessível sem header `Authorization`.
- [ ] As duas rotas devem estar explicitamente marcadas com `@Public()`.
- [ ] Um token inválido ou expirado enviado a uma dessas rotas não deve, por si só, causar `401 Unauthorized`.

### CA-03: Autenticação com token válido

- [ ] Dada uma rota protegida e um JWT válido no formato `Authorization: Bearer <token>`, a requisição deve alcançar o controller.
- [ ] `req.user.id` deve ser igual à claim `sub` do token validado.
- [ ] `req.user.email` deve ser igual à claim `email` do token validado.
- [ ] `req.user.role` deve ser igual à claim `role` do token validado.
- [ ] `req.user` não deve expor senha, hash, segredo JWT ou o token recebido.

### CA-04: Token ausente ou formato inadequado

- [ ] Uma rota protegida chamada sem header `Authorization` deve retornar `401 Unauthorized`.
- [ ] Uma rota protegida chamada sem o esquema `Bearer` esperado deve retornar `401 Unauthorized`.
- [ ] Em ambos os casos, o controller não deve processar a requisição.

### CA-05: Token expirado

- [ ] Uma rota protegida chamada com um JWT expirado deve retornar `401 Unauthorized`.
- [ ] A requisição não deve disponibilizar um usuário autenticado nem alcançar o controller.

### CA-06: Token inválido

- [ ] Uma rota protegida chamada com assinatura inválida deve retornar `401 Unauthorized`.
- [ ] Uma rota protegida chamada com token malformado deve retornar `401 Unauthorized`.
- [ ] Nenhuma dessas requisições deve alcançar o controller.

### CA-07: Metadata público

- [ ] O decorator `@Public()` deve associar o metadata `isPublic` ao recurso marcado.
- [ ] O guard deve reconhecer o metadata tanto na rota quanto no controller.
- [ ] O metadata público deve dispensar a autenticação somente no recurso ao qual se aplica.

### CA-08: Preservação dos fluxos existentes

- [ ] O registro de usuário deve continuar funcionando conforme sua especificação existente.
- [ ] O login e a emissão de JWT devem continuar funcionando conforme sua especificação existente.
- [ ] A proteção global não deve criar novos endpoints nem alterar os contratos de entrada e saída das rotas públicas existentes.

---

## 7. Fora de escopo

Não fazem parte desta especificação:

- Criação de novos endpoints.
- Autorização baseada em papel ou implementação de `RoleGuard`.
- Validação ou gerenciamento de sessão e implementação de `SessionGuard`.
- Refresh token, revogação de tokens ou logout.
- Alteração do prazo de expiração de 24 horas ou do processo atual de emissão do JWT.
