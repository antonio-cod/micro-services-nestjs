# SPEC: Instrumentacao de metricas HTTP no Products Service

**Servico:** products-service  
**Porta:** 3001  
**Escopo:** endpoint Prometheus e metricas tecnicas HTTP com `prom-client`  
**Status:** Pendente  
**Criado em:** 2026-08-18

---

## 1. Objetivo

Instrumentar o Products Service e expor `GET /metrics` para o scrape ja
configurado em `host.docker.internal:3001`, a cada 15 segundos. O escopo inclui
somente metricas HTTP e metricas padrao do Node.js; metricas de negocio,
dashboards, alertas e mudancas no Prometheus/Grafana ficam fora desta SPEC.

## 2. Dependencia e estrutura

Instalar `prom-client` como dependencia de producao, mantendo `package.json` e
`package-lock.json` sincronizados pelo npm. Criar `src/metrics/` com
`metrics.module.ts`, `metrics.service.ts`, `metrics.controller.ts`,
`http-metrics.interceptor.ts` e respectivos testes.

`MetricsModule` deve usar `@Global()`, declarar service/controller, exportar o
service, fornecer o interceptor global via `APP_INTERCEPTOR` e ser importado uma
unica vez no `AppModule`.

## 3. Contrato das metricas

`MetricsService` deve manter um `Registry` exclusivo e executar
`collectDefaultMetrics({ register })` uma vez. Nao usar o registry global
implicito do `prom-client`.

| Metrica | Tipo | Labels | Finalidade |
|---|---|---|---|
| `http_requests_total` | Counter | `method`, `route`, `status_code` | Volume HTTP por rota e resultado |
| `http_request_duration_seconds` | Histogram | `method`, `route`, `status_code` | Distribuicao da latencia HTTP |
| metricas padrao Node.js | coletores padrao | biblioteca | Processo, CPU, memoria, GC e event loop |

O histogram deve usar buckets em segundos: `0.005`, `0.01`, `0.025`, `0.05`,
`0.1`, `0.25`, `0.5`, `1`, `2.5`, `5`, `10`. O service deve disponibilizar o
registro de uma observacao, `registry.metrics()` e `registry.contentType`.

## 4. Captura HTTP

Registrar `HttpMetricsInterceptor` globalmente. Para cada requisicao concluida,
inclusive com erro, ele deve incrementar counter e histogram exatamente uma vez.

- `method`: verbo em maiusculas;
- `route`: template parametrizado combinado com o base path, por exemplo
  `/products/:id`; nunca usar `originalUrl`, IDs concretos ou query strings;
- `status_code`: string; usar status da resposta em sucesso,
  `HttpException.getStatus()` em erro conhecido e `500` nos demais erros;
- usar `unknown` quando o template da rota nao estiver disponivel;
- ignorar o pathname `/metrics`, inclusive com query string, antes da medicao.

## 5. Endpoint e autenticacao

Criar `MetricsController` com `GET /metrics`, resposta textual de
`registry.metrics()` e `Content-Type` igual a `registry.contentType`.

O Products Service registra `JwtAuthGuard` como `APP_GUARD` no `AuthModule`.
Aplicar ao handler o `@Public()` ja existente, garantindo scrape sem token e sem
alterar o comportamento das rotas protegidas ou publicas do catalogo.

## 6. Testes e validacao

- Testar criacao do registry, metricas HTTP, metricas padrao e buckets.
- Testar interceptor em sucesso, erro HTTP, erro generico, rota parametrizada,
  fallback `unknown` e exclusao de `/metrics` com/sem query.
- Testar metadata `@Public()`, payload e content type do controller.
- Testar composicao global do modulo e importacao no `AppModule`.
- No e2e, chamar `/metrics` sem JWT, exercitar uma rota publica de produtos e
  confirmar a serie com template de rota, sem IDs concretos.
- Executar `npm test`, `npm run build` e `npm run lint`.
- Confirmar o job `products-service` como `UP` em
  `http://localhost:9090/targets` quando os cinco servicos estiverem iniciados.

## 7. Criterios de aceite

- [ ] `prom-client` consta nas dependencias de producao e no lockfile.
- [ ] `MetricsModule` e global e esta importado pelo `AppModule`.
- [ ] `GET http://localhost:3001/metrics` responde `200` sem JWT.
- [ ] A resposta possui content type e sintaxe de exposicao Prometheus.
- [ ] Counter e histogram usam apenas `method`, `route` e `status_code`.
- [ ] Labels de rota sao parametrizadas e de baixa cardinalidade.
- [ ] Sucessos e erros sao contabilizados exatamente uma vez.
- [ ] Scrapes de `/metrics` nao sao contabilizados.
- [ ] Metricas padrao do Node.js sao expostas.
- [ ] O target `products-service` aparece `UP` no Prometheus.
- [ ] Testes, build e lint passam.
- [ ] Nenhuma metrica de negocio, dashboard ou infraestrutura foi adicionada.
