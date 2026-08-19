import { validateEnvironment } from './environment.config';

describe('validateEnvironment', () => {
  it('requires RABBITMQ_URL', () => {
    expect(() => validateEnvironment({})).toThrow('RABBITMQ_URL is required');
  });

  it.each(['not-a-url', 'http://user:secret@rabbitmq:15672', 'amqp://'])(
    'rejects an invalid RabbitMQ URL without exposing it: %s',
    (rabbitMqUrl) => {
      let error: unknown;

      try {
        validateEnvironment({ RABBITMQ_URL: rabbitMqUrl });
      } catch (caughtError) {
        error = caughtError;
      }

      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).toBe(
        'RABBITMQ_URL must be a valid AMQP URL',
      );
      expect((error as Error).message).not.toContain(rabbitMqUrl);
      expect((error as Error).message).not.toContain('secret');
    },
  );

  it.each(['amqp://rabbitmq:5672', 'amqps://rabbitmq:5671'])(
    'accepts %s',
    (rabbitMqUrl) => {
      const config = { RABBITMQ_URL: rabbitMqUrl };

      expect(validateEnvironment(config)).toBe(config);
    },
  );
});
