# Aegis Node Total Cost of Ownership

**Document status:** Planning estimate
**Currency:** Nigerian naira (NGN)
**Date:** 2026-09-16

## Important Assumptions

These are planning figures, not supplier quotations. Prices vary by supplier, import costs, board quality, exchange rate, shipping, and quantity. Replace every estimate with an invoice before making a commercial commitment.

The estimate covers a prototype/MVP access-control node and a small local pilot. It excludes rent, salaries, formal certification, taxes, internet subscription, legal fees, and the cost of a developer laptop.

## 1. One-Node MVP Estimate

| Item | Planning estimate (NGN) | Purpose |
|---|---:|---|
| ESP32 DevKit board | 15,000 | Edge controller |
| RC522 RFID reader and cards | 4,000 | Credential input |
| 4x4 matrix keypad | 4,000 | PIN input |
| Servo or electric lock actuator | 20,000 | Physical access control |
| RGB LED and basic indicators | 1,000 | Local status feedback |
| DFPlayer Mini and speaker | 6,000 | Audio feedback |
| Regulated power supply and protection | 12,000 | Safe power delivery |
| Enclosure, brackets, and mounting | 15,000 | Physical installation |
| Wiring, connectors, prototyping, and spares | 10,000 | Assembly and maintenance |
| Local gateway hardware allowance | 60,000 | Small local server or reused mini-PC allowance |
| Initial installation and testing allowance | 25,000 | Assembly, wiring, and commissioning |
| **Subtotal** | **172,000** | |
| **Contingency, 20%** | **34,400** | Price changes and replacement parts |
| **Estimated one-node total** | **206,400** | |

## 2. Three-Node Pilot Estimate

For a small pilot, the gateway can serve multiple nodes. The following estimate assumes three nodes and one shared gateway.

| Category | Estimate (NGN) |
|---|---:|
| Three node hardware and installation before contingency | 411,000 |
| Shared gateway allowance | 60,000 |
| **Pilot subtotal** | **471,000** |
| **Contingency, 20%** | **94,200** |
| **Estimated three-node pilot total** | **565,200** |

## 3. Recurring Ownership Costs

| Cost area | Current position | Production requirement |
|---|---|---|
| Internet/cloud hosting | Not required for core local operation | Optional remote monitoring service |
| Gateway hosting | Local gateway; software is open to self-hosting | Local server maintenance or managed hosting |
| Electricity | Site-dependent | Measure device and actuator consumption |
| Replacement hardware | Keep spare keypad, RFID reader, and actuator | Define spare-parts stock |
| Software maintenance | Firmware, gateway, and dashboard updates | Release process, backups, security patches |
| Support and installation | Not yet productized | Installation, training, and service plan |
| Data storage | Gateway currently uses memory | Persistent database and backup policy |

## 4. Cost-Reduction Strategy

- Start with one pilot site and one gateway.
- Prefer locally available ESP32 boards and standard connectors.
- Use a reused mini-PC or Raspberry Pi-class device for the local gateway where suitable.
- Separate the development kit from the production enclosure.
- Standardize the wiring harness and replacement parts.
- Do not include cloud subscription costs unless a customer genuinely needs remote access.

## 5. Commercial Pricing Framework

Do not set a final selling price from component cost alone. A commercial price must include:

```text
hardware + assembly + installation + software maintenance
+ warranty reserve + support + security updates + margin
```

A pilot price should be quoted only after the selected lock hardware, enclosure, installation requirements, warranty scope, and support expectations are known.

## 6. TCO Risks

The largest unknowns are actuator and enclosure choice, installation labor, power reliability, secure credential provisioning, gateway persistence, and after-sales support. These should be measured during the first pilot rather than hidden inside a low headline price.
