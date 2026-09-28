#ifndef AUDIO_H
#define AUDIO_H

#include <Arduino.h>
#include <HardwareSerial.h>
#include <DFRobotDFPlayerMini.h>
#include "pins.h"

class AudioManager {
private:
    HardwareSerial &serial;
    DFRobotDFPlayerMini dfPlayer;
    bool isInitialized;

public:
    AudioManager(HardwareSerial &hwSerial);

    bool begin();

    // Configured tracks:
    // 01.mp3 = access granted
    // 02.mp3 = access denied
    // 03.mp3 = warning (elevated / high threat)
    // 04.mp3 = lockdown (critical threat)
    void playAccessGranted();
    void playAccessDenied();
    void playWarning();
    void playLockdown();
    
    void stop();
    bool isReady() const;
};

#endif // AUDIO_H
