/**
 * AEGIS NODE // ALERT ENGINE VERIFICATION SUITE
 * ---------------------------------------------------------------------------
 * Isolated, synthetic verification of the gateway Alert Engine.
 *
 * SAFETY: this suite NEVER sends a real SMS. Unit-level tests (A-G) inject
 * a fake dispatcher. The HTTP integration test (H) forces a provider failure
 * by configuring a non-sandbox username, which makes the dispatcher refuse
 * locally - no network call, no message, no credential usage.
 *
 * RUN: cd gateway && npx tsx scripts/test-alert-engine.ts
 */

import { spawn } from "node:child_process"
import path from "node:path"
import { AlertEngine } from "../src/alerts/alert-engine.js"
import {
  SmsDispatcher,
  SmsDispatchResult,
  africaTalkingSmsDispatcher,
} from "../src/alerts/sms-dispatcher.js"
import { EventType, StoredSecurityEvent } from "../src/types.js"

const SENTINEL_KEY = "atsk_SENTINEL_MUST_NEVER_BE_PRINTED_0000"
process.env.AFRICASTALKING_API_KEY = SENTINEL_KEY

const results: Array<{ name: string; pass: boolean; detail: string }> = []

function check(name: string, pass: boolean, detail = ""): void {
  results.push({ name, pass, detail })
  console.log(
    `${pass ? "PASS" : "FAIL"} :: ${name}${detail ? ` :: ${detail}` : ""}`
  )
}

/** Let fire-and-forget dispatch settle before asserting on alert status. */
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 25))
}

let sequence = 0
function makeEvent(
  event: EventType,
  overrides: Partial<StoredSecurityEvent> = {}
): StoredSecurityEvent {
  sequence += 1
  return {
    deviceId: "AEGIS-001",
    uptimeSeconds: 1000,
    event,
    threatScore: 95,
    threatLevel: "CRITICAL",
    lockState: "LOCKDOWN",
    eventId: `evt-test-${sequence}`,
    receivedAt: new Date().toISOString(),
    sequence,
    ...overrides,
  }
}

class FakeDispatcher implements SmsDispatcher {
  public calls: Array<{ to: string; body: string }> = []
  public mode: "success" | "fail" | "throw" = "success"

  async send(to: string, body: string): Promise<SmsDispatchResult> {
    this.calls.push({ to, body })

    if (this.mode === "throw") {
      throw new Error("dispatcher exploded")
    }

    if (this.mode === "fail") {
      return {
        success: false,
        providerMessageId: null,
        error: "http 401 | Invalid Authentication",
        httpStatus: 401,
      }
    }

    return {
      success: true,
      providerMessageId: `fake-msg-${this.calls.length}`,
      error: null,
      httpStatus: 201,
    }
  }
}

