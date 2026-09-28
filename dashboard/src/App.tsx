import React, { useMemo } from "react"
import {
  Activity,
  Radio,
  ShieldCheck,
  Lock,
  ServerOff
} from "lucide-react"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts"
import { useAegisSocket } from "./hooks/useAegisSocket"

function App() {
  const { connected, connecting, recentEvents, latestStatus } = useAegisSocket()

  // Determine gateway & node status
  const gatewayConnected = connected
  const nodeOnline = latestStatus?.status === "ONLINE"

  // Metrics derived from latestStatus or defaults
  const threatLevel = latestStatus?.threatLevel || "NORMAL"
  const threatScore = latestStatus?.threatScore ?? 0
  const nodeStatusText = nodeOnline ? "ONLINE" : "OFFLINE"
  const accessEventsCount = latestStatus?.eventCount ?? recentEvents.length
  const lockState = latestStatus?.lockState || "SECURED"

  // Failed attempts count (events matching ACCESS_DENIED)
  const failedAttemptsCount = useMemo(() => {
    return recentEvents.filter((e) => e.event === "ACCESS_DENIED").length
  }, [recentEvents])

  // Lockdowns count
  const lockdownsCount = useMemo(() => {
    return recentEvents.filter((e) => e.event === "LOCKDOWN" || e.event === "THREAT_DETECTED").length
  }, [recentEvents])

  // Chart data prepared from recentEvents (oldest to newest for Recharts)
  const chartData = useMemo(() => {
    const cloned = [...recentEvents].reverse()
    return cloned.map((ev) => {
      const date = new Date(ev.timestamp * 1000)
      const timeStr = isNaN(date.getTime())
        ? new Date().toTimeString().split(" ")[0]
        : date.toTimeString().split(" ")[0]
      return {
        time: timeStr,
        threatScore: ev.threatScore,
        baseLoad: ev.threatLevel === "CRITICAL" ? 85 : ev.threatLevel === "HIGH" ? 60 : 20,
      }
    })
  }, [recentEvents])

  return (
    <div className="min-h-screen bg-[#05070a] text-white">
      {/* Header */}
      <header className="border-b border-white/10 bg-[#080b10]">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-6 py-5">
          <div>
            <div className="flex items-center gap-3">
              <ShieldCheck className="h-7 w-7 text-cyan-400" />

              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg font-semibold tracking-[0.2em]">
                    AEGIS NODE
                  </h1>
                  <span className="rounded bg-cyan-500/10 px-2 py-0.5 font-mono text-[10px] text-cyan-400 border border-cyan-500/20">
                    LIVE MODE
                  </span>
                </div>

                <p className="text-xs tracking-wider text-white/40">
                  SOVEREIGN EDGE SECURITY PLATFORM
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6 text-xs font-mono">
            {/* Gateway connection state */}
            <div className="flex items-center gap-2">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  gatewayConnected
                    ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]"
                    : connecting
                    ? "bg-amber-400 animate-pulse"
                    : "bg-red-500"
                }`}
              />
              <span className="text-white/70">
                GATEWAY {gatewayConnected ? "CONNECTED" : connecting ? "CONNECTING" : "DISCONNECTED"}
              </span>
            </div>

            {/* Node state */}
            <div className="flex items-center gap-2">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  nodeOnline
                    ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]"
                    : "bg-red-500"
                }`}
              />
              <span className={nodeOnline ? "text-emerald-400 font-medium" : "text-red-400 font-medium"}>
                NODE {nodeStatusText}
              </span>
            </div>

            <div className="text-white/50 border-l border-white/10 pl-5">
              {latestStatus?.deviceId || "ESP32-SEC-01"}
            </div>
          </div>
        </div>
      </header>

      {/* Offline banner if gateway disconnected */}
      {!gatewayConnected && !connecting && (
        <div className="bg-red-950/40 border-b border-red-500/30 px-6 py-2.5 text-center text-xs font-mono text-red-300 flex items-center justify-center gap-2">
          <ServerOff className="h-4 w-4 text-red-400" />
          <span>GATEWAY OFFLINE — Unable to reach telemetry server at http://localhost:4000. Reconnecting...</span>
        </div>
      )}

      {/* Main */}
      <main className="mx-auto max-w-[1600px] space-y-6 px-6 py-8">

        {/* Page heading */}
        <section>
          <p className="mb-2 text-xs font-medium uppercase tracking-[0.25em] text-cyan-400">
            Security Operations Console
          </p>

          <h2 className="text-3xl font-semibold tracking-tight">
            Edge Security Command
          </h2>

          <p className="mt-2 max-w-2xl text-sm text-white/45">
            Real-time monitoring and local threat intelligence streamed directly from Aegis Node gateway.
          </p>
        </section>

        {/* Status cards */}
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">

          <StatusCard
            label="Threat Level"
            value={threatLevel}
            description={`Threat score ${threatScore}`}
            icon={<Activity className="h-5 w-5" />}
            highlight={threatLevel !== "NORMAL"}
          />

          <StatusCard
            label="Node Status"
            value={nodeStatusText}
            description={nodeOnline ? "ESP32 connected & syncing" : "Waiting for telemetry"}
            icon={<Radio className="h-5 w-5" />}
          />

          <StatusCard
            label="Access Events"
            value={String(accessEventsCount)}
            description="Total recorded events"
            icon={<ShieldCheck className="h-5 w-5" />}
          />

          <StatusCard
            label="Lock State"
            value={lockState}
            description="Physical perimeter status"
            icon={<Lock className="h-5 w-5" />}
            highlight={lockState === "LOCKDOWN"}
          />

        </section>

        {/* Main monitoring grid */}
        <section className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">

          {/* Threat telemetry graph */}
          <div className="rounded-2xl border border-white/10 bg-[#090d13] p-6 flex flex-col">

            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">
                  Real-Time Threat Telemetry
                </p>

                <p className="mt-1 text-xs text-white/40">
                  Edge threat score tracking over time
                </p>
              </div>

              <div className="flex items-center gap-2 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-emerald-400 font-mono bg-emerald-500/10">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                LIVE STREAM
              </div>
            </div>

            {chartData.length > 0 ? (
              <div className="h-[320px] w-full pt-4">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="threatGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="time" stroke="#64748b" fontSize={11} tickLine={false} />
                    <YAxis stroke="#64748b" fontSize={11} tickLine={false} domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#090d13",
                        borderColor: "#1e293b",
                        borderRadius: "0.75rem",
                        fontFamily: "monospace",
                        fontSize: "12px",
                        color: "#f8fafc",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="threatScore"
                      name="Threat Score"
                      stroke="#06b6d4"
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#threatGradient)"
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-[320px] items-center justify-center rounded-xl border border-dashed border-white/10 bg-black/20">
                <div className="text-center">
                  <Activity className="mx-auto mb-3 h-8 w-8 text-white/20" />
                  <p className="text-sm text-white/40">
                    Threat telemetry will appear here
                  </p>
                  <p className="mt-1 text-xs text-white/20">
                    Waiting for gateway telemetry events
                  </p>
                </div>
              </div>
            )}

          </div>

          {/* Threat engine */}
          <div className="rounded-2xl border border-white/10 bg-[#090d13] p-6">

            <div className="mb-6">
              <p className="text-sm font-medium">
                Threat Engine Assessment
              </p>

              <p className="mt-1 text-xs text-white/40">
                Real-time security analyzer
              </p>
            </div>

            <div className="flex flex-col items-center justify-center py-6">

              <div className={`relative flex h-44 w-44 items-center justify-center rounded-full border ${
                threatLevel === "CRITICAL"
                  ? "border-red-500/40 bg-red-950/20"
                  : threatLevel === "HIGH"
                  ? "border-amber-500/40 bg-amber-950/20"
                  : "border-emerald-400/20"
              }`}>

                <div className="absolute inset-3 rounded-full border border-white/5" />

                <div className="text-center">
                  <p className="font-mono text-5xl font-semibold">
                    {threatScore}
                  </p>

                  <p className={`mt-2 text-xs uppercase tracking-[0.2em] font-mono ${
                    threatLevel === "CRITICAL"
                      ? "text-red-400"
                      : threatLevel === "HIGH"
                      ? "text-amber-400"
                      : "text-emerald-400"
                  }`}>
                    {threatLevel}
                  </p>
                </div>

              </div>

              <div className="mt-8 grid w-full grid-cols-2 gap-3">
                <Metric label="Failed Attempts" value={String(failedAttemptsCount)} />
                <Metric label="Attempts / Window" value={String(recentEvents.length)} />
                <Metric label="Lockdowns" value={String(lockdownsCount)} />
                <Metric label="Engine" value={gatewayConnected ? "ACTIVE" : "OFFLINE"} />
              </div>

            </div>

          </div>

        </section>

        {/* Events */}
        <section className="rounded-2xl border border-white/10 bg-[#090d13]">

          <div className="border-b border-white/10 px-6 py-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">
                Live Security Event Stream
              </p>

              <p className="mt-1 text-xs text-white/40">
                Events received in real-time from the gateway WebSocket
              </p>
            </div>

            <span className="font-mono text-xs text-white/40">
              Showing latest {Math.min(recentEvents.length, 20)} events
            </span>
          </div>

          <div className="divide-y divide-white/5 max-h-[400px] overflow-y-auto">
            {recentEvents.length > 0 ? (
              recentEvents.slice(0, 20).map((ev, idx) => {
                const date = new Date(ev.timestamp * 1000)
                const timeStr = isNaN(date.getTime())
                  ? new Date().toTimeString().split(" ")[0]
                  : date.toTimeString().split(" ")[0]

                let statusType: "success" | "warning" | "danger" = "success"
                if (ev.event === "ACCESS_DENIED") statusType = "warning"
                if (ev.event === "THREAT_DETECTED" || ev.event === "LOCKDOWN" || ev.event === "SYSTEM_ERROR") {
                  statusType = "danger"
                }

                const sourceLabel = ev.credentialType
                  ? `${ev.source || "ESP32"} / ${ev.credentialType}`
                  : ev.source || "ESP32"

                return (
                  <EventRow
                    key={ev.timestamp + "-" + idx}
                    time={timeStr}
                    event={ev.event}
                    source={sourceLabel}
                    status={statusType}
                  />
                )
              })
            ) : (
              <div className="px-6 py-8 text-center text-xs text-white/40 font-mono">
                No events recorded yet. Waiting for telemetry stream...
              </div>
            )}
          </div>

        </section>

      </main>
    </div>
  )
}

