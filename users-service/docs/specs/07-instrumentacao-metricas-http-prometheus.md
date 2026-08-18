# SPEC: Instrumentacao de metricas HTTP no Users Service

**Servico:** users-service  
**Porta:** 3000  
**Escopo:** endpoint Prometheus e metricas tecnicas HTTP com `prom-client`  
**Status:** Pendente  
**Criado em:** 2026-08-18

---

## 1. Objetivo

Expor `GET /metrics` no Users Service para que o Prometheus colete metricas a
cada 15 segundos em `host.docker.internal:3000`. A entrega abrange metricas
tecnicas HTTP e metricas padrao do Node.js, sem metricas de negocio, dashboards,
alertas ou alteracoes no Prometheus/Grafana.

## 2. Dependencia e componentes

Instalar `prom-client` como dependencia de producao, atualizando `package.json` e
`package-lock.json` via npm. Criar em `src/metrics/`:

- `MetricsModule`, marcado com `@Global()`;
- `MetricsService` e seus testes;
- `HttpMetricsInterceptor` e seus testes;
- `MetricsController` e seus testes.

O modulo deve declarar controller e service, exportar `MetricsService`, registrar
o interceptor com `APP_INTERCEPTOR` e ser importado uma unica vez no `AppModule`.

## 3. Registry e metricas

`MetricsService` deve criar um `Registry` proprio e executar
`collectDefaultMetrics({ register })` uma unica vez. Counter, histogram e
metricas padrao devem compartilhar esse registry, evitando estado global e
duplicacao de coletores em testes.

| Metrica | Tipo | Labels | Finalidade |
|---|---|---|---|
| `http_requests_total` | Counter | `method`, `route`, `status_code` | Requisicoes concluidas |
| `http_request_duration_seconds` | Histogram | `method`, `route`, `status_code` | Latencia HTTP em segundos |
| metricas padrao do Node.js | `collectDefaultMetrics` | biblioteca | CPU, memoria, event loop, GC e processo |

O histogram deve usar os buckets `0.005`, `0.01`, `0.025`, `0.05`, `0.1`, `0.25`,
`0.5`, `1`, `2.5`, `5` e `10`. O servico deve expor operacoes para registrar uma
requisicao e obter `registry.metrics()` e `registry.contentType`.

## 4. Interceptor HTTP

O `HttpMetricsInterceptor`, registrado globalmente, deve:

- medir cada requisicao com duracao em segundos;
- incrementar counter e observar histogram exatamente uma vez, em sucesso ou erro;
- usar `method` em maiusculas, `status_code` como string e o template da rota
  Nest/Express, incluindo base path, como `route`;
- preservar parametros no formato `:id`, sem usar IDs reais, query strings ou
  `originalUrl` como label;
- usar `unknown` se o template nao estiver disponivel;
- obter o status de `HttpException.getStatus()` e usar `500` para erro desconhecido;
- ignorar o pathname exato `/metrics`, inclusive quando houver query string,
  antes de iniciar a medicao.

## 5. Endpoint publico

`MetricsController` deve implementar `GET /metrics`, retornar o texto do registry
e definir o `Content-Type` informado por `registry.contentType`.

Como o `AuthModule` registra `JwtAuthGuard` globalmente com `APP_GUARD`, o handler
deve usar o decorator `@Public()` existente em
`src/auth/decorators/public.decorator.ts`. A rota deve responder sem header
`Authorization`, assim como o health check publico.

## 6. Testes e validacao

- Testes unitarios do service comprovam registro das duas familias HTTP e das
  metricas padrao.
- Testes do interceptor cobrem sucesso, `HttpException`, erro generico, template
  parametrizado, fallback `unknown` e exclusao de `/metrics` com/sem query.
- Teste do controller confirma metadata `@Public()`, status 200, content type e
  payload Prometheus.
- Teste do modulo confirma `@Global()`, provider `APP_INTERCEPTOR`, export do
  service e import no `AppModule`.
- Teste e2e acessa `/metrics` sem JWT, realiza uma chamada a outra rota e confirma
  que as familias HTTP aparecem sem contabilizar `/metrics`.
- Executar `npm test`, `npm run build` e `npm run lint`.
- Com todos os servicos iniciados, confirmar `users-service` como `UP` em
  `http://localhost:9090/targets`.

## 7. Criterios de aceite

- [ ] `prom-client` esta instalado como dependencia de producao.
- [ ] O `MetricsModule` global esta importado pelo `AppModule`.
- [ ] `GET http://localhost:3000/metrics` retorna `200` sem JWT e formato Prometheus.
- [ ] Counter e histogram possuem somente `method`, `route` e `status_code`.
- [ ] A label `route` nao contem IDs reais nem query strings.
- [ ] Sucessos e erros sao registrados uma unica vez com status correto.
- [ ] `/metrics` nao incrementa nem cria series das metricas HTTP.
- [ ] Metricas padrao do Node.js estao presentes.
- [ ] O target `users-service` esta `UP` no Prometheus.
- [ ] Testes, build e lint passam.
- [ ] Nao foram criadas metricas de negocio, dashboards ou alteracoes de infraestrutura.
