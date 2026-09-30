import { EventType, StoredSecurityEvent } from "../types.js"
import { AlertSeverity } from "./types.js"

export interface AlertRuleMatch {
  severity: AlertSeverity
  /** Human-readable justification, used in logs and alert records. */
  reason: string
}

/**
 * Events that are always CRITICAL.
 *
 * These represent physical compromise or a hard security transition, so they
 * always page the operator regardless of the reported threat level.
 */
const ALWAYS_CRITICAL: readonly EventType[] = ["TAMPER_DETECTED", "LOCKDOWN_ENTERED"]

/**
 * THREAT_ESCALATED is only CRITICAL when the node itself reports the
 * CRITICAL threat level. A lower escalation is intentionally not paged.
 */
const CONDITIONAL_CRITICAL_EVENT: EventType = "THREAT_ESCALATED"

/**
 * Routine operational events. Alertable at HIGH severity, but dispatch is
 * opt-in via configuration so it cannot flood the SMS channel.
 */
const HIGH_EVENTS: readonly EventType[] = ["DEVICE_OFFLINE"]

/**
 * Evaluate a stored security event against the alert rules.
 *
 * Returns `null` when the event must not produce an alert. This covers every
 * event type that is not explicitly listed above, which is the default-deny
 * behaviour the spec requires: an unlisted event never sends an SMS.
 *
 * Pure function - no logging, no I/O, no state.
 */
export function evaluateAlertRules(
  event: StoredSecurityEvent
): AlertRuleMatch | null {
  if (ALWAYS_CRITICAL.includes(event.event)) {
    return {
      severity: "CRITICAL",
      reason: `event ${event.event} is always critical`,
    }
  }

  if (event.event === CONDITIONAL_CRITICAL_EVENT) {
    if (event.threatLevel === "CRITICAL") {
      return {
        severity: "CRITICAL",
        reason: "THREAT_ESCALATED with threatLevel CRITICAL",
      }
    }

    return null
  }

  if (HIGH_EVENTS.includes(event.event)) {
    return {
      severity: "HIGH",
      reason: `event ${event.event} is a configurable high-severity alert`,
    }
  }

  return null
}
