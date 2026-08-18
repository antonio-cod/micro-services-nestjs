# SPEC: Infraestrutura de observabilidade com Prometheus e Grafana

**Projeto:** marketplace-ms

**Componentes afetados:** nova observability-stack e documentação de infraestrutura

**Escopo:** coleta centralizada de métricas e visualização por meio de Prometheus e Grafana

**Status:** Pendente

**Criado em:** 2026-08-18

---

## 1. Objetivo

Criar uma stack local de observabilidade para o `marketplace-ms`, composta exclusivamente por Prometheus e Grafana. A stack deve ficar isolada em uma pasta própria na raiz do projeto e ser executável por Docker Compose, seguindo o modelo de infraestrutura dedicada já usado por `messaging-service/`.

O Prometheus deve estar preparado para coletar métricas dos cinco serviços do marketplace pelo endpoint `/metrics`. Como os serviços são executados diretamente no host, os targets configurados no container devem utilizar `host.docker.internal`. O Grafana deve iniciar com o Prometheus cadastrado automaticamente como datasource padrão por meio de provisioning versionado no repositório.

Esta SPEC prepara somente a infraestrutura. A implementação do endpoint `/metrics` nos serviços NestJS será definida em uma SPEC posterior. Portanto, nesta entrega é esperado que os targets sejam carregados pelo Prometheus, mas eles poderão aparecer como `DOWN` até que a instrumentação seja implementada.

## 2. Arquitetura proposta

```text
Serviços NestJS no host
  ├── users-service:3000/metrics
  ├── products-service:3001/metrics
  ├── checkout-service:3003/metrics
  ├── payments-service:3004/metrics
  └── api-gateway:3005/metrics
              │
              │ scrape por host.docker.internal
              ▼
      Prometheus:9090
              │
              │ datasource pela rede Docker
              ▼
         Grafana:3010
```

O acesso entre Grafana e Prometheus deve usar o nome DNS do serviço Docker (`http://prometheus:9090`), sem retornar ao host. Somente a coleta dos serviços NestJS deve usar `host.docker.internal`.

## 3. Estrutura de pastas

Deve ser criada a seguinte estrutura na raiz do projeto:

```text
observability-stack/
├── docker-compose.yml
├── prometheus/
│   └── prometheus.yml
├── grafana/
│   └── provisioning/
│       └── datasources/
│           └── prometheus.yml
└── README.md
```

Não devem ser adicionados arquivos de dashboards ou diretórios de provisioning de alertas nesta entrega.

## 4. Docker Compose da stack

### RF-01: Criar o serviço Prometheus

O arquivo `observability-stack/docker-compose.yml` deve declarar um serviço chamado `prometheus` com as seguintes características:

- Usar uma versão estável e explicitamente fixada da imagem oficial `prom/prometheus`.
- Publicar a porta `9090` do host na porta `9090` do container.
- Montar `./prometheus/prometheus.yml` no caminho `/etc/prometheus/prometheus.yml` em modo somente leitura.
- Persistir os dados em um volume nomeado montado em `/prometheus`.
- Iniciar explicitamente com o arquivo de configuração provisionado.
- Participar de uma rede Docker privada compartilhada com o Grafana.
- Reiniciar automaticamente, exceto quando interrompido manualmente.
- Declarar o mapeamento `host.docker.internal:host-gateway` em `extra_hosts`, garantindo o acesso ao host em ambientes Linux compatíveis com Docker Engine.

### RF-02: Criar o serviço Grafana

O mesmo Compose deve declarar um serviço chamado `grafana` com as seguintes características:

- Usar uma versão estável e explicitamente fixada da imagem oficial `grafana/grafana`.
- Publicar a porta `3010` do host na porta `3000` do container.
- Montar `./grafana/provisioning` no caminho `/etc/grafana/provisioning` em modo somente leitura.
- Persistir os dados em um volume nomeado montado em `/var/lib/grafana`.
- Participar da mesma rede privada do Prometheus.
- Declarar dependência de inicialização em relação ao Prometheus.
- Reiniciar automaticamente, exceto quando interrompido manualmente.

O Compose deve declarar explicitamente os dois volumes nomeados e a rede da stack. Credenciais usadas apenas no ambiente local podem possuir valores padrão documentados, mas devem permitir sobrescrita por variáveis de ambiente, por exemplo:

```yaml
environment:
  GF_SECURITY_ADMIN_USER: ${GRAFANA_ADMIN_USER:-admin}
  GF_SECURITY_ADMIN_PASSWORD: ${GRAFANA_ADMIN_PASSWORD:-admin}
```

