import { StoredSecurityEvent } from "../types.js"
import { AlertSeverity, SecurityAlert } from "./types.js"
import { evaluateAlertRules } from "./alert-rules.js"
import {
  SmsDispatcher,
  SmsDispatchResult,
  africaTalkingSmsDispatcher,
} from "./sms-dispatcher.js"

/**
 * Bounded in-memory alert history.
 *
 * Mirrors the existing TelemetryStore approach (max 100) so the gateway keeps
 * a single, consistent in-memory model. No database at this stage.
 */
const MAX_ALERT_HISTORY = 100

/** Default alert-storm cooldown when AEGIS_ALERT_COOLDOWN_MS is absent. */
const DEFAULT_COOLDOWN_MS = 60000

export interface AlertEngineOptions {
  dispatcher: SmsDispatcher
  /** Destination number. Null/empty disables dispatch but keeps the engine. */
  recipient: string | null
  cooldownMs?: number
  /** Whether HIGH severity alerts are dispatched. Default: false. */
  highSmsEnabled?: boolean
}

/** Operator guidance appended to the SMS body, per severity. */
function actionFor(severity: AlertSeverity): string {
  return severity === "CRITICAL"
    ? "Immediate investigation required."
    : "Review node status."
}

/**
 * Build the SMS body.
 *
 * SECURITY: intentionally omits `credentialId` so no raw PIN or credential
 * material can ever reach the SMS channel. Only operational context is sent.
 */
export function formatAlertMessage(
  alert: SecurityAlert,
  event: StoredSecurityEvent
): string {
  const lines = [
    `AEGIS ${alert.severity} ALERT`,
    `Node: ${event.deviceId}`,
    `Event: ${event.event}`,
    `Threat: ${event.threatLevel}`,
    `Score: ${event.threatScore}`,
    `Lock: ${event.lockState}`,
    `Action: ${actionFor(alert.severity)}`,
  ]

  const body = lines.join("\n")

  // Defensive bound so a long deviceId can never produce an oversized payload.
  return body.length > 480 ? `${body.slice(0, 477)}...` : body
}

