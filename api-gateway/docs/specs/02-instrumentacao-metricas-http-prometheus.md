# SPEC: Instrumentacao de metricas HTTP no API Gateway

**Servico:** api-gateway  
**Porta:** 3005  
**Escopo:** endpoint Prometheus e metricas tecnicas HTTP com `prom-client`  
**Status:** Pendente  
**Criado em:** 2026-08-18

---

## 1. Objetivo

Instrumentar o API Gateway com metricas HTTP no formato Prometheus e expor
`GET /metrics` sem exigir JWT. O Prometheus ja coleta esse endereco a cada 15
segundos em `host.docker.internal:3005`.

Esta entrega cobre somente metricas tecnicas HTTP e metricas padrao do runtime
Node.js. Nao deve criar metricas de negocio, dashboards, alertas nem alterar a
stack de Prometheus/Grafana.

## 2. Dependencia e estrutura

Adicionar `prom-client` como dependencia de producao do `api-gateway`, atualizando
`package.json` e `package-lock.json` pelo gerenciador npm.

Criar:

```text
src/metrics/
├── metrics.module.ts
├── metrics.service.ts
├── metrics.controller.ts
├── http-metrics.interceptor.ts
└── arquivos de teste correspondentes
```

## 3. MetricsModule global

Criar `MetricsModule` com `@Global()`. O modulo deve:

- declarar `MetricsService` e `MetricsController`;
- registrar `HttpMetricsInterceptor` como interceptor global via
  `APP_INTERCEPTOR`;
- exportar `MetricsService` para futuro reuso;
- ser importado uma unica vez pelo `AppModule`.

O interceptor deve coexistir com o `APP_GUARD` de throttling ja registrado no
gateway, sem mudar sua ordem ou configuracao.

## 4. MetricsService

O servico deve possuir um `Registry` proprio, sem usar implicitamente o registry
global de `prom-client`, e chamar `collectDefaultMetrics({ register })` uma unica
vez durante sua inicializacao.

Registrar no mesmo registry:

| Metrica | Tipo | Labels | Finalidade |
|---|---|---|---|
| `http_requests_total` | Counter | `method`, `route`, `status_code` | Total de requisicoes HTTP concluidas |
| `http_request_duration_seconds` | Histogram | `method`, `route`, `status_code` | Duracao das requisicoes em segundos |
| metricas padrao do Node.js | Conjunto `prom-client` | definidas pela biblioteca | Processo, memoria, CPU, event loop e garbage collector |

Usar buckets explicitos adequados a APIs HTTP: `0.005`, `0.01`, `0.025`, `0.05`,
`0.1`, `0.25`, `0.5`, `1`, `2.5`, `5` e `10` segundos. O servico deve oferecer
metodos para incrementar/observar as metricas e retornar `registry.metrics()` e
`registry.contentType`.

## 5. HttpMetricsInterceptor

O interceptor global deve medir o tempo com relogio monotonicamente adequado e
registrar exatamente uma observacao no counter e no histogram para cada
requisicao, incluindo respostas com erro.

Labels:

- `method`: verbo HTTP em maiusculas;
- `route`: template parametrizado da rota resolvida pelo Express/Nest, incluindo
  o base path do controller (por exemplo, `/products/:id`), nunca `originalUrl`
  com IDs ou query strings;
- `status_code`: codigo HTTP convertido para string; em excecoes, usar
  `HttpException.getStatus()` e usar `500` para erros desconhecidos;
- quando nao houver template resolvido, usar `unknown`, evitando transformar a
  URL bruta em label de alta cardinalidade.

`GET /metrics`, com ou sem query string, deve ser identificado pelo pathname e
ignorado antes de iniciar a medicao. Nenhuma serie HTTP pode ser criada pelo
scrape do proprio Prometheus.

## 6. MetricsController e acesso publico no gateway

Criar `GET /metrics` retornando o texto de `registry.metrics()` com o
`Content-Type` fornecido por `registry.contentType`.

O gateway nao possui JWT como `APP_GUARD`: `JwtAuthGuard` e aplicado diretamente
em controllers protegidos. Ainda assim, aplicar o decorator `@Public()` existente
ao handler de metricas para declarar explicitamente o contrato publico e impedir
regressoes caso a autenticacao se torne global. Nao aplicar `JwtAuthGuard`,
`SessionGuard` ou `RoleGuard` ao novo controller.

O `CustomThrottlerGuard` global continua ativo. Nao alterar limites nem adicionar
excecoes de throttling nesta entrega; o scrape de 15 segundos permanece abaixo
dos limites configurados.

## 7. Testes e validacao

- Testar que o registry contem o counter, o histogram e metricas padrao.
- Testar incremento e observacao com labels completas.
- Testar o interceptor em sucesso, `HttpException`, erro desconhecido, rota
  parametrizada e fallback `unknown`.
- Testar que `/metrics` e `/metrics?x=1` nao sao contabilizados.
- Testar que o controller possui metadata `@Public()`, responde sem token, usa o
  content type Prometheus e retorna as familias esperadas.
- Testar que `MetricsModule` e global, registra `APP_INTERCEPTOR` e esta importado
  no `AppModule`.
- Executar `npm test`, `npm run build` e `npm run lint` no gateway.
- Com os cinco servicos iniciados, confirmar o job `api-gateway` como `UP` em
  `http://localhost:9090/targets`.

## 8. Criterios de aceite

- [ ] `prom-client` esta instalado como dependencia de producao.
- [ ] `MetricsModule` global esta importado pelo `AppModule`.
- [ ] `GET http://localhost:3005/metrics` responde `200` sem JWT e em formato Prometheus.
- [ ] Counter e histogram usam somente `method`, `route` e `status_code`.
- [ ] Rotas parametrizadas nao geram labels com IDs reais ou query strings.
- [ ] Respostas de sucesso e erro sao contabilizadas exatamente uma vez.
- [ ] O proprio `/metrics` nao aparece nas metricas HTTP.
- [ ] Metricas padrao do Node.js sao expostas.
- [ ] O target `api-gateway` aparece `UP` no Prometheus.
- [ ] Testes, build e lint passam.
- [ ] Nenhuma metrica de negocio, dashboard ou mudanca de infraestrutura foi criada.
