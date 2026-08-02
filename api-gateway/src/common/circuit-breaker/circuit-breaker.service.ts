import { Injectable, Logger } from '@nestjs/common';
import {
  CircuitBreakerOptions,
  CircuitBreakerState,
  CircuitBreakerStateEnum,
} from './circuit-breaker.interface';

@Injectable()
export class CircuitBreakerService {
  private readonly logger = new Logger('CircuitBreaker');
  private readonly circuits = new Map<string, CircuitBreakerState>();
  private readonly defaultOptions: CircuitBreakerOptions = {
    failureThreshold: 5,
    timeout: 60000,
    resetTimeout: 30000,
  };

  async executeWithCircuitBreaker<T>(
    operation: () => Promise<T>,
    key: string,
    options: CircuitBreakerOptions = this.defaultOptions,
    fallback?: () => Promise<T>,
  ): Promise<T> {
    const config = { ...this.defaultOptions, ...options };
    const circuit = this.getOrCreateCircuit(key, config);

    if (circuit.state === 'OPEN') {
      if (Date.now() < circuit.nextAttemptTime) {
        this.logger.warn(`Circuit breaker OPEN for ${key}, using fallback`);

        if (fallback) {
          return await fallback();
        }

        throw new Error('Circuit breaker OPEN');
      } else {
        circuit.state = CircuitBreakerStateEnum.HALF_OPEN;
        this.logger.warn(
          `Circuit breaker HALF_OPEN for ${key}, using fallback`,
        );
      }
    }

    try {
      const result = await operation();
      this.onSucess(circuit, key);

      return result;
    } catch (error) {
      this.onFailure(circuit, key);
      this.logger.error(`Circuit breaker failure for ${key}:`, error.message);

      if (fallback) {
        this.logger.log(`Using fallback for ${key}`);
        return await fallback();
      }

      throw error;
    }
  }

  private getOrCreateCircuit(
    key: string,
    options: CircuitBreakerOptions,
  ): CircuitBreakerState {
    if (!this.circuits.has(key)) {
      this.circuits.set(key, {
        state: CircuitBreakerStateEnum.CLOSED,
        failureCount: 0,
        lastFailureTime: 0,
        nextAttemptTime: Date.now() + options.timeout,
      });
    }

    return this.circuits.get(key)!;
  }
}