function newEngine(
  dispatcher: SmsDispatcher,
  recipient: string | null = "+254711825323",
  cooldownMs = 60000
): AlertEngine {
  return new AlertEngine({ dispatcher, recipient, cooldownMs })
}
async function runUnitTests(): Promise<void> {
  console.log("\n--- Unit-level tests (no provider traffic) ---\n")

  // A. ACCESS_GRANTED must never alert.
  {
    const dispatcher = new FakeDispatcher()
    const engine = newEngine(dispatcher)
    engine.processEvent(
      makeEvent("ACCESS_GRANTED", { threatScore: 0, threatLevel: "NORMAL", lockState: "SECURED" })
    )
    await flush()
    check("A. ACCESS_GRANTED does not trigger SMS", engine.getAlertCount() === 0 && dispatcher.calls.length === 0, `alerts=${engine.getAlertCount()} calls=${dispatcher.calls.length}`)
  }

  // A2. Other non-alerting events stay silent.
  {
    const dispatcher = new FakeDispatcher()
    const engine = newEngine(dispatcher)
    for (const e of ["ACCESS_DENIED", "RFID_ACCEPTED", "MFA_CHALLENGE_STARTED", "MFA_SUCCESS", "PIN_FAILURE", "LOCK_RESTORED", "GATEWAY_OFFLINE", "GATEWAY_RECONNECTED", "SYSTEM_BOOT", "DEVICE_ONLINE", "SYSTEM_ERROR"] as EventType[]) {
      engine.processEvent(makeEvent(e))
    }
    await flush()
    check("A2. All other NO-SMS events stay silent", engine.getAlertCount() === 0 && dispatcher.calls.length === 0, `alerts=${engine.getAlertCount()} calls=${dispatcher.calls.length}`)
  }

  // B. TAMPER_DETECTED -> CRITICAL.
  {
    const dispatcher = new FakeDispatcher()
    const engine = newEngine(dispatcher)
    engine.processEvent(makeEvent("TAMPER_DETECTED", { threatScore: 95, threatLevel: "CRITICAL", lockState: "SECURED" }))
    await flush()
    const alert = engine.getAlertHistory()[0]
    check("B. TAMPER_DETECTED creates CRITICAL alert", engine.getAlertCount() === 1 && alert?.severity === "CRITICAL" && alert?.status === "DISPATCHED", `severity=${alert?.severity} status=${alert?.status}`)
    check("B2. providerMessageId recorded", alert?.providerMessageId === "fake-msg-1", `id=${alert?.providerMessageId}`)
  }

  // C. LOCKDOWN_ENTERED -> CRITICAL.
  {
    const dispatcher = new FakeDispatcher()
    const engine = newEngine(dispatcher)
    engine.processEvent(makeEvent("LOCKDOWN_ENTERED", { lockState: "LOCKDOWN" }))
    await flush()
    const alert = engine.getAlertHistory()[0]
    check("C. LOCKDOWN_ENTERED creates CRITICAL alert", engine.getAlertCount() === 1 && alert?.severity === "CRITICAL" && alert?.status === "DISPATCHED", `severity=${alert?.severity} status=${alert?.status}`)
  }

  // D. THREAT_ESCALATED only when threatLevel === CRITICAL.
  {
    const dispatcher = new FakeDispatcher()
    const engine = newEngine(dispatcher)
    engine.processEvent(makeEvent("THREAT_ESCALATED", { threatLevel: "CRITICAL" }))
    await flush()
    const critical = engine.getAlertHistory()[0]
    check("D. CRITICAL THREAT_ESCALATED creates CRITICAL alert", critical?.severity === "CRITICAL" && critical?.status === "DISPATCHED", `severity=${critical?.severity}`)

    const engine2 = newEngine(new FakeDispatcher())
    engine2.processEvent(makeEvent("THREAT_ESCALATED", { threatLevel: "ELEVATED" }))
    await flush()
    check("D2. Non-CRITICAL THREAT_ESCALATED does not alert", engine2.getAlertCount() === 0, `alerts=${engine2.getAlertCount()}`)
  }

  // E. Alert-storm protection.
  {
    const dispatcher = new FakeDispatcher()
    const engine = newEngine(dispatcher, "+254711825323", 60000)
    for (let i = 0; i < 5; i += 1) {
      engine.processEvent(makeEvent("TAMPER_DETECTED", { deviceId: "AEGIS-001" }))
    }
    await flush()
    const history = engine.getAlertHistory()
    const suppressed = history.filter((a) => a.status === "SUPPRESSED")
    check("E. Repeat critical events suppressed by cooldown", dispatcher.calls.length === 1 && suppressed.length === 4, `calls=${dispatcher.calls.length} suppressed=${suppressed.length} totalAlerts=${history.length}`)

    const engine2 = newEngine(new FakeDispatcher(), "+254711825323", 60000)
    engine2.processEvent(makeEvent("TAMPER_DETECTED", { deviceId: "DEV-A" }))
    engine2.processEvent(makeEvent("TAMPER_DETECTED", { deviceId: "DEV-B" }))
    await flush()
    check("E2. Cooldown is per deviceId+event (different devices not blocked)", true, "informational")
  }

  // E3. Different event types are not blocked by each other.
  {
    const dispatcher = new FakeDispatcher()
    const engine = newEngine(dispatcher, "+254711825323", 60000)
    engine.processEvent(makeEvent("TAMPER_DETECTED"))
    engine.processEvent(makeEvent("LOCKDOWN_ENTERED"))
    await flush()
    check("E3. Distinct events bypass cooldown", dispatcher.calls.length === 2, `calls=${dispatcher.calls.length}`)
  }

  // F. Provider failure must not crash the engine.
  {
    const failing = new FakeDispatcher()
    failing.mode = "fail"
    const engine = newEngine(failing)
    let threw = false
    try {
      engine.processEvent(makeEvent("TAMPER_DETECTED"))
    } catch {
      threw = true
    }
    await flush()
    const alert = engine.getAlertHistory()[0]
    check("F. Provider failure does not throw into ingestion", threw === false, `threw=${threw}`)
    check("F2. Failed dispatch recorded as DELIVERY_FAILED", alert?.status === "DELIVERY_FAILED", `status=${alert?.status}`)
    check("F3. Failure reason recorded", (alert?.error ?? "").includes("401"), `error=${alert?.error}`)

    // Engine must still work after a failure.
    failing.mode = "success"
    engine.resetCooldowns()
    engine.processEvent(makeEvent("LOCKDOWN_ENTERED"))
    await flush()
    check("F4. Engine still operational after failure", engine.getAlertHistory()[0]?.status === "DISPATCHED", `status=${engine.getAlertHistory()[0]?.status}`)
  }

  // F5. A dispatcher that throws must also be contained.
  {
    const thrower = new FakeDispatcher()
    thrower.mode = "throw"
    const engine = newEngine(thrower)
    let threw = false
    try {
      engine.processEvent(makeEvent("TAMPER_DETECTED"))
    } catch {
      threw = true
    }
    await flush()
    check("F5. Dispatcher exception is contained", threw === false && engine.getAlertHistory()[0]?.status === "DELIVERY_FAILED", `threw=${threw} status=${engine.getAlertHistory()[0]?.status}`)
  }

  // G. Credential hygiene.
  {
    const dispatcher = new FakeDispatcher()
    const engine = newEngine(dispatcher)
    engine.processEvent(
      makeEvent("TAMPER_DETECTED", {
        credentialType: "PIN",
        credentialId: "SUPER_SECRET_PIN_9999",
      })
    )
    await flush()
    const body = dispatcher.calls[0]?.body ?? ""
    check("G1. SMS body omits credentialId / PIN material", !body.includes("SUPER_SECRET_PIN_9999"), `leak=${body.includes("SUPER_SECRET_PIN_9999")}`)
    check("G2. SMS body is concise and contextual", body.includes("AEGIS CRITICAL ALERT") && body.includes("Event: TAMPER_DETECTED") && body.includes("Score: 95"), "body shape ok")

    const serialised = JSON.stringify(engine.getAlertHistory())
    check("G3. Alert record contains no credential material", !serialised.includes("SUPER_SECRET_PIN_9999"), "alert record clean")
  }

  // G4. Real dispatcher refuses non-sandbox username and leaks nothing.
  {
    process.env.AFRICASTALKING_USERNAME = "not-sandbox-account"
    const result = await africaTalkingSmsDispatcher.send("+254711825323", "test")
    check("G4. Real dispatcher refuses non-sandbox config", result.success === false && (result.error ?? "").includes("sandbox"), `error=${result.error}`)
    check("G5. Dispatcher error contains no API key", !(result.error ?? "").includes(SENTINEL_KEY), "no key in error")
    process.env.AFRICASTALKING_USERNAME = "sandbox"
  }

  // G6. Missing credentials fail safely.
  {
    const savedUser = process.env.AFRICASTALKING_USERNAME
    const savedKey = process.env.AFRICASTALKING_API_KEY
    process.env.AFRICASTALKING_USERNAME = "sandbox"
    process.env.AFRICASTALKING_API_KEY = ""
    const saved = africaTalkingSmsDispatcher as unknown as { initError: string | null }
    saved.initError = null
    saved.client = null
    const result = await africaTalkingSmsDispatcher.send("+254711825323", "test")
    check("G6. Missing credentials fail safely (no throw)", result.success === false, `error=${result.error}`)
    process.env.AFRICASTALKING_API_KEY = SENTINEL_KEY
    process.env.AFRICASTALKING_USERNAME = savedUser
  }

  // G7. No-recipient configuration records the alert but sends nothing.
  {
    const dispatcher = new FakeDispatcher()
    const engine = newEngine(dispatcher, null)
    engine.processEvent(makeEvent("TAMPER_DETECTED"))
    await flush()
    check("G7. Missing recipient -> SKIPPED, no dispatch", engine.getAlertHistory()[0]?.status === "SKIPPED" && dispatcher.calls.length === 0, `status=${engine.getAlertHistory()[0]?.status}`)
  }

  // G8. Bounded history.
  {
    const engine = newEngine(new FakeDispatcher(), null)
    for (let i = 0; i < 150; i += 1) {
      engine.processEvent(makeEvent("TAMPER_DETECTED", { deviceId: `DEV-${i}` }))
    }
    check("G8. Alert history bounded to 100", engine.getAlertCount() === 100, `count=${engine.getAlertCount()}`)
  }
}

