#include "audio.h"

AudioManager::AudioManager(HardwareSerial &hwSerial)
    : serial(hwSerial), isInitialized(false) {}

bool AudioManager::begin() {
    // Initialize UART2 for DFPlayer Mini on PIN_DF_TX (16) and PIN_DF_RX (17)
    serial.begin(9600, SERIAL_8N1, PIN_DF_RX, PIN_DF_TX);

    // Disable ACK mode so an absent module can never block the security loop.
    if (dfPlayer.begin(serial, /*isACK = */false, /*doReset = */false)) {
        isInitialized = true;
        dfPlayer.volume(20);      // Set volume (0~30)
        Serial.println("[HW_INIT] DFPlayer Mini audio interface ready (non-blocking mode).");
        return true;
    } else {
        isInitialized = false;
        Serial.println("[AUDIO_WARN] DFPlayer unavailable. Continuing without audio.");
        return false;
    }
}

void AudioManager::playAccessGranted() {
    if (isInitialized) {
        dfPlayer.play(1); // 01.mp3
    }
}

void AudioManager::playAccessDenied() {
    if (isInitialized) {
        dfPlayer.play(2); // 02.mp3
    }
}

void AudioManager::playWarning() {
    if (isInitialized) {
        dfPlayer.play(3); // 03.mp3
    }
}

void AudioManager::playLockdown() {
    if (isInitialized) {
        dfPlayer.play(4); // 04.mp3
    }
}

void AudioManager::stop() {
    if (isInitialized) {
        dfPlayer.stop();
    }
}

bool AudioManager::isReady() const {
    return isInitialized;
}
