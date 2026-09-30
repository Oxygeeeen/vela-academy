import { describe, expect, it } from "vitest";
import { generateTemporaryPassword, hashPassword, validatePasswordStrength, verifyPassword } from "@/lib/auth/password";

describe("password controls", () => {
  it("rejects weak passwords and accepts an enterprise-strength password", () => {
    expect(validatePasswordStrength("password").valid).toBe(false);
    expect(validatePasswordStrength("Strong!Learning2026").valid).toBe(true);
  });

  it("hashes and verifies without retaining plaintext", async () => {
    const password = "Strong!Learning2026";
    const hash = await hashPassword(password);
    expect(hash).not.toContain(password);
    await expect(verifyPassword(password, hash)).resolves.toBe(true);
    await expect(verifyPassword("Wrong!Password2026", hash)).resolves.toBe(false);
  }, 30_000);

  it("generates temporary passwords that satisfy the policy", () => {
    expect(validatePasswordStrength(generateTemporaryPassword()).valid).toBe(true);
  });
});
