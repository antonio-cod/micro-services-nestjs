# Plano de implementação: Proteção global de rotas com JWT

**Serviço:** users-service  
**SPEC de referência:** `docs/specs/04-protecao-de-rotas-jwt.md`  
**Status:** Implementado  
**Criado em:** 2026-08-12

---

## 1. Objetivo

Implementar autenticação JWT global no `users-service`, protegendo todas as rotas por padrão e mantendo `POST /auth/register` e `POST /auth/login` explicitamente públicas.

## 2. Etapas de execução

1. Registrar as dependências Passport necessárias no manifesto e no lockfile.
2. Definir os contratos do payload JWT e do usuário autenticado.
3. Implementar a estratégia JWT com extração Bearer e validação de assinatura e expiração.
4. Implementar o decorator `@Public()` e marcar individualmente registro e login.
5. Implementar o guard JWT e registrá-lo globalmente com `APP_GUARD`.
6. Cobrir estratégia, decorator, guard, composição do módulo e fluxos HTTP com testes automatizados.
7. Executar lint, testes unitários, testes end-to-end e build.

## 3. Comportamento esperado

- Todas as rotas sem metadata `isPublic` exigem um JWT válido.
- Rotas públicas ignoram a autenticação mesmo quando recebem um token inválido.
- Tokens válidos disponibilizam `{ id, email, role }` em `req.user`.
- Tokens ausentes, expirados, malformados ou com assinatura inválida resultam em `401 Unauthorized` nas rotas protegidas.
- Nenhum endpoint novo, `RoleGuard`, `SessionGuard`, refresh token ou consulta de usuário no banco será incluído.

## 4. Verificação

- Testes unitários validam configuração e retorno da estratégia, metadata público, bypass e delegação do guard e registro global.
- Testes end-to-end validam as rotas públicas e o acesso protegido ao endpoint raiz com tokens válidos e inválidos.
- A entrega somente será concluída após aprovação de lint, testes e build e revisão integral dos critérios da SPEC 04.
