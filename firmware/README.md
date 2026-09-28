# AEGIS NODE // SOVEREIGN ACCESS CONTROL FIRMWARE v4.2

Production-grade C++ Arduino firmware for the **ESP32 DevKit V1 (30-pin)** edge-AI sovereign access control node.

---

## Hardware Architecture & GPIO Pinout

> **CRITICAL BOOT & HARDWARE WARNINGS:**
> - **GPIO 6–11** are strictly reserved for internal flash and PSRAM. **Never use them.**
> - **Internet connectivity is NOT required for physical security decisions.** The ESP32 is the sole security authority; Wi-Fi/gateway failure never blocks access control or lockdown.
> - **Explainable Heuristic Model:** The threat engine is an explainable windowed deterministic heuristic model, **not** a machine learning model.

### Safe GPIO Map

| Peripheral | Component | ESP32 Pin | Boot-Strapping Considerations |
| :--- | :--- | :--- | :--- |
| **SPI (RFID)** | RC522 SDA (SS) | **GPIO 5** | Must be HIGH during boot (Strapping pin for VDD_SDIO). |
| | RC522 SCK | **GPIO 18** | VSPI Clock (Safe). |
| | RC522 MOSI | **GPIO 23** | VSPI Master Out Slave In (Safe). |
| | RC522 MISO | **GPIO 19** | VSPI Master In Slave Out (Safe). |
| | RC522 RST | **GPIO 22** | Hardware Reset (Safe). |
| **Keypad (4x4)**| Rows (R1-R4) | **GPIO 32, 33, 25, 26** | Digital I/O (Safe). |
| | Columns (C1-C4)| **GPIO 27, 14, 12, 13** | **GPIO 12 must be LOW at boot** (MTDI strapping pin). |
| **Actuator** | Servo PWM | **GPIO 4** | PWM signal to door solenoid / servo (Safe). |
| **RGB LED** | Red, Green, Blue| **GPIO 15, 2, 21** | **GPIO 15 must be HIGH**, **GPIO 2 must be LOW/floating** at boot. |
| **Audio** | DFPlayer TX/RX | **GPIO 16, 17** | UART2 TX/RX (Safe). |

---

## Power Requirements & Actuator Warning

- **Do NOT power MG996R servos, heavy solenoids, or sirens from the ESP32 3.3V rail.** 
- Power high-current actuators from an external 5V/12V power supply with a **common ground** connected to the ESP32 GND.

---

## Required Arduino Libraries

1. **`MFRC522`** (RC522 RFID reader)
2. **`Keypad`** (4x4 matrix keypad)
3. **`ESP32Servo`** (Servo motor PWM control)
4. **`DFRobotDFPlayerMini`** (Audio feedback)
5. **`ArduinoJson`** (Telemetry JSON serialization)

---

## DFPlayer SD Card Structure

Format a MicroSD card to FAT32 and place audio files in root:
- `01.mp3` = Access Granted
- `02.mp3` = Access Denied
- `03.mp3` = Warning / Elevated Threat
- `04.mp3` = Lockdown Alert

---

## Flashing & Demo Procedure

1. Open `firmware/aegis-node.ino` in Arduino IDE or PlatformIO.
2. Select **ESP32 Dev Module**.
3. Configure Wi-Fi SSID, password, and gateway IP in `config.h`.
4. Flash firmware via USB.
5. Trigger valid RFID card or PIN sequence to unlock.
6. Trigger repeated invalid attempts (>80 threat score) to test **LOCKDOWN** state and siren.