O README deve advertir que os valores padrão não são apropriados para produção.

## 5. Configuração do Prometheus

### RF-03: Definir a configuração global

O arquivo `observability-stack/prometheus/prometheus.yml` deve ser um YAML válido para o Prometheus e definir um intervalo global de coleta adequado ao desenvolvimento local. O valor recomendado é:

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s
```

### RF-04: Configurar os cinco serviços

Devem existir cinco jobs distintos em `scrape_configs`, um para cada serviço. Cada job deve utilizar `metrics_path: /metrics` e o target correspondente no host:

```yaml
scrape_configs:
  - job_name: api-gateway
    metrics_path: /metrics
    static_configs:
      - targets: ['host.docker.internal:3005']

  - job_name: users-service
    metrics_path: /metrics
    static_configs:
      - targets: ['host.docker.internal:3000']

  - job_name: products-service
    metrics_path: /metrics
    static_configs:
      - targets: ['host.docker.internal:3001']

  - job_name: checkout-service
    metrics_path: /metrics
    static_configs:
      - targets: ['host.docker.internal:3003']

  - job_name: payments-service
    metrics_path: /metrics
    static_configs:
      - targets: ['host.docker.internal:3004']
```

Os jobs devem permanecer separados para facilitar filtros, diagnósticos e futuras consultas por serviço. Não devem ser configurados exporters adicionais, regras de gravação ou regras de alerta.

## 6. Provisioning do Grafana

### RF-05: Provisionar o datasource Prometheus

O arquivo `observability-stack/grafana/provisioning/datasources/prometheus.yml` deve seguir o formato de provisioning do Grafana e cadastrar um único datasource com estas propriedades:

```yaml
apiVersion: 1

datasources:
  - name: Prometheus
    uid: prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: false
```

O datasource deve estar disponível sem configuração manual após a inicialização do Grafana. A URL não deve usar `localhost`, `host.docker.internal` nem a porta publicada `3010`, pois a comunicação ocorre diretamente pela rede Docker.

Não devem ser provisionados dashboards, organizações, usuários adicionais, alertas ou plugins.

## 7. Mapa de portas atualizado

### Serviços da aplicação

| Componente | Porta no host | Finalidade |
|---|---:|---|
| users-service | 3000 | API de usuários e autenticação |
| products-service | 3001 | API de produtos |
| checkout-service | 3003 | API de carrinho e pedidos |
| payments-service | 3004 | API e processamento de pagamentos |
| api-gateway | 3005 | Entrada pública do marketplace |

### Infraestrutura

| Componente | Porta no host | Porta no container | Finalidade |
|---|---:|---:|---|
| Prometheus | 9090 | 9090 | Coleta e consulta de métricas |
| Grafana | 3010 | 3000 | Visualização de métricas |
| RabbitMQ AMQP | 5672 | 5672 | Mensageria |
| RabbitMQ Management | 15672 | 15672 | Administração do RabbitMQ |
| PostgreSQL users | 5433 | 5432 | Banco do users-service |
| PostgreSQL products | 5434 | 5432 | Banco do products-service |
| PostgreSQL payments | 5435 | 5432 | Banco do payments-service |
| PostgreSQL checkout | 5436 | 5432 | Banco do checkout-service |

A publicação do Grafana em `3010` é obrigatória para não conflitar com o `users-service`, que utiliza `3000` no host.

## 8. README da observability-stack

### RF-06: Documentar uso e diagnóstico

O arquivo `observability-stack/README.md` deve conter, no mínimo:

- Descrição breve da finalidade da stack.
- Pré-requisitos: Docker e Docker Compose.
- Comando de inicialização executado a partir da pasta `observability-stack/`: `docker compose up -d`.
- Comando para consultar o estado: `docker compose ps`.
- Comando para acompanhar logs: `docker compose logs -f`.
- Comando de parada preservando dados: `docker compose down`.
- Comando opcional de remoção dos dados, com alerta explícito de que é destrutivo: `docker compose down -v`.
- Endereço do Prometheus: `http://localhost:9090`.
- Endereço do Grafana: `http://localhost:3010`.
- Credenciais locais padrão do Grafana e como sobrescrevê-las com `GRAFANA_ADMIN_USER` e `GRAFANA_ADMIN_PASSWORD`.
- Informação de que o datasource Prometheus é provisionado automaticamente.
- Explicação de que os targets podem permanecer `DOWN` enquanto `/metrics` ainda não tiver sido implementado nos serviços.
- Orientação para verificar a configuração e os targets nas páginas `/config` e `/targets` do Prometheus.
- Nota de que `host.docker.internal` depende do `extra_hosts` definido no Compose para funcionar no Linux.

