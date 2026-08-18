# SPEC: Instrumentacao de metricas HTTP no Checkout Service

**Servico:** checkout-service  
**Porta:** 3003  
**Escopo:** endpoint Prometheus e metricas tecnicas HTTP com `prom-client`  
**Status:** Pendente  
**Criado em:** 2026-08-18

---

## 1. Objetivo

Adicionar instrumentacao HTTP ao Checkout Service e disponibilizar
`GET /metrics` para o target `host.docker.internal:3003` do Prometheus. Esta SPEC
nao inclui metricas de carrinho, pedidos ou mensageria, nem dashboards, alertas
ou mudancas na infraestrutura de observabilidade.

## 2. Dependencia e modulo

Instalar `prom-client` como dependencia de producao com npm, atualizando
`package.json` e `package-lock.json`. Criar em `src/metrics/` o `MetricsModule`,
`MetricsService`, `HttpMetricsInterceptor`, `MetricsController` e testes.

O modulo deve ser decorado com `@Global()`, exportar `MetricsService`, registrar o
interceptor como `APP_INTERCEPTOR`, declarar o controller e ser importado uma
unica vez no `AppModule`.

## 3. MetricsService

Usar um `Registry` proprio por processo. Registrar nele as duas metricas HTTP e
chamar `collectDefaultMetrics({ register })` uma unica vez, sem depender do
registry global de `prom-client`.

| Metrica | Tipo | Labels | Finalidade |
|---|---|---|---|
| `http_requests_total` | Counter | `method`, `route`, `status_code` | Quantidade de requisicoes concluidas |
| `http_request_duration_seconds` | Histogram | `method`, `route`, `status_code` | Duracao HTTP em segundos |
| metricas padrao Node.js | coletores padrao | biblioteca | CPU, memoria, processo, GC e event loop |

Buckets do histogram: `0.005`, `0.01`, `0.025`, `0.05`, `0.1`, `0.25`, `0.5`,
`1`, `2.5`, `5`, `10`. O service deve fornecer uma operacao de registro e acesso
assincrono a `registry.metrics()` e a `registry.contentType`.

## 4. Interceptor

O interceptor global deve medir e registrar uma unica vez tanto respostas de
sucesso quanto falhas.

- Label `method`: verbo em maiusculas.
- Label `route`: template Nest/Express com base path, como `/cart/items/:id` ou
  `/orders/:id`; nao usar URL real, parametros concretos ou query string.
- Label `status_code`: string obtida da resposta; em erros usar
  `HttpException.getStatus()` ou `500` para erro desconhecido.
- Se nao houver template resolvido, usar `unknown`.
- Comparar o pathname para excluir `/metrics`, inclusive quando o scrape trouxer
  query string, antes de iniciar o timer.

## 5. Endpoint publico

`MetricsController` deve retornar `registry.metrics()` em `GET /metrics` e definir
o content type dinamico de `registry.contentType`.

O `AuthModule` do Checkout registra `JwtAuthGuard` globalmente via `APP_GUARD`.
Aplicar o decorator `@Public()` existente ao handler de metricas. O endpoint deve
ser acessivel sem JWT, sem tornar publicas rotas de carrinho ou pedidos.

## 6. Testes e validacao

- Testar registry isolado, familias HTTP, metricas padrao e buckets.
- Testar interceptor em fluxo normal, `HttpException`, erro inesperado, rotas
  parametrizadas e fallback `unknown`.
- Testar explicitamente que `/metrics` e `/metrics?param=value` nao alteram
  counter nem histogram.
- Testar metadata `@Public()`, content type e corpo do controller.
- Testar `@Global()`, `APP_INTERCEPTOR`, export do service e import no AppModule.
- Testar e2e sem JWT e validar que uma chamada a rota de checkout gera serie com
  template de baixa cardinalidade.
- Executar `npm test`, `npm run build` e `npm run lint`.
- Confirmar `checkout-service` como `UP` em `http://localhost:9090/targets` com
  todos os servicos iniciados.

## 7. Criterios de aceite

- [ ] `prom-client` esta instalado como dependencia de producao.
- [ ] `MetricsModule` global esta registrado no `AppModule`.
- [ ] `GET http://localhost:3003/metrics` retorna `200` sem JWT.
- [ ] A resposta usa formato e content type Prometheus.
- [ ] Counter e histogram usam apenas `method`, `route` e `status_code`.
- [ ] Rotas de carrinho/pedido nao incluem IDs reais nas labels.
- [ ] Sucessos e falhas sao contabilizados exatamente uma vez.
- [ ] `/metrics` nao e contabilizado pelo interceptor.
- [ ] Metricas padrao do Node.js sao expostas.
- [ ] O target `checkout-service` esta `UP` no Prometheus.
- [ ] Testes, build e lint passam.
- [ ] Nao existem novas metricas de negocio, dashboards ou mudancas de infraestrutura.
