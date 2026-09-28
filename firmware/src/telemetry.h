#ifndef TELEMETRY_H
#define TELEMETRY_H

#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include "config.h"
#include "threat_engine.h"

class TelemetryManager {
private:
    String gatewayUrl;
    unsigned long lastRetryAttempt;
    const unsigned long RETRY_INTERVAL_MS = 10000; // 10 seconds bounded retry
    bool wifiConnected;

public:
    TelemetryManager();

    void begin();
    
    // Non-blocking Wi-Fi check / connection maintenance
    void updateNetwork();

    // Sends telemetry to gateway. If Wi-Fi is down, logs and returns false without blocking.
    bool sendTelemetry(const char* eventType, const char* credentialType, const char* credentialId, int threatScore, ThreatLevel threatLevel, const char* lockState);
};

#endif // TELEMETRY_H
