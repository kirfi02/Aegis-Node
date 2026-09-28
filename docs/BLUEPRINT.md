# Aegis Node Technical Blueprint

**Document status:** Product blueprint and exhibition reference
**Version:** 0.1
**Date:** 2026-09-16

## 1. Product Definition

Aegis Node is a local-first edge-security platform for controlling and monitoring access to physical spaces. An ESP32 performs the security-critical work locally: credential validation, lock control, threat scoring, and lockdown response. A self-hosted gateway and web dashboard provide telemetry, audit visibility, and operations monitoring.

The central product promise is:

> Protect the physical space locally, even when the network or dashboard is unavailable.

The first target market should be small offices, schools, laboratories, and technical facilities that need affordable access control without depending entirely on a cloud service.

## 2. Design Principles

1. **Local authority:** The ESP32 is authoritative for access and lockdown decisions.
2. **Graceful degradation:** Gateway or Wi-Fi failure must not disable physical security.
3. **Explainability:** Threat decisions must be inspectable and reproducible.
4. **Privacy:** Raw credentials remain local and are not sent as telemetry.
5. **Repairability:** Hardware should use available components and be serviceable locally.
6. **Evidence over claims:** The system must distinguish implemented features from roadmap features.

## 3. System Architecture

```text
RFID reader      Keypad       Door/tamper sensors
     \             |                 /
      \            |                /
       +------ ESP32 edge controller ------+
       | credential validation              |
       | threat engine                      |
       | lock/servo control                 |
       | LED/audio response                 |
       | offline operation                  |
       +------------------+-----------------+
                          |
                 Optional local Wi-Fi
                          |
                   Node.js gateway
        REST telemetry | validation | WebSocket
                          |
                    React dashboard
             live status | events | charts
```

## 4. Component Responsibilities

### ESP32 firmware

Current firmware modules include:

- `access_control.cpp`: RFID and keypad input, local allowlist checks, servo lock state.
- `threat_engine.cpp`: bounded counters for failures, rapid attempts, repeated credentials, and lockdown history.
- `telemetry.cpp`: optional local HTTP telemetry delivery.
- `audio.cpp`: DFPlayer feedback.
- `config.h`: device configuration, thresholds, and current credential allowlist.

Current threat thresholds are `30` for elevated, `60` for high, and `80` for critical. The current model is a deterministic heuristic, not machine learning.

### Gateway

The Node.js gateway currently provides:

- `GET /api/health`
- `GET /api/status`
- `POST /api/telemetry`
- WebSocket streaming at `/ws`
- Zod payload validation
- In-memory current state and recent events

Production target additions are persistent storage, device authentication, role-based administration, encrypted transport, rate limiting, and audit-log export.

### Dashboard

The React dashboard currently displays gateway status, node status, threat score, threat level, lock state, event counts, recent telemetry, and a threat chart. It is an operations view, not the security authority.

## 5. Security Model

### Current baseline

- RFID and PIN validation occur on the ESP32.
- The current allowlist is compiled into firmware.
- Telemetry is optional and skipped when Wi-Fi is unavailable.
- The threat engine raises scores for failed, rapid, and repeated attempts.

### Production requirements

Before commercial deployment, implement:

- Secure credential provisioning instead of hard-coded credentials.
- Credential hashing or protected storage appropriate to the device.
- Authenticated device-to-gateway communication.
- TLS or a documented protected local-network alternative.
- Tamper input and door-state sensing.
- Persistent, tamper-evident audit logs.
- Signed firmware updates and rollback.
- Watchdog recovery and safe boot behavior.
- Manual emergency override and documented fail-safe behavior.

## 6. Reliability and Safety Requirements

The product must be tested against Wi-Fi loss, gateway shutdown, power interruption, reboot, invalid credentials, repeated attacks, actuator failure, sensor disconnection, and malformed telemetry. High-current locks and servos must use an external supply with a common ground; they must not be powered from the ESP32 3.3 V rail.

The installation must define whether the physical lock is fail-safe or fail-secure, how emergency exit works, and what happens during power loss. These are deployment decisions, not merely software settings.

## 7. Product Roadmap

### Milestone 1: Hardware validation

Verify keypad wiring, RFID reads, lock movement, LED states, audio feedback, power stability, and serial diagnostics.

### Milestone 2: Integrated MVP

Restore the main firmware entry point, validate the complete offline access flow, connect the gateway, and demonstrate the dashboard with real events.

### Milestone 3: Secure MVP

Add secure provisioning, persistent logs, tamper detection, authenticated telemetry, watchdog handling, and update recovery.

### Milestone 4: Field pilot

Deploy one unit in a real controlled location. Measure unlock response time, false rejection rate, power behavior, network failure behavior, maintenance effort, and user experience.

### Milestone 5: Intelligent security

Use pilot data to add explainable anomaly detection for unusual access times, rapid attempts, unfamiliar credential patterns, tampering, and forced-entry signals.

## 8. Current Positioning

The accurate current description is:

> Aegis Node is an African-built sovereign edge-security platform progressing from a working prototype toward a deployable local-first access-control product.

It should not currently be marketed as Sovereign AI or machine learning. Its sovereignty comes from local control, local deployment, data ownership, and independence from cloud access. AI can be added later where real operational data proves it is useful.
