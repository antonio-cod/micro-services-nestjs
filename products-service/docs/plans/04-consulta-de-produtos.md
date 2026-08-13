# Plano de implementação: Consulta de produtos

**Serviço:** products-service  
**SPEC de referência:** `docs/specs/04-consulta-de-produtos.md`  
**Escopo:** `GET /products`, `GET /products/seller/:sellerId` e `GET /products/:id`  
**Status:** Pendente  
**Criado em:** 2026-08-13

---

## 1. Objetivo do plano

Implementar e validar os três endpoints públicos de consulta definidos na SPEC 04, reutilizando a entidade, o repositório, o controller, o service e a autenticação global já existentes no `products-service`.

Ao final, o serviço deverá listar o catálogo ativo, listar os produtos ativos de um vendedor e consultar qualquer produto existente pelo ID, sem alterar o comportamento protegido de criação.

---

## 2. Arquivos previstos

| Arquivo | Alteração planejada |
|---|---|
| `src/products/products.service.ts` | Adicionar as três operações de consulta e o tratamento de produto inexistente. |
| `src/products/products.controller.ts` | Expor as três rotas GET, marcá-las como públicas e preservar a ordem correta de declaração. |
| `src/products/products.service.spec.ts` | Cobrir filtros, ordenação, retorno vazio, consulta por ID e erro de produto não encontrado. |
| `src/products/products.controller.spec.ts` | Cobrir o encaminhamento dos parâmetros e retornos entre controller e service. |
| `src/products/products.http.spec.ts` | Cobrir os contratos HTTP, o acesso público, a prioridade das rotas e a permanência da proteção do POST. |

Não há alteração prevista na entidade `Product`, no `ProductsModule`, no mecanismo JWT, no DTO de criação ou no banco de dados.

---

## 3. Estratégia de implementação

### Etapa 1: Preparar os testes unitários do service

1. Ampliar o mock do repositório em `products.service.spec.ts` para suportar as operações de leitura necessárias.
2. Adicionar um cenário para a listagem geral que verifique:
   - filtro por `isActive` igual a `true`;
   - ordenação por `createdAt` decrescente;
   - devolução dos produtos retornados pelo repositório;
   - devolução de array vazio sem erro.
3. Adicionar um cenário para a listagem por vendedor que verifique:
   - filtro simultâneo por `sellerId` e `isActive` igual a `true`;
   - encaminhamento exato do UUID recebido;
   - devolução dos produtos encontrados;
   - devolução de array vazio sem erro.
4. Adicionar cenários para consulta por ID que verifiquem:
   - busca pelo ID exato;
   - retorno de produto ativo ou inativo quando existente;
   - lançamento de `NotFoundException` quando o repositório não encontrar o produto.
5. Manter intactos os testes existentes do método de criação.

**Resultado da etapa:** o comportamento esperado das consultas estará definido em testes antes da alteração do service.

### Etapa 2: Implementar as consultas no ProductsService

1. Adicionar uma operação para listar todos os produtos ativos.
2. Configurar essa consulta para ordenar por `createdAt` em ordem decrescente.
3. Adicionar uma operação para listar produtos ativos por `sellerId`.
4. Adicionar uma operação para localizar um produto pelo `id`, sem filtro de `isActive`.
5. Quando a consulta por ID não encontrar registro, encerrar o caso de uso com `NotFoundException` e uma mensagem clara de produto não encontrado.
6. Preservar sem alterações funcionais o método `create` existente.

**Resultado da etapa:** o service atenderá todas as regras de persistência e erro da SPEC.

### Etapa 3: Preparar os testes unitários do controller

1. Ampliar o mock de `ProductsService` em `products.controller.spec.ts` com as três novas operações.
2. Testar que a listagem geral chama a operação correspondente e devolve seu resultado.
3. Testar que a listagem por vendedor encaminha exatamente o `sellerId` recebido na rota e devolve o resultado do service.
4. Testar que a consulta por ID encaminha exatamente o `id` recebido na rota e devolve o produto encontrado.
5. Preservar os cenários existentes de criação por seller e rejeição das demais roles.

**Resultado da etapa:** a responsabilidade de delegação do controller estará coberta sem duplicar regras de persistência.

### Etapa 4: Expor as rotas públicas no ProductsController

1. Adicionar a rota `GET /products` e vinculá-la à listagem de produtos ativos.
2. Adicionar a rota `GET /products/seller/:sellerId` e vinculá-la à listagem por vendedor.
3. Adicionar a rota `GET /products/:id` e vinculá-la à consulta de produto por ID.
4. Aplicar `@Public()` individualmente às três rotas GET.
5. Declarar a rota `seller/:sellerId` antes da rota dinâmica `:id`, garantindo que o prefixo `seller` não seja tratado como um ID de produto.
6. Manter `POST /products` sem `@Public()` e sem alterações nas regras de autenticação e autorização.

