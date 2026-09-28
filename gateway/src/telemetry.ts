import { NodeStatusState, TelemetryPayload } from "./types.js"

class TelemetryStore {
  private state: NodeStatusState = {
    deviceId: "ESP32-SEC-01",
    status: "OFFLINE",
    lastSeen: 0,
    threatScore: 0,
    threatLevel: "NORMAL",
    lockState: "SECURED",
    eventCount: 0,
    recentEvents: [],
  }

  private maxHistory = 100

  public getStatus(): NodeStatusState {
    // If last seen was more than 30 seconds ago, mark offline for responsiveness if needed, 
    // but here we keep the exact state recorded.
    return { ...this.state }
  }

  public recordTelemetry(payload: TelemetryPayload): NodeStatusState {
    this.state.deviceId = payload.deviceId
    this.state.status = "ONLINE"
    this.state.lastSeen = payload.timestamp * 1000 // convert unix timestamp seconds to ms if needed, or keep timestamp
    this.state.threatScore = payload.threatScore
    this.state.threatLevel = payload.threatLevel
    this.state.lockState = payload.lockState
    this.state.eventCount += 1

    // Prepend to recent events
    this.state.recentEvents.unshift(payload)
    if (this.state.recentEvents.length > this.maxHistory) {
      this.state.recentEvents = this.state.recentEvents.slice(0, this.maxHistory)
    }

    return { ...this.state }
  }
}

export const telemetryStore = new TelemetryStore()