function createAlertId(sequence: number): string {
  return `alert-${Date.now().toString(36)}-${sequence.toString(36)}`
}export class AlertEngine {
  private readonly dispatcher: SmsDispatcher
  private readonly recipient: string | null
  private readonly cooldownMs: number
  private readonly highSmsEnabled: boolean

  private alerts: SecurityAlert[] = []
  private alertSequence = 0

  /** Cooldown bookkeeping keyed by `${deviceId}:${event}`. */
  private lastDispatchAt = new Map<string, number>()

  constructor(options: AlertEngineOptions) {
    this.dispatcher = options.dispatcher
    this.recipient =
      options.recipient && options.recipient.trim().length > 0
        ? options.recipient.trim()
        : null
    this.cooldownMs = options.cooldownMs ?? DEFAULT_COOLDOWN_MS
    this.highSmsEnabled = options.highSmsEnabled ?? false
  }

  /**
   * Internal module API: read the bounded alert history.
   * Returns a defensive copy so callers cannot mutate engine state.
   */
  public getAlertHistory(): SecurityAlert[] {
    return this.alerts.map((alert) => ({ ...alert }))
  }

  /** Internal module API: current alert count. */
  public getAlertCount(): number {
    return this.alerts.length
  }

  /** Test seam: drop cooldown state so cooldown assertions stay isolated. */
  public resetCooldowns(): void {
    this.lastDispatchAt.clear()
  }

  private record(alert: SecurityAlert): void {
    this.alerts.unshift(alert)

    if (this.alerts.length > MAX_ALERT_HISTORY) {
      this.alerts = this.alerts.slice(0, MAX_ALERT_HISTORY)
    }
  }
  /**
   * Entry point called from the telemetry ingestion path.
   *
   * Contract: returns synchronously and NEVER throws. SMS dispatch is
   * fire-and-forget, so the ESP32 request is never blocked on the provider
   * and a provider outage can never stall or fail telemetry ingestion.
   */
  public processEvent(event: StoredSecurityEvent): void {
    try {
      const match = evaluateAlertRules(event)

      if (!match) {
        return
      }

      this.alertSequence += 1

      const alert: SecurityAlert = {
        alertId: createAlertId(this.alertSequence),
        eventId: event.eventId,
        deviceId: event.deviceId,
        event: event.event,
        severity: match.severity,
        createdAt: new Date().toISOString(),
        channel: "SMS",
        status: "PENDING",
        providerMessageId: null,
        error: null,
      }

      this.record(alert)

      console.log(
        `[AEGIS][ALERT] Alert created: ${alert.severity} ` +
          `alertId=${alert.alertId} device=${alert.deviceId} ` +
          `event=${alert.event}`
      )

      // Alert-storm protection for repeated identical events.
      const key = `${event.deviceId}:${event.event}`
      const now = Date.now()
      const last = this.lastDispatchAt.get(key)

      if (last !== undefined && now - last < this.cooldownMs) {
        alert.status = "SUPPRESSED"
        alert.error = `suppressed by ${this.cooldownMs}ms cooldown`

        console.warn(
          `[AEGIS][ALERT] Alert suppressed by cooldown: ` +
            `device=${alert.deviceId} event=${alert.event}`
        )

        return
      }

      if (alert.severity === "HIGH" && !this.highSmsEnabled) {
        alert.status = "SKIPPED"
        alert.error = "HIGH severity SMS dispatch is disabled"

        console.log(
          `[AEGIS][ALERT] Alert skipped: HIGH severity SMS is disabled ` +
            `(device=${alert.deviceId} event=${alert.event})`
        )

        return
      }

      if (!this.recipient) {
        alert.status = "SKIPPED"
        alert.error = "no SMS recipient configured"

        console.warn(
          "[AEGIS][ALERT] Alert skipped: AEGIS_ALERT_SMS_RECIPIENT is not set"
        )

        return
      }

      this.lastDispatchAt.set(key, now)

      // Intentionally not awaited.
      void this.dispatch(alert, event)
    } catch (error) {
      // A failure in the alert subsystem must never break ingestion.
      console.error(
        `[AEGIS][ALERT] Alert engine error (non-fatal): ` +
          `${error instanceof Error ? error.message : "unknown"}`
      )
    }
  }
  /**
   * Fire-and-forget dispatch. Always resolves; never rejects.
   */
  private async dispatch(
    alert: SecurityAlert,
    event: StoredSecurityEvent
  ): Promise<void> {
    try {
      const body = formatAlertMessage(alert, event)

      console.log(
        `[AEGIS][ALERT] SMS dispatch started: alertId=${alert.alertId}`
      )

      const result: SmsDispatchResult = await this.dispatcher.send(
        this.recipient as string,
        body
      )

      if (result.success) {
        alert.status = "DISPATCHED"
        alert.providerMessageId = result.providerMessageId

        console.log(
          `[AEGIS][ALERT] SMS delivered: alertId=${alert.alertId} ` +
            `providerMessageId=${result.providerMessageId ?? "n/a"}`
        )
      } else {
        alert.status = "DELIVERY_FAILED"
        alert.error = result.error

        console.error(
          `[AEGIS][ALERT] SMS delivery failed: alertId=${alert.alertId} ` +
            `reason=${result.error ?? "unknown"}`
        )
      }
    } catch (error) {
      alert.status = "DELIVERY_FAILED"
      alert.error = "unexpected dispatch error"

      console.error(
        `[AEGIS][ALERT] SMS delivery failed: alertId=${alert.alertId} ` +
          `reason=${error instanceof Error ? error.message : "unknown"}`
      )
    }
  }
}
function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10)

  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function parseBoolean(value: string | undefined): boolean {
  const normalized = (value ?? "").trim().toLowerCase()

  return normalized === "true" || normalized === "1" || normalized === "yes"
}

let engine: AlertEngine | null = null

/**
 * Lazily construct the process-wide Alert Engine.
 *
 * Lazy is required, not stylistic: server.ts calls dotenv.config() in its
 * module body, but ES module imports are evaluated before that body runs.
 * Reading configuration here would inspect an unloaded environment.
 */
export function getAlertEngine(): AlertEngine {
  if (!engine) {
    engine = new AlertEngine({
      dispatcher: africaTalkingSmsDispatcher,
      recipient: process.env.AEGIS_ALERT_SMS_RECIPIENT?.trim() || null,
      cooldownMs: parsePositiveInt(
        process.env.AEGIS_ALERT_COOLDOWN_MS,
        DEFAULT_COOLDOWN_MS
      ),
      highSmsEnabled: parseBoolean(process.env.AEGIS_ALERT_HIGH_SMS_ENABLED),
    })
  }

  return engine
}
