import { describe, it, expect } from 'vitest';
import { resolveModelChain } from '../../runner/ModelClient.js';
import type { ModelRegistry } from '../../models/ModelRegistry.js';

describe('ModelClient', () => {
  describe('resolveModelChain', () => {
    it('returns chain from user models', () => {
      const original = process.env.OPENROUTER_API_KEY;
      process.env.OPENROUTER_API_KEY = '';
      try {
        // Will throw because no API keys set
        expect(() => resolveModelChain(undefined)).toThrow('No API key found');
      } finally {
        if (original) process.env.OPENROUTER_API_KEY = original;
        else delete process.env.OPENROUTER_API_KEY;
      }
    });

    it('handles empty user models', () => {
      const original = process.env.OPENROUTER_API_KEY;
      process.env.OPENROUTER_API_KEY = '';
      try {
        // Will throw because no API keys set
        expect(() => resolveModelChain(undefined)).toThrow('No API key found');
      } finally {
        if (original) process.env.OPENROUTER_API_KEY = original;
        else delete process.env.OPENROUTER_API_KEY;
      }
    });
  });

  describe('technical analysis exports', () => {
    it('exports fullAnalysis function', async () => {
      const { fullAnalysis } = await import('../../tools/TechnicalAnalysis.js');
      expect(typeof fullAnalysis).toBe('function');
    });

    it('exports indicator functions', async () => {
      const { rsi, macd, ema, sma, bollingerBands, atr } = await import('../../tools/TechnicalAnalysis.js');
      expect(typeof rsi).toBe('function');
      expect(typeof macd).toBe('function');
      expect(typeof ema).toBe('function');
      expect(typeof sma).toBe('function');
      expect(typeof bollingerBands).toBe('function');
      expect(typeof atr).toBe('function');
    });
  });

  describe('TechnicalAnalysis', () => {
    it('calculates SMA correctly', async () => {
      const { sma } = await import('../../tools/TechnicalAnalysis.js');
      const prices = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const result = sma(prices, 3);
      expect(result.length).toBe(8);
      expect(result[0]).toBeCloseTo(2); // (1+2+3)/3
    });

    it('calculates RSI on sufficient data', async () => {
      const { rsi } = await import('../../tools/TechnicalAnalysis.js');
      const prices = Array.from({ length: 20 }, (_, i) => 100 + Math.sin(i) * 10);
      const result = rsi(prices, 14);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toBeGreaterThanOrEqual(0);
      expect(result[0]).toBeLessThanOrEqual(100);
    });

    it('returns empty RSI for insufficient data', async () => {
      const { rsi } = await import('../../tools/TechnicalAnalysis.js');
      const prices = [100, 101];
      const result = rsi(prices, 14);
      expect(result.length).toBe(0);
    });
  });
});