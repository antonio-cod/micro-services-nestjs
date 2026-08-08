# Install Dependece

    npm i --save-dev @types/node
    npm install @nestjs/typeorm typeorm pg
    npm install @nestjs/jwt @nestjs/passport passport passport-jwt
    npm install @nestjs/jwt bcryptjs
    npm install -D @types/bcryptjs
    npm install @nestjs/axios axios
    npm install @nestjs/config //provavelmente ja vem instalado
    npm install class-validator class-transformer
    npm install amqplib
    npm install --save-dev @types/amqplib
    npm i -D @types/passport @types/passport-jwt
    sudo apt install docker-compose-plugin

# comandos

    nest generate module events
    nest generate service events/rabbitmq --no-spec
    nest g service events/payment-queue --no-spec
