# Marketplace MS

[![Arquitetura do Marketplace MS](docs/architecture/marketplace-ms.svg)](docs/architecture/marketplace-ms.excalidraw)

> Clique no diagrama para acessar o [arquivo-fonte `.excalidraw`](docs/architecture/marketplace-ms.excalidraw), que pode ser importado no [Excalidraw](https://excalidraw.com/). A [exportação SVG](docs/architecture/marketplace-ms.svg) também está disponível separadamente.

Marketplace de referência construído como um monorepositório de cinco aplicações NestJS independentes. O sistema usa APIs REST para operações síncronas, RabbitMQ para o fluxo assíncrono de pagamentos e um banco PostgreSQL exclusivo para cada domínio que persiste dados.

## Sumário

- [Arquitetura](#arquitetura)
- [Microsserviços](#microsserviços)
- [Fluxos principais](#fluxos-principais)
- [Tecnologias](#tecnologias)
- [Estrutura do repositório](#estrutura-do-repositório)
- [Como executar](#como-executar)
- [Endpoints e documentação](#endpoints-e-documentação)
- [Testes](#testes)
- [Observabilidade](#observabilidade)

## Arquitetura

O cliente acessa o sistema pelo API Gateway. O gateway valida o JWT, aplica proteções HTTP e encaminha a requisição ao serviço responsável. Cada serviço pode ser executado, testado e implantado de forma independente.

| Componente | Porta padrão | Responsabilidade | Dependências de infraestrutura |
| --- | ---: | --- | --- |
| API Gateway | `3005` | Entrada única, autenticação, proxy e resiliência | Serviços HTTP downstream |
| Users Service | `3000` | Cadastro, login, validação de token e perfis | PostgreSQL `users_db` em `5433` |
| Products Service | `3001` | Catálogo, estoque e produtos por vendedor | PostgreSQL `products_db` em `5434` |
| Checkout Service | `3003` | Carrinho, checkout e ciclo de vida de pedidos | PostgreSQL `checkout_db` em `5436`, Products e RabbitMQ |
| Payments Service | `3004` | Consumo e processamento de pagamentos | PostgreSQL `payments_db` em `5435` e RabbitMQ |
| RabbitMQ | `5672` / `15672` | Eventos, retry, dead-letter queues e painel administrativo | Volume Docker próprio |
| Prometheus | `9090` | Coleta de métricas dos serviços | Endpoints `/metrics` |
| Grafana | `3010` | Dashboards e visualização | Prometheus |

### Decisões arquiteturais

- **Database per service:** Users, Products, Checkout e Payments possuem bancos PostgreSQL independentes. Nenhum serviço acessa diretamente as tabelas de outro domínio.
- **API Gateway:** concentra a interface pública, repassa contexto do usuário e protege os serviços com JWT, rate limiting, timeout, retry e circuit breaker.
- **Comunicação híbrida:** HTTP é usado para consultas imediatas; RabbitMQ desacopla a criação do pedido do processamento do pagamento.
- **Consistência eventual:** o Checkout cria um pedido pendente, o Payments processa o evento e publica o resultado; o Checkout então atualiza o pedido para pago ou falho.
- **Observabilidade nativa:** todos os serviços expõem health checks e métricas Prometheus com rotas de baixa cardinalidade.

## Microsserviços

### API Gateway

Ponto de entrada público do marketplace. Encaminha rotas de autenticação, usuários, produtos, carrinho, pedidos e pagamentos aos serviços correspondentes.

Principais recursos:

- proxy HTTP baseado em `HttpService`/Axios;
- autenticação e propagação de identidade via JWT;
- autorização por papéis;
- rate limiting com `@nestjs/throttler`;
- timeout, retry, circuit breaker e respostas de fallback;
- validação global de DTOs, CORS e headers de segurança com Helmet;
- health agregado dos serviços downstream.

### Users Service

Responsável pela identidade e pelos dados básicos dos usuários.

- cadastro de compradores e vendedores;
- hash de senha com `bcryptjs`;
- login e emissão de JWT;
- validação de token compartilhada entre os serviços;
- consulta de perfil, vendedores ativos e usuários por ID;
- estados e papéis modelados por enums de domínio.

### Products Service

Mantém o catálogo do marketplace.

- criação de produto permitida para vendedores autenticados;
- listagem pública de produtos ativos;
- busca por ID e por vendedor;
- preço decimal, estoque e estado ativo persistidos com TypeORM.

### Checkout Service

Coordena carrinhos e pedidos.

- inclusão e remoção de itens;
- consulta síncrona ao Products Service para obter e validar o produto;
- cálculo monetário em centavos para evitar erros de ponto flutuante;
- transações de banco e bloqueio pessimista nas operações críticas;
- checkout idempotente por carrinho;
- publicação de `payment.order` e consumo de `payment.result` no RabbitMQ.

### Payments Service

Processa pedidos de pagamento recebidos de forma assíncrona.

- consumer RabbitMQ com métricas de processamento;
- persistência idempotente por `orderId`;
- `FakePaymentGatewayService` determinístico para simular aprovação e rejeição;
- publicação do resultado para o Checkout Service;
- retry, DLQ, inspeção e reprocessamento de mensagens mortas;
- consulta HTTP do pagamento por pedido.

## Fluxos principais

### Autenticação

1. O cliente envia cadastro ou login ao API Gateway.
2. O gateway encaminha a solicitação ao Users Service.
3. O Users Service valida as credenciais e emite o JWT.
4. Nas rotas protegidas, o gateway valida o token e propaga `user-id`, `email` e `role` aos serviços internos.

### Compra e pagamento

1. O comprador inclui um produto no carrinho pelo API Gateway.
2. O Checkout Service consulta o Products Service e grava o item no carrinho.
3. No checkout, o carrinho é concluído e um pedido com estado `pending` é criado.
4. O Checkout publica `payment.order` no exchange `payments`.
5. O Payments Service consome a mensagem e executa o gateway de pagamento fake.
6. O resultado `approved` ou `rejected` é persistido e publicado como `payment.result`.
7. O Checkout consome o resultado e altera o pedido para `paid` ou `failed`.

Falhas no consumo passam por filas de retry e podem terminar em uma DLQ para inspeção e reprocessamento.

## Tecnologias

### Base compartilhada

| Tecnologia/biblioteca | Uso no projeto |
| --- | --- |
| Node.js + TypeScript | Runtime e linguagem de todos os serviços |
| NestJS 11 | Módulos, controllers, injeção de dependência, guards e lifecycle |
| Express | Adaptador HTTP do NestJS |
| RxJS | Fluxos assíncronos e integração com o `HttpService` |
| `@nestjs/config` | Leitura e validação das variáveis de ambiente |
| `class-validator` e `class-transformer` | Validação e transformação dos DTOs |
| `@nestjs/swagger` | Documentação OpenAPI dos serviços HTTP |
| Passport, `passport-jwt` e `@nestjs/jwt` | Autenticação Bearer JWT |
| `@nestjs/terminus` | Health checks de HTTP, PostgreSQL e RabbitMQ |
| `prom-client` | Métricas no formato Prometheus |
| Jest, `@nestjs/testing` e ts-jest | Testes unitários e módulos Nest de teste |
| Supertest | Testes de integração dos endpoints HTTP |
| ESLint e Prettier | Qualidade e padronização do código |

### Persistência e mensageria

| Tecnologia/biblioteca | Uso no projeto |
| --- | --- |
| PostgreSQL 15 | Persistência de produção, isolada por serviço |
| TypeORM + `@nestjs/typeorm` | Entidades, repositórios, transações e migrations/sincronização |
| `pg` | Driver PostgreSQL |
| RabbitMQ 3 Management | Broker AMQP e interface administrativa |
| `amqplib` e `amqp-connection-manager` | Publicação, consumo e gerenciamento das conexões AMQP |
| `@nestjs/microservices` | Integração Nest com transportes de mensageria e health checks |
| SQLite, `sqlite3` e `better-sqlite3` | Banco em memória exclusivamente nos testes E2E |

### Gateway e observabilidade

| Tecnologia/biblioteca | Uso no projeto |
| --- | --- |
| Axios e `@nestjs/axios` | Comunicação HTTP entre gateway/checkout e serviços internos |
| `@nestjs/throttler` | Limitação de requisições no gateway |
| Helmet | Headers HTTP de segurança |
| Prometheus | Scrape e armazenamento de métricas |
| Grafana | Dashboards provisionados e visualização |
| Docker Compose | PostgreSQL, RabbitMQ, Prometheus e Grafana locais |

## Estrutura do repositório

```text
marketplace-ms/
├── api-gateway/             # Entrada pública e proxy para os domínios
├── users-service/           # Autenticação e usuários
├── products-service/        # Catálogo de produtos
├── checkout-service/        # Carrinho e pedidos
├── payments-service/        # Pagamentos e consumidores AMQP
├── messaging-service/       # Docker Compose do RabbitMQ
├── observability-stack/     # Prometheus, Grafana, alertas e dashboards
├── docs/architecture/       # Diagrama SVG e fonte Excalidraw
├── .env.example             # Referência de configuração do gateway
└── README.md
```

Cada aplicação NestJS mantém seu próprio `package.json`, `.env.example`, configuração Jest, código `src/` e testes `test/`.

## Como executar

### Pré-requisitos

- Node.js compatível com NestJS 11;
- npm;
- Docker e Docker Compose;
- Nest CLI opcional: `npm install -g @nestjs/cli`.

### 1. Instalar as dependências

Como os serviços possuem manifests independentes, instale as dependências em cada diretório:

```bash
for service in users-service products-service checkout-service payments-service api-gateway; do
  (cd "$service" && npm install)
done
```

### 2. Preparar as variáveis de ambiente

Copie o `.env.example` de cada serviço e preencha os valores. Todos os serviços que validam JWT devem compartilhar o mesmo `JWT_SECRET`.

```bash
cp users-service/.env.example users-service/.env
cp products-service/.env.example products-service/.env
cp checkout-service/.env.example checkout-service/.env
cp payments-service/.env.example payments-service/.env
cp api-gateway/.env.example api-gateway/.env
```

URLs padrão usadas pelo gateway:

```dotenv
USERS_SERVICE_URL=http://localhost:3000
PRODUCTS_SERVICE_URL=http://localhost:3001
CHECKOUT_SERVICE_URL=http://localhost:3003
PAYMENTS_SERVICE_URL=http://localhost:3004
```

O Payments Service exige uma `RABBITMQ_URL` AMQP válida, por exemplo:

```dotenv
RABBITMQ_URL=amqp://admin:admin@localhost:5672
```

### 3. Subir a infraestrutura

```bash
docker compose -f users-service/docker-compose.yml up -d
docker compose -f products-service/docker-compose.yml up -d
docker compose -f checkout-service/docker-compose.yml up -d
docker compose -f payments-service/docker-compose.yml up -d
docker compose -f messaging-service/docker-compose.yml up -d
docker compose -f observability-stack/docker-compose.yml up -d
```

### 4. Iniciar os serviços

Execute cada comando em um terminal:

```bash
cd users-service && npm run start:dev
cd products-service && npm run start:dev
cd checkout-service && npm run start:dev
cd payments-service && npm run start:dev
cd api-gateway && npm run start:dev
```

Use `npm run build` e `npm run start:prod` dentro de cada aplicação para uma execução compilada.

## Endpoints e documentação

As principais rotas públicas do gateway são:

| Domínio | Rotas principais |
| --- | --- |
| Auth | `POST /auth/register`, `POST /auth/login` |
| Users | `GET /users/profile`, `GET /users/sellers`, `GET /users/:id` |
| Products | `GET /products`, `GET /products/:id`, `GET /products/seller/:sellerId`, `POST /products` |
| Cart | `GET /cart`, `POST /cart/items`, `DELETE /cart/items/:itemId`, `POST /cart/checkout` |
| Orders | `GET /orders`, `GET /orders/:id` |
| Payments | `GET /payments/:orderId` |
| Health | `GET /health`, `GET /health/services`, `GET /health/ready`, `GET /health/live` |
| Metrics | `GET /metrics` |

Os serviços configuram Swagger em seus bootstraps; com a aplicação em execução, consulte a rota de documentação definida pelo respectivo `main.ts`.

## Testes

Cada serviço possui scripts independentes:

```bash
npm test          # testes unitários
npm run test:e2e  # integração HTTP isolada
npm run test:cov  # relatório de cobertura
```

Os testes unitários usam `Test.createTestingModule` e mocks Jest para repositórios e integrações. Os testes E2E usam SQLite em memória nos serviços com persistência e mocks para HTTP/RabbitMQ; portanto, não precisam de PostgreSQL, RabbitMQ ou outros serviços em execução.

O cenário cross-service do gateway é intencionalmente separado da suíte E2E padrão e só deve ser executado quando toda a stack estiver ativa.

## Observabilidade

- `/health` informa a disponibilidade local e das dependências relevantes.
- O gateway também oferece health agregado, readiness e liveness.
- `/metrics` expõe contadores e histogramas no formato Prometheus.
- O Payments Service possui métricas específicas do consumer e endpoints administrativos de DLQ.
- O Prometheus carrega regras de alerta de `observability-stack/prometheus/alert.rules.yml`.
- O Grafana é provisionado a partir de `observability-stack/grafana/provisioning`.

Detalhes adicionais da stack estão em [observability-stack/README.md](observability-stack/README.md).

## Diagrama completo da arquitetura

O desenho abaixo é a exportação visual do arquivo [marketplace-ms.excalidraw](docs/architecture/marketplace-ms.excalidraw), preservando cores, componentes, conexões e legendas do diagrama da arquitetura.

<p align="center">
  <a href="docs/architecture/marketplace-ms.excalidraw" title="Abrir o arquivo editável do Excalidraw">
    <img
      src="docs/architecture/marketplace-ms.svg"
      alt="Diagrama completo da arquitetura do Marketplace MS"
      width="100%"
    />
  </a>
</p>

> Para editar o desenho, baixe o arquivo `.excalidraw` pelo link acima e importe-o em [excalidraw.com](https://excalidraw.com/).
