# HeatBot – Server, Client & Sensor Gateway

HeatBot is composed of three main parts:

1. **Server (Node.js / Express / PostgreSQL)**
2. **Client (React + Vite)**
3. **Sensor Gateway (Python + Bleak)** – responsible for reading BLE sensor data and forwarding it to the server.

This guide explains how to install all dependencies and run every part of the system on Windows or Linux.

---

## 📦 Prerequisites

Before installing the project, make sure you have:

### ✔ Node.js (recommended: v18 or v20)
Download from:  
https://nodejs.org

### ✔ Docker Desktop
On Windows, Docker requires **WSL2**.

Install WSL first:

```powershell
wsl --install
```

Then install Docker Desktop:  
https://www.docker.com/products/docker-desktop/

### ✔ Python 3.9+
Required for the BLE Sensor Gateway.

Download:  
https://www.python.org/downloads/

Make sure to enable **“Add Python to PATH”** during installation.

---

# 🚀 Project Setup

Clone the repository:

```bash
git clone https://github.com/Tokushiro/heat-bot
cd HeatBot
```

---

## 1️⃣ Install Dependencies (Server + Client)

### **Server**
```bash
cd server
npm install
```

### **Client**
```bash
cd ../client
npm install
```

---

## 2️⃣ Environment Variables

Inside each service folder that contains an `.env.example`, create your `.env`:

```bash
cp .env.example .env
```

Fill the `.env` file with your local credentials  
(database connection, API URLs, etc.).

---

## 3️⃣ Running the System (Docker)

From the **project root**:

```bash
docker compose up --build
```

This will start:

- PostgreSQL database
- Node.js API backend
- React frontend

You can now visit the system in your browser (usually http://localhost:3000 or the port defined in docker-compose).

---

# 📡 Sensor Gateway (Python + BLE)

This service listens to a BLE sensor, receives detection events, and forwards them to the server.

## 4️⃣ Create Python Virtual Environment

Navigate to the `sensor` folder:

```bash
cd sensor
```

Create the venv:

```bash
python -m venv .venv
```

Activate it:

### Windows:
```powershell
.\.venv\Scripts\activate
```

### Linux / macOS:
```bash
source .venv/bin/activate
```

Install Python dependencies:

```bash
pip install -r requirements.txt
```

---

## 5️⃣ Running the BLE Gateway

After the virtual environment is active:

```bash
python ble_gateway.py
```

If the Bluetooth sensor is in range and the MAC address is correct, the gateway will:

- connect to the BLE device
- subscribe to notifications
- send detection events to the Node.js API

This process will automatically reconnect if the sensor disconnects.

---

# 🧪 Development Notes

- Use Node.js and Python locally only if you are actively developing the server/client or the sensor gateway logic outside of Docker.
- The gateway is intentionally isolated as a separate container so it can run on a Raspberry Pi later with minimal changes.
- Node.js exposes an endpoint for receiving BLE events.
- The gateway uses Bleak (async) and auto-reconnect logic.

---

# 🛠 Useful Commands

Stop all Docker containers:

```bash
docker compose down
```

Rebuild containers after changes:

```bash
docker compose up --build
```

Update Python dependencies:

```bash
pip install --upgrade -r requirements.txt
```

---

# 🤝 Contributors

- Oskar Andrzejewski
- (Add your teammates here)

---

# 📄 License

MIT License  
(or replace with your project license)
