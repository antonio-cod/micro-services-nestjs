# SPEC: Correção de portas PostgreSQL e teste do checkout-service

**Projeto:** marketplace-ms  
**Serviços afetados:** checkout-service e payments-service  
**Escopo:** configuração local dos bancos PostgreSQL e correção do teste unitário do checkout-service  
**Status:** Pendente  
**Criado em:** 2026-08-13

---

## 1. Objetivo

Corrigir conflitos e inconsistências na infraestrutura local dos serviços de checkout e pagamentos, permitindo que seus bancos PostgreSQL sejam executados simultaneamente com os demais bancos do marketplace. Também deve ser restaurada a execução do teste unitário do `AppController` do `checkout-service` após a inclusão da dependência `PaymentQueueService`.

Ao final, as portas locais dos bancos devem ser únicas e coerentes entre Docker Compose, variáveis de ambiente e fallbacks da aplicação, e o teste do controller deve compilar e executar sem depender de uma conexão real com RabbitMQ.

## 2. Estado esperado das portas

| Serviço | Porta PostgreSQL no host | Porta no container |
|---|---:|---:|
| users-service | 5433 | 5432 |
| products-service | 5434 | 5432 |
| payments-service | 5435 | 5432 |
| checkout-service | 5436 | 5432 |

As configurações de `users-service` e `products-service` são apenas referências para demonstrar a ausência de conflito e não devem ser alteradas.

## 3. Requisitos funcionais

### RF-01: Corrigir a porta do banco do checkout-service

O `checkout-service` deve utilizar a porta `5436` no host para acessar seu banco PostgreSQL.

Devem ser alinhados:

- `checkout-service/docker-compose.yml`: publicar a porta como `5436:5432`.
- `checkout-service/.env`: definir `DB_PORT=5436`.
- `checkout-service/src/config/database.config.ts`: utilizar `5436` como fallback quando `DB_PORT` não estiver definida ou não produzir um número válido.

Não devem ser alterados o nome do banco, usuário, senha, volume, rede, porta interna `5432` ou demais configurações do serviço.

### RF-02: Garantir a porta do banco do payments-service

O `payments-service` deve utilizar a porta `5435` no host, em conformidade com o mapeamento `5435:5432` já definido em `payments-service/docker-compose.yml`.

O arquivo `payments-service/.env` deve conter `DB_PORT=5435`. Caso o valor já esteja correto, ele deve ser preservado e validado. Não fazem parte desta correção mudanças no Compose ou no fallback do `database.config.ts` de pagamentos quando ambos já estiverem em `5435`.

### RF-03: Corrigir o teste unitário do AppController

O `TestingModule` de `checkout-service/src/app.controller.spec.ts` deve fornecer um mock de `PaymentQueueService`, além do `AppService` já existente.

O mock deve:

- Ser registrado com o token de injeção `PaymentQueueService`.
- Disponibilizar `publishPaymentOrder` como função mock do Jest.
- Não inicializar RabbitMQ, `EventsModule` ou o provider real.
- Permitir que o teste existente de `getHello()` compile e continue validando o mesmo resultado.

Não é necessário adicionar testes para `POST /test/send-message` nesta correção.

## 4. Critérios de aceite

### CA-01: Configuração do checkout-service

- [ ] `checkout-service/docker-compose.yml` contém o mapeamento `5436:5432` para `checkout-db`.
- [ ] `checkout-service/.env` contém `DB_PORT=5436`.
- [ ] O fallback do banco no `checkout-service` é `5436`.
- [ ] A configuração do Compose é válida segundo `docker compose config`.
- [ ] O container `checkout-db` pode iniciar e ficar disponível na porta `5436` sem conflito com o banco do `products-service` na porta `5434`.
- [ ] Com `DB_PORT` ausente, o `checkout-service` resolve a porta do banco como `5436`.

### CA-02: Configuração do payments-service

- [ ] `payments-service/.env` contém `DB_PORT=5435`.
- [ ] A porta do `.env`, o mapeamento `5435:5432` do Compose e o fallback `5435` do `database.config.ts` permanecem consistentes.
- [ ] O container `payments-db` pode iniciar e ficar disponível na porta `5435`.

### CA-03: Isolamento entre bancos

- [ ] Os bancos de users, products, payments e checkout podem permanecer ativos simultaneamente nas portas `5433`, `5434`, `5435` e `5436`, respectivamente.
- [ ] Nenhum dos quatro containers publica a mesma porta PostgreSQL no host.
- [ ] Nenhum arquivo de `users-service` ou `products-service` é modificado.

### CA-04: Testes e qualidade

- [ ] `npm test -- --runInBand src/app.controller.spec.ts` passa no `checkout-service`.
- [ ] O teste instancia `AppController` com um mock de `PaymentQueueService` e sem conexão com RabbitMQ.
- [ ] A suíte completa de testes do `checkout-service` passa sem regressões.
- [ ] Lint e build do `checkout-service` passam.
- [ ] A alteração de configuração do `payments-service` não introduz falhas de build ou inicialização.

## 5. Validação recomendada

1. Validar os arquivos Compose de checkout e payments com `docker compose config` em cada diretório.
2. Subir os quatro bancos e confirmar que as portas `5433`, `5434`, `5435` e `5436` estão simultaneamente em escuta.
3. Iniciar `checkout-service` e `payments-service` com seus respectivos `.env` e confirmar a conexão com os bancos corretos.
4. Executar o teste isolado do `AppController`, a suíte completa, o lint e o build do `checkout-service`.
5. Revisar o diff final para confirmar que `users-service`, `products-service`, Dockerfiles e a raiz do projeto não receberam mudanças de infraestrutura.

## 6. Fora de escopo

- Alterações em `users-service` ou `products-service`.
- Criação de Docker Compose na raiz do projeto.
- Criação ou alteração de Dockerfiles.
- Mudança de credenciais, nomes de bancos, volumes ou redes Docker.
- Alterações em RabbitMQ, filas ou no comportamento de publicação de pagamentos.
- Refatoração do `AppController`, `PaymentQueueService` ou módulos de eventos.
- Criação de migrações ou alteração de entidades e schemas PostgreSQL.
