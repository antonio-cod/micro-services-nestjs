# Plano de implementação: Integração com o api-gateway

**Serviços:** users-service e api-gateway  
**SPEC de referência:** `docs/specs/06-integracao-users-service-api-gateway.md`  
**Status:** Implementado  
**Criado em:** 2026-08-12

---

## 1. Objetivo

Integrar registro, login e consultas de usuários por meio do `api-gateway`, com validação remota do JWT no `users-service` e preservação da infraestrutura de proxy e resiliência existente.

## 2. Entrega

1. Disponibilizar health check público e Swagger no `users-service`.
2. Disponibilizar `GET /auth/validate-token` protegido e sem dados sensíveis.
3. Validar no gateway o Bearer original por meio do `users-service`.
4. Encaminhar `/auth/*` e `/users/*`, preservando status, dados, parâmetros e autenticação.
5. Cobrir os fluxos com testes unitários e ponta a ponta e validar lint e build dos dois serviços.

## 3. Resultado esperado

- O cliente executa registro, login, perfil e listagem de vendedores somente pela porta `3005`.
- O gateway e o `users-service` validam o mesmo JWT e o header `Authorization` não é alterado.
- Respostas funcionais `4xx` são preservadas; falhas de comunicação resultam em indisponibilidade do serviço.
- Health checks, Swagger, circuit breaker, retry, timeout, fallback e throttling permanecem ativos.
