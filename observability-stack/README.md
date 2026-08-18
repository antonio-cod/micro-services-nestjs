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
