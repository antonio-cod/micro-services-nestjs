# SPEC — Dashboards Grafana e métricas de negócio

## 1. Objetivo

Adicionar métricas de negócio aos serviços de pagamentos e checkout e disponibilizar dois dashboards Grafana versionados no repositório:

- **Marketplace Overview**, para uma visão operacional e de negócio dos cinco serviços;
- **Service Details**, para análise RED e de recursos de um serviço selecionado.

Esta entrega usa o `MetricsService` global e o `Registry` já existentes, as métricas HTTP atuais e o datasource Prometheus de UID `prometheus` já provisionado.

## 2. Escopo

### Incluído

- novos counters `prom-client` em `payments-service` e `checkout-service`;
- instrumentação dos fluxos de pagamento, criação de pedido e publicação da mensagem de pagamento;
- testes unitários das métricas e dos pontos de instrumentação;
- dois dashboards em JSON;
- provisioning dos dashboards por arquivo;
- documentação das principais queries PromQL.

### Fora de escopo

- alertas ou regras de alerting;
- métricas de banco de dados;
- RabbitMQ exporter ou métricas internas do broker;
- mudanças no scrape, intervalo ou targets do Prometheus;
- mudanças no Docker Compose ou na infraestrutura existente de Prometheus/Grafana;
- métricas de valor financeiro, filas consumidas, retries ou DLQ.

## 3. Estado atual e premissas

- Os jobs Prometheus são `api-gateway`, `users-service`, `products-service`, `checkout-service` e `payments-service`.
- Todos expõem `/metrics`, coletado a cada 15 segundos.
- `http_requests_total` possui labels `method`, `route` e `status_code`.
- `http_request_duration_seconds` é um histogram com os mesmos labels.
- `collectDefaultMetrics` fornece, entre outras, `process_resident_memory_bytes`, `process_cpu_user_seconds_total`, `process_cpu_system_seconds_total` e `nodejs_eventloop_lag_seconds`.
- O label externo `job`, adicionado pelo Prometheus, é a identidade canônica do serviço nos dashboards.
- Counters reiniciam quando o processo reinicia. Painéis de fluxo devem usar `rate`/`increase`, e não interpretar o valor bruto como total histórico persistente.
- As janelas dos painéis devem usar `$__rate_interval`, exceto totais de negócio no período, que usam `increase(...[$__range])`.

## 4. Métricas de negócio

Todos os counters devem ser criados uma única vez no construtor do `MetricsService`, registrados explicitamente no registry privado com `registers: [this.registry]` e expostos por métodos de intenção. Nenhum controller ou serviço de domínio deve manipular o objeto `Counter` diretamente.

### 4.1 `payments-service`

| Métrica | Tipo | Labels | Momento do incremento |
|---|---|---|---|
| `payments_processed_total` | Counter | nenhum | uma vez após persistir uma nova transição de `PENDING` para estado terminal |
| `payments_approved_total` | Counter | nenhum | junto de `payments_processed_total`, quando o estado terminal persistido for `APPROVED` |
| `payments_rejected_total` | Counter | `reason` | junto de `payments_processed_total`, quando o estado terminal persistido for `REJECTED` |

Regras:

1. `payments_processed_total` representa resultados de negócio concluídos, logo deve ser igual à soma dos incrementos de aprovados e rejeitados desde o início do processo.
2. O incremento ocorre somente depois de `paymentsRepository.save(payment)` concluir com sucesso.
3. O retorno idempotente de um pagamento já terminal não incrementa nenhum counter novamente.
4. Exceções de validação, gateway ou persistência não incrementam os counters desta seção.
5. O label `reason` não pode receber texto livre, IDs nem mensagens de exceção. Ele deve usar o código estável retornado pelo gateway, normalizado em `snake_case`; valores ausentes ou desconhecidos viram `unknown`. Deve existir uma allowlist explícita baseada nos motivos suportados pelo `FakePaymentGatewayService`.
6. O `MetricsService` deve expor operações equivalentes a `recordPaymentApproved()` e `recordPaymentRejected(reason)`; cada operação incrementa tanto o resultado específico quanto `payments_processed_total`.

Essa instrumentação deve ficar no ponto que conhece a transição persistida, em `PaymentsService.processPayment`, e não no consumer RabbitMQ. Assim, retries e entregas duplicadas não contam duas vezes quando a operação retorna um pagamento já terminal.

### 4.2 `checkout-service`

| Métrica | Tipo | Labels | Momento do incremento |
|---|---|---|---|
| `orders_created_total` | Counter | nenhum | uma vez, após a transação que persiste o novo pedido concluir com sucesso |
| `rabbitmq_messages_published_total` | Counter | `queue` | depois que a publicação confirmar sucesso |

Regras:

