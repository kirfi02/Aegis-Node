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
      lastKeypressTime(0) {

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
    lockServo.setPeriodHertz(50); // Standard 50hz servo
    lockServo.attach(PIN_SERVO_PWM, 500, 2400);
    lockServo.write(SERVO_LOCKED_ANGLE);
    unlockedState = false;

    currentPinBuffer = "";
    lastKeypressTime = 0;

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
        if (buffer[i] < 0x10) uidStr += "0";
        uidStr += String(buffer[i], HEX);
    }
    uidStr.toUpperCase();
    return uidStr;
}

bool AccessControlManager::pollCredentials(AuthAttempt &outAttempt) {
    // 1. Check RFID Reader
    if (rfidReader.PICC_IsNewCardPresent() && rfidReader.PICC_ReadCardSerial()) {
        String rawUid = getUidString(rfidReader.uid.uidByte, rfidReader.uid.size);
        Serial.printf("[RFID] Detected UID: %s\n", rawUid.c_str());
        rfidReader.PICC_HaltA();
        rfidReader.PCD_StopCrypto1();

        // Check allowlist
        bool valid = false;
        for (size_t i = 0; i < AUTHORIZED_CREDENTIALS_COUNT; i++) {
            if (String(AUTHORIZED_CREDENTIALS[i].credentialType) == "RFID" &&
                rawUid == String(AUTHORIZED_CREDENTIALS[i].credentialId)) {
                valid = true;
                break;
            }
        }

        // Mask/Safe identifier for telemetry vs internal check
        // Rule: Sensitive credentials must never be transmitted raw. We send masked/safe ID.
        outAttempt = { rawUid, "PIN-REDACTED", "RFID", valid, millis() / 1000 };
        return true;
    }

    // 2. Check Keypad Matrix
    char key = keypad.getKey();
    if (key) {
        unsigned long now = millis();
        // Reset pin buffer if timeout exceeded
        if (currentPinBuffer.length() > 0 && (now - lastKeypressTime > PIN_TIMEOUT_MS)) {
            currentPinBuffer = "";
        }
        lastKeypressTime = now;

        if (key == '#') {
            // Submit PIN buffer
            if (currentPinBuffer.length() > 0) {
                String pinId = "PIN-" + currentPinBuffer;
                currentPinBuffer = "";

                bool valid = false;
                for (size_t i = 0; i < AUTHORIZED_CREDENTIALS_COUNT; i++) {
                    if (String(AUTHORIZED_CREDENTIALS[i].credentialType) == "PIN" &&
                        pinId == String(AUTHORIZED_CREDENTIALS[i].credentialId)) {
                        valid = true;
                        break;
                    }
                }

                // Rule: PIN is never transmitted. Telemetry receives "PIN-REDACTED".
                outAttempt = { pinId, "PIN-REDACTED", "PIN", valid, millis() / 1000 };
                return true;
            }
        } else if (key == '*') {
            // Clear PIN buffer
            currentPinBuffer = "";
        } else {
            // Append digit
            if (currentPinBuffer.length() < 8) {
                currentPinBuffer += key;
            }
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
