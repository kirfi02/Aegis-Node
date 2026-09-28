#ifndef THREAT_ENGINE_H
#define THREAT_ENGINE_H

#include <Arduino.h>
#include "config.h"

enum ThreatLevel {
    THREAT_LEVEL_NORMAL,
    THREAT_LEVEL_ELEVATED,
    THREAT_LEVEL_HIGH,
    THREAT_LEVEL_CRITICAL
};

class ThreatEngine {
private:
    int failedAttempts;
    int rapidAttempts;
    int repeatedCredentialCount;
    int lockoutHistoryCount;

    unsigned long lastFailedAttemptTime;
    unsigned long lastAttemptTime;
    String lastCredentialId;

    int currentScore;
    ThreatLevel currentLevel;

    void pruneExpiredCounters(unsigned long now);
    void recalculateThreat(unsigned long now);

public:
    ThreatEngine();

    void recordAttempt(
        const String &credentialId,
        bool isValid,
        unsigned long nowMillis
    );

    // Called only when the system actually enters lockdown.
    void recordLockdown(unsigned long nowMillis);

    // Clears expired/temporary state after lockdown cooldown.
    void resetAfterLockdown(unsigned long nowMillis);

    int getThreatScore() const;
    ThreatLevel getThreatLevel() const;
    const char* getThreatLevelString() const;
};

#endif // THREAT_ENGINE_H
