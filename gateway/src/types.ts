export type EventType =
  | "SYSTEM_BOOT"
  | "DEVICE_ONLINE"
  | "DEVICE_OFFLINE"
  | "RFID_ACCEPTED"
  | "MFA_CHALLENGE_STARTED"
  | "MFA_SUCCESS"
  | "PIN_FAILURE"
  | "ACCESS_GRANTED"
  | "ACCESS_DENIED"
  | "THREAT_ESCALATED"
  | "LOCKDOWN_ENTERED"
  | "LOCK_RESTORED"
  | "GATEWAY_OFFLINE"
  | "GATEWAY_RECONNECTED"
  | "TAMPER_DETECTED"
  | "SYSTEM_ERROR"

export type ThreatLevel =
  | "NORMAL"
  | "ELEVATED"
  | "HIGH"
  | "CRITICAL"

export type LockState =
  | "SECURED"
  | "UNLOCKED"
  | "LOCKDOWN"

export type CredentialType =
  | "RFID"
  | "PIN"
  | "MFA"
  | "SYSTEM"
  | "UNKNOWN"

export interface TelemetryPayload {
  deviceId: string

  // Monotonic time since ESP32 boot.
  // This is NOT Unix time.
  uptimeSeconds: number

  event: EventType

  credentialType?: CredentialType

  // Must never contain raw PIN values.
  credentialId?: string

  threatScore: number
  threatLevel: ThreatLevel
  lockState: LockState

  network?: string
  source?: string
}

export interface StoredSecurityEvent extends TelemetryPayload {
  eventId: string
  receivedAt: string
  sequence: number
}

export interface NodeStatusState {
  deviceId: string
  status: "ONLINE" | "OFFLINE"

  // Gateway receipt time, not ESP32 uptime.
  lastSeen: string | null

  threatScore: number
  threatLevel: ThreatLevel
  lockState: LockState

  eventCount: number
  recentEvents: StoredSecurityEvent[]
}