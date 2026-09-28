#include <Arduino.h>
#include <esp_system.h>
#include "config.h"
#include "pins.h"
#include "access_control.h"
#include "threat_engine.h"
#include "telemetry.h"
#include "audio.h"

// Instantiate Global Hardware & Logic Managers
HardwareSerial DFSerial(2); // UART2 for DFPlayer
AccessControlManager accessCtrl;
ThreatEngine threatEngine;
TelemetryManager telemetry;
AudioManager audio(DFSerial);

// System States
enum SystemState {
    STATE_BOOT,
    STATE_SELF_TEST,
    STATE_SECURED,
    STATE_AUTHENTICATION,
    STATE_VALIDATE,
    STATE_ACCESS_GRANTED,
    STATE_ACCESS_DENIED,
    STATE_THREAT_ANALYSIS,
    STATE_LOCKDOWN,
    STATE_ALERT
};

SystemState currentState = STATE_BOOT;

// Timing Variables
unsigned long stateStartTime = 0;
unsigned long lastRgbFlashTime = 0;
bool rgbFlashState = false;

const char* resetReasonName(esp_reset_reason_t reason) {
    switch (reason) {
        case ESP_RST_UNKNOWN: return "UNKNOWN";
        case ESP_RST_POWERON: return "POWERON";
        case ESP_RST_EXT: return "EXTERNAL";
        case ESP_RST_SW: return "SOFTWARE";
        case ESP_RST_PANIC: return "PANIC";
        case ESP_RST_INT_WDT: return "INT_WDT";
        case ESP_RST_TASK_WDT: return "TASK_WDT";
        case ESP_RST_WDT: return "WDT";
        case ESP_RST_DEEPSLEEP: return "DEEPSLEEP";
        case ESP_RST_BROWNOUT: return "BROWNOUT";
        case ESP_RST_SDIO: return "SDIO";
        default: return "UNRECOGNIZED";
    }
}

// Active attempt context storage
AuthAttempt activeAttempt;

// Helper: RGB LED Controller
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
            setRgbColor(true, false, false); // Red
            break;
        case THREAT_LEVEL_HIGH:
            setRgbColor(true, true, false);  // Yellow / Orange
            break;
        case THREAT_LEVEL_ELEVATED:
            setRgbColor(false, true, true);  // Cyan
            break;
        case THREAT_LEVEL_NORMAL:
        default:
            setRgbColor(false, false, false); // Off while secured and waiting
            break;
    }
}

void setup() {
    Serial.begin(115200);
    esp_reset_reason_t resetReason = esp_reset_reason();
    Serial.printf("[RESET] reason=%d (%s)\n", static_cast<int>(resetReason), resetReasonName(resetReason));
    delay(1000);
    Serial.println("\n[AEGIS] Booting Sovereign Access Control Node (ESP32)...");

    pinMode(PIN_RGB_R, OUTPUT);
    pinMode(PIN_RGB_G, OUTPUT);
    pinMode(PIN_RGB_B, OUTPUT);
    setRgbColor(false, false, true); // Blue during boot

    currentState = STATE_BOOT;
}

