import { z } from "zod"

export const telemetrySchema = z.object({
  deviceId: z
    .string()
    .min(1, "deviceId is required")
    .max(64, "deviceId is too long"),

  // Monotonic ESP32 uptime in seconds.
  // This is intentionally NOT treated as Unix time.
  uptimeSeconds: z
    .number()
    .int()
    .nonnegative("uptimeSeconds must be non-negative"),

  event: z.enum([
    "SYSTEM_BOOT",
    "DEVICE_ONLINE",
    "DEVICE_OFFLINE",

    "RFID_ACCEPTED",
    "MFA_CHALLENGE_STARTED",
    "MFA_SUCCESS",
    "PIN_FAILURE",

    "ACCESS_GRANTED",
    "ACCESS_DENIED",

    "THREAT_ESCALATED",
    "LOCKDOWN_ENTERED",
    "LOCK_RESTORED",

    "GATEWAY_OFFLINE",
    "GATEWAY_RECONNECTED",

    "TAMPER_DETECTED",
    "SYSTEM_ERROR",
  ]),

  credentialType: z
    .enum([
      "RFID",
      "PIN",
      "MFA",
      "SYSTEM",
      "UNKNOWN",
    ])
    .optional(),

  // Credential identifiers must already be redacted/safe.
  // Raw PIN values must never reach the gateway.
  credentialId: z
    .string()
    .max(128, "credentialId is too long")
    .optional(),

  threatScore: z
    .number()
    .int()
    .min(0)
    .max(100, "threatScore must be between 0 and 100"),

  threatLevel: z.enum([
    "NORMAL",
    "ELEVATED",
    "HIGH",
    "CRITICAL",
  ]),

  lockState: z.enum([
    "SECURED",
    "UNLOCKED",
    "LOCKDOWN",
  ]),

  network: z
    .string()
    .max(32, "network is too long")
    .optional(),

  source: z
    .string()
    .max(32, "source is too long")
    .optional(),
})

export type ValidatedTelemetry = z.infer<typeof telemetrySchema>