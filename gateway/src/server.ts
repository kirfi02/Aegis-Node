import express, { Request, Response } from "express"
import http from "http"
import cors from "cors"
import dotenv from "dotenv"
import { telemetrySchema } from "./schemas.js"
import { telemetryStore } from "./telemetry.js"
import { setupWebSocket, broadcastTelemetry } from "./websocket.js"

dotenv.config()

const app = express()
const server = http.createServer(app)

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4000
const HOST = process.env.HOST || "0.0.0.0"
const DASHBOARD_ORIGIN = process.env.DASHBOARD_ORIGIN || "http://localhost:5173"

// Middleware
app.use(
  cors({
    origin: [DASHBOARD_ORIGIN, "http://localhost:3000", "http://localhost:4173"],
    credentials: true,
  })
)
app.use(express.json())

// Setup WebSocket server
const wss = setupWebSocket(server)

// Routes
app.get("/api/health", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "aegis-gateway",
    timestamp: new Date().toISOString(),
  })
})

app.get("/api/status", (_req: Request, res: Response) => {
  const status = telemetryStore.getStatus()
  res.json({
    status: "success",
    data: status,
  })
})

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

  const telemetry = result.success ? result.data : req.body

  console.log(`[AEGIS] Telemetry received: ${telemetry.event}`)

  // Record in memory store
  telemetryStore.recordTelemetry(telemetry)

  // Broadcast to WebSocket clients
  broadcastTelemetry(wss, telemetry)

  res.status(200).json({
    status: "success",
    message: "Telemetry processed successfully",
  })
})

// Start server
server.listen(PORT, HOST, () => {
  console.log(`[AEGIS] Gateway started on ${HOST}:${PORT}`)
  console.log(`[AEGIS] Allowed Dashboard Origin: ${DASHBOARD_ORIGIN}`)
})
