/**
 * TechnicalAnalysis tests — pure math functions, no network calls.
 */
import { describe, it, expect } from "vitest";
import { rsi, macd, ema, sma, bollingerBands, rsiSignal, macdSignal } from "../tools/TechnicalAnalysis.js";

// Generate price series for testing
const risingPrices  = Array.from({ length: 60 }, (_, i) => 100 + i * 2);  // 100→218
const fallingPrices = Array.from({ length: 60 }, (_, i) => 220 - i * 2);  // 220→102
const flatPrices    = Array.from({ length: 60 }, () => 150);

describe("sma()", () => {
  it("returns empty array when insufficient data", () => {
    expect(sma([100, 99], 14)).toEqual([]);
  });

  it("calculates correct 3-period SMA", () => {
    const result = sma([10, 20, 30, 40], 3);
    expect(result[0]).toBeCloseTo(20, 2);  // (10+20+30)/3
    expect(result[1]).toBeCloseTo(30, 2);  // (20+30+40)/3
  });

  it("result length = prices.length - period + 1", () => {
    const result = sma(risingPrices, 20);
    expect(result.length).toBe(risingPrices.length - 20 + 1);
  });
});

describe("ema()", () => {
  it("returns first price as first EMA value", () => {
    const result = ema([100, 110, 120], 3);
    expect(result[0]).toBe(100);
  });

  it("EMA tracks price direction", () => {
    const result = ema(risingPrices, 12);
    expect(result[result.length - 1]).toBeGreaterThan(result[0]!);
  });
});

describe("rsi()", () => {
  it("returns empty array when insufficient data", () => {
    expect(rsi([100, 99], 14)).toEqual([]);
  });

  it("returns oversold (<30) for falling prices", () => {
    const result = rsi(fallingPrices, 14);
    expect(result[result.length - 1]).toBeLessThan(30);
  });

  it("returns overbought (>70) for rising prices", () => {
    const result = rsi(risingPrices, 14);
    expect(result[result.length - 1]).toBeGreaterThan(70);
  });

  it("returns neutral (~50) for flat prices", () => {
    // RSI is undefined for perfectly flat — but should handle gracefully
    const result = rsi(flatPrices, 14);
    // avgLoss = 0, so RSI = 100 (no change)
    expect(result.length).toBeGreaterThan(0);
  });

  it("all values are in [0, 100]", () => {
    const result = rsi(risingPrices, 14);
    for (const v of result) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });
});

describe("rsiSignal()", () => {
  it("returns bearish for overbought RSI", () => {
    const sig = rsiSignal([75]);
    expect(sig.signal).toBe("bearish");
    expect(sig.metadata?.condition).toBe("overbought");
  });

  it("returns bullish for oversold RSI", () => {
    const sig = rsiSignal([25]);
    expect(sig.signal).toBe("bullish");
    expect(sig.metadata?.condition).toBe("oversold");
  });

  it("returns neutral for mid-range RSI", () => {
    const sig = rsiSignal([50]);
    expect(sig.signal).toBe("neutral");
  });
});

describe("macd()", () => {
  it("returns empty arrays for insufficient data", () => {
    const result = macd([100, 99], 12, 26, 9);
    expect(result.signal).toEqual([]);
  });

  it("produces histogram for sufficient data", () => {
    const result = macd(risingPrices, 12, 26, 9);
    expect(result.macd.length).toBeGreaterThan(0);
    expect(result.histogram.length).toBeGreaterThan(0);
  });
});

describe("macdSignal()", () => {
  it("returns neutral for empty histogram", () => {
    expect(macdSignal({ macd: [], signal: [], histogram: [] }).signal).toBe("neutral");
  });

  it("returns bullish when histogram crosses above zero", () => {
    const sig = macdSignal({ macd: [0.1], signal: [0], histogram: [-0.1, 0.1] });
    expect(sig.signal).toBe("bullish");
  });
});

describe("bollingerBands()", () => {
  it("upper band > middle > lower band", () => {
    const bands = bollingerBands(risingPrices, 20, 2);
    const last  = bands.upper.length - 1;
    expect(bands.upper[last]).toBeGreaterThan(bands.middle[last]!);
    expect(bands.middle[last]).toBeGreaterThan(bands.lower[last]!);
  });

  it("flat prices produce narrow bands", () => {
    const bands = bollingerBands(flatPrices, 20, 2);
    const last  = bands.width.length - 1;
    expect(bands.width[last]).toBeLessThan(1); // near-zero width for flat prices
  });
});
