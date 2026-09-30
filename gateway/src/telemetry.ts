import {
  NodeStatusState,
  StoredSecurityEvent,
  TelemetryPayload,
} from "./types.js"

class TelemetryStore {
  private state: NodeStatusState = {
    deviceId: "ESP32-SEC-01",
    status: "OFFLINE",
    lastSeen: null,
    threatScore: 0,
    threatLevel: "NORMAL",
    lockState: "SECURED",
    eventCount: 0,
    recentEvents: [],
  }

  private maxHistory = 100
  private sequence = 0

  public getStatus(): NodeStatusState {
    return {
      ...this.state,
      recentEvents: [...this.state.recentEvents],
    }
  }

  public recordTelemetry(payload: TelemetryPayload): NodeStatusState {
    const receivedAt = new Date().toISOString()

    this.sequence += 1

    const event: StoredSecurityEvent = {
      ...payload,
      eventId: this.createEventId(),
      receivedAt,
      sequence: this.sequence,
    }

    this.state.deviceId = payload.deviceId
    this.state.status = "ONLINE"
    this.state.lastSeen = receivedAt
    this.state.threatScore = payload.threatScore
    this.state.threatLevel = payload.threatLevel
    this.state.lockState = payload.lockState
    this.state.eventCount += 1

    this.state.recentEvents.unshift(event)

    if (this.state.recentEvents.length > this.maxHistory) {
      this.state.recentEvents = this.state.recentEvents.slice(
        0,
        this.maxHistory
      )
    }

    return this.getStatus()
  }

  private createEventId(): string {
    const timestamp = Date.now().toString(36)
    const sequence = this.sequence.toString(36)

    return `evt-${timestamp}-${sequence}`
  }
}

export const telemetryStore = new TelemetryStore()