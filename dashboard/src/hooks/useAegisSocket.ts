import { useState, useEffect, useRef, useCallback } from "react"
import { NodeStatusState, TelemetryPayload } from "../types/telemetry"

interface UseAegisSocketOptions {
  wsUrl?: string
  httpUrl?: string
}

export function useAegisSocket(options: UseAegisSocketOptions = {}) {
  const wsUrl = options.wsUrl || import.meta.env.VITE_AEGIS_GATEWAY_WS || "ws://localhost:4000/ws"
  const httpUrl = options.httpUrl || import.meta.env.VITE_AEGIS_GATEWAY_HTTP || "http://localhost:4000"

  const [connected, setConnected] = useState<boolean>(false)
  const [connecting, setConnecting] = useState<boolean>(true)
  const [connectionError, setConnectionError] = useState<string | null>(null)
  
  const [latestStatus, setLatestStatus] = useState<NodeStatusState | null>(null)
  const [telemetry, setTelemetry] = useState<TelemetryPayload | null>(null)
  const [recentEvents, setRecentEvents] = useState<TelemetryPayload[]>([])

  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const reconnectAttemptsRef = useRef<number>(0)

  // Fetch initial state via REST
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch(`${httpUrl}/api/status`)
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`)
      }
      const json = await res.json()
      if (json && json.data) {
        const statusData: NodeStatusState = json.data
        setLatestStatus(statusData)
        if (statusData.recentEvents) {
          setRecentEvents(statusData.recentEvents)
        }
      }
    } catch (err: any) {
      console.warn("[AEGIS] REST initial status fetch failed:", err.message)
    }
  }, [httpUrl])

  // Connect WebSocket
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    setConnecting(true)
    setConnectionError(null)

    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      setConnecting(false)
      setConnectionError(null)
      reconnectAttemptsRef.current = 0
      console.log("[AEGIS] WebSocket connected")
    }

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)
        
        if (message.type === "SNAPSHOT" && message.data) {
          const snapshot: NodeStatusState = message.data
          setLatestStatus(snapshot)
          if (snapshot.recentEvents) {
            setRecentEvents(snapshot.recentEvents)
          }
        } else if (message.type === "TELEMETRY" && message.data) {
          const payload: TelemetryPayload = message.data
          setTelemetry(payload)
          setRecentEvents((prev) => [payload, ...prev].slice(0, 50))
          setLatestStatus((prev) => {
            if (!prev) {
              return {
                deviceId: payload.deviceId,
                status: "ONLINE",
                lastSeen: payload.timestamp * 1000,
                threatScore: payload.threatScore,
                threatLevel: payload.threatLevel,
                lockState: payload.lockState,
                eventCount: 1,
                recentEvents: [payload],
              }
            }
            return {
              ...prev,
              status: "ONLINE",
              lastSeen: payload.timestamp * 1000,
              threatScore: payload.threatScore,
              threatLevel: payload.threatLevel,
              lockState: payload.lockState,
              eventCount: prev.eventCount + 1,
            }
          })
        }
      } catch (err) {
        console.error("[AEGIS] Failed to parse WebSocket message:", err)
      }
    }

    ws.onerror = (err) => {
      console.error("[AEGIS] WebSocket error:", err)
      setConnectionError("Gateway connection error")
    }

    ws.onclose = () => {
      setConnected(false)
      setConnecting(false)
      console.log("[AEGIS] WebSocket disconnected")

      // Exponential backoff reconnect, max 10 seconds
      const attempts = reconnectAttemptsRef.current
      const delay = Math.min(1000 * Math.pow(1.5, attempts), 10000)
      reconnectAttemptsRef.current = attempts + 1

      reconnectTimeoutRef.current = setTimeout(() => {
        connect()
      }, delay)
    }
  }, [wsUrl])

  useEffect(() => {
    fetchStatus()
    connect()

    return () => {
      if (wsRef.current) {
        wsRef.current.close()
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
    }
  }, [connect, fetchStatus])

  return {
    connected,
    connecting,
    connectionError,
    telemetry,
    recentEvents,
    latestStatus,
    refreshStatus: fetchStatus,
  }
}
