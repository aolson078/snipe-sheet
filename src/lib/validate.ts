import { z } from "zod";

export const addressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Invalid Ethereum address");

export const chainSchema = z.enum(["ethereum", "base"]);

export const analyzeSchema = z.object({
  address: addressSchema,
  chain: chainSchema,
});