## 9. Validação recomendada

1. Executar `docker compose config` dentro de `observability-stack/` e confirmar que o Compose é válido.
2. Validar `prometheus/prometheus.yml` com `promtool check config /etc/prometheus/prometheus.yml` dentro do container do Prometheus.
3. Executar `docker compose up -d` e confirmar que `prometheus` e `grafana` permanecem em execução.
4. Consultar `http://localhost:9090/-/ready` e confirmar resposta de prontidão do Prometheus.
5. Consultar a API de targets do Prometheus e confirmar a presença dos cinco jobs e seus respectivos endereços, independentemente de ainda estarem `UP` ou `DOWN`.
6. Consultar `http://localhost:3010/api/health` e confirmar que o Grafana está operacional.
7. Autenticar no Grafana e confirmar que o datasource `Prometheus` existe, é o padrão e aponta para `http://prometheus:9090`.
8. Reiniciar os containers e confirmar que o provisioning continua aplicado e que os volumes preservam os dados.
9. Revisar o diff para comprovar que nenhum serviço NestJS, dashboard ou configuração de alerting foi adicionado ou alterado por esta entrega.

## 10. Critérios de aceite

### CA-01: Estrutura e isolamento

- [ ] Existe uma pasta `observability-stack/` na raiz, com Compose, configuração do Prometheus, provisioning do Grafana e README.
- [ ] A stack pode ser gerenciada independentemente das demais pastas de infraestrutura.
- [ ] `docker compose config` é executado sem erros dentro da nova pasta.
- [ ] Somente Prometheus e Grafana fazem parte do Compose.

### CA-02: Prometheus

- [ ] O Prometheus inicia e responde em `http://localhost:9090`.
- [ ] A configuração é aceita por `promtool check config`.
- [ ] Existe exatamente um job para cada um dos cinco serviços do marketplace.
- [ ] Todos os jobs usam `/metrics` e `host.docker.internal` com as portas corretas.
- [ ] O Compose contém `extra_hosts` com `host.docker.internal:host-gateway` no serviço Prometheus.
- [ ] Os cinco targets aparecem na interface ou API do Prometheus, ainda que permaneçam `DOWN` antes da futura instrumentação.
- [ ] Os dados do Prometheus são persistidos em volume nomeado.

### CA-03: Grafana

- [ ] O Grafana inicia e responde em `http://localhost:3010` sem conflito com o `users-service`.
- [ ] O datasource `Prometheus` é criado automaticamente no primeiro início e após reinicializações.
- [ ] O datasource é padrão, não editável e usa `http://prometheus:9090`.
- [ ] O Grafana consegue consultar o Prometheus pela rede interna da stack.
- [ ] Os dados do Grafana são persistidos em volume nomeado.
- [ ] Nenhum dashboard ou alerta é provisionado.

### CA-04: Documentação e portas

- [ ] O README documenta inicialização, estado, logs, parada, URLs, credenciais locais e sobrescrita por variáveis.
- [ ] O README diferencia a parada preservando volumes da remoção destrutiva com `-v`.
- [ ] O mapa de portas inclui os cinco serviços, Prometheus, Grafana, RabbitMQ e os bancos PostgreSQL.
- [ ] Prometheus usa `9090` e Grafana publica `3010:3000`.

### CA-05: Limites de escopo

- [ ] Nenhum dos cinco serviços NestJS é instrumentado ou alterado nesta entrega.
- [ ] Nenhuma implementação de `/metrics` é adicionada nesta entrega.
- [ ] Nenhum dashboard, alerta, exporter adicional, Loki, Jaeger ou outra ferramenta é incluído.
- [ ] A configuração existente de RabbitMQ não é modificada.

## 11. Fora de escopo

- Instalar bibliotecas de métricas ou alterar código, módulos, controllers, interceptors ou middlewares dos serviços NestJS.
- Implementar ou testar o conteúdo do endpoint `/metrics` nos serviços.
- Criar dashboards ou painéis de negócio e infraestrutura no Grafana.
- Configurar alertas, regras de alerta, Alertmanager ou canais de notificação.
- Adicionar Loki, Promtail, Jaeger, OpenTelemetry Collector, Tempo, Zipkin, Elasticsearch ou qualquer outra ferramenta.
- Coletar métricas do RabbitMQ, PostgreSQL, Docker ou do sistema operacional por exporters.
- Definir requisitos de autenticação, TLS, alta disponibilidade, backup ou implantação de produção para a stack.
- Unificar os arquivos Compose existentes em um único Compose na raiz.
