# SPEC: Consulta de produtos

**Serviço:** products-service  
**Porta:** 3001  
**Escopo:** endpoints públicos essenciais para consulta do catálogo de produtos  
**Status:** Pendente  
**Criado em:** 2026-08-13

---

## 1. Objetivo

Disponibilizar as consultas essenciais de produtos para o funcionamento do marketplace, permitindo que qualquer pessoa navegue pelo catálogo, consulte os produtos ativos de um vendedor e obtenha os dados de um produto específico.

As consultas definidas nesta especificação devem ser públicas. A criação de produtos permanece protegida e não faz parte das alterações de acesso deste escopo.

---

## 2. Contexto e premissas

- O `products-service` é uma aplicação NestJS executada na porta 3001 e utiliza PostgreSQL.
- A entidade `Product` já existe com os campos `id`, `name`, `description`, `price`, `stock`, `sellerId`, `isActive`, `createdAt` e `updatedAt`.
- O `ProductsModule` já possui `ProductsController` e `ProductsService`, incluindo o caso de uso de criação.
- Todas as rotas são protegidas por padrão pelo `JwtAuthGuard` global.
- O decorator `@Public()` já está disponível para identificar rotas que dispensam autenticação.
- O endpoint protegido `POST /products`, permitido somente para vendedores, já está em funcionamento e deve conservar seu comportamento atual.
- Esta especificação abrange somente as três consultas expressamente definidas a seguir.

---

## 3. Requisitos funcionais

### RF-01: Listagem do catálogo ativo

O serviço deve disponibilizar o endpoint `GET /products`.

Esse endpoint deve:

- Retornar somente produtos cujo `isActive` seja igual a `true`.
- Ordenar os produtos por `createdAt` em ordem decrescente, apresentando os mais recentes primeiro.
- Retornar um array vazio quando não houver produtos ativos.
- Ser público e permitir acesso sem token JWT.

### RF-02: Listagem de produtos ativos por vendedor

O serviço deve disponibilizar o endpoint `GET /products/seller/:sellerId`.

Esse endpoint deve:

- Retornar somente os produtos cujo `sellerId` corresponda ao identificador informado na rota.
- Retornar somente produtos cujo `isActive` seja igual a `true`.
- Retornar um array vazio quando o vendedor não possuir produtos ativos.
- Ser público e permitir acesso sem token JWT.

A ausência de produtos para o vendedor não deve ser tratada como erro ou como produto não encontrado.

### RF-03: Consulta de produto por ID

O serviço deve disponibilizar o endpoint `GET /products/:id`, em que `:id` representa o UUID do produto.

Esse endpoint deve:

- Retornar os dados do produto correspondente ao ID informado.
- Retornar `404 Not Found` quando nenhum produto corresponder ao ID informado.
- Ser público e permitir acesso sem token JWT.

Esta consulta é determinada pela existência do produto. Portanto, não deve aplicar o filtro de `isActive` exigido nas duas listagens.

### RF-04: Exposição pública restrita às consultas

Os três endpoints de consulta desta especificação devem ser identificados como públicos para não exigirem autenticação pelo guard global.

Essa definição não deve alterar a proteção das demais operações. Em particular, `POST /products` deve continuar protegido e restrito a usuários vendedores conforme seu comportamento existente.

### RF-05: Prioridade das rotas

A declaração das rotas no controller deve preservar a seguinte precedência funcional:

1. A rota de listagem geral `GET /products`.
2. A rota com prefixo específico `GET /products/seller/:sellerId`.
3. A rota dinâmica `GET /products/:id`.

A rota com prefixo `seller/:sellerId` deve ser reconhecida como consulta por vendedor e nunca ser capturada ou interpretada pela rota dinâmica de consulta por ID.

---

## 4. Dados retornados

Cada produto retornado pelas consultas deve representar os dados da entidade `Product`, incluindo:

- `id`
- `name`
- `description`
- `price`
- `stock`
- `sellerId`
- `isActive`
- `createdAt`
- `updatedAt`

