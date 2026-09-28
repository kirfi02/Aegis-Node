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

struct AuthAttempt {
    String internalCredentialId; // Used internally for threat engine logic
    String telemetryCredentialId; // Safe masked ID for telemetry ("PIN-REDACTED" or masked RFID)
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

    String getUidString(byte *buffer, byte bufferSize);

public:
    AccessControlManager();
    
    bool begin();
    
    // Polls RFID reader and Keypad. Returns true if an auth attempt was completed.
    bool pollCredentials(AuthAttempt &outAttempt);
    
    void setLockState(bool unlocked);
    bool isUnlocked() const;
};

#endif // ACCESS_CONTROL_H