1. `orders_created_total` mede pedidos persistidos, mesmo se a publicação posterior falhar. Não incrementar dentro da callback da transação, pois a transação ainda pode sofrer rollback.
2. `rabbitmq_messages_published_total` não é incrementado quando `publishMessage` lança exceção ou retorna falha.
3. Nesta entrega, a publicação de `payment.order` usa `queue="payment_queue"`. O label contém apenas nomes lógicos conhecidos e nunca routing keys, payloads ou IDs.
4. A instrumentação de publicação fica em `PaymentQueueService.publishPaymentOrder`, após o retorno bem-sucedido de `RabbitmqService.publishMessage`, evitando contar tentativas falhas.
5. O `MetricsService` deve expor operações equivalentes a `recordOrderCreated()` e `recordRabbitMqMessagePublished(queue)`.

### 4.3 Requisitos de implementação e testes

- Declarar os counters com `help` descritivo e, quando aplicável, `labelNames` tipado.
- Não usar o registry global default do `prom-client`.
- Não adicionar labels como `user_id`, `order_id`, `payment_id` ou texto de erro.
- Testar a presença, tipo e labels das séries no texto retornado por `getMetrics()`.
- Testar incrementos de sucesso, aprovação, rejeição e motivo normalizado.
- Testar que falha e retorno idempotente não incrementam counters.
- Testar que pedido criado e publicação bem-sucedida incrementam separadamente, inclusive o cenário pedido persistido/publicação falha.

## 5. Provisioning dos dashboards

Criar a seguinte estrutura, sem alterar `docker-compose.yml`:

```text
observability-stack/grafana/provisioning/
├── dashboards/
│   ├── marketplace-overview.json
│   └── service-details.json
├── dashboards.yml
└── datasources/
    └── prometheus.yml
```

`dashboards.yml` deve usar `apiVersion: 1`, um provider do tipo `file`, `disableDeletion: false`, `editable: false`, `updateIntervalSeconds: 10` e o caminho `/etc/grafana/provisioning/dashboards`. A montagem existente de toda a pasta `provisioning` já torna esses arquivos disponíveis ao Grafana; não é necessária alteração no Compose.

Requisitos comuns aos JSONs:

- UIDs estáveis: `marketplace-overview` e `service-details`;
- `schemaVersion` compatível com a versão de Grafana do projeto;
- datasource referenciado por UID `prometheus`, nunca por ID numérico;
- `refresh: 15s`, timezone `browser` e período inicial `now-6h` a `now`;
- tags `marketplace-ms` e `observability`;
- títulos, unidades, legendas e descrições de painel explícitos;
- nenhuma configuração de alerting;
- arquivos formatados e válidos como JSON, sem exportar dados locais, IDs de datasource ou credenciais.

## 6. Dashboard `Marketplace Overview`

Dashboard sem filtro obrigatório, cobrindo os cinco jobs. Organização sugerida: **Saúde**, **HTTP/RED**, **Recursos** e **Negócio**.

| Painel | Visualização | Especificação |
|---|---|---|
| Status dos serviços | Stat, repetido ou um stat por série | último valor de `up` para os cinco jobs; value mapping `1 = UP` verde e `0 = DOWN` vermelho; sem dado = `NO DATA` cinza |
| Throughput geral | Time series | requests/s agrupados por `job`; legenda com nome do serviço; unidade `req/s` |
| Taxa de erros 4xx | Time series | percentual de requests 4xx por serviço sobre todas as requests do mesmo serviço; unidade `%` |
| Taxa de erros 5xx | Time series | percentual de requests 5xx por serviço sobre todas as requests do mesmo serviço; unidade `%` |
| Latência P95 | Time series | P95 derivado do histogram e agrupado por serviço; unidade segundos |
| Memória por serviço | Time series | resident set size por serviço; unidade bytes (IEC) |
| Pagamentos processados | Stat | aumento de `payments_processed_total` no período selecionado |
| Pagamentos aprovados | Stat | aumento de `payments_approved_total` no período selecionado |
| Pagamentos rejeitados | Stat | aumento de `payments_rejected_total` no período selecionado |
| Rejeições por motivo | Bar chart | aumento no período agrupado por `reason` |
| Pedidos criados | Stat | aumento de `orders_created_total` no período selecionado |
| Mensagens publicadas | Stat ou bar gauge | aumento no período agrupado por `queue` |

As divisões de taxa devem proteger denominador zero com `clamp_min(..., 1e-9)`. Painéis de negócio sem amostras no período devem exibir zero, usando `or on() vector(0)` somente em painéis de total único; não aplicar esse fallback a agrupamentos, pois ele criaria uma série sem labels.

## 7. Dashboard `Service Details`

Criar uma variável custom ou query chamada `service`, exibida como **Service**, single-select, sem opção All, contendo exatamente os cinco jobs. A opção inicial deve ser `api-gateway`. Se for query variable, usar `label_values(up{job=~"api-gateway|users-service|products-service|checkout-service|payments-service"}, job)` e regex que limite os mesmos valores.

