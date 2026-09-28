#include <Arduino.h>
#include <esp_system.h>
#include "config.h"
#include "pins.h"
#include "access_control.h"
#include "threat_engine.h"
#include "telemetry.h"
#include "audio.h"

// ============================================================
// GLOBAL HARDWARE & LOGIC MANAGERS
// ============================================================

HardwareSerial DFSerial(2); // UART2 for DFPlayer

AccessControlManager accessCtrl;
ThreatEngine threatEngine;
TelemetryManager telemetry;
AudioManager audio(DFSerial);

// ============================================================
// SYSTEM STATES
// ============================================================

enum SystemState {
    STATE_BOOT,
    STATE_SELF_TEST,
    STATE_SECURED,
    STATE_WAITING_FOR_PIN,
    STATE_AUTHENTICATION,
    STATE_ACCESS_GRANTED,
    STATE_ACCESS_DENIED,
    STATE_THREAT_ANALYSIS,
    STATE_LOCKDOWN,
    STATE_ALERT
};

SystemState currentState = STATE_BOOT;

// ============================================================
// TIMING
// ============================================================

unsigned long stateStartTime = 0;
unsigned long lastRgbFlashTime = 0;

bool rgbFlashState = false;

// MFA challenge timeout.
// This matches the PIN timeout currently implemented in
// AccessControlManager.
const unsigned long MFA_CHALLENGE_TIMEOUT_MS = 5000;

// ============================================================
// RESET REASON
// ============================================================

const char* resetReasonName(esp_reset_reason_t reason) {
    switch (reason) {
        case ESP_RST_UNKNOWN:
            return "UNKNOWN";

        case ESP_RST_POWERON:
            return "POWERON";

        case ESP_RST_EXT:
            return "EXTERNAL";

        case ESP_RST_SW:
            return "SOFTWARE";

        case ESP_RST_PANIC:
            return "PANIC";

        case ESP_RST_INT_WDT:
            return "INT_WDT";

        case ESP_RST_TASK_WDT:
            return "WDT";

        case ESP_RST_DEEPSLEEP:
            return "DEEPSLEEP";

        case ESP_RST_BROWNOUT:
            return "BROWNOUT";

        case ESP_RST_SDIO:
            return "SDIO";

        default:
            return "UNRECOGNIZED";
    }
}

// ============================================================
// ACTIVE AUTHENTICATION ATTEMPT
// ============================================================

AuthAttempt activeAttempt;

// ============================================================
// RGB LED CONTROLLER
// ============================================================

void setRgbColor(bool r, bool g, bool b) {

    if (RGB_COMMON_ANODE) {
        digitalWrite(PIN_RGB_R, r ? LOW : HIGH);
        digitalWrite(PIN_RGB_G, g ? LOW : HIGH);
        digitalWrite(PIN_RGB_B, b ? LOW : HIGH);
    } else {
        digitalWrite(PIN_RGB_R, r ? HIGH : LOW);
        digitalWrite(PIN_RGB_G, g ? HIGH : LOW);
        digitalWrite(PIN_RGB_B, b ? HIGH : LOW);
    }
}

// ============================================================
// THREAT LED STATE
// ============================================================

void updateRgbForThreat(ThreatLevel level, bool isLockdown) {

    if (isLockdown) {

        unsigned long now = millis();

        if (now - lastRgbFlashTime > 300) {
            lastRgbFlashTime = now;
            rgbFlashState = !rgbFlashState;
        }

        setRgbColor(rgbFlashState, false, false);
        return;
    }

    switch (level) {

        case THREAT_LEVEL_CRITICAL:
            setRgbColor(true, false, false);
            break;

        case THREAT_LEVEL_HIGH:
            setRgbColor(true, true, false);
            break;

        case THREAT_LEVEL_ELEVATED:
            setRgbColor(false, true, true);
            break;

        case THREAT_LEVEL_NORMAL:
        default:
            setRgbColor(false, false, false);
            break;
    }
}

// ============================================================
// SETUP
// ============================================================

