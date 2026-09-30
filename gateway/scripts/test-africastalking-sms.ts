/**
 * AEGIS NODE // ISOLATED AFRICA'S TALKING SANDBOX SMS CONNECTIVITY TEST
 * ---------------------------------------------------------------------------
 * PURPOSE
 *   One-off provider connectivity test ONLY. This file is deliberately NOT
 *   wired into the gateway, the telemetry pipeline, the WebSocket bus, the
 *   dashboard, or any Aegis security event.
 *
 * SAFETY GUARANTEES
 *   - Sends EXACTLY ONE message. No retry, no loop, no backoff.
 *   - Aborts BEFORE sending unless the SDK resolved a *sandbox* endpoint, so
 *     a mis-set username can never reach the live/production API.
 *   - Never prints the API key or its length, never writes a credential to
 *     disk, and never logs the raw SDK/Axios error object (Axios errors embed
 *     request headers, which contain the API key).
 *
 * RUN
 *   cd gateway
 *   npx tsx scripts/test-africastalking-sms.ts
 */

import path from "node:path";
import { createRequire } from "node:module";
import dotenv from "dotenv";
import AfricasTalking from "africastalking";

const REQUIRED_USERNAME = "sandbox";
const SANDBOX_ENDPOINT_MARKER = "sandbox.africastalking.com";

const TEST_MESSAGE =
  "AEGIS NODE TEST: Africa's Talking Sandbox notification channel is working.";

/**
 * Canonical Africa's Talking SANDBOX test MSISDN.
 *
 * Sandbox-only test number: traffic is terminated by Africa's Talking and
 * surfaced in the web simulator. It is NOT routed to a real handset.
 *
 * Override with AFRICASTALKING_SANDBOX_TO if you registered your own test
 * number at https://account.africastalking.com/apps/sandbox
 */
const DEFAULT_SANDBOX_RECIPIENT = "+254711825323";

function bail(message: string): never {
  console.error(`[AEGIS][AT-SMS-TEST] ABORT: ${message}`);
  process.exit(1);
}

function log(line: string): void {
  console.log(`[AEGIS][AT-SMS-TEST] ${line}`);
}

/** Resolve gateway/ regardless of the directory the script is invoked from. */
function resolveGatewayRoot(): string {
  if (typeof __dirname !== "undefined") {
    return path.resolve(__dirname, "..");
  }
  return process.cwd();
}

const gatewayRoot = resolveGatewayRoot();
const envPath = path.join(gatewayRoot, ".env");

// ---------------------------------------------------------------------------
// 1. Load credentials
// ---------------------------------------------------------------------------

if (!dotenv.config({ path: envPath }).parsed) {
  bail(`could not read an env file at ${envPath}`);
}

const username = process.env.AFRICASTALKING_USERNAME?.trim();
const apiKey = process.env.AFRICASTALKING_API_KEY?.trim();

log(`env file loaded from ${envPath}`);

// Report PRESENCE only. Never the value, never the length.
log(`AFRICASTALKING_USERNAME present: ${username !== undefined}`);
log(`AFRICASTALKING_API_KEY present: ${apiKey !== undefined}`);

if (!username) {
  bail("AFRICASTALKING_USERNAME is missing or empty in gateway/.env");
}

if (!apiKey) {
  bail("AFRICASTALKING_API_KEY is missing or empty in gateway/.env");
}

if (username.toLowerCase() !== REQUIRED_USERNAME) {
  bail(
    `AFRICASTALKING_USERNAME must be "${REQUIRED_USERNAME}" for a sandbox ` +
      `test. Refusing to send.`
  );
}

const recipient =
  process.env.AFRICASTALKING_SANDBOX_TO?.trim() || DEFAULT_SANDBOX_RECIPIENT;