Todos os painéis devem filtrar com `job="$service"`.

| Painel | Visualização | Especificação |
|---|---|---|
| Rate por rota | Time series | requests/s por `method` e `route` |
| Errors 4xx por rota | Time series | percentual 4xx por `method` e `route` |
| Errors 5xx por rota | Time series | percentual 5xx por `method` e `route` |
| Duration P50 | Time series | quantil 0,50 por `method` e `route` |
| Duration P95 | Time series | quantil 0,95 por `method` e `route` |
| Duration P99 | Time series | quantil 0,99 por `method` e `route` |
| Top rotas por volume | Table | top 10 combinações `method`/`route` por aumento no período selecionado; colunas Route, Method e Requests, em ordem decrescente |
| Distribuição de status codes | Pie chart | aumento no período agrupado por `status_code`; legenda com código, valor e percentual |
| CPU | Time series | CPU do processo em cores/segundo, soma de user e system; unidade `cores` |
| Memória | Time series | `process_resident_memory_bytes`; unidade bytes (IEC) |
| Event loop lag | Time series | `nodejs_eventloop_lag_seconds`; unidade segundos |

O label `route` já contém templates normalizados. O dashboard não deve derivar rotas de URLs brutas nem ocultar `route="unknown"`; essa série é útil para diagnosticar falhas de instrumentação.

Para quantis por rota, agregar buckets por `le`, `method` e `route` antes de chamar `histogram_quantile`. Não manter `status_code` na agregação, pois isso produziria um quantil separado por status em vez da latência total da rota.

## 8. Referência PromQL

Nos exemplos, `$__rate_interval`, `$__range` e `$service` são variáveis do Grafana.

| Finalidade | Query PromQL |
|---|---|
| Status dos cinco serviços | `up{job=~"api-gateway|users-service|products-service|checkout-service|payments-service"}` |
| Throughput por serviço | `sum by (job) (rate(http_requests_total[$__rate_interval]))` |
| Erros 4xx por serviço (%) | `100 * sum by (job) (rate(http_requests_total{status_code=~"4.."}[$__rate_interval])) / clamp_min(sum by (job) (rate(http_requests_total[$__rate_interval])), 1e-9)` |
| Erros 5xx por serviço (%) | `100 * sum by (job) (rate(http_requests_total{status_code=~"5.."}[$__rate_interval])) / clamp_min(sum by (job) (rate(http_requests_total[$__rate_interval])), 1e-9)` |
| P95 por serviço | `histogram_quantile(0.95, sum by (job, le) (rate(http_request_duration_seconds_bucket[$__rate_interval])))` |
| Memória por serviço | `max by (job) (process_resident_memory_bytes)` |
| Rate por rota | `sum by (method, route) (rate(http_requests_total{job="$service"}[$__rate_interval]))` |
| 4xx por rota (%) | `100 * sum by (method, route) (rate(http_requests_total{job="$service",status_code=~"4.."}[$__rate_interval])) / clamp_min(sum by (method, route) (rate(http_requests_total{job="$service"}[$__rate_interval])), 1e-9)` |
| 5xx por rota (%) | `100 * sum by (method, route) (rate(http_requests_total{job="$service",status_code=~"5.."}[$__rate_interval])) / clamp_min(sum by (method, route) (rate(http_requests_total{job="$service"}[$__rate_interval])), 1e-9)` |
| P50 por rota | `histogram_quantile(0.50, sum by (le, method, route) (rate(http_request_duration_seconds_bucket{job="$service"}[$__rate_interval])))` |
| P95 por rota | `histogram_quantile(0.95, sum by (le, method, route) (rate(http_request_duration_seconds_bucket{job="$service"}[$__rate_interval])))` |
| P99 por rota | `histogram_quantile(0.99, sum by (le, method, route) (rate(http_request_duration_seconds_bucket{job="$service"}[$__rate_interval])))` |
| Top 10 rotas no período | `topk(10, sum by (method, route) (increase(http_requests_total{job="$service"}[$__range])))` |
| Status codes no período | `sum by (status_code) (increase(http_requests_total{job="$service"}[$__range]))` |
| CPU do processo | `rate(process_cpu_user_seconds_total{job="$service"}[$__rate_interval]) + rate(process_cpu_system_seconds_total{job="$service"}[$__rate_interval])` |
| Memória do processo | `process_resident_memory_bytes{job="$service"}` |
| Event loop lag | `nodejs_eventloop_lag_seconds{job="$service"}` |
| Pagamentos processados no período | `sum(increase(payments_processed_total{job="payments-service"}[$__range])) or on() vector(0)` |
| Pagamentos aprovados no período | `sum(increase(payments_approved_total{job="payments-service"}[$__range])) or on() vector(0)` |
| Pagamentos rejeitados no período | `sum(increase(payments_rejected_total{job="payments-service"}[$__range])) or on() vector(0)` |
| Rejeições por motivo | `sum by (reason) (increase(payments_rejected_total{job="payments-service"}[$__range]))` |
| Pedidos criados no período | `sum(increase(orders_created_total{job="checkout-service"}[$__range])) or on() vector(0)` |
| Publicações por fila | `sum by (queue) (increase(rabbitmq_messages_published_total{job="checkout-service"}[$__range]))` |

