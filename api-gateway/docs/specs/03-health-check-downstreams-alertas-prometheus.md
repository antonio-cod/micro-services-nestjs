# SPEC: Health checks de downstreams e alertas Prometheus

**Serviço coordenador:** `api-gateway`  
**Porta local:** `3005`  
**Artefatos compartilhados:** Prometheus e dashboard Marketplace Overview  
**Status:** Pendente

## 1. Objetivo

Implementar um health check Terminus no gateway que valide os quatro serviços
downstream e adicionar regras Prometheus para indisponibilidade, erro, latência,
memória e pagamentos. Exibir os alertas ativos no dashboard Overview existente.

Esta SPEC coordena os artefatos compartilhados. Os health checks internos dos
demais serviços estão definidos nas SPECs correspondentes em seus próprios
diretórios.

## 2. Health check do API Gateway

### 2.1 Dependências e módulo

Instalar como dependências de produção:

- `@nestjs/terminus`;
- `@nestjs/axios` (e `axios` caso não esteja disponível diretamente nas
  dependências do projeto).

O `HealthModule` deve importar `TerminusModule` e `HttpModule`, declarar o
`HealthController` e continuar importado no `AppModule`. O controller injeta
`HealthCheckService` e `HttpHealthIndicator`.

### 2.2 Downstreams

`GET /health` deve executar, em uma única chamada a
`HealthCheckService.check`, quatro `pingCheck`s HTTP:

| Chave do indicator | URL |
|---|---|
| `users-service` | `${USERS_SERVICE_URL}/health` |
| `products-service` | `${PRODUCTS_SERVICE_URL}/health` |
| `checkout-service` | `${CHECKOUT_SERVICE_URL}/health` |
| `payments-service` | `${PAYMENTS_SERVICE_URL}/health` |

As URLs-base devem vir da configuração existente em
`src/config/gateway.config.ts`, sem strings de host duplicadas no controller.
Normalizar somente a barra final para não gerar `//health`. Configurar timeout
HTTP explícito de `3_000 ms` no `HttpModule`; não aplicar retry ou circuit breaker
ao health check.

O endpoint deve usar `@HealthCheck()` e o envelope padrão do Terminus:

- todos respondem `2xx`: HTTP `200`, `status="ok"` e quatro indicators `up`;
- qualquer timeout, erro de rede, resposta não `2xx` ou health downstream `503`:
  HTTP `503`, `status="error"` e indicator correspondente `down`;
- executar checks de forma independente para que os detalhes identifiquem todos
  os resultados disponíveis;
- não devolver URL completa, payload remoto, stack trace ou credenciais.

O novo `GET /health` substitui somente o retorno local estático. Os endpoints
legados `/health/services` e `/health/services/:serviceName` podem ser mantidos
por compatibilidade, mas não devem ser usados internamente pelo Terminus. Os
endpoints existentes `/health/ready` e `/health/live` não devem ser modificados,
ampliados ou apresentados como probes nesta entrega.

### 2.3 Testes do gateway

- unitários verificam os quatro nomes e URLs, timeout e uma chamada por
  downstream;
- mock HTTP cobre todos saudáveis, um `503`, timeout e falhas simultâneas;
- teste HTTP/e2e confirma `200` quando os quatro mocks respondem e `503` quando
  um deles falha;
- os testes não dependem de serviços reais nem da internet;
- atualizar testes/Swagger que descrevem o corpo estático anterior.

## 3. Regras de alerta do Prometheus

Criar `observability-stack/prometheus/alert.rules.yml`, montar esse arquivo como
read-only em `/etc/prometheus/alert.rules.yml` no serviço Prometheus e adicionar
ao `prometheus.yml`:

```yaml
rule_files:
  - /etc/prometheus/alert.rules.yml
```

O arquivo deve possuir um grupo `marketplace-ms` e as regras abaixo. Toda regra
deve conter `severity`, `summary` e `description`; labels dinâmicos usados na
anotação devem existir no resultado da expressão.

### 3.1 Disponibilidade e recursos

```yaml
groups:
  - name: marketplace-ms
    rules:
      - alert: ServiceDown
        expr: up{job=~"api-gateway|users-service|products-service|checkout-service|payments-service"} == 0
        for: 30s
        labels:
          severity: critical
        annotations:
          summary: "Serviço {{ $labels.job }} indisponível"
          description: "O target {{ $labels.job }} não responde ao scrape há pelo menos 30 segundos."

      - alert: HighErrorRate
        expr: |
          100 * sum by (job) (rate(http_requests_total{job=~"api-gateway|users-service|products-service|checkout-service|payments-service",status_code=~"5.."}[5m]))
          / clamp_min(sum by (job) (rate(http_requests_total{job=~"api-gateway|users-service|products-service|checkout-service|payments-service"}[5m])), 1e-9) > 10
          and on (job) sum by (job) (rate(http_requests_total{job=~"api-gateway|users-service|products-service|checkout-service|payments-service"}[5m])) > 0
        for: 1m
        labels:
          severity: warning
        annotations:
          summary: "Taxa de erro alta em {{ $labels.job }}"
          description: "Mais de 10% das respostas foram 5xx na janela de 5 minutos."

      - alert: HighLatencyP95
        expr: |
          histogram_quantile(0.95,
            sum by (job, le) (rate(http_request_duration_seconds_bucket{job=~"api-gateway|users-service|products-service|checkout-service|payments-service"}[5m]))
          ) > 2
        for: 1m
        labels:
          severity: warning
        annotations:
          summary: "Latência P95 alta em {{ $labels.job }}"
          description: "A latência HTTP P95 permaneceu acima de 2 segundos."

      - alert: HighMemoryUsage
        expr: max by (job) (process_resident_memory_bytes{job=~"api-gateway|users-service|products-service|checkout-service|payments-service"}) > 512 * 1024 * 1024
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "Uso de memória alto em {{ $labels.job }}"
          description: "A memória RSS do processo permaneceu acima de 512 MiB."
```

