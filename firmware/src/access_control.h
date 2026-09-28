#ifndef ACCESS_CONTROL_H
#define ACCESS_CONTROL_H

#include <Arduino.h>
#include <SPI.h>
#include <MFRC522.h>
#include <Keypad.h>
#include <ESP32Servo.h>
#include "pins.h"
#include "config.h"

enum CredentialValidationResult {
    CREDENTIAL_UNKNOWN,
    CREDENTIAL_VALID,
    CREDENTIAL_INVALID
};

enum AuthenticationStage {
    AUTH_STAGE_IDLE,
    AUTH_STAGE_WAITING_FOR_PIN
};

struct AuthAttempt {
    String internalCredentialId;      // Internal only; may contain sensitive credential data
    String telemetryCredentialId;     // Safe identifier for telemetry
    String credentialType;
    bool isValid;
    unsigned long timestamp;
};

class AccessControlManager {
private:
    MFRC522 rfidReader;
    Keypad keypad;
    Servo lockServo;
    bool unlockedState;

    char keypadKeys[4][3];
    byte rowPins[4];
    byte colPins[3];

    String currentPinBuffer;
    unsigned long lastKeypressTime;
    const unsigned long PIN_TIMEOUT_MS = 5000;

    // MFA state
    AuthenticationStage authStage;
    String validatedRfidId;
    String validatedRfidTelemetryId;

    String getUidString(byte *buffer, byte bufferSize);

    bool isAuthorizedCredential(
        const String &credentialType,
        const String &credentialId
    );

public:
    AccessControlManager();

    bool begin();

    // Polls RFID reader and keypad.
    // Authentication flow:
    // 1. Valid RFID
    // 2. Valid PIN
    // 3. Only then returns a valid MFA attempt
    bool pollCredentials(AuthAttempt &outAttempt);

    void setLockState(bool unlocked);
    bool isUnlocked() const;
};

#endif // ACCESS_CONTROL_H