#include "telemetry.h"

namespace {
bool wifiPendingLogged = false;
bool offlineLogged = false;
bool wifiStarted = false;
bool apReady = false;
}

TelemetryManager::TelemetryManager()
    : lastRetryAttempt(0), wifiConnected(false) {
    gatewayUrl = String("http://") + GATEWAY_HOST + ":" + GATEWAY_PORT + "/api/telemetry";
}

void TelemetryManager::begin() {
    if (!WIFI_ENABLED) {
        wifiConnected = false;
        apReady = false;
        wifiPendingLogged = false;
        offlineLogged = false;
        wifiStarted = false;

        Serial.println("[NET_DISABLED] Wi-Fi disabled. Operating in local-only mode.");
        return;
    }

    if (wifiStarted) return;

    Serial.println("[NET_AP] Starting AEGIS local Wi-Fi network...");

    IPAddress localIP;
    IPAddress gateway;
    IPAddress subnet;

    localIP.fromString(WIFI_AP_IP);
    gateway.fromString(WIFI_AP_GATEWAY);
    subnet.fromString(WIFI_AP_SUBNET);

    WiFi.mode(WIFI_AP);

    if (!WiFi.softAPConfig(localIP, gateway, subnet)) {
        Serial.println("[NET_AP] ERROR: Failed to configure SoftAP network.");
        wifiConnected = false;
        apReady = false;
        wifiStarted = true;
        return;
    }

    if (!WiFi.softAP(WIFI_AP_SSID, WIFI_AP_PASSWORD)) {
        Serial.println("[NET_AP] ERROR: Failed to start SoftAP.");
        wifiConnected = false;
        apReady = false;
        wifiStarted = true;
        return;
    }

    apReady = true;
    wifiConnected = true;
    wifiPendingLogged = false;
    offlineLogged = false;
    lastRetryAttempt = millis();
    wifiStarted = true;

    Serial.printf("[NET_AP] SSID: %s\n", WIFI_AP_SSID);
    Serial.printf("[NET_AP] IP address: %s\n", WiFi.softAPIP().toString().c_str());
    Serial.printf("[NET_AP] Gateway target: %s:%u\n", GATEWAY_HOST, GATEWAY_PORT);
    Serial.println("[NET_AP] Local Aegis network ready.");
}

void TelemetryManager::updateNetwork() {
    if (!WIFI_ENABLED || !wifiStarted) return;

    if (!apReady) {
        return;
    }

    // SoftAP itself remains available even when no laptop/gateway is connected.
    // Physical security must never depend on a connected client.
    int connectedClients = WiFi.softAPgetStationNum();

    static int lastClientCount = -1;

    if (connectedClients != lastClientCount) {
        lastClientCount = connectedClients;

        Serial.printf(
            "[NET_AP] Connected clients: %d\n",
            connectedClients
        );
    }

    // The AP is considered locally available.
    // Gateway availability is checked only when telemetry is sent.
    wifiConnected = true;
}

bool TelemetryManager::sendTelemetry(
    const char* eventType,
    const char* credentialType,
    const char* credentialId,
    int threatScore,
    ThreatLevel threatLevel,
    const char* lockState
) {
    if (!WIFI_ENABLED || !apReady) {
        if (!offlineLogged) {
            Serial.println(
                "[NET_OFFLINE] Local Wi-Fi unavailable. "
                "Bypassing telemetry; local security remains active."
            );
            offlineLogged = true;
        }
        return false;
    }

    HTTPClient http;
    http.begin(gatewayUrl);
    http.addHeader("Content-Type", "application/json");

    // Keep telemetry requests bounded so they cannot block physical security.
    // The budget stays well below RETRY_INTERVAL_MS (10s) so a stalled request
    // can never starve the security loop. 5000ms matches the Arduino
    // HTTPCLIENT_DEFAULT_TCP_TIMEOUT; a tighter value (1500ms) caused
    // spurious HTTPC_ERROR_READ_TIMEOUT on a healthy local SoftAP link.
    http.setTimeout(5000);

    JsonDocument doc;

    doc["deviceId"] = DEVICE_ID;
    // The gateway contract (schemas.ts) requires "uptimeSeconds" as a
    // non-negative integer. millis() is monotonic since boot, which is
    // exactly the semantic the gateway documents for this field.
    doc["uptimeSeconds"] = millis() / 1000;
    doc["event"] = eventType;

    if (credentialType && strlen(credentialType) > 0) {
        doc["credentialType"] = credentialType;
    }

    if (credentialId && strlen(credentialId) > 0) {
        doc["credentialId"] = credentialId;
    }

    doc["threatScore"] = threatScore;

    switch (threatLevel) {
        case THREAT_LEVEL_CRITICAL:
            doc["threatLevel"] = "CRITICAL";
            break;

        case THREAT_LEVEL_HIGH:
            doc["threatLevel"] = "HIGH";
            break;

        case THREAT_LEVEL_ELEVATED:
            doc["threatLevel"] = "ELEVATED";
            break;

        case THREAT_LEVEL_NORMAL:
        default:
            doc["threatLevel"] = "NORMAL";
            break;
    }

    doc["lockState"] = lockState;
    doc["network"] = "LOCAL";
    doc["source"] = "ESP32";

    String requestBody;
    serializeJson(doc, requestBody);

    int httpResponseCode = http.POST(requestBody);

    bool success =
        (httpResponseCode == 200 ||
         httpResponseCode == 201);

    if (success) {
        Serial.printf(
            "[NET_SYNC] Telemetry event '%s' synced to gateway.\n",
            eventType
        );
        offlineLogged = false;
    } else {
        // Log the numeric code as well as the string: HTTPClient's
        // errorToString() returns an empty string for positive HTTP status
        // codes, which previously made every 4xx/5xx rejection print blank.
        // No credentials, PINs or secrets are ever included here.
        Serial.printf(
            "[NET_ERR] Telemetry sync failed: %s (code %d)\n",
            http.errorToString(httpResponseCode).c_str(),
            httpResponseCode
        );
    }

    http.end();

    return success;
}
