# SPEC: Health check avançado de PostgreSQL no Products Service

**Serviço:** `products-service`  
**Porta local:** `3001`  
**Status:** Pendente  
**Dependência verificada:** PostgreSQL via TypeORM

## 1. Objetivo

Substituir o retorno estático de `GET /health` por um health check do
`@nestjs/terminus` que confirme o acesso ao PostgreSQL pela conexão TypeORM já
usada pelo `products-service`.

## 2. Escopo e componentes

- instalar `@nestjs/terminus` como dependência de produção;
- importar `TerminusModule` no `HealthModule` existente;
- injetar `HealthCheckService` e `TypeOrmHealthIndicator` no
  `HealthController`;
- decorar o handler com `@HealthCheck()` e preservar `@Public()`;
- executar `database.pingCheck('database')` dentro de
  `HealthCheckService.check`;
- atualizar testes e exemplos Swagger que ainda descrevem a resposta estática.

O indicator deve reutilizar o `DataSource` criado por
`TypeOrmModule.forRoot(databaseConfig)`. É proibido criar outra conexão ou
duplicar credenciais apenas para health check.

## 3. Contrato HTTP

| Cenário | HTTP | Corpo mínimo esperado |
|---|---:|---|
| PostgreSQL acessível | 200 | `status="ok"`; `details.database.status="up"` |
| PostgreSQL inacessível | 503 | `status="error"`; `details.database.status="down"` |

A resposta deve seguir o envelope padrão do Terminus (`status`, `info`, `error`
e `details`). Não retornar URL de conexão, credenciais, stack trace ou detalhes
internos do driver. A rota continua sendo exatamente `GET /health`, pública e
sem criação de variantes `/ready` ou `/live`.

## 4. Testes

- unitário do controller verifica a execução única de
  `pingCheck('database')` e a delegação a `HealthCheckService.check`;
- metadados `@HealthCheck()` e `@Public()` são validados;
- caso saudável integrado responde `200` com o indicator `database` em `up`;
- indisponibilidade controlada do PostgreSQL responde `503` e marca somente o
  indicator correspondente como `down`;
- testes existentes do contrato `{ status: "ok", service: "products-service" }`
  são migrados para o envelope Terminus.

## 5. Critérios de aceite

- [ ] `@nestjs/terminus` consta em `dependencies` e no lockfile.
- [ ] `HealthModule` importa `TerminusModule` sem duplicar o módulo TypeORM.
- [ ] `GET /health` é público e retorna `200` quando o banco responde.
- [ ] A mesma rota retorna `503` quando o banco não responde.
- [ ] Os detalhes identificam a dependência com a chave estável `database`.
- [ ] Nenhuma informação sensível aparece em respostas ou logs de teste.
- [ ] Nenhum endpoint de readiness/liveness, métrica ou dashboard foi criado.
- [ ] Testes, build e lint do serviço passam.

## 6. Validação manual

1. Com serviço e PostgreSQL ativos, chamar
   `curl -i localhost:3001/health` e confirmar `database=up`.
2. Parar apenas o PostgreSQL e confirmar `503`/`database=down`.
3. Restaurar o PostgreSQL e confirmar recuperação para `200` sem reiniciar a
   aplicação.

