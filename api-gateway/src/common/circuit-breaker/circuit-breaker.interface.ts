enum CircuitBreakerStateEnum {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerOptions {
  failureThershold: number;
  timeout: number;
  resetTimeout: number;
}

export interface CircuitBreakerState {
  state: CircuitBreakerStateEnum;
  failureCount: number;
  lastFailureTime: number;
  nextAttemptTime: number;
}

export interface CircuitBreakerResult<T> {
  sucess: boolean;
  data?: T;
  error?: Error;
  fromCache?: boolean;
}
