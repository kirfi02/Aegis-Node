import { z } from "zod"

export const telemetrySchema = z.object({
  deviceId: z.string().min(1, "deviceId is required"),
  timestamp: z.number().int().positive("timestamp must be a positive integer"),
  event: z.enum([
    "ACCESS_GRANTED",
    "ACCESS_DENIED",
    "THREAT_DETECTED",
    "LOCKDOWN",
    "DEVICE_ONLINE",
    "DEVICE_OFFLINE",
    "SYSTEM_ERROR",
  ]),
  credentialType: z.enum(["RFID", "PIN", "SYSTEM", "UNKNOWN"]).optional(),
  credentialId: z.string().optional(),
  threatScore: z.number().min(0).max(100, "threatScore must be between 0 and 100"),
  threatLevel: z.enum(["NORMAL", "ELEVATED", "HIGH", "CRITICAL"]),
  lockState: z.enum(["SECURED", "UNLOCKED", "LOCKDOWN"]),
  network: z.string().optional(),
  source: z.string().optional(),
})

export type ValidatedTelemetry = z.infer<typeof telemetrySchema>
