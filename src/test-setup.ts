import '@testing-library/jest-dom';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

// Reset mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
  mockFetch.mockReset();
});
