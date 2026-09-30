import { EventType } from "../types.js"

/**
 * Severity assigned by the alert rules.
 *
 * Only two levels exist at this stage. "CRITICAL" is always dispatched over
 * SMS; "HIGH" is dispatched only when explicitly enabled, so routine events
 * cannot flood the notification channel.
 */
export type AlertSeverity = "CRITICAL" | "HIGH"

/** Notification channels. SMS is the only channel implemented so far. */
export type AlertChannel = "SMS"

/**
 * Lifecycle of a single alert record.
 *
 * PENDING        - created, dispatch not yet resolved
 * DISPATCHED     - provider accepted the message
 * DELIVERY_FAILED- provider rejected, timed out, or was unavailable
 * SUPPRESSED     - suppressed by the cooldown window (alert-storm protection)
 * SKIPPED        - intentionally not sent (no recipient, or channel disabled)
 */
export type AlertStatus =
  | "PENDING"
  | "DISPATCHED"
  | "DELIVERY_FAILED"
  | "SUPPRESSED"
  | "SKIPPED"

/**
 * Internal alert record.
 *
 * SECURITY: this record must never contain credentials. `error` holds a
 * sanitised provider message produced by the SMS dispatcher.
 */
export interface SecurityAlert {
  alertId: string
  eventId: string
  deviceId: string
  event: EventType
  severity: AlertSeverity
  createdAt: string
  channel: AlertChannel
  status: AlertStatus
  providerMessageId: string | null
  error: string | null
}
