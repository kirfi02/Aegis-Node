# Aegis Node Exhibition Runbook

## Objective

Demonstrate a complete, repeatable security workflow in under three minutes. The audience should see a physical access decision, a threat response, and the relationship between the device and the dashboard.

## Booth Message

> What happens when your security system loses the internet? Aegis Node still protects the door.

## Hardware Setup

- ESP32 node in a visible enclosure or mounted demonstration frame
- RFID reader with one authorized and one unauthorized card
- 4x4 keypad
- Servo or lock actuator connected to safe external power
- RGB LED
- Speaker and DFPlayer, if stable
- Laptop showing the dashboard
- Local gateway running on the laptop or a small local server
- Printed architecture diagram and QR code to the repository or project page
- Spare ESP32, cables, RFID card, power supply, and actuator

## Three-Minute Demonstration

### 0:00-0:30: Frame the problem

Explain that Aegis Node protects a physical entrance and keeps access decisions local instead of depending on a cloud platform.

### 0:30-1:00: Show authorized access

Present the authorized RFID card or enter the authorized PIN. Show the actuator unlocking, the green status, and the access-granted event on the dashboard.

### 1:00-1:45: Show detection and escalation

Use an invalid card or PIN several times. Show the threat score increasing and explain that the model is deterministic and inspectable.

### 1:45-2:15: Show lockdown

Trigger the critical threshold using the prepared test sequence. Show the lock remaining secured, warning LED/audio behavior, and lockdown event in the dashboard.

### 2:15-2:45: Show resilience

Stop the gateway or disconnect Wi-Fi only if this has been tested immediately before the event. Demonstrate that local credential and lock behavior continues. Do not improvise a live network failure with an untested setup.

### 2:45-3:00: Close

Say: "The dashboard gives operators visibility, but the ESP32 remains the security authority. Our next milestone is a secure field pilot with persistent audit logs, tamper detection, and measured reliability."

## Reliability Rules

- Use a tested power supply and common ground.
- Do not power a high-current actuator from the ESP32 3.3 V rail.
- Keep a known-good firmware image available.
- Keep a backup demo video and screenshots.
- Use an offline script if the gateway is unavailable.
- Avoid claiming features that are only roadmap items.
- Never expose real passwords, private Wi-Fi details, or production credentials in the demo.

## Judge Conversation Guide

### For embedded judges

Discuss GPIO safety, power isolation, watchdog behavior, actuator failure modes, boot straps, and local control.

### For web and cloud judges

Discuss REST ingestion, Zod validation, WebSocket streaming, dashboard state, and why the gateway is intentionally optional to the security loop.

### For AI judges

Explain that the current model is an explainable heuristic detector. Present machine-learning anomaly detection as a later step backed by pilot data, not as a feature that does not exist.

### For founders and investors

Discuss the initial customer, deployment cost, maintenance model, pilot evidence, and how the platform can scale from one door to multiple local nodes.

## Evidence to Collect Before Exhibition

- Successful authorized access count
- Invalid attempt and lockdown test results
- Average unlock response time
- Behavior during gateway outage
- Reboot recovery behavior
- Power and actuator observations
- Short video of the complete workflow
- Clear photos of the assembled hardware
