// Test utilities and helpers
export function mockFetch(data: unknown, ok = true, status = 200): typeof fetch {
  return async () => ({
    ok,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
  }) as Response;
}

export function createMockPriceTick(symbol: string, price: number, change24h: number) {
  return {
    id: symbol,
    symbol,
    price,
    change24h,
    timestamp: Date.now(),
  };
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}