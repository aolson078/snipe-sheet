import { describe, it, expect } from "vitest";
import { addressSchema, chainSchema, analyzeSchema } from "../lib/validate";

describe("addressSchema", () => {
  it("accepts valid Ethereum address", () => {
    expect(
      addressSchema.parse("0x1234567890abcdef1234567890abcdef12345678")
    ).toBe("0x1234567890abcdef1234567890abcdef12345678");
  });

  it("rejects address without 0x prefix", () => {
    expect(() =>
      addressSchema.parse("1234567890abcdef1234567890abcdef12345678")
    ).toThrow();
  });

  it("rejects too-short address", () => {
    expect(() => addressSchema.parse("0x1234")).toThrow();
  });

  it("rejects non-hex characters", () => {
    expect(() =>
      addressSchema.parse("0xGGGG567890abcdef1234567890abcdef12345678")
    ).toThrow();
  });

  it("rejects empty string", () => {
    expect(() => addressSchema.parse("")).toThrow();
  });
});

describe("chainSchema", () => {
  it("accepts ethereum", () => {
    expect(chainSchema.parse("ethereum")).toBe("ethereum");
  });

  it("accepts base", () => {
    expect(chainSchema.parse("base")).toBe("base");
  });

  it("rejects unsupported chain", () => {
    expect(() => chainSchema.parse("solana")).toThrow();
  });
});

describe("analyzeSchema", () => {
  it("accepts valid input", () => {
    const result = analyzeSchema.parse({
      address: "0x1234567890abcdef1234567890abcdef12345678",
      chain: "ethereum",
    });
    expect(result.address).toBe(
      "0x1234567890abcdef1234567890abcdef12345678"
    );
    expect(result.chain).toBe("ethereum");
  });

  it("rejects missing address", () => {
    expect(() => analyzeSchema.parse({ chain: "ethereum" })).toThrow();
  });

  it("rejects missing chain", () => {
    expect(() =>
      analyzeSchema.parse({
        address: "0x1234567890abcdef1234567890abcdef12345678",
      })
    ).toThrow();
  });
});
