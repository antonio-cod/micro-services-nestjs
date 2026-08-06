## Install

npm i -g @nestjs/cli

## Nest cli

nest --help

nest g s proxy/service/proxy --flat
nest g mo middleware
nest g mi middleware/looging
nest g gu guards/throttler --flat
nest g mo auth
nest g s auth/service/auth --flat
nest g co auth/controllers/auth --flat
nest g gu auth/guard/auth --flat
nest g gu auth/guard/session --flat
nest g gu auth/guard/role --flat
nest g d auth/decorators/public --flat
nest g d auth/decorators/roles --flat
nest g d auth/decorators/current-user --flat
nest g mo health
nest g co health
nest g s health --no-spec
nest g mo common/timeout
nest g itf common/timeout
nest g s common/timeout
nest g mo common/retry
nest g s common/retry
nest g itf common/retry

# Removendo git para subir todo codigo em um unico repositorio modelo monorepo

// Dentro da pasta raiz execute esse comando mais no nome do micro por padrao o nestjs cria o git no micro services.
rm -rf checkout-service/.git