**Resultado da etapa:** os três contratos HTTP estarão disponíveis publicamente, com resolução de rota correta e criação ainda protegida.

### Etapa 5: Cobrir o comportamento HTTP

1. Ampliar a configuração de `products.http.spec.ts` para simular as três operações de consulta além da criação.
2. Adicionar cenários sem header `Authorization` para comprovar que cada rota GET é pública.
3. Para `GET /products`, verificar:
   - resposta `200 OK` com array de produtos ativos;
   - ordem do mais recente para o mais antigo;
   - resposta `200 OK` com array vazio.
4. Para `GET /products/seller/:sellerId`, verificar:
   - resposta `200 OK` com os produtos ativos do vendedor solicitado;
   - encaminhamento correto do `sellerId`;
   - resposta `200 OK` com array vazio quando não houver produtos;
   - ausência de `404` no caso de lista vazia.
5. Para `GET /products/:id`, verificar:
   - resposta `200 OK` com o produto encontrado;
   - possibilidade de retorno de produto inativo existente;
   - resposta `404 Not Found` quando o produto não existir.
6. Adicionar um cenário explícito para `GET /products/seller/:sellerId` que comprove que a requisição chega à operação de consulta por vendedor, e não à operação de consulta por ID.
7. Manter ou reforçar o cenário que comprova `401 Unauthorized` em `POST /products` sem token.

**Resultado da etapa:** os status, formatos de resposta, acesso público e precedência das rotas estarão validados na camada HTTP.

### Etapa 6: Executar a verificação final

1. Executar os testes unitários do domínio de produtos.
2. Executar os testes HTTP de produtos.
3. Executar toda a suíte Jest do `products-service` para detectar regressões em autenticação e criação.
4. Executar lint e build do serviço.
5. Confirmar manualmente que nenhuma alteração adicionou paginação, filtros extras, busca textual, update ou delete.

**Resultado da etapa:** implementação compilando, formatada e sem regressões no comportamento existente.

---

## 4. Matriz de rastreabilidade

| Requisito da SPEC | Implementação principal | Validação principal |
|---|---|---|
| RF-01 — catálogo ativo e ordenado | `ProductsService` e `ProductsController` | Testes unitários do service e testes HTTP de `GET /products` |
| RF-02 — produtos ativos por vendedor | `ProductsService` e `ProductsController` | Testes unitários e HTTP de `GET /products/seller/:sellerId` |
| RF-03 — produto por ID e 404 | `ProductsService` e `ProductsController` | Testes de produto existente, inativo existente e inexistente |
| RF-04 — consultas públicas e POST protegido | `ProductsController` | GET sem token e POST sem token nos testes HTTP |
| RF-05 — prioridade das rotas | Ordem das declarações no `ProductsController` | Teste HTTP específico da rota `seller/:sellerId` |

---

## 5. Decisões e limites

- As listagens delegarão filtros e ordenação ao repositório, evitando carregar registros fora do resultado esperado pelo catálogo.
- A consulta por ID não filtrará `isActive`, conforme definido na SPEC.
- Lista vazia é um resultado válido e deve permanecer com status `200 OK`.
- Somente a ausência do produto na consulta por ID gera `404 Not Found`.
- Os objetos retornados continuarão seguindo a representação atual da entidade `Product`; não será criado um novo contrato de resposta nesta entrega.
- Não serão adicionados endpoints, DTOs ou regras que não estejam previstos na SPEC.

---

## 6. Definição de pronto

- [ ] Os três endpoints definidos na SPEC estão implementados.
- [ ] As três consultas podem ser realizadas sem token JWT.
- [ ] As listagens retornam somente produtos ativos.
- [ ] A listagem geral retorna os produtos mais recentes primeiro.
- [ ] A listagem por vendedor retorna array vazio quando aplicável.
- [ ] A consulta por ID retorna produtos existentes independentemente de `isActive`.
- [ ] A consulta por ID retorna `404 Not Found` quando o produto não existe.
- [ ] A rota por vendedor não é capturada pela rota dinâmica por ID.
- [ ] `POST /products` continua protegido e restrito a sellers.
- [ ] Testes unitários e HTTP relevantes estão passando.
- [ ] A suíte completa, o lint e o build do `products-service` estão passando.
- [ ] Nenhuma funcionalidade fora do escopo foi adicionada.