function StatusCard({
  label,
  value,
  description,
  icon,
  highlight = false,
}: {
  label: string
  value: string
  description: string
  icon: React.ReactNode
  highlight?: boolean
}) {
  return (
    <div className={`rounded-2xl border p-5 ${
      highlight ? "border-amber-500/40 bg-amber-950/10" : "border-white/10 bg-[#090d13]"
    }`}>

      <div className="mb-6 flex items-center justify-between">

        <p className="text-xs uppercase tracking-[0.15em] text-white/40">
          {label}
        </p>

        <div className="text-cyan-400">
          {icon}
        </div>

      </div>

      <p className={`font-mono text-2xl font-semibold ${
        highlight ? "text-amber-400" : "text-white"
      }`}>
        {value}
      </p>

      <p className="mt-2 text-xs text-white/35">
        {description}
      </p>

    </div>
  )
}

function Metric({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-black/20 p-3">
      <p className="text-[10px] uppercase tracking-wider text-white/30">
        {label}
      </p>

      <p className="mt-2 font-mono text-sm">
        {value}
      </p>
    </div>
  )
}

function EventRow({
  time,
  event,
  source,
  status,
}: {
  time: string
  event: string
  source: string
  status: "success" | "warning" | "danger"
}) {
  const statusClasses = {
    success: "text-emerald-400",
    warning: "text-amber-400",
    danger: "text-red-400",
  }

  return (
    <div className="grid grid-cols-[100px_1fr_180px] items-center px-6 py-4 text-xs">

      <span className="font-mono text-white/30">
        {time}
      </span>

      <span className={`font-mono font-medium ${statusClasses[status]}`}>
        {event}
      </span>

      <span className="text-right text-white/40 font-mono truncate">
        {source}
      </span>

    </div>
  )
}

export default App
