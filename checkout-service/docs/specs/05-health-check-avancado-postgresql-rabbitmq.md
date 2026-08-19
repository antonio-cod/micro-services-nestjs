# SPEC: Health check avançado de PostgreSQL e RabbitMQ no Checkout Service

**Serviço:** `checkout-service`  
**Porta local:** `3003`  
**Status:** Pendente  
**Dependências verificadas:** PostgreSQL e RabbitMQ

## 1. Objetivo

Fazer `GET /health` refletir a capacidade do `checkout-service` de acessar o
PostgreSQL e estabelecer comunicação com o RabbitMQ, substituindo o retorno
estático atual por indicators do `@nestjs/terminus`.

## 2. Dependências e módulo

- instalar `@nestjs/terminus` como dependência de produção;
- importar `TerminusModule` no `HealthModule` existente;
- injetar `HealthCheckService`, `TypeOrmHealthIndicator` e
  `MicroserviceHealthIndicator` no controller;
- preservar `@Public()` e a rota `GET /health`;
- reutilizar `databaseConfig`/TypeORM e a variável `RABBITMQ_URL` já usada pelo
  serviço. Não criar novas variáveis de infraestrutura.

## 3. Indicators

Executar os dois indicators na mesma chamada a `HealthCheckService.check`:

1. `database.pingCheck('database')` para o PostgreSQL;
2. `microservice.pingCheck('rabbitmq', { transport: Transport.RMQ, options: {
   urls: [rabbitMqUrl] } })` para o RabbitMQ.

As opções RMQ devem ser construídas por provider/factory do `HealthModule`,
usando `ConfigService`, com validação de `RABBITMQ_URL` equivalente à integração
existente. Não registrar consumer, queue exclusiva ou handler de mensagens para
executar o ping. Não criar uma conexão persistente adicional fora do ciclo
gerenciado pelo indicator.

## 4. Contrato HTTP

O endpoint usa `@HealthCheck()` e o envelope padrão do Terminus.

| Banco | RabbitMQ | HTTP | `status` | Detalhes |
|---|---|---:|---|---|
| up | up | 200 | `ok` | `database=up`, `rabbitmq=up` |
| down | up | 503 | `error` | `database=down`, `rabbitmq=up` |
| up | down | 503 | `error` | `database=up`, `rabbitmq=down` |
| down | down | 503 | `error` | ambos `down` |

Não expor `RABBITMQ_URL`, credenciais, DSN do banco, stack trace ou payloads de
mensagens. A mudança não altera as rotas de negócio nem suas semânticas.

## 5. Testes

- unitários validam os nomes estáveis `database` e `rabbitmq`, as opções
  `Transport.RMQ` e a execução dos dois indicators;
- unitário garante que falha de qualquer indicator resulta no erro propagado
  pelo Terminus, sem ser convertida em sucesso;
- teste HTTP/e2e com ambas as dependências ativas confirma `200` e os dois
  indicators `up`;
- testes controlados cobrem banco indisponível e broker indisponível
  separadamente, esperando `503` e identificando a dependência correta;
- atualizar testes e Swagger que esperam o antigo objeto
  `{ status: "ok", service: "checkout-service" }`.

## 6. Critérios de aceite

- [ ] `@nestjs/terminus` está instalado e o lockfile foi atualizado.
- [ ] `HealthModule` importa `TerminusModule` e permanece no `AppModule`.
- [ ] `GET /health` continua público e não exige JWT.
- [ ] Com PostgreSQL e RabbitMQ ativos, retorna `200` e ambos estão `up`.
- [ ] A falha isolada de qualquer dependência retorna `503` e marca a chave
  correta como `down`.
- [ ] O health check usa a conexão TypeORM e `RABBITMQ_URL` existentes.
- [ ] A resposta não contém segredos ou detalhes internos de conexão.
- [ ] Não foram adicionados readiness/liveness, métricas ou mudanças de negócio.
- [ ] Testes, build e lint passam.

## 7. Validação manual

1. Com PostgreSQL e RabbitMQ ativos, executar
   `curl -i localhost:3003/health` e confirmar os dois indicators `up`.
2. Parar somente o RabbitMQ e confirmar `503`/`rabbitmq=down`.
3. Restaurar o broker, parar somente o PostgreSQL e confirmar
   `503`/`database=down`.
4. Restaurar tudo e confirmar recuperação para `200`.

