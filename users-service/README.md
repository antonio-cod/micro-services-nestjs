# Users Service

Microserviço NestJS responsável pela persistência dos usuários do marketplace.
Este scaffold mantém apenas o endpoint padrão do NestJS e não implementa
endpoints de usuários nem regras de negócio.

## Configuração local

O arquivo `.env` incluído no ambiente local já contém os valores de
desenvolvimento definidos pela spec. Inicie o PostgreSQL com:

```bash
docker compose up -d
```

Depois, instale as dependências e inicie a aplicação:

```bash
npm install
npm run start:dev
```

O serviço usa a porta HTTP `3000` por padrão. O PostgreSQL é publicado em
`localhost:5433`, com dados persistidos no volume `users_db_data`.

## Verificações

```bash
npm run lint
npm test
npm run build
npm run test:e2e
```

Os testes E2E exigem o PostgreSQL do Docker Compose em execução. O arquivo
`.env.example` lista todas as variáveis necessárias sem expor valores locais.
Defina `JWT_SECRET` com um segredo não vazio; sem ele, o serviço interrompe a
inicialização para impedir a emissão insegura de tokens.