### 3.2 Pagamentos

```yaml
      - alert: NoPaymentsProcessed
        expr: (sum(increase(payments_processed_total{job="payments-service"}[5m])) or vector(0)) == 0
        for: 5m
        labels:
          severity: info
          service: payments-service
        annotations:
          summary: "Nenhum pagamento processado"
          description: "Nenhum pagamento foi processado nos últimos 5 minutos por pelo menos 5 minutos."

      - alert: HighPaymentRejectionRate
        expr: |
          100 * sum(increase(payments_rejected_total{job="payments-service"}[5m]))
          / clamp_min(sum(increase(payments_processed_total{job="payments-service"}[5m])), 1) > 50
          and sum(increase(payments_processed_total{job="payments-service"}[5m])) > 0
        for: 2m
        labels:
          severity: warning
          service: payments-service
        annotations:
          summary: "Taxa de rejeição de pagamentos alta"
          description: "Mais de 50% dos pagamentos processados foram rejeitados na janela de 5 minutos."
```

`NoPaymentsProcessed` é intencionalmente informativo: em ambientes sem tráfego
ele ficará ativo. Não adicionar horário comercial ou volume mínimo sem uma SPEC
futura. `HighPaymentRejectionRate` exige ao menos um pagamento processado para
evitar divisão por zero e alerta sem amostras.

Não instalar nem configurar Alertmanager, Slack, email, webhook ou qualquer
outro canal externo.

## 4. Painel de alertas ativos no Grafana

Alterar apenas
`observability-stack/grafana/provisioning/dashboards/marketplace-overview.json`,
adicionando um painel **Alertas ativos** ao dashboard Overview existente. Nenhum
painel, query, métrica, variável ou configuração existente deve ser removido ou
alterado.

Requisitos do painel:

- visualização `Table`, datasource UID `prometheus`;
- query instantânea
  `ALERTS{alertstate="firing",alertname=~"ServiceDown|HighErrorRate|HighLatencyP95|HighMemoryUsage|NoPaymentsProcessed|HighPaymentRejectionRate"}`;
- exibir pelo menos `alertname`, `severity`, `job`/`service` e estado;
- organizar por severidade visual: `critical` vermelho, `warning` amarelo e
  `info` azul;
- título e descrição deixam claro que são somente alertas ativos;
- quando não houver séries, mostrar estado vazio legível, não erro de query;
- preservar UID `marketplace-overview`, datasource, refresh e período atuais.

## 5. Validação

### 5.1 Automatizada e estática

1. Executar testes, build e lint do `api-gateway`.
2. Validar a configuração com `promtool check config` e as regras com
   `promtool check rules /etc/prometheus/alert.rules.yml` no container.
3. Validar o dashboard com `jq empty`.
4. Reiniciar a stack e consultar `/api/v1/rules` e `/api/v1/alerts` do
   Prometheus para confirmar que as seis regras foram carregadas.

### 5.2 Cenários funcionais

- parar um serviço por mais de 30 segundos e confirmar `ServiceDown` em firing;
- gerar mais de 10% de respostas 5xx e sustentar por 1 minuto;
- gerar requests cuja P95 supere 2 segundos e sustentar por 1 minuto;
- em teste isolado de regra, fornecer RSS acima de 512 MiB por 2 minutos;
- deixar `payments_processed_total` sem incremento e validar o alerta info;
- gerar mais de 50% de rejeições, com volume processado não zero, por 2 minutos;
- confirmar que cada alerta firing aparece no novo painel do Overview e some
  após sua condição deixar de ser verdadeira.

## 6. Critérios de aceite

### Health check

- [ ] `@nestjs/terminus`, `@nestjs/axios` e a dependência HTTP necessária estão
  instalados e registrados no lockfile.
- [ ] `HealthModule` importa `TerminusModule` e `HttpModule`.
- [ ] `GET /health` consulta exatamente os quatro downstreams pela configuração
  existente e usa timeout de 3 segundos.
- [ ] Todos saudáveis resultam em HTTP `200` e quatro indicators `up`.
- [ ] Falha, timeout ou `503` de qualquer downstream resulta em HTTP `503` e
  identifica o indicator `down`.
- [ ] Nenhuma URL sensível, payload remoto ou stack trace é exposto.
- [ ] Nenhum readiness/liveness probe foi criado ou modificado.

### Prometheus e Grafana

- [ ] `alert.rules.yml` é válido e contém exatamente as seis regras requeridas,
  com nomes, thresholds, durações e severidades desta SPEC.
- [ ] `prometheus.yml` carrega o arquivo e o Compose o monta como read-only.
- [ ] `ServiceDown` cobre exatamente os cinco jobs do marketplace.
- [ ] Taxas de erro e rejeição não disparam com denominador zero.
- [ ] O Overview possui o painel **Alertas ativos** consultando apenas séries em
  firing e preserva todos os painéis existentes.
- [ ] O JSON do dashboard é válido e continua com UID `marketplace-overview`.
- [ ] As seis regras aparecem na API/UI do Prometheus sem erro de avaliação.
- [ ] Não existe configuração de Alertmanager ou notificação externa.
- [ ] Nenhuma métrica existente e nenhum outro dashboard foi alterado.

## 7. Definição de pronto

A entrega está pronta quando os cinco endpoints `/health` obedecerem às SPECs de
seus serviços, as seis regras estiverem carregadas e testadas, o Overview exibir
alertas firing e todos os testes, builds, lints e validadores de configuração
passarem sem introduzir readiness/liveness ou notificações externas.
