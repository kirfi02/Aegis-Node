import AfricasTalking, { AfricasTalkingClient } from "africastalking"

/** Structured, credential-free outcome of a single SMS dispatch attempt. */
export interface SmsDispatchResult {
  success: boolean
  providerMessageId: string | null
  /** Sanitised, credential-free failure description. Null on success. */
  error: string | null
  httpStatus: number | null
}

/**
 * Transport abstraction. The Alert Engine depends on this interface only,
 * which keeps the rules engine testable without any provider traffic.
 */
export interface SmsDispatcher {
  send(to: string, body: string): Promise<SmsDispatchResult>
}

const DEFAULT_TIMEOUT_MS = 10000

/**
 * Sandbox is mandatory at this stage.
 *
 * If the configured username is anything else the dispatcher refuses to send,
 * so a mis-set environment can never page a live number.
 */
const REQUIRED_SANDBOX_USERNAME = "sandbox"

/**
 * Reject any string that might carry the live API key.
 *
 * Belt-and-braces: the sanitiser below already avoids raw Axios objects, but
 * this guarantees that even an unexpected provider message cannot leak the
 * key into an alert record or a log line.
 */
function redactSecrets(text: string): string {
  const apiKey = process.env.AFRICASTALKING_API_KEY?.trim()

  if (!apiKey) {
    return text
  }

  return text.split(apiKey).join("[REDACTED]")
}

/**
 * Extract a credential-free description from an unknown provider error.
 *
 * SECURITY: never stringify the raw error. Axios error objects embed
 * `config.headers`, which contains the API key. Only whitelisted fields
 * are read.
 */
function sanitizeProviderError(error: unknown): {
  message: string
  httpStatus: number | null
} {
  const e = error as {
    message?: string
    response?: {
      status?: number
      data?: {
        statusMessage?: string
        errors?: Array<{ message?: string }>
      }
    }
  }

  const parts: string[] = []
  const httpStatus =
    typeof e?.response?.status === "number" ? e.response.status : null

  if (httpStatus !== null) {
    parts.push(`http ${httpStatus}`)
  }

  if (e?.response?.data?.statusMessage) {
    parts.push(e.response.data.statusMessage)
  }

  for (const item of e?.response?.data?.errors ?? []) {
    if (item?.message) {
      parts.push(item.message)
    }
  }

  if (parts.length === 0) {
    parts.push(e?.message ?? "unknown provider error")
  }

  return {
    message: redactSecrets(parts.join(" | ")),
    httpStatus,
  }
}

/** Race a provider promise against a timeout. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`provider request exceeded ${ms}ms`))
    }, ms)

    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        clearTimeout(timer)
        reject(error)
      }
    )
  })
}

class AfricaTalkingSmsDispatcher implements SmsDispatcher {
  private client: AfricasTalkingClient | null = null
  private initError: string | null = null
  private readonly timeoutOverride: number | null

  constructor(timeoutMs?: number) {
    this.timeoutOverride =
      typeof timeoutMs === "number" && Number.isFinite(timeoutMs) && timeoutMs > 0
        ? timeoutMs
        : null
  }

  /**
   * Resolve the request timeout at call time (not construction time) for the
   * same reason credentials are read lazily: dotenv has not run yet when this
   * module is first evaluated.
   */
  private resolveTimeoutMs(): number {
    if (this.timeoutOverride !== null) {
      return this.timeoutOverride
    }

    const parsed = Number.parseInt(
      process.env.AEGIS_ALERT_SMS_TIMEOUT_MS ?? "",
      10
    )

    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS
  }

  /**
   * Lazily construct the SDK client.
   *
   * Lazy initialisation is required: server.ts calls dotenv.config() in its
   * module body, but ES module imports are evaluated first, so credentials
   * are not available at import time.
   */
  private getClient(): AfricasTalkingClient | null {
    if (this.client) {
      return this.client
    }

    if (this.initError) {
      return null
    }

    const username = process.env.AFRICASTALKING_USERNAME?.trim()
    const apiKey = process.env.AFRICASTALKING_API_KEY?.trim()

    if (!username || !apiKey) {
      this.initError = "Africa's Talking credentials are not configured"
      return null
    }

    if (username.toLowerCase() !== REQUIRED_SANDBOX_USERNAME) {
      this.initError =
        `refusing to dispatch: AFRICASTALKING_USERNAME must be ` +
        `"${REQUIRED_SANDBOX_USERNAME}" (sandbox only)`
      return null
    }

    try {
      this.client = AfricasTalking({ username, apiKey })
      return this.client
    } catch {
      // Deliberately not rethrowing: a broken SDK must not affect the gateway.
      this.initError = "Africa's Talking SDK initialisation failed"
      return null
    }
  }

  /**
   * Send one SMS.
   *
   * Contract: this method NEVER throws and NEVER rejects. Any provider
   * failure becomes a structured result, so the caller - and ultimately the
   * telemetry ingestion path - stays unaffected.
   */
  async send(to: string, body: string): Promise<SmsDispatchResult> {
    const client = this.getClient()

    if (!client) {
      return {
        success: false,
        providerMessageId: null,
        error: this.initError ?? "dispatcher unavailable",
        httpStatus: null,
      }
    }

    try {
      const response = await withTimeout(
        client.SMS.send({ to, message: body }),
        this.resolveTimeoutMs()
      )

      const data = response?.SMSMessageData
      const recipients = data?.Recipients ?? []
      const first = recipients[0]

      // The provider can return HTTP 201 with a per-recipient failure.
      const accepted =
        recipients.length === 0 ||
        first?.statusCode === 101 ||
        first?.status === "Success"

      if (!accepted) {
        return {
          success: false,
          providerMessageId: null,
          error: redactSecrets(
            `provider rejected recipient: ${first?.status ?? "unknown status"}`
          ),
          httpStatus: 201,
        }
      }

      return {
        success: true,
        providerMessageId: first?.messageId ?? null,
        error: null,
        httpStatus: 201,
      }
    } catch (error) {
      const sanitized = sanitizeProviderError(error)

      return {
        success: false,
        providerMessageId: null,
        error: sanitized.message,
        httpStatus: sanitized.httpStatus,
      }
    }
  }
}

export const africaTalkingSmsDispatcher = new AfricaTalkingSmsDispatcher()

