import express, { Request, Response } from "express"
import http from "http"
import cors from "cors"
import dotenv from "dotenv"
import { telemetrySchema } from "./schemas.js"
import { telemetryStore } from "./telemetry.js"
import { setupWebSocket, broadcastTelemetry } from "./websocket.js"
import { getAlertEngine } from "./alerts/alert-engine.js"

dotenv.config()

const app = express()
const server = http.createServer(app)

const PORT = process.env.PORT
  ? parseInt(process.env.PORT, 10)
  : 4000

const HOST = process.env.HOST || "0.0.0.0"

const DASHBOARD_ORIGIN =
  process.env.DASHBOARD_ORIGIN || "http://localhost:5173"

// ------------------------------------------------------------
// Middleware
// ------------------------------------------------------------

app.use(
  cors({
    origin: [
      DASHBOARD_ORIGIN,
      "http://localhost:3000",
      "http://localhost:4173",
    ],
    credentials: true,
  })
)

app.use(express.json())

// ------------------------------------------------------------
// WebSocket
// ------------------------------------------------------------

const wss = setupWebSocket(server)

// ------------------------------------------------------------
// Health
// ------------------------------------------------------------

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "aegis-gateway",
    timestamp: new Date().toISOString(),
  })
})

// ------------------------------------------------------------
// Current node status
// ------------------------------------------------------------

app.get("/api/status", (_req: Request, res: Response) => {
  const status = telemetryStore.getStatus()

  res.json({
    status: "success",
    data: status,
  })
})

// ------------------------------------------------------------
// Telemetry ingestion
// ------------------------------------------------------------

app.post("/api/telemetry", (req: Request, res: Response) => {
  const result = telemetrySchema.safeParse(req.body)

  if (!result.success) {
    res.status(400).json({
      status: "error",
      message: "Invalid telemetry payload",
      errors: result.error.format(),
    })

    return
  }

  const telemetry = result.data

  console.log(
    `[AEGIS] Security event received: ` +
    `${telemetry.event} from ${telemetry.deviceId}`
  )

  // Store the validated event.
  const status = telemetryStore.recordTelemetry(telemetry)

  // Broadcast the stored event, which now includes:
  // eventId, sequence and gateway receivedAt.
  const storedEvent = status.recentEvents[0]

  if (storedEvent) {
    // Alert Engine: gateway notification subsystem only. It is NOT part of
    // the ESP32 security authority. processEvent() is synchronous and its SMS
    // dispatch is fire-and-forget, so neither this HTTP response nor the
    // WebSocket broadcast waits on the SMS provider.
    getAlertEngine().processEvent(storedEvent)

    broadcastTelemetry(wss, storedEvent)
  }

  res.status(200).json({
    status: "success",
    message: "Telemetry processed successfully",
  })
})

// ------------------------------------------------------------
// Start server
// ------------------------------------------------------------

server.listen(PORT, HOST, () => {
  console.log(
    `[AEGIS] Gateway started on ${HOST}:${PORT}`
  )

  console.log(
    `[AEGIS] Allowed Dashboard Origin: ${DASHBOARD_ORIGIN}`
  )
})