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
