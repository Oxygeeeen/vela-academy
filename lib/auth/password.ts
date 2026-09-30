import bcrypt from "bcryptjs";
import { getOptionalEnv } from "@/lib/env";

const HASH_ROUNDS = 12;

export async function hashPassword(password: string) {
  return bcrypt.hash(password, HASH_ROUNDS);
}

export async function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export function validatePasswordStrength(password: string) {
  const minimumLength = getOptionalEnv().PASSWORD_MIN_LENGTH ?? 14;
  const failures = [
    password.length < minimumLength && `at least ${minimumLength} characters`,
    !/[a-z]/.test(password) && "a lowercase letter",
    !/[A-Z]/.test(password) && "an uppercase letter",
    !/\d/.test(password) && "a number",
    !/[^A-Za-z0-9]/.test(password) && "a special character",
  ].filter(Boolean) as string[];

  return {
    valid: failures.length === 0,
    message: failures.length ? `Password must include ${failures.join(", ")}.` : null,
  };
}

export function generateTemporaryPassword(length = 18) {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%";
  const random = new Uint32Array(length);
  crypto.getRandomValues(random);
  const generated = Array.from(random, (value) => alphabet[value % alphabet.length]).join("");
  return `V!${generated.slice(2)}9a`;
}
