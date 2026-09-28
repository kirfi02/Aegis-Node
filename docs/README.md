# Aegis Node Documentation

This directory contains the product and exhibition documentation for Aegis Node.

## Documents

- [Technical Blueprint](BLUEPRINT.md): architecture, responsibilities, security model, reliability requirements, and product roadmap.
- [Total Cost of Ownership](TCO.md): Nigerian-naira planning estimate, pilot assumptions, recurring ownership costs, and commercial pricing framework.
- [Pitch Deck](PITCH-DECK.md): slide-by-slide competition narrative, 60-second pitch, and technical questions.
- [Exhibition Runbook](EXHIBITION-RUNBOOK.md): booth setup, three-minute demo flow, failure plan, and judge conversation guide.

## Current Project Status

The repository currently contains the ESP32 firmware foundation, Node.js gateway, and React dashboard. The firmware main entry point is temporarily disabled while the standalone keypad hardware test is used to validate wiring.

The documentation deliberately separates:

- **Implemented baseline:** local credential checks, deterministic threat scoring, optional telemetry, gateway validation, WebSocket updates, and dashboard monitoring.
- **Production roadmap:** secure provisioning, persistent audit logs, authenticated transport, tamper detection, signed updates, watchdog recovery, and field-pilot evidence.

Do not describe roadmap features as already implemented in a public presentation.
