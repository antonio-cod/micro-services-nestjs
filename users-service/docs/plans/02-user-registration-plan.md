# Plano de execução: Registro de usuário

**Serviço:** users-service  
**SPEC de referência:** `docs/specs/02-user-registration.md`  
**Status:** Planejado  
**Criado em:** 2026-08-12

---

## 1. Objetivo

Implementar e validar o endpoint `POST /auth/register` definido na SPEC de registro de usuário, mantendo o escopo restrito ao cadastro e garantindo que a senha nunca seja persistida em texto plano nem exposta nas respostas.

---

## 2. Estado inicial considerado

O plano parte das seguintes condições já existentes no `users-service`:

- Scaffold NestJS funcional.
- PostgreSQL disponível via Docker Compose.
- TypeORM configurado.
- `ValidationPipe` global com rejeição de campos não permitidos.
- `UsersModule` existente.
- Entidade `User` existente com os campos exigidos pela SPEC.
- Enums `UserRole` e `UserStatus` existentes.
- `bcryptjs` ainda não instalado.
- `AuthModule`, controller, service e DTO de registro ainda não existentes.

---

## 3. Estratégia de execução

A implementação será dividida em etapas pequenas e verificáveis. Cada etapa somente será considerada concluída quando sua condição de saída tiver sido atendida.

### Etapa 1: Preparar a dependência de segurança

**Ações:**

1. Adicionar `bcryptjs` às dependências de produção do `users-service`.
2. Confirmar que a versão instalada é compatível com a versão atual do Node.js e com a compilação TypeScript do projeto.
3. Atualizar o arquivo de lock do gerenciador de pacotes.

**Condição de saída:**

- A dependência está registrada e pode ser utilizada pelo serviço sem erro de compilação.

### Etapa 2: Definir o contrato de entrada

**Ações:**

1. Criar o DTO de registro dentro do domínio de autenticação.
2. Declarar somente os campos permitidos: `email`, `password`, `firstName`, `lastName` e `role`.
3. Aplicar as regras de obrigatoriedade, tipo, formato, tamanho e enum definidas na SPEC.
4. Definir mensagens de validação claras, associadas aos respectivos campos e regras.
5. Confirmar que `id`, `status`, `createdAt`, `updatedAt` e quaisquer campos desconhecidos são rejeitados pelo pipeline global.

**Condição de saída:**

- O DTO representa integralmente a seção 3 da SPEC e rejeita entradas fora do contrato.

### Etapa 3: Implementar a regra de registro no serviço

**Ações:**

1. Criar o service de autenticação.
2. Disponibilizar ao service o repositório TypeORM da entidade `User`.
3. Consultar a existência do email antes da criação.
4. Retornar conflito quando o email já estiver cadastrado.
5. Gerar o hash da senha com bcrypt e 10 salt rounds.
6. Montar o novo usuário somente com dados validados, hash da senha e status `active`.
7. Persistir o usuário no PostgreSQL.
8. Converter violações concorrentes da restrição única de email em resposta de conflito, sem expor detalhes do banco.
9. Produzir um resultado público que exclua o campo `password` de forma explícita.

**Condição de saída:**

- O service cadastra um usuário válido, protege a senha, trata duplicidades e nunca retorna a senha ou o hash.

### Etapa 4: Expor o endpoint HTTP

**Ações:**

1. Criar o controller de autenticação.
2. Expor somente `POST /auth/register` no escopo desta implementação.
3. Associar o corpo da requisição ao DTO de registro.
4. Encaminhar a operação ao service de autenticação.
5. Garantir que uma criação bem-sucedida resulte em `201 Created`.
6. Garantir que validações e conflitos resultem, respectivamente, em `400 Bad Request` e `409 Conflict`.

**Condição de saída:**

- A rota está acessível e respeita os contratos HTTP de sucesso e erro da SPEC.

### Etapa 5: Compor o AuthModule

**Ações:**

1. Criar o `AuthModule`.
2. Registrar nele o controller e o service de autenticação.
3. Registrar o acesso TypeORM à entidade `User` no contexto do módulo.
4. Importar o `AuthModule` no `AppModule`.
5. Confirmar que nenhum endpoint de login, JWT ou autenticação adicional foi incluído.

**Condição de saída:**

- O módulo está integrado à aplicação e disponibiliza exclusivamente o endpoint previsto na SPEC.

### Etapa 6: Criar testes unitários do DTO e do service

**Ações:**

1. Testar todas as regras do DTO:
   - campos obrigatórios;
   - formato do email;
   - senha com mínimo de 6 caracteres;
   - nomes com máximo de 100 caracteres;
   - roles permitidas;
   - tipos inválidos;
   - campos não permitidos;
   - múltiplos erros na mesma entrada.
2. Testar o fluxo de sucesso do service com repositório controlado.
3. Verificar que bcrypt usa 10 salt rounds e que o valor persistido não corresponde ao texto plano.
4. Verificar que o status persistido é `active`.
5. Verificar que o resultado não contém `password`.
6. Testar email previamente cadastrado.
7. Testar violação de unicidade durante a persistência.
8. Verificar que erros não expõem senha, hash ou detalhes internos do banco.

**Condição de saída:**

- Os comportamentos de negócio e validação estão cobertos por testes unitários determinísticos.

### Etapa 7: Criar testes do controller e testes end-to-end

**Ações:**