void loop() {
    unsigned long now = millis();
    if (currentState != STATE_BOOT && currentState != STATE_SELF_TEST) {
        telemetry.updateNetwork();
    }
    switch (currentState) {
        case STATE_BOOT:
            Serial.println("[STATE] BOOT -> Transitioning to SELF_TEST");
            currentState = STATE_SELF_TEST;
            stateStartTime = now;
            break;

        case STATE_SELF_TEST: {
            Serial.println("[SELF_TEST] Running subsystem diagnostics...");
            
            bool rfidOk = accessCtrl.begin();
            audio.begin();
            telemetry.begin();

            if (!rfidOk) {
                Serial.println("[CRITICAL_FAULT] RFID subsystem initialization failed. System entering secure lockdown mode.");
                setRgbColor(true, false, false);
                audio.playLockdown();
                
                threatEngine.recordLockdown(now);
                currentState = STATE_LOCKDOWN;
            } else {
                Serial.println("[SYSTEM] AEGIS NODE ONLINE");
                setRgbColor(false, false, false); // Off while secured and waiting
                
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

        case STATE_SECURED: {
            updateRgbForThreat(threatEngine.getThreatLevel(), false);

            if (accessCtrl.pollCredentials(activeAttempt)) {
                Serial.printf("[AUTH] Credential detected. Type: %s, Valid: %s\n", 
                    activeAttempt.credentialType.c_str(), 
                    activeAttempt.isValid ? "YES" : "NO");
                
                // Threat engine evaluates internal ID
                threatEngine.recordAttempt(activeAttempt.internalCredentialId, activeAttempt.isValid, now);
                Serial.printf(
                    "[THREAT] Score=%d Level=%s\n",
                    threatEngine.getThreatScore(),
                    threatEngine.getThreatLevelString()
                );

                if (activeAttempt.isValid) {
                    currentState = STATE_ACCESS_GRANTED;
                } else {
                    currentState = STATE_ACCESS_DENIED;
                }
                stateStartTime = now;
            }
            break;
        }

        case STATE_ACCESS_GRANTED: {
            Serial.println("[SECURITY] ACCESS_GRANTED // Unlocking perimeter");
            accessCtrl.setLockState(true);
            setRgbColor(false, true, false); // Green
            audio.playAccessGranted();

            // Telemetry receives safe masked ID ("PIN-REDACTED" or masked RFID)
            telemetry.sendTelemetry(
                "ACCESS_GRANTED", 
                activeAttempt.credentialType.c_str(), 
                activeAttempt.telemetryCredentialId.c_str(), 
                threatEngine.getThreatScore(), 
                threatEngine.getThreatLevel(), 
                "UNLOCKED"
            );

            stateStartTime = now;
            currentState = STATE_AUTHENTICATION;
            break;
        }

        case STATE_ACCESS_DENIED: {
            Serial.println("[SECURITY] ACCESS_DENIED // Credential rejected");
            setRgbColor(true, true, false); // Amber warning

            ThreatLevel level = threatEngine.getThreatLevel();
            if (level == THREAT_LEVEL_NORMAL) {
                audio.playAccessDenied();
            } else if (level == THREAT_LEVEL_ELEVATED || level == THREAT_LEVEL_HIGH) {
                audio.playWarning();
            }

            // Telemetry receives safe masked ID
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

        case STATE_THREAT_ANALYSIS: {
            ThreatLevel level = threatEngine.getThreatLevel();
            if (level == THREAT_LEVEL_CRITICAL) {
                Serial.println("[THREAT] CRITICAL threat score reached! Initiating LOCKDOWN.");
                threatEngine.recordLockdown(now);
                currentState = STATE_LOCKDOWN;
            } else {
                currentState = STATE_SECURED;
            }
            stateStartTime = now;
            break;
        }

        case STATE_LOCKDOWN: {
            accessCtrl.setLockState(false);
            updateRgbForThreat(threatEngine.getThreatLevel(), true);
            audio.playLockdown();

            telemetry.sendTelemetry(
                "LOCKDOWN", 
                "SYSTEM", 
                DEVICE_ID, 
                threatEngine.getThreatScore(), 
                threatEngine.getThreatLevel(), 
                "LOCKDOWN"
            );

            Serial.println("[LOCKDOWN] Perimeter secured. Cooldown initiated.");
            stateStartTime = now;
            currentState = STATE_ALERT;
            break;
        }

        case STATE_ALERT: {
            updateRgbForThreat(threatEngine.getThreatLevel(), true);
            accessCtrl.setLockState(false);

            if (now - stateStartTime > LOCKDOWN_COOLDOWN_MS) {
                Serial.println("[LOCKDOWN] Cooldown elapsed. Resetting temporary threat counters and returning to SECURED.");
                threatEngine.resetAfterLockdown(now);
                currentState = STATE_SECURED;
                stateStartTime = now;
            }
            break;
        }

        case STATE_AUTHENTICATION: {
            if (now - stateStartTime > UNLOCK_DURATION_MS) {
                Serial.println("[SECURITY] Unlock duration elapsed. Re-locking perimeter.");
                accessCtrl.setLockState(false);
                currentState = STATE_SECURED;
            }
            break;
        }

        default:
            currentState = STATE_SECURED;
            break;
    }
}
