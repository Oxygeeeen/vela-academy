import { z } from "zod";

const environmentSchema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  SESSION_SECRET: z.string().min(32, "SESSION_SECRET must be at least 32 characters"),
  APP_URL: z.string().url().default("http://localhost:3000"),
  APP_ENV: z.enum(["development", "test", "production"]).default("development"),
  BOOTSTRAP_ADMIN_EMAIL: z.string().email().optional(),
  BOOTSTRAP_ADMIN_PASSWORD: z.string().min(12).optional(),
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default("Vela AI Academy <vela@scaleworkagency.com>"),
  SUPPORT_EMAIL: z.string().email().default("vela@scaleworkagency.com"),
  CRON_SECRET: z.string().min(24).optional(),
  PASSWORD_MIN_LENGTH: z.coerce.number().int().min(12).max(128).default(14),
  SESSION_TTL_SECONDS: z.coerce.number().int().min(900).max(2_592_000).default(86_400),
  MAX_UPLOAD_BYTES: z.coerce.number().int().min(1_000_000).max(100_000_000).default(25_000_000),
});

export type AppEnvironment = z.infer<typeof environmentSchema>;

let cachedEnvironment: AppEnvironment | undefined;

export function getEnv(): AppEnvironment {
  if (!cachedEnvironment) {
    const result = environmentSchema.safeParse(process.env);
    if (!result.success) {
      const details = result.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ");
      throw new Error(`Invalid environment configuration: ${details}`);
    }
    cachedEnvironment = result.data;
  }
  return cachedEnvironment;
}

export function getOptionalEnv() {
  return environmentSchema.partial().safeParse(process.env).data ?? {};
}
