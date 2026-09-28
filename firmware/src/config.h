#ifndef CONFIG_H
#define CONFIG_H

#include <Arduino.h>

// ==========================================
// AEGIS NODE CONFIGURATION (FIRMWARE v4.2)
// ==========================================

// Wi-Fi Configuration — Aegis Local Access Point
const bool WIFI_ENABLED = true;

const char* const WIFI_AP_SSID = "AEGIS-NODE-001";
const char* const WIFI_AP_PASSWORD = "AegisNode2026";

// ESP32 SoftAP network
const char* const WIFI_AP_IP = "192.168.4.1";
const char* const WIFI_AP_GATEWAY = "192.168.4.1";
const char* const WIFI_AP_SUBNET = "255.255.255.0";

// Laptop running the Node.js gateway
const char* const GATEWAY_HOST = "192.168.4.2";
const uint16_t GATEWAY_PORT = 4000;
const char* const DEVICE_ID = "AEGIS-001";

// Access Control & Hardware Timing
const unsigned long UNLOCK_DURATION_MS = 3500;       // Solenoid / Servo unlock duration
const unsigned long LOCKDOWN_COOLDOWN_MS = 10000;  // Cooldown before returning to secured state from lockdown
const unsigned int SERVO_LOCKED_ANGLE = 0;
const unsigned int SERVO_UNLOCKED_ANGLE = 90;

// RGB LED Configuration (True if Common Anode where LOW = ON, HIGH = OFF)
const bool RGB_COMMON_ANODE = false;

// Threat Engine Windowed Counters & Thresholds
const unsigned long FAILURE_WINDOW_MS = 60000;      // 1 minute window for failed attempts
const unsigned long RAPID_ATTEMPT_WINDOW_MS = 10000; // 10 seconds rapid attempt window
const unsigned long LOCKOUT_HISTORY_WINDOW_MS = 300000; // 5 minutes history window

// Thresholds for Threat Levels
const int THREAT_THRESHOLD_ELEVATED = 30;
const int THREAT_THRESHOLD_HIGH = 60;
const int THREAT_THRESHOLD_CRITICAL = 80;

// Authorized Credential Allowlist
// Credentials are validated locally on the ESP32.
// Sensitive credential values must never be transmitted as telemetry.
struct CredentialEntry {
    const char* credentialId; // e.g. "UID-7F2A91"
    const char* credentialType; // "RFID" or "PIN"
};

const CredentialEntry AUTHORIZED_CREDENTIALS[] = {
    { "UID-981E6351", "RFID" },
    { "UID-8F42C19A", "RFID" },
    { "UID-7F2A91", "RFID" },
    { "PIN-2014", "PIN" },
    { "PIN-1337", "PIN" }
};

const size_t AUTHORIZED_CREDENTIALS_COUNT = sizeof(AUTHORIZED_CREDENTIALS) / sizeof(AUTHORIZED_CREDENTIALS[0]);

#endif // CONFIG_H
