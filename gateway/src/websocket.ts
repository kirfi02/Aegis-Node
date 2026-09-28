import { WebSocketServer, WebSocket } from "ws"
import { Server } from "http"
import { telemetryStore } from "./telemetry.js"
import { TelemetryPayload } from "./types.js"

export function setupWebSocket(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ server, path: "/ws" })

  wss.on("connection", (ws: WebSocket) => {
    console.log("[AEGIS] WebSocket client connected")

    // Send current state snapshot immediately upon connection
    const currentStatus = telemetryStore.getStatus()
    ws.send(
      JSON.stringify({
        type: "SNAPSHOT",
        data: currentStatus,
      })
    )

    ws.on("close", () => {
      console.log("[AEGIS] WebSocket client disconnected")
    })

    ws.on("error", (err) => {
      console.error("[AEGIS] WebSocket error:", err)
    })
  })

  return wss
}

export function broadcastTelemetry(wss: WebSocketServer, payload: TelemetryPayload) {
  const message = JSON.stringify({
    type: "TELEMETRY",
    data: payload,
  })

  let clientCount = 0
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message)
      clientCount++
    }
  })

  console.log(`[AEGIS] Telemetry broadcast: ${payload.deviceId} (${clientCount} clients)`)
}
