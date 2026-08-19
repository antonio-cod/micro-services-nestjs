const RABBITMQ_PROTOCOLS = new Set(['amqp:', 'amqps:']);

export function validateEnvironment(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const rabbitMqUrl = config.RABBITMQ_URL;

  if (typeof rabbitMqUrl !== 'string' || rabbitMqUrl.trim().length === 0) {
    throw new Error('RABBITMQ_URL is required');
  }

  try {
    const parsedUrl = new URL(rabbitMqUrl);

    if (!RABBITMQ_PROTOCOLS.has(parsedUrl.protocol) || !parsedUrl.hostname) {
      throw new Error();
    }
  } catch {
    throw new Error('RABBITMQ_URL must be a valid AMQP URL');
  }

  return config;
}
