import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

export function configureSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('Billing Service')
    .setDescription(
      'Os comandos da Saga são consumidos por SQS e não são endpoints HTTP. As rotas HTTP internas de comando estão marcadas como legadas; a consulta de pagamento com x-saga-token permanece síncrona para a entrega da OS.',
    )
    .setVersion('1.0')
    .addApiKey(
      {
        type: 'apiKey',
        in: 'header',
        name: 'x-saga-token',
        description: 'Token para as rotas HTTP internas legadas do Billing.',
      },
      'SagaToken',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);
}
