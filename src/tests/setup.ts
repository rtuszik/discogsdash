import { beforeAll, afterEach, afterAll } from 'vitest';
import { server } from '../mocks/node'; // Import the MSW server
import '@testing-library/jest-dom/vitest'; // Extend Vitest's expect with jest-dom matchers

// --- MSW Setup ---
// Start MSW server before all tests
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

// Reset any request handlers that may be added during the tests,
// so they don't affect other tests.
afterEach(() => server.resetHandlers());

// Clean up after the tests are finished.
afterAll(() => server.close());
// --- End MSW Setup ---

// You can add other global setup here if needed, e.g.,
// - Mocking global objects (localStorage, fetch)
// - Setting up global test data