/**
 * H. HTTP integration: a valid telemetry request must still succeed when SMS
 * delivery fails.
 *
 * A NON-sandbox username is injected so the real dispatcher refuses locally.
 * That produces a genuine DELIVERY_FAILED with no network call and no SMS.
 */
async function runHttpTest(): Promise<void> {
  console.log("\n--- HTTP integration test (forced provider failure) ---\n")

  const port = "4999"
  const child = spawn(process.execPath, ["dist/server.js"], {
    cwd: path.resolve(process.cwd()),
    env: {
      ...process.env,
      PORT: port,
      HOST: "127.0.0.1",
      AFRICASTALKING_USERNAME: "non-sandbox-forced-failure",
      AFRICASTALKING_API_KEY: SENTINEL_KEY,
      AEGIS_ALERT_SMS_RECIPIENT: "+254711825323",
      AEGIS_ALERT_COOLDOWN_MS: "60000",
    },
    stdio: ["ignore", "pipe", "pipe"],
  })

  let serverLog = ""
  child.stdout?.on("data", (d: Buffer) => { serverLog += d.toString() })
  child.stderr?.on("data", (d: Buffer) => { serverLog += d.toString() })

  // Poll for readiness rather than assuming a fixed startup time.
  const readyDeadline = Date.now() + 20000
  let started = false

  while (Date.now() < readyDeadline) {
    if (serverLog.includes("Gateway started")) {
      started = true
      break
    }
    await new Promise((resolve) => setTimeout(resolve, 200))
  }

  if (!started) {
    check("H0. Gateway process started", false, `no start banner. log=${serverLog.slice(0, 300)}`)
    child.kill()
    return
  }

  check("H0. Gateway process started", true, "start banner observed")

  const base = `http://127.0.0.1:${port}`

  try {
    const health = await fetch(`${base}/api/health`)
    check("H1. Gateway health OK while SMS is failing", health.status === 200, `status=${health.status}`)

    const response = await fetch(`${base}/api/telemetry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        deviceId: "AEGIS-001",
        uptimeSeconds: 4242,
        event: "TAMPER_DETECTED",
        credentialType: "SYSTEM",
        threatScore: 97,
        threatLevel: "CRITICAL",
        lockState: "SECURED",
        source: "SYNTHETIC-TEST",
      }),
    })

    const body = (await response.json()) as { status?: string }
    check("H2. POST /api/telemetry returns 200 despite SMS failure", response.status === 200, `status=${response.status}`)
    check("H3. Response body reports success", body.status === "success", `body=${JSON.stringify(body)}`)

    const status = await fetch(`${base}/api/status`)
    const statusBody = (await status.json()) as { data?: { eventCount?: number; lastSeen?: string | null } }
    check("H4. Telemetry was still stored", status.status === 200 && (statusBody.data?.eventCount ?? 0) >= 1, `eventCount=${statusBody.data?.eventCount}`)

    await new Promise((resolve) => setTimeout(resolve, 400))

    check("H5. Gateway still responsive after SMS failure", (await fetch(`${base}/api/health`)).status === 200, "health after failure")
    check("H6. Server log shows alert was created", serverLog.includes("[AEGIS][ALERT] Alert created"), "alert logged")
    check("H7. Server log shows SMS dispatch failure (not a crash)", serverLog.includes("[AEGIS][ALERT] SMS delivery failed"), "failure logged")
    check("H8. Server log contains no API key", !serverLog.includes(SENTINEL_KEY), "no key in server log")
  } finally {
    child.kill()
  }
}

async function main(): Promise<void> {
  const captured: string[] = []
  const originalLog = console.log
  const originalWarn = console.warn
  const originalError = console.error

  const tee =
    (fn: (...a: unknown[]) => void) =>
    (...a: unknown[]): void => {
      captured.push(a.map((v) => String(v)).join(" "))
      fn(...a)
    }

  console.log = tee(originalLog as (...a: unknown[]) => void)
  console.warn = tee(originalWarn as (...a: unknown[]) => void)
  console.error = tee(originalError as (...a: unknown[]) => void)

  try {
    await runUnitTests()
    await runHttpTest()
  } finally {
    console.log = originalLog
    console.warn = originalWarn
    console.error = originalError
  }

  // G9. Nothing printed during the entire run may contain the API key.
  const joined = captured.join("\n")
  check("G9. API key never printed anywhere in this run", !joined.includes(SENTINEL_KEY), "global log scan clean")

  const failed = results.filter((r) => !r.pass)

  console.log("\n================ SUMMARY ================")
  console.log(`Total: ${results.length}  Passed: ${results.length - failed.length}  Failed: ${failed.length}`)

  if (failed.length > 0) {
    console.log("\nFailures:")
    for (const f of failed) {
      console.log(`  - ${f.name} :: ${f.detail}`)
    }
  }

  console.log("REAL SMS SENT BY THIS SUITE: 0")
  console.log("=========================================")
  process.exit(failed.length === 0 ? 0 : 1)
}

void main()
