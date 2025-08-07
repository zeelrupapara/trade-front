import { API_CONFIG, ERROR_MESSAGES } from '../constants';

export class TradingError extends Error {
  code?: string;
  details?: any;
  
  constructor(message: string, code?: string, details?: any) {
    super(message);
    this.name = 'TradingError';
    this.code = code;
    this.details = details;
  }
}

export class NetworkError extends TradingError {
  constructor(message: string = ERROR_MESSAGES.NETWORK_ERROR, details?: any) {
    super(message, 'NETWORK_ERROR', details);
    this.name = 'NetworkError';
  }
}

export class AuthError extends TradingError {
  constructor(message: string = ERROR_MESSAGES.AUTH_ERROR, details?: any) {
    super(message, 'AUTH_ERROR', details);
    this.name = 'AuthError';
  }
}

export class DataError extends TradingError {
  constructor(message: string = ERROR_MESSAGES.INVALID_DATA_FORMAT, details?: any) {
    super(message, 'DATA_ERROR', details);
    this.name = 'DataError';
  }
}

// Retry utility with exponential backoff
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    initialDelay?: number;
    maxDelay?: number;
    backoffFactor?: number;
    onRetry?: (attempt: number, error: Error) => void;
  } = {}
): Promise<T> {
  const {
    maxAttempts = API_CONFIG.RETRY_ATTEMPTS,
    initialDelay = API_CONFIG.RETRY_DELAY,
    maxDelay = 30000,
    backoffFactor = 2,
    onRetry,
  } = options;

  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxAttempts) {
        throw lastError;
      }
      
      if (onRetry) {
        onRetry(attempt, lastError);
      }
      
      const delay = Math.min(
        initialDelay * Math.pow(backoffFactor, attempt - 1),
        maxDelay
      );
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError!;
}

// Validate API response
export function validateResponse(response: any, schema?: {
  required?: string[];
  types?: Record<string, string>;
}): void {
  if (!response) {
    throw new DataError('Empty response received');
  }
  
  if (schema?.required) {
    for (const field of schema.required) {
      if (!(field in response)) {
        throw new DataError(`Missing required field: ${field}`);
      }
    }
  }
  
  if (schema?.types) {
    for (const [field, expectedType] of Object.entries(schema.types)) {
      if (field in response && typeof response[field] !== expectedType) {
        throw new DataError(
          `Invalid type for field ${field}: expected ${expectedType}, got ${typeof response[field]}`
        );
      }
    }
  }
}

// Format error for user display
export function formatErrorMessage(error: unknown): string {
  if (error instanceof TradingError) {
    return error.message;
  }
  
  if (error instanceof Error) {
    // Check for common error patterns
    if (error.message.includes('network') || error.message.includes('fetch')) {
      return ERROR_MESSAGES.NETWORK_ERROR;
    }
    if (error.message.includes('401') || error.message.includes('403')) {
      return ERROR_MESSAGES.AUTH_ERROR;
    }
    
    return error.message;
  }
  
  return 'An unexpected error occurred';
}