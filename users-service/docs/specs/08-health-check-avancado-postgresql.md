# SPEC: Health check avançado de PostgreSQL no Users Service

**Serviço:** `users-service`  
**Porta local:** `3000`  
**Status:** Pendente  
**Dependência verificada:** PostgreSQL via TypeORM

## 1. Objetivo

Substituir o health check estático do `users-service` por um health check real com
`@nestjs/terminus`. `GET /health` deve informar se a aplicação consegue executar
uma consulta no PostgreSQL usando a conexão TypeORM já configurada.

## 2. Escopo

- instalar `@nestjs/terminus` como dependência de produção;
- manter `src/health/health.module.ts` e adequá-lo para importar
  `TerminusModule`;
- alterar `HealthController` para usar `@HealthCheck()` e
  `HealthCheckService`;
- registrar `TypeOrmHealthIndicator` e executar
  `database.pingCheck('database')`;
- preservar `GET /health` como rota pública com o decorator `@Public()`;
- atualizar testes unitários, HTTP/e2e e documentação Swagger afetada pelo novo
  contrato.

Não fazem parte desta SPEC novos endpoints de readiness/liveness, novas métricas,
alterações no banco ou configuração de alertas.

## 3. Implementação

O `HealthModule` deve importar `TerminusModule`, declarar o `HealthController` e
ser importado uma única vez no `AppModule`. A conexão usada pelo indicator deve
ser a mesma criada por `TypeOrmModule.forRoot(databaseConfig)`; não criar
`DataSource`, pool ou credenciais paralelas.

O handler deve ter comportamento equivalente a:

```ts
@Get()
@Public()
@HealthCheck()
check() {
  return this.health.check([
    () => this.database.pingCheck('database'),
  ]);
}
```

Em sucesso, responder HTTP `200` no formato do Terminus, com `status: "ok"` e
`details.database.status: "up"`. Se o PostgreSQL estiver indisponível ou exceder
o timeout padrão do indicator, responder HTTP `503`, com `status: "error"` e
`details.database.status: "down"`. Não incluir URL, usuário, senha, stack trace
ou mensagem interna do driver na resposta pública.

## 4. Testes

- teste unitário confirma `@HealthCheck()`, `@Public()` e a chamada única a
  `pingCheck('database')`;
- teste unitário cobre as respostas resolvida e rejeitada de
  `HealthCheckService.check` sem abrir conexão real;
- teste de integração/e2e com PostgreSQL disponível valida HTTP `200` e o bloco
  `database: { status: "up" }`;
- teste de integração controlado com banco indisponível valida HTTP `503` e
  `database: { status: "down" }`;
- testes antigos que esperam `{ status: "ok", service: "users-service" }` devem
  ser atualizados para o contrato Terminus.

## 5. Critérios de aceite

- [ ] `@nestjs/terminus` está em `dependencies` e o lockfile foi atualizado.
- [ ] `HealthModule` importa `TerminusModule` e continua registrado no
  `AppModule`.
- [ ] `GET /health` permanece acessível sem JWT.
- [ ] Com PostgreSQL disponível, retorna `200`, `status: "ok"` e indicator
  `database` como `up`.
- [ ] Com PostgreSQL indisponível, retorna `503`, `status: "error"` e indicator
  `database` como `down`.
- [ ] A checagem reutiliza a conexão TypeORM da aplicação e não expõe segredos.
- [ ] Não foram criados endpoints de readiness/liveness nem novas métricas.
- [ ] Testes, build e lint do serviço passam.

## 6. Validação manual

1. Iniciar o PostgreSQL e o serviço; executar `curl -i localhost:3000/health` e
   confirmar `200`/`database=up`.
2. Parar somente o PostgreSQL; repetir a chamada e confirmar `503`/`database=down`.
3. Reiniciar a dependência e confirmar que a rota volta a `200` sem reiniciar o
   serviço.

