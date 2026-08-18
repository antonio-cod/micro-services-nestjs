# SPEC: Instrumentacao de metricas HTTP no Payments Service

**Servico:** payments-service  
**Porta:** 3004  
**Escopo:** endpoint Prometheus e metricas tecnicas HTTP com `prom-client`  
**Status:** Pendente  
**Criado em:** 2026-08-18

---

## 1. Objetivo

Instrumentar as requisicoes HTTP do Payments Service e expor `GET /metrics` no
formato Prometheus para o scrape de `host.docker.internal:3004`.

Ja existe um `MetricsController` de metricas internas do consumidor RabbitMQ em
`src/events/metrics/metrics.controller.ts`, ocupando `GET /metrics` com JSON. Essa
rota deve ser migrada antes da criacao do endpoint Prometheus para eliminar o
conflito. A entrega nao deve criar novas metricas de negocio nem converter essas
metricas existentes para `prom-client`.

Dashboards, alertas e alteracoes no Prometheus/Grafana ficam fora do escopo.

## 2. Compatibilidade da rota existente

Renomear o prefixo do controller existente de `metrics` para `consumer-metrics`,
preservando sua implementacao e seus quatro handlers:

| Rota atual | Nova rota |
|---|---|
| `GET /metrics` | `GET /consumer-metrics` |
| `GET /metrics/health` | `GET /consumer-metrics/health` |
| `GET /metrics/summary` | `GET /consumer-metrics/summary` |
| `POST /metrics/reset` | `POST /consumer-metrics/reset` |

Renomear a classe para `ConsumerMetricsController` e ajustar import/registro no
`EventsModule` e testes. Nao manter alias em `/metrics`, pois qualquer resposta
nesse pathname deve ser exclusivamente o exposition format do Prometheus.

Esta e uma mudanca de rota interna necessaria; nenhum campo ou comportamento do
JSON de metricas do consumidor deve ser alterado.

## 3. Dependencia e estrutura

Instalar `prom-client` como dependencia de producao e atualizar `package.json` e
`package-lock.json` pelo npm. Criar:

```text
src/metrics/
├── metrics.module.ts
├── metrics.service.ts
├── metrics.controller.ts
├── http-metrics.interceptor.ts
└── arquivos de teste correspondentes
```

O novo `MetricsModule` deve ser `@Global()`, declarar o novo controller/service,
exportar `MetricsService`, registrar o interceptor por `APP_INTERCEPTOR` e ser
importado uma unica vez no `AppModule`.

## 4. Registry e metricas HTTP

`MetricsService` deve instanciar um `Registry` proprio, registrar counter e
histogram nesse registry e executar `collectDefaultMetrics({ register })` uma
unica vez. Nao compartilhar o estado das metricas JSON do consumidor.

| Metrica | Tipo | Labels | Finalidade |
|---|---|---|---|
| `http_requests_total` | Counter | `method`, `route`, `status_code` | Total de requisicoes HTTP |
| `http_request_duration_seconds` | Histogram | `method`, `route`, `status_code` | Latencia HTTP em segundos |
| metricas padrao Node.js | coletores padrao | biblioteca | Processo, CPU, memoria, GC e event loop |

Buckets: `0.005`, `0.01`, `0.025`, `0.05`, `0.1`, `0.25`, `0.5`, `1`, `2.5`,
`5`, `10`. Expor no service uma operacao de registro, `registry.metrics()` e
`registry.contentType`.

## 5. Interceptor HTTP

Registrar o `HttpMetricsInterceptor` como interceptor global e contabilizar cada
request concluido exatamente uma vez, inclusive erros.

- `method`: verbo HTTP em maiusculas;
- `route`: template Nest/Express com base path, por exemplo `/payments/:orderId`
  e `/consumer-metrics/summary`, sem IDs reais nem query strings;
- `status_code`: string; status da resposta em sucesso,
  `HttpException.getStatus()` em falha conhecida e `500` em erro desconhecido;
- fallback de rota: `unknown`, nunca a URL bruta;
- ignorar o pathname exato `/metrics`, com ou sem query string, antes de iniciar
  timer e contadores.

As rotas migradas para `/consumer-metrics` sao requisicoes HTTP normais e devem
ser contabilizadas pelo interceptor; seus valores internos nao devem virar
metricas Prometheus nesta SPEC.

## 6. Endpoint publico

Criar um novo `MetricsController` em `src/metrics/` com `GET /metrics`, corpo
obtido de `registry.metrics()` e `Content-Type` igual a
`registry.contentType`.

O Payments Service atualmente nao registra guard JWT global e nao possui
decorator `@Public()`. Portanto, o novo endpoint ja e publico e nao se deve criar
um decorator de autenticacao artificial nesta entrega. Um teste e2e deve fixar o
contrato de acesso sem credenciais.

## 7. Testes e validacao

- Atualizar os testes do controller legado para as novas rotas e nome de classe,
  garantindo que o JSON existente permanece igual.
- Testar registry isolado, metricas HTTP, metricas padrao e buckets.
- Testar interceptor em sucesso, `HttpException`, erro desconhecido, rota
  parametrizada, fallback `unknown` e exclusao de `/metrics` com/sem query.
- Confirmar que `/consumer-metrics` e contabilizado, mas `/metrics` nao.
- Testar corpo e content type do novo controller.
- Testar modulo global, `APP_INTERCEPTOR`, export e importacao no `AppModule`.
- No e2e, confirmar `/metrics` sem autenticacao e verificar que o payload nao e o
  JSON anterior do consumidor.
- Executar `npm test`, `npm run build` e `npm run lint`.
- Com todos os servicos iniciados, confirmar `payments-service` como `UP` em
  `http://localhost:9090/targets`.

## 8. Criterios de aceite

- [ ] `prom-client` esta instalado como dependencia de producao.
- [ ] O endpoint JSON anterior foi movido integralmente para `/consumer-metrics`.
- [ ] Nao existe conflito de controllers ou handlers em `GET /metrics`.
- [ ] `MetricsModule` e global e esta importado no `AppModule`.
- [ ] `GET http://localhost:3004/metrics` retorna `200`, sem credenciais, no formato Prometheus.
- [ ] Counter e histogram usam somente `method`, `route` e `status_code`.
- [ ] Rotas parametrizadas nao geram labels com IDs ou queries concretas.
- [ ] Sucessos e erros sao contabilizados exatamente uma vez.
- [ ] `/metrics` nao e contabilizado; `/consumer-metrics` e contabilizado normalmente.
- [ ] Metricas padrao do Node.js sao expostas.
- [ ] O target `payments-service` aparece `UP` no Prometheus.
- [ ] Testes, build e lint passam.
- [ ] Nenhuma nova metrica de negocio, dashboard ou alteracao de infraestrutura foi criada.
