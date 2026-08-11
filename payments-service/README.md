# Install

    npm install @nestjs/typeorm typeorm pg @nestjs/passport passport passport-jwt @nestjs/jwt bcryptjs @nestjs/axios axios @nestjs/config class-validator class-transformer amqplib
    npm install -D @types/passport-jwt @types/bcryptjs @types/amqplib @types/passport

# Nestjs cli

    nest generate module events
    nest generate service events/rabbitmq --no-spec
    nest generate service events/payment-queue --no-spec
    nest generate service events/payment-consumer --no-spec
    nest generate controller events/metrics --no-spec
