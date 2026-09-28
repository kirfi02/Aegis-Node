# Aegis Node - Local Gateway & Telemetry API

Node.js local gateway and telemetry API for the **Aegis Node** sovereign access control system.

---

## Architecture Flow

```
ESP32 (Edge Node) → HTTP POST /api/telemetry → Node.js Gateway → WebSocket (/ws) → React Dashboard
```

---

## Getting Started

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Default configuration:
```env
PORT=4000
HOST=0.0.0.0
DASHBOARD_ORIGIN=http://localhost:5173
```

### 3. Run Development Server
```bash
npm run dev
```

### 4. Production Build & Start
```bash
npm run build
npm run start
```

### 5. Type Checking
```bash
npm run typecheck
```

---

## API Endpoints

### `GET /api/health`
Returns gateway health status.
- **Response:**
  ```json
  {
    "status": "ok",
    "service": "aegis-gateway",
    "timestamp": "2026-09-15T12:00:00.000Z"
  }
  ```

### `GET /api/status`
Returns the latest known node state and recent event history.
- **Response:**
  ```json
  {
    "status": "success",
    "data": {
      "deviceId": "ESP32-SEC-01",
      "status": "ONLINE",
      "lastSeen": 1726400000000,
      "threatScore": 0,
      "threatLevel": "NORMAL",
      "lockState": "SECURED",
      "eventCount": 1,
      "recentEvents": [...]
    }
  }
  ```

### `POST /api/telemetry`
Receives and validates ESP32 telemetry payloads via Zod, updates in-memory state, and broadcasts via WebSocket.
- **Request Body Example:**
  ```json
  {
    "deviceId": "AEGIS-001",
    "timestamp": 1726400000,
    "event": "ACCESS_DENIED",
    "credentialType": "RFID",
    "credentialId": "UID-7F2A91",
    "threatScore": 40,
    "threatLevel": "ELEVATED",
    "lockState": "SECURED",
    "network": "LOCAL",
    "source": "ESP32"
  }
  ```

---

## WebSocket Interface

Connect via `ws://localhost:4000/ws`.
- Upon connection, receives an initial `SNAPSHOT` message containing current node state.
- Receives real-time `TELEMETRY` broadcast messages upon each valid `POST /api/telemetry` request.