void setup() {

    Serial.begin(115200);

    esp_reset_reason_t resetReason = esp_reset_reason();

    Serial.printf(
        "[RESET] reason=%d (%s)\n",
        static_cast<int>(resetReason),
        resetReasonName(resetReason)
    );

    delay(1000);

    Serial.println(
        "\n[AEGIS] Booting Sovereign Access Control Node (ESP32)..."
    );

    pinMode(PIN_RGB_R, OUTPUT);
    pinMode(PIN_RGB_G, OUTPUT);
    pinMode(PIN_RGB_B, OUTPUT);

    // Blue during boot
    setRgbColor(false, false, true);

    currentState = STATE_BOOT;
}

// ============================================================
// MAIN LOOP
// ============================================================

void loop() {

    unsigned long now = millis();

    // Network telemetry is not required for physical security.
    // The ESP32 remains authoritative when the gateway is offline.
    if (
        currentState != STATE_BOOT &&
        currentState != STATE_SELF_TEST
    ) {
        telemetry.updateNetwork();
    }

    switch (currentState) {

        // ======================================================
        // BOOT
        // ======================================================

        case STATE_BOOT:

            Serial.println(
                "[STATE] BOOT -> Transitioning to SELF_TEST"
            );

            currentState = STATE_SELF_TEST;
            stateStartTime = now;

            break;


        // ======================================================
        // SELF TEST
        // ======================================================

        case STATE_SELF_TEST: {

            Serial.println(
                "[SELF_TEST] Running subsystem diagnostics..."
            );

            bool rfidOk = accessCtrl.begin();

            audio.begin();
            telemetry.begin();

            if (!rfidOk) {

                Serial.println(
                    "[CRITICAL_FAULT] RFID subsystem initialization failed. "
                    "System entering secure lockdown mode."
                );

                setRgbColor(true, false, false);

                audio.playLockdown();

                threatEngine.recordLockdown(now);

                currentState = STATE_LOCKDOWN;

            } else {

                Serial.println(
                    "[SYSTEM] AEGIS NODE ONLINE"
                );

                setRgbColor(false, false, false);

                telemetry.sendTelemetry(
                    "DEVICE_ONLINE",
                    "SYSTEM",
                    "SYSTEM",
                    threatEngine.getThreatScore(),
                    threatEngine.getThreatLevel(),
                    "SECURED"
                );

                currentState = STATE_SECURED;
            }

            stateStartTime = now;

            break;
        }


        // ======================================================
        // SECURED
        //
        // System is locked and waiting for RFID.
        //
        // IMPORTANT:
        // A valid RFID NEVER unlocks the system.
        // It only moves authentication to the PIN stage.
        // ======================================================

        case STATE_SECURED: {

            updateRgbForThreat(
                threatEngine.getThreatLevel(),
                false
            );

            if (accessCtrl.pollCredentials(activeAttempt)) {

                Serial.printf(
                    "[AUTH] Credential detected. Type: %s, Valid: %s\n",
                    activeAttempt.credentialType.c_str(),
                    activeAttempt.isValid ? "YES" : "NO"
                );

                // ==================================================
                // THREAT ENGINE
                // ==================================================

                threatEngine.recordAttempt(
                    activeAttempt.internalCredentialId,
                    activeAttempt.isValid,
                    now
                );

                Serial.printf(
                    "[THREAT] Score=%d Level=%s\n",
                    threatEngine.getThreatScore(),
                    threatEngine.getThreatLevelString()
                );

                // ==================================================
                // INVALID FIRST FACTOR
                // ==================================================

                if (!activeAttempt.isValid) {

                    currentState = STATE_ACCESS_DENIED;
                }

                // ==================================================
                // VALID RFID
                //
                // This is ONLY the first MFA factor.
                // DO NOT unlock.
                // ==================================================

                else if (
                    activeAttempt.credentialType == "RFID"
                ) {

                    Serial.println(
                        "[MFA] First factor accepted."
                    );

                    Serial.println(
                        "[MFA] RFID validated. PIN required."
                    );

                    // Blue = waiting for second factor
                    setRgbColor(false, false, true);

                    telemetry.sendTelemetry(
                        "RFID_VALIDATED",
                        "RFID",
                        activeAttempt.telemetryCredentialId.c_str(),
                        threatEngine.getThreatScore(),
                        threatEngine.getThreatLevel(),
                        "WAITING_FOR_PIN"
                    );

                    // Enter explicit MFA challenge state.
                    currentState = STATE_WAITING_FOR_PIN;

                    stateStartTime = now;
                }

                // ==================================================
                // DEFENSIVE FALLBACK
                //
                // Only MFA may ever grant access.
                // ==================================================

                else {

                    Serial.println(
                        "[SECURITY] Valid credential is not a "
                        "completed MFA authentication."
                    );

                    Serial.println(
                        "[SECURITY] Access remains denied."
                    );

                    currentState = STATE_SECURED;
                }

                stateStartTime = now;
            }

            break;
        }


        // ======================================================
        // WAITING FOR PIN
        //
        // RFID has already been validated.
        // System remains LOCKED.
        //
        // Only a valid PIN can produce an MFA attempt.
        // ======================================================

        case STATE_WAITING_FOR_PIN: {

            // Keep the perimeter locked while waiting for PIN.
            accessCtrl.setLockState(false);

            // Blue indicates MFA challenge in progress.
            setRgbColor(false, false, true);

            // --------------------------------------------------
            // MFA challenge timeout
            // --------------------------------------------------

            if (
                now - stateStartTime >
                MFA_CHALLENGE_TIMEOUT_MS
            ) {

                Serial.println(
                    "[MFA] PIN challenge timeout."
                );

                Serial.println(
                    "[MFA] Authentication sequence reset."
                );

                telemetry.sendTelemetry(
                    "MFA_TIMEOUT",
                    "MFA",
                    "MFA-REDACTED",
                    threatEngine.getThreatScore(),
                    threatEngine.getThreatLevel(),
                    "SECURED"
                );

                setRgbColor(false, false, false);

                currentState = STATE_SECURED;
                stateStartTime = now;

                break;
            }

            // --------------------------------------------------
            // Check for PIN completion
            // --------------------------------------------------

            if (accessCtrl.pollCredentials(activeAttempt)) {

                Serial.printf(
                    "[AUTH] Credential detected. Type: %s, Valid: %s\n",
                    activeAttempt.credentialType.c_str(),
                    activeAttempt.isValid ? "YES" : "NO"
                );

                // Evaluate the second factor.
                threatEngine.recordAttempt(
                    activeAttempt.internalCredentialId,
                    activeAttempt.isValid,
                    now
                );

                Serial.printf(
                    "[THREAT] Score=%d Level=%s\n",
                    threatEngine.getThreatScore(),
                    threatEngine.getThreatLevelString()
                );

                // ==================================================
                // COMPLETED MFA
                // ==================================================

                if (
                    activeAttempt.isValid &&
                    activeAttempt.credentialType == "MFA"
                ) {

                    Serial.println(
                        "[MFA] RFID + PIN authentication successful."
                    );

                    Serial.println(
                        "[MFA] Authentication sequence complete."
                    );

                    currentState = STATE_ACCESS_GRANTED;
                }

                // ==================================================
                // INVALID PIN
                // ==================================================

                else {

                    Serial.println(
                        "[MFA] Second factor rejected."
                    );

                    currentState = STATE_ACCESS_DENIED;
                }

                stateStartTime = now;
            }

            break;
        }


        // ======================================================
        // ACCESS GRANTED
        //
        // THIS STATE CAN ONLY BE REACHED BY COMPLETED MFA.
        // ======================================================

        case STATE_ACCESS_GRANTED: {

            // Defensive assertion:
            // the active attempt must be MFA.
            if (
                activeAttempt.credentialType != "MFA" ||
                !activeAttempt.isValid
            ) {

                Serial.println(
                    "[SECURITY_FAULT] ACCESS_GRANTED reached "
                    "without completed MFA."
                );

                accessCtrl.setLockState(false);
                setRgbColor(false, false, false);

                currentState = STATE_SECURED;
                stateStartTime = now;

                break;
            }

            Serial.println(
                "[SECURITY] ACCESS_GRANTED // "
                "RFID + PIN verified. Unlocking perimeter."
            );

            accessCtrl.setLockState(true);

            setRgbColor(false, true, false);

            audio.playAccessGranted();

            telemetry.sendTelemetry(
                "ACCESS_GRANTED",
                "MFA",
                "MFA-RFID+PIN",
                threatEngine.getThreatScore(),
                threatEngine.getThreatLevel(),
                "UNLOCKED"
            );

            stateStartTime = now;

            currentState = STATE_AUTHENTICATION;

            break;
        }


        // ======================================================
        // ACCESS DENIED
        // ======================================================

        case STATE_ACCESS_DENIED: {

            Serial.println(
                "[SECURITY] ACCESS_DENIED // "
                "Authentication rejected."
            );

            // Ensure perimeter remains locked.
            accessCtrl.setLockState(false);

            setRgbColor(true, true, false);

            ThreatLevel level =
                threatEngine.getThreatLevel();

            if (level == THREAT_LEVEL_NORMAL) {

                audio.playAccessDenied();

            } else if (
                level == THREAT_LEVEL_ELEVATED ||
                level == THREAT_LEVEL_HIGH
            ) {

                audio.playWarning();
            }

            telemetry.sendTelemetry(
                "ACCESS_DENIED",
                activeAttempt.credentialType.c_str(),
                activeAttempt.telemetryCredentialId.c_str(),
                threatEngine.getThreatScore(),
                threatEngine.getThreatLevel(),
                "SECURED"
            );

            stateStartTime = now;

            currentState = STATE_THREAT_ANALYSIS;

            break;
        }


        // ======================================================
        // THREAT ANALYSIS
        // ======================================================

        case STATE_THREAT_ANALYSIS: {

            ThreatLevel level =
                threatEngine.getThreatLevel();

            if (level == THREAT_LEVEL_CRITICAL) {

                Serial.println(
                    "[THREAT] CRITICAL threat score reached! "
                    "Initiating LOCKDOWN."
                );

                threatEngine.recordLockdown(now);

                currentState = STATE_LOCKDOWN;

            } else {

                currentState = STATE_SECURED;
            }

            stateStartTime = now;

            break;
        }


        // ======================================================
        // LOCKDOWN
        // ======================================================

        case STATE_LOCKDOWN: {

            accessCtrl.setLockState(false);

            updateRgbForThreat(
                threatEngine.getThreatLevel(),
                true
            );

            audio.playLockdown();

            telemetry.sendTelemetry(
                "LOCKDOWN",
                "SYSTEM",
                DEVICE_ID,
                threatEngine.getThreatScore(),
                threatEngine.getThreatLevel(),
                "LOCKDOWN"
            );

            Serial.println(
                "[LOCKDOWN] Perimeter secured. Cooldown initiated."
            );

            stateStartTime = now;

            currentState = STATE_ALERT;

            break;
        }


        // ======================================================
        // ALERT / LOCKDOWN COOLDOWN
        // ======================================================

        case STATE_ALERT: {

            updateRgbForThreat(
                threatEngine.getThreatLevel(),
                true
            );

            accessCtrl.setLockState(false);

            if (
                now - stateStartTime >
                LOCKDOWN_COOLDOWN_MS
            ) {

                Serial.println(
                    "[LOCKDOWN] Cooldown elapsed. "
                    "Resetting temporary threat counters "
                    "and returning to SECURED."
                );

                threatEngine.resetAfterLockdown(now);

                setRgbColor(false, false, false);

                currentState = STATE_SECURED;

                stateStartTime = now;
            }

            break;
        }


        // ======================================================
        // UNLOCKED / AUTHENTICATION WINDOW
        // ======================================================

        case STATE_AUTHENTICATION: {

            if (
                now - stateStartTime >
                UNLOCK_DURATION_MS
            ) {

                Serial.println(
                    "[SECURITY] Unlock duration elapsed. "
                    "Re-locking perimeter."
                );

                accessCtrl.setLockState(false);

                setRgbColor(false, false, false);

                currentState = STATE_SECURED;

                stateStartTime = now;
            }

            break;
        }


        // ======================================================
        // DEFENSIVE FALLBACK
        // ======================================================

        default:

            Serial.println(
                "[SECURITY_FAULT] Unknown system state. "
                "Returning to secured state."
            );

            accessCtrl.setLockState(false);

            setRgbColor(false, false, false);

            currentState = STATE_SECURED;

            stateStartTime = now;

            break;
    }
}