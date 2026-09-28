export type EventType =
  | "ACCESS_GRANTED"
  | "ACCESS_DENIED"
  | "THREAT_DETECTED"
  | "LOCKDOWN"
  | "DEVICE_ONLINE"
  | "DEVICE_OFFLINE"
  | "SYSTEM_ERROR"

export type ThreatLevel = "NORMAL" | "ELEVATED" | "HIGH" | "CRITICAL"

export type LockState = "SECURED" | "UNLOCKED" | "LOCKDOWN"

export type CredentialType = "RFID" | "PIN" | "SYSTEM" | "UNKNOWN"

export interface TelemetryPayload {
  deviceId: string
  timestamp: number
  event: EventType
  credentialType?: CredentialType
  credentialId?: string
  threatScore: number
  threatLevel: ThreatLevel
  lockState: LockState
  network?: string
  source?: string
}

export interface NodeStatusState {
  deviceId: string
  status: "ONLINE" | "OFFLINE"
  lastSeen: number
  threatScore: number
  threatLevel: ThreatLevel
  lockState: LockState
  eventCount: number
  recentEvents: TelemetryPayload[]
}