1. Testar o controller para confirmar o encaminhamento do DTO e o formato da resposta.
2. Preparar um ambiente de banco isolado para testes end-to-end.
3. Cobrir os cenários HTTP:
   - registro válido de `seller`;
   - registro válido de `buyer`;
   - email inválido;
   - senha curta;
   - nomes acima do limite;
   - role inválida;
   - campos obrigatórios ausentes;
   - valor nulo ou tipo inválido;
   - campo adicional não permitido;
   - múltiplos campos inválidos;
   - email duplicado;
   - tentativas concorrentes com o mesmo email.
4. Conferir diretamente no banco que o status é `active` e a senha está armazenada como hash válido.
5. Conferir em todas as respostas que `password` e o hash não são expostos.
6. Limpar os dados de teste entre cenários para evitar dependência de ordem.

**Condição de saída:**

- Os contratos HTTP e a persistência real estão validados de ponta a ponta.

### Etapa 8: Executar verificação final

**Ações:**

1. Executar a formatação e o lint do projeto.
2. Executar os testes unitários.
3. Executar os testes end-to-end com PostgreSQL disponível.
4. Executar o build de produção.
5. Iniciar o serviço e realizar uma verificação manual mínima do endpoint.
6. Revisar cada critério de aceite da SPEC e registrar seu resultado.
7. Revisar o diff final para remover mudanças acidentais ou fora de escopo.

**Condição de saída:**

- Formatação, lint, testes e build passam sem falhas, e todos os critérios de aceite da SPEC estão atendidos.

---

## 4. Estrutura de arquivos prevista

| Área | Artefato | Responsabilidade |
|---|---|---|
| Dependências | `package.json` e arquivo de lock | Registrar `bcryptjs`. |
| Aplicação | `src/app.module.ts` | Integrar o `AuthModule`. |
| Autenticação | `src/auth/auth.module.ts` | Compor controller, service e persistência. |
| Autenticação | `src/auth/auth.controller.ts` | Expor `POST /auth/register`. |
| Autenticação | `src/auth/auth.service.ts` | Executar as regras de cadastro. |
| Contrato | `src/auth/dto/register.dto.ts` | Definir e validar a entrada. |
| Testes unitários | Arquivos de teste próximos aos artefatos | Validar DTO, service e controller isoladamente. |
| Testes E2E | `test/` | Validar contrato HTTP e persistência real. |

A entidade `User` e seus enums somente devem ser alterados se a implementação revelar uma incompatibilidade objetiva com a SPEC. Mudanças não relacionadas devem ser evitadas.

---

## 5. Ordem recomendada de commits

1. **Dependência e contrato:** adicionar `bcryptjs` e o DTO de registro.
2. **Regra de negócio:** adicionar o service e seus testes unitários.
3. **Endpoint e composição:** adicionar controller, módulo e integração ao `AppModule`.
4. **Validação integrada:** adicionar testes do controller e end-to-end.
5. **Ajustes finais:** corrigir achados de lint, testes, build e revisão dos critérios de aceite.

Cada commit deve permanecer compilável e conter apenas alterações relacionadas à sua etapa.

---

## 6. Matriz de rastreabilidade

| Requisito da SPEC | Etapa principal | Evidência esperada |
|---|---:|---|
| RF-01 — AuthModule | 5 | Módulo integrado com controller e service. |
| RF-02 — Endpoint de registro | 4 | Teste HTTP com retorno `201`. |
| RF-03 — Unicidade de email | 3 e 7 | Testes de duplicidade simples e concorrente com `409`. |
| RF-04 — Proteção da senha | 3, 6 e 7 | Hash bcrypt válido, 10 salt rounds e ausência nas respostas. |
| RF-05 — Status inicial | 3 e 7 | Registro persistido com status `active`. |
| RF-06 — Validação da entrada | 2, 6 e 7 | Testes de cada regra e lista de erros com `400`. |
| CA-01 a CA-09 | 6, 7 e 8 | Suíte automatizada e checklist final aprovados. |

---

## 7. Riscos e controles

| Risco | Impacto | Controle previsto |
|---|---|---|
| Duas requisições passam simultaneamente pela consulta de email. | Possível erro interno ou duplicidade. | Manter a restrição única no banco e traduzir sua violação para `409 Conflict`. |
| Entidade retornada diretamente contém `password`. | Vazamento de credencial. | Criar uma representação pública explícita e testar ausência do campo em todos os caminhos. |
| Exceção do banco expõe detalhes internos. | Vazamento de informação e contrato inconsistente. | Mapear somente a duplicidade conhecida e retornar erros públicos sanitizados. |
| Testes E2E compartilham dados. | Resultados instáveis. | Isolar e limpar a base entre os cenários. |
| Inclusão acidental de login ou JWT. | Expansão indevida do escopo. | Revisar rotas e dependências antes da conclusão. |

---

## 8. Definição de pronto

A execução será considerada concluída quando:

- [ ] Todas as etapas deste plano estiverem concluídas.
- [ ] Todos os critérios de aceite da SPEC estiverem cobertos e aprovados.
- [ ] `POST /auth/register` retornar `201`, `400` e `409` nos cenários definidos.
- [ ] Nenhuma senha em texto plano estiver armazenada.
- [ ] Nenhuma resposta contiver `password` ou hash de senha.
- [ ] Tentativas concorrentes não criarem usuários duplicados.
- [ ] Lint, testes unitários, testes end-to-end e build passarem.
- [ ] Nenhum endpoint ou mecanismo de autenticação fora do escopo tiver sido adicionado.
