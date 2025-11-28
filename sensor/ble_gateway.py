import asyncio
import os
from datetime import datetime, timezone

import requests
from bleak import BleakScanner, AdvertisementData
from dotenv import load_dotenv

# -----------------------------------------------------------
# 1. Configuration
# -----------------------------------------------------------
load_dotenv("../.env")

TARGET_MAC = os.getenv("NIKO_PIR_MAC", "AA:BB:CC:DD:EE:FF").upper()

HEATBOT_SERVER_URL = os.getenv("SERVER_IP", "http://localhost:3000")
HEATBOT_EVENTS_ENDPOINT = os.getenv(
    "HEATBOT_EVENTS_ENDPOINT",
    "/api/sensor-events"
)
SENSOR_ID = os.getenv("HEATBOT_SENSOR_ID", "niko-pir-1")


# -----------------------------------------------------------
# 2. PIR decoding – bit 4 of byte 51
# -----------------------------------------------------------

def get_pir_bit_from_payload(payload: bytes) -> int | None:
    """
    Here we assume `payload` corresponds to the same byte sequence
    (e.g. manufacturer_data). We then:
      - check that we have at least 52 bytes
      - read byte index 51
      - extract bit 4 (Wireshark bit 4 = 5th MSB)

    Returns:
      1  -> PIR active
      0  -> PIR inactive
      None -> not enough data
    """
    if len(payload) <= 51:
        return None

    b = payload[51]


    pir_bit = (b >> 3) & 0x01
    return pir_bit


# -----------------------------------------------------------
# 3. HTTP helper
# -----------------------------------------------------------

def send_event_to_heatbot(mac: str, raw_hex: str) -> None:
    """
    Sends a JSON event to the HeatBot server when PIR bit is 1.
    """
    url = HEATBOT_SERVER_URL.rstrip("/") + HEATBOT_EVENTS_ENDPOINT

    payload = {
        "sensorId": SENSOR_ID,
        "mac": mac,
        "event": "MovementDetected",
        "raw": raw_hex,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }

    try:
        resp = requests.post(url, json=payload, timeout=2.0)
        resp.raise_for_status()
        print(f"[HeatBot] Movement sent -> {url}  status={resp.status_code}")
    except Exception as e:
        print(f"[HeatBot] Failed to send event: {e}")


# -----------------------------------------------------------
# 4. Scanner callback – advertisements only
# -----------------------------------------------------------

def detection_callback(device, adv_data: AdvertisementData):
    mac = device.address.upper()
    if mac != TARGET_MAC:
        return

    if not adv_data.manufacturer_data:
        return

    # Take first manufacturer payload (most devices only have one)
    _, payload = next(iter(adv_data.manufacturer_data.items()))

    pir_bit = get_pir_bit_from_payload(payload)
    if pir_bit is None:
        # Not enough bytes in payload to reach byte 51
        # Uncomment this for debugging:
        print(f"[Niko PIR] Payload too short ({len(payload)} bytes)")
        return

    raw_hex = payload.hex()

    if pir_bit == 1:
        # PIR = 1 → detection
        print(f"[Niko PIR] PIR=1 (movement)  MAC={mac}  raw={raw_hex}")
        send_event_to_heatbot(mac, raw_hex)
    else:
        # PIR = 0 → no detection (you can log if you want)
        # print(f"[Niko PIR] PIR=0 (no movement) MAC={mac}")
        pass


# -----------------------------------------------------------
# 5. Main
# -----------------------------------------------------------

async def main():
    print(f"Starting Niko PIR scanner for {TARGET_MAC} (bit 4 of byte 51)…")
    print(f"HeatBot endpoint: {HEATBOT_SERVER_URL.rstrip('/')}{HEATBOT_EVENTS_ENDPOINT}")
    scanner = BleakScanner(detection_callback)

    await scanner.start()
    print("Scanner started. Press Ctrl+C to stop.")

    try:
        while True:
            await asyncio.sleep(1.0)
    finally:
        await scanner.stop()
        print("Scanner stopped.")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nInterrupted by user.")