## 9. Critérios de aceite

### Métricas

- [ ] O endpoint `/metrics` do `payments-service` expõe os tipos `payments_processed_total`, `payments_approved_total` e `payments_rejected_total`, sendo apenas a última série rotulada por `reason`.
- [ ] Ao concluir um pagamento aprovado novo, `payments_processed_total` e `payments_approved_total` aumentam em 1, e `payments_rejected_total` não aumenta.
- [ ] Ao concluir um pagamento rejeitado novo, `payments_processed_total` e `payments_rejected_total{reason="<normalizado>"}` aumentam em 1, e `payments_approved_total` não aumenta.
- [ ] Reprocessar o mesmo pagamento já terminal não altera nenhum dos três counters.
- [ ] Falha antes da persistência terminal não altera nenhum dos três counters.
- [ ] O endpoint `/metrics` do `checkout-service` expõe `orders_created_total` e `rabbitmq_messages_published_total{queue="payment_queue"}`.
- [ ] Um checkout cuja transação foi confirmada aumenta `orders_created_total` em 1.
- [ ] Uma publicação confirmada em `payment_queue` aumenta o counter correspondente em 1; uma publicação que lança erro não o aumenta.
- [ ] Se o pedido é persistido e a publicação falha, somente `orders_created_total` aumenta.
- [ ] Nenhuma nova métrica possui labels de cardinalidade não limitada.
- [ ] Os testes unitários novos e existentes dos dois serviços passam.

### Provisioning e dashboards

- [ ] `dashboards.yml`, `marketplace-overview.json` e `service-details.json` estão versionados nos caminhos especificados e os JSONs passam em um parser (`jq empty`).
- [ ] Após reiniciar somente a stack existente com `docker compose up -d`, os dois dashboards aparecem automaticamente no Grafana sem importação manual.
- [ ] Alterar um JSON e aguardar até 10 segundos atualiza o dashboard provisionado.
- [ ] O dashboard Marketplace Overview mostra os cinco targets como UP/DOWN/NO DATA e todos os painéis descritos na seção 6 sem erro de query.
- [ ] Gerar tráfego 2xx, 4xx e 5xx altera throughput e taxas correspondentes; as taxas são percentuais por serviço.
- [ ] A P95 é calculada a partir de `_bucket`, agregada por serviço, e a memória é exibida em bytes IEC.
- [ ] Criar um pedido e processar um pagamento atualiza os painéis de negócio no próximo scrape, em até aproximadamente 15 segundos, sem exigir refresh manual além do refresh configurado.
- [ ] O dashboard Service Details oferece somente os cinco valores de `$service`, inicia em `api-gateway` e todos os painéis mudam ao trocar a seleção.
- [ ] O dashboard Service Details apresenta Rate, Errors, P50, P95, P99, top 10 rotas, status codes, CPU, memória e event loop sem erro de query.
- [ ] Os dashboards referenciam o datasource UID `prometheus`, possuem refresh de 15 segundos e não contêm regras ou painéis de alerting.
- [ ] Nenhum arquivo de Prometheus, Docker Compose ou configuração do datasource existente foi alterado para viabilizar a entrega.

## 10. Plano de validação manual

1. Executar os testes de `payments-service` e `checkout-service`.
2. Iniciar os cinco serviços e a stack de observabilidade existente.
3. Verificar os cinco targets em `http://localhost:9090/targets`.
4. Validar os JSONs com `jq empty observability-stack/grafana/provisioning/dashboards/*.json`.
5. Abrir `http://localhost:3010`, confirmar o provisioning dos dois dashboards e ausência de erros nos painéis.
6. Gerar requests de sucesso e erro em pelo menos dois serviços e confirmar as mudanças após um ciclo de scrape.
7. Executar um checkout aprovado e um rejeitado; confirmar os increments nos endpoints `/metrics`, no Prometheus e nos painéis.
8. Simular falha de publicação e reprocessamento idempotente em teste automatizado, confirmando que não há dupla contagem.

## 11. Definição de pronto

A entrega está pronta quando código, testes, provisioning e JSONs dos dois dashboards estiverem versionados, todos os critérios de aceite forem satisfeitos e nenhuma alteração fora do escopo tiver sido introduzida.
