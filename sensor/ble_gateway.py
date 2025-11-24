import asyncio
import os
from datetime import datetime

from bleak import BleakClient
import aiohttp

# ====== CONFIG ======
BLE_SENSOR_MAC = os.getenv("BLE_SENSOR_MAC", "AA:BB:CC:DD:EE:FF")  # sensor MAC
SERVICE_UUID = os.getenv("BLE_SERVICE_UUID", "ffffffff-ffff-ffff-ffff-fffffffffff0")
CHAR_UUID = os.getenv("BLE_CHAR_UUID", "ffffffff-ffff-ffff-ffff-fffffffffff1")

NODE_SERVER_URL = os.getenv("NODE_SERVER_URL", "http://localhost:3000/api/sensor-events")
# ====================


async def send_event_to_server(session, detected: bool, raw_bytes: bytes):
    payload = {
        "detected": detected,
        "timestamp": datetime.utcnow().isoformat(),
        "raw": list(raw_bytes),
    }

    try:
        async with session.post(NODE_SERVER_URL, json=payload) as resp:
            if resp.status != 200:
                print(f"[GW] Server responded with status {resp.status}")
    except Exception as e:
        print(f"[GW] Error sending event to server: {e}")


def interpret_detection(data: bytearray) -> bool:
    """Turn sensor bytes into True/False."""
    if not data:
        return False
    byte = data[0]
    return byte == 1


async def run_gateway():
    print("[GW] Starting BLE gateway...")
    print(f"[GW] Target MAC: {BLE_SENSOR_MAC}")

    async with aiohttp.ClientSession() as session:
        while True:
            try:
                print("[GW] Connecting to sensor...")
                async with BleakClient(BLE_SENSOR_MAC) as client:
                    if not client.is_connected:
                        print("[GW] Could not connect, retrying...")
                        await asyncio.sleep(5)
                        continue

                    print("[GW] Connected to sensor!")


                    async def notification_handler(sender: int, data: bytearray):
                        """Handle every notification from the sensor."""
                        detected = interpret_detection(data)
                        print(f"[GW] Notification: detected={detected}, raw={list(data)}")

                        # Fire-and-forget sending to Node
                        asyncio.create_task(
                            send_event_to_server(session, detected, bytes(data))
                        )

                    print(f"[GW] Subscribing to characteristic {CHAR_UUID}...")
                    await client.start_notify(CHAR_UUID, notification_handler)

                    print("[GW] Listening for notifications. Press Ctrl+C to stop.")
                    # Keep connection as long as possible
                    while True:
                        await asyncio.sleep(1)

            except Exception as e:
                print(f"[GW] Error: {e}")
                print("[GW] Reconnecting in 5 seconds...")
                await asyncio.sleep(5)


if __name__ == "__main__":
    try:
        asyncio.run(run_gateway())
    except KeyboardInterrupt:
        print("\n[GW] Stopped by user")
