#ifndef PINS_H
#define PINS_H

// ==========================================
// ESP32 DEVKIT V1 (30-PIN) SAFE GPIO MAPPING
// ==========================================
// CRITICAL: GPIO 6-11 are RESERVED for internal flash/PSRAM. DO NOT USE.
//
// BOOT STRAPPING PINS CONSIDERATION:
// - GPIO 0: Must be HIGH during boot (pulled up externally or internally).
// - GPIO 2: Must be LOW or floating during boot (connected to onboard LED).
// - GPIO 5: Must be HIGH during boot (Strapping pin for SDIO / VDD_SDIO).
// - GPIO 12: MTDI strapping pin. Must be LOW during boot to select 3.3V VDD_SDIO. 
//            (Ensure external pull-down if connected to active-high circuitry).
// - GPIO 15: MTDO strapping pin. Must be HIGH during boot (enables debug logging).

// 1. RC522 RFID Reader (SPI Bus)
const uint8_t PIN_RFID_SS   = 5;   // GPIO 5 (Boot strapping: Ensure HIGH on boot)
const uint8_t PIN_RFID_SCK  = 18;  // VSPI Clock
const uint8_t PIN_RFID_MOSI = 23;  // VSPI Master Out Slave In
const uint8_t PIN_RFID_MISO = 19;  // VSPI Master In Slave Out
const uint8_t PIN_RFID_RST  = 22;  // GPIO 22

// 2. 3x4 Membrane Keypad Matrix
const uint8_t PIN_KP_R1 = 13;  // Row 1
const uint8_t PIN_KP_R2 = 12;  // Row 2
const uint8_t PIN_KP_R3 = 14;  // Row 3
const uint8_t PIN_KP_R4 = 27;  // Row 4

const uint8_t PIN_KP_C1 = 26;  // Column 1
const uint8_t PIN_KP_C2 = 25;  // Column 2
const uint8_t PIN_KP_C3 = 33;  // Column 3

// 3. Actuator (Solenoid Lock / Servo Motor)
const uint8_t PIN_SERVO_PWM = 4;   // GPIO 4

// 4. Status RGB LED
const uint8_t PIN_RGB_R = 15;  // GPIO 15 (BOOT STRAPPING: GPIO 15 must be HIGH at boot)
const uint8_t PIN_RGB_G = 2;   // GPIO 2  (BOOT STRAPPING: GPIO 2 must be LOW at boot)
const uint8_t PIN_RGB_B = 21;  // GPIO 21

// 5. DFPlayer Mini Audio Module (UART2)
const uint8_t PIN_DF_TX = 16;  // ESP32 TX2 -> DFPlayer RX
const uint8_t PIN_DF_RX = 17;  // ESP32 RX2 <- DFPlayer TX (use 1k resistor divider)

#endif // PINS_H