// ---------------------------------------------------------------------------
// 2-3. Initialise, verify sandbox routing, send exactly one SMS
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  log(`initialising SDK (username: ${username})`);

  const client = AfricasTalking({ username, apiKey });

  // Introspect the SDK's resolved base URL to PROVE we target the sandbox
  // before spending the single permitted send.
  const sdkRequire = createRequire(path.join(gatewayRoot, "package.json"));
  const common = sdkRequire("africastalking/lib/common") as {
    CONTENT_URL: string;
  };

  const resolvedEndpoint = common.CONTENT_URL;
  log(`resolved messaging endpoint: ${resolvedEndpoint}`);

  if (!resolvedEndpoint.includes(SANDBOX_ENDPOINT_MARKER)) {
    bail(
      `SDK resolved a NON-sandbox endpoint (${resolvedEndpoint}). ` +
        `Refusing to send anything to the live API.`
    );
  }

  log("sandbox routing verified - safe to proceed");

// ---------------------------------------------------------------------------
// 3. Send exactly ONE SMS
// ---------------------------------------------------------------------------

  log(`recipient: ${recipient}`);
  log(`message: ${TEST_MESSAGE}`);
  log("sending 1 message (single attempt, no retries configured)");

  try {
    const response = (await client.SMS.send({
      to: recipient,
      message: TEST_MESSAGE,
    })) as {
      SMSMessageData?: {
        Message?: string;
        Recipients?: Array<{
          statusCode?: number;
          number?: string;
          status?: string;
          cost?: string;
          messageId?: string;
        }>;
      };
    };

    const data = response?.SMSMessageData;
    const recipients = data?.Recipients ?? [];

    log("RESULT: request SUCCEEDED (HTTP 201 Created)");
    log(`summary: ${data?.Message ?? "(no summary returned)"}`);

    for (const r of recipients) {
      log(
        `recipient -> number: ${r.number ?? "?"} | status: ${r.status ?? "?"} ` +
          `| statusCode: ${r.statusCode ?? "?"} | cost: ${r.cost ?? "?"} ` +
          `| messageId: ${r.messageId ?? "?"}`
      );
    }

    log(
      "NEXT STEP: view this message in the sandbox simulator at " +
        "https://simulator.africastalking.com:1517/"
    );
    log("NOTE: sandbox SMS is not delivered to a real handset.");

    process.exit(0);
  } catch (error) {
    // DO NOT log the raw error: Axios error.config.headers contains the API
    // key. Extract only known-safe fields instead.
    const e = error as {
      message?: string;
      code?: string;
      response?: {
        status?: number;
        data?: {
          statusMessage?: string;
          errors?: Array<{ message?: string }>;
        };
      };
    };

    console.error("[AEGIS][AT-SMS-TEST] RESULT: request FAILED");

    if (e?.response?.status !== undefined) {
      console.error(`[AEGIS][AT-SMS-TEST] http status: ${e.response.status}`);
    }

    if (e?.response?.data?.statusMessage) {
      console.error(
        `[AEGIS][AT-SMS-TEST] statusMessage: ${e.response.data.statusMessage}`
      );
    }

    for (const err of e?.response?.data?.errors ?? []) {
      if (err?.message) {
        console.error(`[AEGIS][AT-SMS-TEST] error: ${err.message}`);
      }
    }

    if (!e?.response && e?.message) {
      console.error(`[AEGIS][AT-SMS-TEST] transport error: ${e.message}`);
      if (e?.code) {
        console.error(`[AEGIS][AT-SMS-TEST] error code: ${e.code}`);
      }
    }

    console.error(
      "[AEGIS][AT-SMS-TEST] Not retrying. Exactly one attempt was made."
    );

    process.exit(1);
  }
}

main().catch((error: unknown) => {
  // Last-resort guard. Never stringify the raw error - it can contain the
  // API key in request headers.
  const message =
    error instanceof Error ? error.message : "unknown non-Error failure";
  console.error(`[AEGIS][AT-SMS-TEST] UNEXPECTED FAILURE: ${message}`);
  console.error(
    "[AEGIS][AT-SMS-TEST] Not retrying. Exactly one attempt was made."
  );
  process.exit(1);
});

