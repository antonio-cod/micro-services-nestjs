# SPEC: Health check avançado de PostgreSQL e RabbitMQ no Payments Service

**Serviço:** `payments-service`  
**Porta local:** `3004`  
**Status:** Pendente  
**Dependências verificadas:** PostgreSQL e RabbitMQ

## 1. Objetivo

Substituir o health check geral estático do `payments-service` por uma checagem
real de PostgreSQL e RabbitMQ com `@nestjs/terminus`, sem modificar o endpoint
legado de métricas do consumer.

## 2. Escopo

- instalar `@nestjs/terminus` como dependência de produção;
- importar `TerminusModule` em `HealthModule`;
- usar `HealthCheckService`, `TypeOrmHealthIndicator` e
  `MicroserviceHealthIndicator` em `GET /health`;
- checar PostgreSQL com `database.pingCheck('database')`;
- checar RabbitMQ com `microservice.pingCheck('rabbitmq', { transport:
  Transport.RMQ, options: { urls: [rabbitMqUrl] } })`;
- obter `rabbitMqUrl` de `RABBITMQ_URL` via `ConfigService`, reutilizando a
  configuração e as regras de validação existentes;
- atualizar testes do health check geral.

`GET /consumer-metrics/health` possui finalidade e contrato próprios e deve
permanecer inalterado. Não o chamar por dentro de `GET /health` e não substituí-lo.

## 3. Contrato e segurança

O handler deve usar `@HealthCheck()` e retornar o envelope padrão do Terminus.
Com as duas dependências disponíveis, responde HTTP `200`, `status: "ok"`,
`details.database.status: "up"` e `details.rabbitmq.status: "up"`.

Falha ou timeout de qualquer dependência responde HTTP `503`, `status: "error"`
e marca a dependência como `down`; a outra dependência deve continuar visível no
resultado quando sua verificação concluir. Não retornar credenciais, URLs de
conexão, stack traces, nomes de entidades ou conteúdo de mensagens.

O ping RMQ não deve consumir de `payment_queue`, declarar nova fila de negócio
ou produzir eventos. Ele usa somente a conexão temporária gerenciada pelo
indicator.

## 4. Testes

- teste unitário confirma a chamada dos indicators `database` e `rabbitmq` uma
  única vez e o uso de `Transport.RMQ`;
- teste saudável valida HTTP `200` e ambos os detalhes como `up`;
- cenários separados de PostgreSQL indisponível e RabbitMQ indisponível validam
  HTTP `503` e a chave `down` correspondente;
- ausência/invalidez de `RABBITMQ_URL` falha de forma determinística na
  inicialização conforme a configuração existente, sem vazar o valor;
- testes antigos que esperam `{ status: "healthy" }` em `GET /health` são
  atualizados;
- testes de `GET /consumer-metrics/health` continuam passando sem alteração de
  contrato.

## 5. Critérios de aceite

- [ ] `@nestjs/terminus` consta em `dependencies` e no lockfile.
- [ ] O `HealthModule` importa `TerminusModule` e está registrado uma única vez.
- [ ] `GET /health` retorna `200` apenas quando PostgreSQL e RabbitMQ respondem.
- [ ] Falha de banco ou broker produz `503` e identifica `database` ou
  `rabbitmq` como `down`.
- [ ] TypeORM e `RABBITMQ_URL` existentes são reutilizados, sem conexões de
  negócio paralelas.
- [ ] `GET /consumer-metrics/health` e o processamento de pagamentos não foram
  alterados.
- [ ] Nenhum segredo aparece no contrato público.
- [ ] Não foram implementados readiness/liveness nem novas métricas.
- [ ] Testes, build e lint passam.

## 6. Validação manual

1. Com banco e broker ativos, chamar `curl -i localhost:3004/health` e confirmar
   `200`, `database=up` e `rabbitmq=up`.
2. Parar somente o broker e confirmar `503`/`rabbitmq=down`, sem consumir ou
   publicar mensagem.
3. Restaurar o broker, parar somente o banco e confirmar `503`/`database=down`.
4. Confirmar que `GET /consumer-metrics/health` preserva sua resposta anterior.

