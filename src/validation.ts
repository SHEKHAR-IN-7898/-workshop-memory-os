import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(10).max(200),
  displayName: z.string().trim().min(1).max(120).optional(),
  workshopName: z.string().trim().min(2).max(160),
  workshopSlug: z.string().trim().regex(/^[a-z0-9-]{3,60}$/),
});

export const loginSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().max(200),
});

export const customerSchema = z.object({
  name: z.string().trim().min(1).max(200),
  phone: z.string().trim().max(40).optional(),
  email: z.string().email().max(320).optional(),
  address: z.string().max(1000).optional(),
});

export const vehicleSchema = z.object({
  customerId: z.string().uuid(),
  registration: z.string().trim().min(2).max(40),
  vin: z.string().trim().max(80).optional(),
  make: z.string().trim().max(80).optional(),
  model: z.string().trim().max(80).optional(),
  variant: z.string().trim().max(80).optional(),
  modelYear: z.number().int().min(1950).max(2100).optional(),
  fuelType: z.enum(["PETROL","DIESEL","CNG","ELECTRIC","HYBRID","LPG","OTHER"]).optional(),
});

export const questionSchema = z.object({
  question: z.string().trim().min(3).max(2000),
  vehicleId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
});

export const importSchema = z.object({
  type: z.enum(["customers","vehicles","services","invoices"]),
  csv: z.string().min(1).max(10_000_000),
});
