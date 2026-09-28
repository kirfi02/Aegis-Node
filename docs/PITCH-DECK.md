# Aegis Node Pitch Deck

## Slide 1: Title

### Aegis Node

**Local-first edge security for physical spaces.**

An African-built access-control platform that keeps the critical security decision on the edge, even when the network is unavailable.

**Presenter:** [Your name]
**Team:** [Names]
**Event:** [Event name]

## Slide 2: The Problem

Many access-control systems depend on cloud services, stable internet, or expensive proprietary infrastructure.

When connectivity fails, operators may lose visibility or the ability to manage access. Small organizations also need systems that are affordable, locally maintainable, and appropriate for their environment.

**Problem statement:** How can a physical space remain secure and observable when connectivity is unreliable and the operator cannot depend on a cloud platform?

## Slide 3: The Solution

Aegis Node combines:

- RFID and keypad authentication
- Local credential validation
- Servo or electric-lock control
- Explainable threat scoring
- Local LED and audio feedback
- Optional local telemetry
- A self-hosted monitoring dashboard

The door-control decision remains on the ESP32. The web platform improves visibility but is not a dependency for the core security loop.

## Slide 4: How It Works

```text
Credential or sensor event
          ↓
ESP32 validates locally
          ↓
Access granted, denied, or lockdown
          ↓
Threat engine updates security state
          ↓
Optional telemetry to local gateway
          ↓
Dashboard displays live operations view
```

## Slide 5: Why It Is Different

Aegis Node is not only an IoT sensor, a web dashboard, or an AI label. It is a complete physical-to-digital system:

- Embedded control produces a real-world action.
- The security authority runs at the edge.
- The gateway and dashboard are self-hosted.
- The threat model is explainable and testable.
- The design is intended for local deployment and repair.

## Slide 6: Technology

### Edge

ESP32, Arduino framework, MFRC522, Keypad, ESP32Servo, DFPlayer Mini, ArduinoJson.

### Gateway

Node.js, Express, TypeScript, Zod validation, REST, WebSockets.

### Dashboard

React, Vite, TypeScript, Recharts, Lucide icons.

### Current data path

ESP32 → HTTP telemetry → Node.js gateway → WebSocket → React dashboard.

## Slide 7: Security and Sovereignty

The current system is sovereign in its operating model, not yet Sovereign AI:

- Access decisions are made locally.
- Internet is not required for physical security decisions.
- Raw credential validation remains on the device.
- Telemetry is optional.
- The gateway can run on local infrastructure.

The production roadmap adds secure provisioning, authenticated telemetry, persistent audit logs, tamper detection, signed updates, and anomaly detection based on real operational data.

## Slide 8: Target Users and Impact

### Initial target

Small offices, schools, laboratories, and technical facilities.

### Expected value

- Affordable local access control
- Better visibility into failed attempts
- Operation during connectivity outages
- Local ownership of security data
- Repairable and adaptable hardware
- A platform that can grow from one door to multiple nodes

## Slide 9: Business and Deployment Model

Start with a pilot rather than a broad commercial claim:

1. Install one node in a controlled location.
2. Measure reliability and user experience.
3. Harden security and hardware.
4. Deploy a small multi-node pilot.
5. Offer installation, maintenance, and software support.

Revenue can eventually combine hardware, installation, support, and optional managed monitoring.

## Slide 10: Roadmap

### Now

Validate hardware and restore the integrated Aegis firmware.

### Next

Build the secure MVP with persistent logs, provisioning, tamper detection, and reliable recovery.

### Then

Run a real pilot and collect evidence.

### Later

Add explainable anomaly detection and scale to multi-site deployments.

## Slide 11: Honest Status

Aegis Node is a working project progressing toward a deployable product. The current repository contains the firmware, gateway, and dashboard foundations. The temporary keypad test is being used to validate hardware wiring before the complete firmware entry point is re-enabled.

This distinction matters: reliability and security validation come before commercial claims.

## Slide 12: Closing

> Most systems treat the edge as a sensor. Aegis Node treats the edge as the security authority.

**Ask:** Support a pilot deployment, technical mentorship, hardware partnership, or access to a real test environment.

---

# 60-Second Pitch

Aegis Node is a local-first edge-security platform for protecting physical spaces. It uses an ESP32 to validate RFID cards and keypad PINs, control a lock, detect suspicious access patterns, and trigger lockdown locally. A self-hosted Node.js gateway collects optional telemetry, while a React dashboard provides live monitoring and event history. Unlike cloud-dependent access systems, Aegis Node keeps the critical security decision on the device, so it continues operating when connectivity is unavailable. We are turning the prototype into a deployable African security product through secure provisioning, persistent auditing, tamper detection, and a real-world pilot.

# Questions to Expect

### Is this AI?

The current threat engine is an explainable rule-based model, not machine learning. That is intentional for the first secure version. Anomaly detection can be added after collecting real site data and defining measurable use cases.

### What happens if the gateway fails?

The ESP32 continues local authentication, lock control, and lockdown behavior. The dashboard and telemetry are affected, but the physical security loop is not dependent on them.

### Why build your own dashboard?

A custom self-hosted dashboard provides control over data ownership, privacy, event visualization, and future security workflows without depending on a generic cloud IoT platform.

### What makes it African technology?

It is designed for local deployment, unreliable connectivity, repairability, affordable components, local data ownership, and real access-control needs. It is not merely a cloud service imported into a local context.

### What is the next proof point?

A reliable pilot installation with measured unlock latency, false rejection rate, outage behavior, power performance, and audit completeness.