Os endpoints de listagem devem retornar uma coleção de produtos. O endpoint de consulta por ID deve retornar um único produto.

---

## 5. Respostas esperadas

| Endpoint | Status | Condição | Resultado esperado |
|---|---|---|---|
| `GET /products` | `200 OK` | Existem produtos ativos. | Array com todos os produtos ativos, do mais recente para o mais antigo. |
| `GET /products` | `200 OK` | Não existem produtos ativos. | Array vazio. |
| `GET /products/seller/:sellerId` | `200 OK` | O vendedor possui produtos ativos. | Array contendo somente os produtos ativos do vendedor informado. |
| `GET /products/seller/:sellerId` | `200 OK` | O vendedor não possui produtos ativos. | Array vazio. |
| `GET /products/:id` | `200 OK` | O produto existe. | Dados do produto correspondente ao ID informado. |
| `GET /products/:id` | `404 Not Found` | O produto não existe. | Indicação de que o produto não foi encontrado. |

---

## 6. Critérios de aceite

### CA-01: Catálogo público de produtos ativos

- [ ] Uma requisição sem token para `GET /products` retorna `200 OK`.
- [ ] A resposta contém somente produtos com `isActive` igual a `true`.
- [ ] Produtos inativos não aparecem na resposta.
- [ ] Os produtos são retornados por `createdAt` em ordem decrescente.
- [ ] Quando dois produtos ativos possuem datas de criação diferentes, o mais recente aparece antes do mais antigo.
- [ ] Quando não existem produtos ativos, a resposta é um array vazio com `200 OK`.

### CA-02: Consulta pública por vendedor

- [ ] Uma requisição sem token para `GET /products/seller/:sellerId` retorna `200 OK`.
- [ ] Todos os itens retornados possuem `sellerId` igual ao parâmetro da rota.
- [ ] Todos os itens retornados possuem `isActive` igual a `true`.
- [ ] Produtos de outros vendedores não aparecem na resposta.
- [ ] Produtos inativos do vendedor informado não aparecem na resposta.
- [ ] Quando o vendedor não possui produtos ativos, a resposta é um array vazio com `200 OK`.
- [ ] A ausência de produtos do vendedor não resulta em `404 Not Found`.

### CA-03: Consulta pública por ID

- [ ] Uma requisição sem token para `GET /products/:id` retorna `200 OK` quando o produto existe.
- [ ] O produto retornado possui `id` exatamente igual ao UUID informado na rota.
- [ ] Os dados retornados correspondem ao registro persistido.
- [ ] Um produto existente pode ser consultado por ID independentemente do valor de `isActive`.
- [ ] Quando o produto não existe, a resposta é `404 Not Found`.

### CA-04: Contrato das respostas

- [ ] `GET /products` retorna um array.
- [ ] `GET /products/seller/:sellerId` retorna um array.
- [ ] `GET /products/:id` retorna um único produto quando encontrado.
- [ ] Cada produto retornado contém os campos definidos na entidade `Product`.

### CA-05: Resolução correta das rotas

- [ ] `GET /products/seller/:sellerId` é processada como consulta por vendedor.
- [ ] O segmento `seller` não é interpretado como o parâmetro `:id` de `GET /products/:id`.
- [ ] As rotas estática e com prefixo específico são declaradas antes da rota dinâmica `:id`.

### CA-06: Preservação da segurança da criação

- [ ] Somente os três endpoints `GET` definidos nesta especificação são tornados públicos.
- [ ] `POST /products` continua sem identificação de rota pública.
- [ ] Uma requisição sem token para `POST /products` continua sendo recusada pela autenticação global.
- [ ] As regras existentes de autorização da criação para vendedores permanecem inalteradas.

---

## 7. Fora de escopo

- Criação ou alteração do comportamento de `POST /products`.
- Atualização de produtos.
- Exclusão ou desativação de produtos.
- Paginação.
- Filtros adicionais de catálogo.
- Busca por texto.
- Ordenações alternativas.
- Consulta de produtos inativos por listagem.
- Upload ou gerenciamento de imagens.
- Categorias de produtos.
- Integrações com outros microserviços.
