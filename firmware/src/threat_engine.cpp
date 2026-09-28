#include "threat_engine.h"

ThreatEngine::ThreatEngine()
    : failedAttempts(0),
      rapidAttempts(0),
      repeatedCredentialCount(0),
      lockoutHistoryCount(0),
      lastFailedAttemptTime(0),
      lastAttemptTime(0),
      lastCredentialId(""),
      currentScore(0),
      currentLevel(THREAT_LEVEL_NORMAL) {}

void ThreatEngine::pruneExpiredCounters(unsigned long now) {
    if (
        failedAttempts > 0 &&
        lastFailedAttemptTime > 0 &&
        (now - lastFailedAttemptTime > FAILURE_WINDOW_MS)
    ) {
        failedAttempts = 0;
        repeatedCredentialCount = 0;
        lastCredentialId = "";
    }

    if (
        rapidAttempts > 0 &&
        lastFailedAttemptTime > 0 &&
        (now - lastFailedAttemptTime > RAPID_ATTEMPT_WINDOW_MS)
    ) {
        rapidAttempts = 0;
    }

    if (
        lockoutHistoryCount > 0 &&
        lastAttemptTime > 0 &&
        (now - lastAttemptTime > LOCKOUT_HISTORY_WINDOW_MS)
    ) {
        lockoutHistoryCount = 0;
    }
}

void ThreatEngine::recalculateThreat(unsigned long now) {
    pruneExpiredCounters(now);

    const int calculatedScore =
        (failedAttempts * 20) +
        (rapidAttempts * 15) +
        (repeatedCredentialCount * 10) +
        (lockoutHistoryCount * 20);

    currentScore = constrain(calculatedScore, 0, 100);

    if (currentScore >= THREAT_THRESHOLD_CRITICAL) {
        currentLevel = THREAT_LEVEL_CRITICAL;
    }
    else if (currentScore >= THREAT_THRESHOLD_HIGH) {
        currentLevel = THREAT_LEVEL_HIGH;
    }
    else if (currentScore >= THREAT_THRESHOLD_ELEVATED) {
        currentLevel = THREAT_LEVEL_ELEVATED;
    }
    else {
        currentLevel = THREAT_LEVEL_NORMAL;
    }
}

void ThreatEngine::recordAttempt(
    const String &credentialId,
    bool isValid,
    unsigned long nowMillis
) {
    pruneExpiredCounters(nowMillis);

    if (
        !isValid &&
        lastFailedAttemptTime > 0 &&
        (nowMillis - lastFailedAttemptTime < RAPID_ATTEMPT_WINDOW_MS)
    ) {
        rapidAttempts++;
    }

    if (isValid) {
        if (failedAttempts > 0) {
            failedAttempts--;
        }
        repeatedCredentialCount = 0;
    }
    else {
        failedAttempts++;

        if (
            credentialId == lastCredentialId &&
            !credentialId.isEmpty()
        ) {
            repeatedCredentialCount++;
        }
        else {
            repeatedCredentialCount = 0;
        }

        lastCredentialId = credentialId;
        lastFailedAttemptTime = nowMillis;
    }

    lastAttemptTime = nowMillis;

    recalculateThreat(nowMillis);
}

void ThreatEngine::recordLockdown(unsigned long nowMillis) {
    if (lockoutHistoryCount < 5) {
        lockoutHistoryCount++;
    }

    lastAttemptTime = nowMillis;

    recalculateThreat(nowMillis);
}

void ThreatEngine::resetAfterLockdown(unsigned long nowMillis) {
    failedAttempts = 0;
    rapidAttempts = 0;
    repeatedCredentialCount = 0;

    lastFailedAttemptTime = 0;
    lastAttemptTime = nowMillis;
    lastCredentialId = "";

    recalculateThreat(nowMillis);
}

int ThreatEngine::getThreatScore() const {
    return currentScore;
}

ThreatLevel ThreatEngine::getThreatLevel() const {
    return currentLevel;
}

const char* ThreatEngine::getThreatLevelString() const {
    switch (currentLevel) {
        case THREAT_LEVEL_CRITICAL:
            return "CRITICAL";

        case THREAT_LEVEL_HIGH:
            return "HIGH";

        case THREAT_LEVEL_ELEVATED:
            return "ELEVATED";

        case THREAT_LEVEL_NORMAL:
        default:
            return "NORMAL";
    }
}
