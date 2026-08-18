# Stack de observabilidade

Infraestrutura local de observabilidade do marketplace, composta por Prometheus
para coleta e consulta de metricas e Grafana para visualizacao.

## Pre-requisitos

- Docker
- Docker Compose

Todos os comandos a seguir devem ser executados dentro de `observability-stack/`.

## Uso

Inicie a stack em segundo plano:

```bash
docker compose up -d
```

Consulte o estado dos containers:

```bash
docker compose ps
```

Acompanhe os logs:

```bash
docker compose logs -f
```

Pare a stack preservando os dados armazenados nos volumes:

```bash
docker compose down
```

Para remover tambem os volumes, execute:

```bash
docker compose down -v
```

> **Atencao:** o comando com `-v` e destrutivo e remove permanentemente os
> dados locais persistidos pelo Prometheus e pelo Grafana.

## Acesso

- Prometheus: <http://localhost:9090>
- Grafana: <http://localhost:3010>

O Grafana usa por padrao o usuario `admin` e a senha `admin`. Essas credenciais
sao adequadas somente para desenvolvimento local e nao devem ser usadas em
producao. Elas podem ser sobrescritas ao iniciar a stack:

```bash
GRAFANA_ADMIN_USER=meu-usuario \
GRAFANA_ADMIN_PASSWORD=minha-senha \
docker compose up -d
```

O datasource `Prometheus` e provisionado automaticamente como datasource
padrao e aponta para `http://prometheus:9090` pela rede interna do Docker.

## Dashboards provisionados

O Grafana carrega automaticamente, na pasta **Marketplace MS**, os dashboards:

- **Marketplace Overview**: saude dos cinco servicos, indicadores HTTP/RED,
  memoria e metricas de pedidos, pagamentos e publicacoes RabbitMQ;
- **Service Details**: analise por servico de taxa e erros por rota, percentis de
  duracao, status codes, CPU, memoria e atraso do event loop.

Os arquivos em `grafana/provisioning/dashboards/` sao a fonte de verdade. O
provider verifica alteracoes a cada 10 segundos, os dashboards atualizam dados a
cada 15 segundos e nao sao editaveis pela interface. Mudancas devem ser feitas
nos JSONs versionados.

O manifesto `grafana/provisioning/dashboards.yml` documenta o provider no caminho
definido pela especificacao. A copia `dashboards/provider.yml` e necessaria para
o carregamento, pois o Grafana procura manifestos de dashboards dentro desse
subdiretorio; ambos devem permanecer sincronizados.

## Referencia PromQL

As consultas de fluxo usam `$__rate_interval`; totais de negocio usam
`increase(...[$__range])`, pois counters reiniciam junto com os processos.

| Indicador | PromQL |
|---|---|
| Status | `up{job=~"api-gateway|users-service|products-service|checkout-service|payments-service"}` |
| Throughput por servico | `sum by (job) (rate(http_requests_total[$__rate_interval]))` |
| Erros 4xx por servico | `100 * sum by (job) (rate(http_requests_total{status_code=~"4.."}[$__rate_interval])) / clamp_min(sum by (job) (rate(http_requests_total[$__rate_interval])), 1e-9)` |
| Erros 5xx por servico | `100 * sum by (job) (rate(http_requests_total{status_code=~"5.."}[$__rate_interval])) / clamp_min(sum by (job) (rate(http_requests_total[$__rate_interval])), 1e-9)` |
| P95 por servico | `histogram_quantile(0.95, sum by (job, le) (rate(http_request_duration_seconds_bucket[$__rate_interval])))` |
| Rate por rota | `sum by (method, route) (rate(http_requests_total{job="$service"}[$__rate_interval]))` |
| Quantil por rota | `histogram_quantile(QUANTIL, sum by (le, method, route) (rate(http_request_duration_seconds_bucket{job="$service"}[$__rate_interval])))` |
| Top 10 rotas | `topk(10, sum by (method, route) (increase(http_requests_total{job="$service"}[$__range])))` |
| CPU | `rate(process_cpu_user_seconds_total{job="$service"}[$__rate_interval]) + rate(process_cpu_system_seconds_total{job="$service"}[$__rate_interval])` |
| Pagamentos processados | `sum(increase(payments_processed_total{job="payments-service"}[$__range])) or on() vector(0)` |
| Rejeicoes por motivo | `sum by (reason) (increase(payments_rejected_total{job="payments-service"}[$__range]))` |
| Pedidos criados | `sum(increase(orders_created_total{job="checkout-service"}[$__range])) or on() vector(0)` |
| Publicacoes por fila | `sum by (queue) (increase(rabbitmq_messages_published_total{job="checkout-service"}[$__range]))` |

## Diagnostico do Prometheus

Os cinco servicos da aplicacao sao executados diretamente no host. O Prometheus
os acessa por `host.docker.internal`, cujo funcionamento no Linux e garantido
pelo mapeamento `extra_hosts` com `host-gateway` no Compose.

Enquanto o endpoint `/metrics` nao estiver implementado nos servicos, os
targets podem aparecer como `DOWN`; isso e esperado nesta etapa. Consulte:

- Configuracao carregada: <http://localhost:9090/config>
- Estado dos targets: <http://localhost:9090/targets>

## Mapa de portas

### Servicos da aplicacao

| Componente | Porta no host | Finalidade |
|---|---:|---|
| users-service | 3000 | API de usuarios e autenticacao |
| products-service | 3001 | API de produtos |
| checkout-service | 3003 | API de carrinho e pedidos |
| payments-service | 3004 | API e processamento de pagamentos |
| api-gateway | 3005 | Entrada publica do marketplace |

### Infraestrutura

| Componente | Porta no host | Porta no container | Finalidade |
|---|---:|---:|---|
| Prometheus | 9090 | 9090 | Coleta e consulta de metricas |
| Grafana | 3010 | 3000 | Visualizacao de metricas |
| RabbitMQ AMQP | 5672 | 5672 | Mensageria |
| RabbitMQ Management | 15672 | 15672 | Administracao do RabbitMQ |
| PostgreSQL users | 5433 | 5432 | Banco do users-service |
| PostgreSQL products | 5434 | 5432 | Banco do products-service |
| PostgreSQL payments | 5435 | 5432 | Banco do payments-service |
| PostgreSQL checkout | 5436 | 5432 | Banco do checkout-service |
