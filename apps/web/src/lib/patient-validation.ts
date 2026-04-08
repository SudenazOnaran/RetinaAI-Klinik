import { z } from "zod";

function isValidTcNo(tcNo: string) {
  if (!/^\d{11}$/.test(tcNo)) return false;
  if (tcNo[0] === "0") return false;

  const digits = tcNo.split("").map(Number);
  const oddSum = digits[0] + digits[2] + digits[4] + digits[6] + digits[8];
  const evenSum = digits[1] + digits[3] + digits[5] + digits[7];
  const tenth = (((oddSum * 7 - evenSum) % 10) + 10) % 10;
  const eleventh = digits.slice(0, 10).reduce((sum, d) => sum + d, 0) % 10;

  return digits[9] === tenth && digits[10] === eleventh;
}

const normalizedText = z
  .string()
  .trim()
  .min(2, "Alan en az 2 karakter olmali")
  .max(120, "Alan en fazla 120 karakter olmali");

const createPatientSchema = z.object({
  fullName: normalizedText,
  tcNo: z
    .string()
    .trim()
    .regex(/^\d{11}$/, "TC No 11 haneli sayi olmalidir")
    .refine(isValidTcNo, "TC No dogrulamasi basarisiz"),
  age: z
    .number()
    .int()
    .min(0, "Yas 0-120 araliginda olmali")
    .max(120, "Yas 0-120 araliginda olmali"),
  gender: z.string().trim().min(1, "Cinsiyet secimi zorunlu"),
  diabetesYears: z
    .number()
    .int()
    .min(0, "Diyabet yili 0-80 araliginda olmali")
    .max(80, "Diyabet yili 0-80 araliginda olmali")
    .nullable()
    .optional(),
  hba1c: z
    .number()
    .min(3, "HbA1c 3-20 araliginda olmali")
    .max(20, "HbA1c 3-20 araliginda olmali")
    .nullable()
    .optional(),
});

const updatePatientClinicalSchema = z.object({
  age: z
    .number()
    .int()
    .min(0, "Yas 0-120 araliginda olmali")
    .max(120, "Yas 0-120 araliginda olmali"),
  diabetesYears: z
    .number()
    .int()
    .min(0, "Diyabet yili 0-80 araliginda olmali")
    .max(80, "Diyabet yili 0-80 araliginda olmali")
    .nullable(),
  hba1c: z
    .number()
    .min(3, "HbA1c 3-20 araliginda olmali")
    .max(20, "HbA1c 3-20 araliginda olmali")
    .nullable(),
});

export type CreatePatientInput = z.infer<typeof createPatientSchema>;
export type UpdatePatientClinicalInput = z.infer<
  typeof updatePatientClinicalSchema
>;

export function validateCreatePatientInput(input: unknown) {
  return createPatientSchema.safeParse(input);
}

export function validateUpdatePatientClinicalInput(input: unknown) {
  return updatePatientClinicalSchema.safeParse(input);
}
