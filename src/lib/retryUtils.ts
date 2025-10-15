interface RetryOptions {
    maxRetries?: number;
    baseDelay?: number;
    maxDelay?: number;
    backoffMultiplier?: number;
    retryCondition?: (error: any) => boolean;
}

interface RetryResult<T> {
    success: boolean;
    data?: T;
    error?: Error;
    attempts: number;
}

export class RetryError extends Error {
    constructor(
        message: string,
        public attempts: number,
        public lastError: Error,
    ) {
        super(message);
        this.name = "RetryError";
    }
}

export async function withRetry<T>(operation: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
    const {
        maxRetries = 5,
        baseDelay = 1000,
        maxDelay = 30000,
        backoffMultiplier = 2,
        retryCondition = defaultRetryCondition,
    } = options;

    let lastError: Error = new Error("No attempts made");
    let delay = baseDelay;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
        try {
            const result = await operation();
            if (attempt > 1) {
                console.log(`✅ Operation succeeded on attempt ${attempt}`);
            }
            return result;
        } catch (error) {
            lastError = error as Error;

            // Don't retry on the last attempt
            if (attempt > maxRetries) {
                break;
            }

            // Check if this error should trigger a retry
            if (!retryCondition(error)) {
                throw error;
            }

            console.log(`⚠️ Attempt ${attempt} failed: ${lastError.message}`);

            // Check for Retry-After header in error message for rate limiting
            let actualDelay = delay;
            if (lastError.message.includes("429") || lastError.message.toLowerCase().includes("too many requests")) {
                // For rate limiting, use a longer delay
                actualDelay = Math.max(delay, 5000); // At least 5 seconds for rate limiting
                console.log(`🚦 Rate limit detected, using longer delay: ${actualDelay}ms`);
            }

            console.log(`🔄 Retrying in ${actualDelay}ms... (${maxRetries + 1 - attempt} attempts remaining)`);

            // Wait before retrying
            await sleep(actualDelay);

            // Calculate next delay with exponential backoff
            delay = Math.min(delay * backoffMultiplier, maxDelay);
        }
    }

    throw new RetryError(
        `Operation failed after ${maxRetries + 1} attempts: ${lastError.message}`,
        maxRetries + 1,
        lastError,
    );
}

function defaultRetryCondition(error: any): boolean {
    // Retry on network errors, timeout errors, and rate limiting
    if (error.code === "ECONNREFUSED" || error.code === "ETIMEDOUT") {
        return true;
    }

    // Retry on HTTP status codes that might be temporary
    if (error.message && typeof error.message === "string") {
        const message = error.message.toLowerCase();

        // Rate limiting
        if (message.includes("429") || message.includes("too many requests")) {
            return true;
        }

        // Server errors
        if (message.includes("500") || message.includes("502") || message.includes("503") || message.includes("504")) {
            return true;
        }

        // Network errors
        if (message.includes("network") || message.includes("timeout") || message.includes("connection")) {
            return true;
        }
    }

    return false;
}

export function createDiscogsRetryOptions(): RetryOptions {
    return {
        maxRetries: 8, // More retries for Discogs due to aggressive rate limiting
        baseDelay: 2000, // Start with 2 seconds
        maxDelay: 60000, // Max 1 minute delay
        backoffMultiplier: 1.5, // Gentler exponential backoff
        retryCondition: (error: any) => {
            // Custom retry logic for Discogs API
            if (error.code === "ECONNREFUSED" || error.code === "ETIMEDOUT") {
                return true;
            }

            if (error.message && typeof error.message === "string") {
                const message = error.message.toLowerCase();

                // Don't retry on OAuth-specific authentication errors
                if (
                    message.includes("invalid request token") ||
                    message.includes("invalid access token") ||
                    (message.includes("unauthorized") && message.includes("oauth"))
                ) {
                    return false;
                }

                // Always retry on rate limiting
                if (message.includes("429") || message.includes("too many requests")) {
                    return true;
                }

                // Retry on server errors
                if (
                    message.includes("500") ||
                    message.includes("502") ||
                    message.includes("503") ||
                    message.includes("504")
                ) {
                    return true;
                }

                // Retry on various network/connection issues
                if (
                    message.includes("network") ||
                    message.includes("timeout") ||
                    message.includes("connection") ||
                    message.includes("enotfound") ||
                    message.includes("socket hang up")
                ) {
                    return true;
                }
            }

            return false;
        },
    };
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
