#include "access_control.h"

// Keypad pin arrays must exist before the Keypad object is constructed.
byte KEYPAD_ROW_PINS[4] = {
    PIN_KP_R1,
    PIN_KP_R2,
    PIN_KP_R3,
    PIN_KP_R4
};

byte KEYPAD_COL_PINS[3] = {
    PIN_KP_C1,
    PIN_KP_C2,
    PIN_KP_C3
};

// Define keypad layout
char KEYS[4][3] = {
    {'1','2','3'},
    {'4','5','6'},
    {'7','8','9'},
    {'*','0','#'}
};

AccessControlManager::AccessControlManager()
    : rfidReader(PIN_RFID_SS, PIN_RFID_RST),
      keypad(makeKeymap(KEYS), KEYPAD_ROW_PINS, KEYPAD_COL_PINS, 4, 3),
      unlockedState(false),
      currentPinBuffer(""),
      lastKeypressTime(0),
      authStage(AUTH_STAGE_IDLE),
      validatedRfidId(""),
      validatedRfidTelemetryId("") {

    for (int i = 0; i < 4; i++) {
        rowPins[i] = KEYPAD_ROW_PINS[i];
    }

    for (int i = 0; i < 3; i++) {
        colPins[i] = KEYPAD_COL_PINS[i];
    }
}

bool AccessControlManager::begin() {
    keypad.setDebounceTime(50);

    // Initialize SPI and RFID
    SPI.begin();
    rfidReader.PCD_Init();

    // Initialize Servo
    lockServo.setPeriodHertz(50);
    lockServo.attach(PIN_SERVO_PWM, 500, 2400);
    lockServo.write(SERVO_LOCKED_ANGLE);
    unlockedState = false;

    currentPinBuffer = "";
    lastKeypressTime = 0;
    authStage = AUTH_STAGE_IDLE;
    validatedRfidId = "";
    validatedRfidTelemetryId = "";

    // Test RFID communication
    byte v = rfidReader.PCD_ReadRegister(MFRC522::VersionReg);

    if (v == 0x00 || v == 0xFF) {
        Serial.println("[HW_FAULT] RC522 RFID reader not detected!");
        return false;
    }

    Serial.println("[HW_INIT] AccessControlManager initialized successfully.");
    return true;
}

String AccessControlManager::getUidString(byte *buffer, byte bufferSize) {
    String uidStr = "UID-";

    for (byte i = 0; i < bufferSize; i++) {
        if (buffer[i] < 0x10) {
            uidStr += "0";
        }

        uidStr += String(buffer[i], HEX);
    }

    uidStr.toUpperCase();
    return uidStr;
}

bool AccessControlManager::isAuthorizedCredential(
    const String &credentialType,
    const String &credentialId
) {
    for (size_t i = 0; i < AUTHORIZED_CREDENTIALS_COUNT; i++) {
        if (String(AUTHORIZED_CREDENTIALS[i].credentialType) == credentialType &&
            credentialId == String(AUTHORIZED_CREDENTIALS[i].credentialId)) {
            return true;
        }
    }

    return false;
}

bool AccessControlManager::pollCredentials(AuthAttempt &outAttempt) {

    // ============================================================
    // AUTH STAGE 1: RFID
    // ============================================================
    if (authStage == AUTH_STAGE_IDLE) {

        if (rfidReader.PICC_IsNewCardPresent() &&
            rfidReader.PICC_ReadCardSerial()) {

            String rawUid = getUidString(
                rfidReader.uid.uidByte,
                rfidReader.uid.size
            );

            Serial.printf("[RFID] Detected UID: %s\n", rawUid.c_str());

            rfidReader.PICC_HaltA();
            rfidReader.PCD_StopCrypto1();

            bool valid = isAuthorizedCredential("RFID", rawUid);

            if (!valid) {
                Serial.println("[MFA] RFID authentication failed.");

                outAttempt = {
                    rawUid,
                    "RFID-REDACTED",
                    "RFID",
                    false,
                    millis() / 1000
                };

                return true;
            }

            // Valid RFID: do NOT unlock.
            // Move to the second authentication factor.
            validatedRfidId = rawUid;
            validatedRfidTelemetryId = "RFID-REDACTED";
            authStage = AUTH_STAGE_WAITING_FOR_PIN;

            currentPinBuffer = "";
            lastKeypressTime = millis();

            Serial.println("[MFA] RFID authentication successful.");
            Serial.println("[MFA] Waiting for PIN...");

            // RFID success alone is not an access grant.
            // Return a non-granting authentication event so the
            // system can record the successful first factor.
            outAttempt = {
                rawUid,
                "RFID-REDACTED",
                "RFID",
                true,
                millis() / 1000
            };

            return true;
        }

        // A PIN cannot authenticate while the system is waiting
        // for the first factor.
        char key = keypad.getKey();

        if (key) {
            Serial.println("[MFA] PIN ignored: valid RFID required first.");

            if (key == '*') {
                currentPinBuffer = "";
            }

            return false;
        }

        return false;
    }

    // ============================================================
    // AUTH STAGE 2: PIN
    // ============================================================
    if (authStage == AUTH_STAGE_WAITING_FOR_PIN) {

        unsigned long now = millis();

        // Timeout waiting for PIN.
        if (now - lastKeypressTime > PIN_TIMEOUT_MS) {

            Serial.println("[MFA] PIN entry timeout. Authentication reset.");

            currentPinBuffer = "";
            validatedRfidId = "";
            validatedRfidTelemetryId = "";
            authStage = AUTH_STAGE_IDLE;

            return false;
        }

        char key = keypad.getKey();

        if (!key) {
            return false;
        }

        lastKeypressTime = now;

        if (key == '*') {
            currentPinBuffer = "";

            Serial.println("[MFA] PIN buffer cleared.");

            return false;
        }

        if (key == '#') {

            if (currentPinBuffer.length() == 0) {
                return false;
            }

            String pinId = "PIN-" + currentPinBuffer;
            currentPinBuffer = "";

            bool valid = isAuthorizedCredential("PIN", pinId);

            if (!valid) {

                Serial.println("[MFA] PIN authentication failed.");

                // Reset MFA sequence after failed second factor.
                validatedRfidId = "";
                validatedRfidTelemetryId = "";
                authStage = AUTH_STAGE_IDLE;

                // PIN is never transmitted.
                outAttempt = {
                    pinId,
                    "PIN-REDACTED",
                    "PIN",
                    false,
                    millis() / 1000
                };

                return true;
            }

            // Both factors are now valid.
            Serial.println("[MFA] PIN authentication successful.");
            Serial.println("[MFA] RFID + PIN authentication complete.");

            // The final successful authentication event is represented
            // as MFA so the main security state machine knows that
            // both factors have been validated.
            outAttempt = {
                validatedRfidId + "|" + pinId,
                "MFA-RFID+PIN",
                "MFA",
                true,
                millis() / 1000
            };

            validatedRfidId = "";
            validatedRfidTelemetryId = "";
            authStage = AUTH_STAGE_IDLE;

            return true;
        }

        // Accept numeric keypad input only.
        if (key >= '0' && key <= '9') {

            if (currentPinBuffer.length() < 8) {
                currentPinBuffer += key;
            }

            return false;
        }
    }

    return false;
}

void AccessControlManager::setLockState(bool unlocked) {
    unlockedState = unlocked;

    if (unlocked) {
        lockServo.write(SERVO_UNLOCKED_ANGLE);
    } else {
        lockServo.write(SERVO_LOCKED_ANGLE);
    }
}

bool AccessControlManager::isUnlocked() const {
    return unlockedState;
}