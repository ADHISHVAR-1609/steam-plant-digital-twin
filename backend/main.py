"""
Steam Plant Digital Twin — FastAPI backend
Layers: PLC sim (W2) · MQTT pub (W3) · WebSocket HMI bridge (W4)
        Historian (W5) · Edge/ERP (W6) · AI agent (W7) · Fault injection (W8)
"""
import asyncio
import json
import os
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

from simulation.plant import PlantSimulator
from historian.db import Historian
from edge.gateway import EdgeGateway
from ai_agent.agent import AIAgent

# ---------------------------------------------------------------------------
# Globals
# ---------------------------------------------------------------------------
simulator = PlantSimulator()
historian = Historian()
edge_gw = EdgeGateway()
ai_agent = AIAgent()

clients: set[WebSocket] = set()
_edge_cache: dict = {}
mqtt_connected = False

# ---------------------------------------------------------------------------
# MQTT (Week 3) — optional, gracefully skipped if broker unavailable
# ---------------------------------------------------------------------------
try:
    import paho.mqtt.client as _mqtt_mod

    _mc = _mqtt_mod.Client(client_id="steam_boiler_backend")

    def _on_connect(client, userdata, flags, rc):
        global mqtt_connected
        mqtt_connected = rc == 0
        if rc == 0:
            print("[MQTT] connected to broker")

    def _on_disconnect(client, userdata, rc):
        global mqtt_connected
        mqtt_connected = False

    _mc.on_connect = _on_connect
    _mc.on_disconnect = _on_disconnect

    def _setup_mqtt() -> None:
        host = os.getenv("MQTT_HOST", "localhost")
        port = int(os.getenv("MQTT_PORT", "1883"))
        try:
            _mc.connect_async(host, port, 60)
            _mc.loop_start()
        except Exception as exc:
            print(f"[MQTT] broker unreachable ({exc}) — publishing disabled")

    def _publish_mqtt(state: dict) -> None:
        if not mqtt_connected:
            return
        base = "steam_boiler"
        tags = {
            f"{base}/boiler/pressure":       state["boiler"]["pressure"],
            f"{base}/boiler/level_pct":      state["boiler"]["level_pct"],
            f"{base}/boiler/temperature":    state["boiler"]["temperature"],
            f"{base}/boiler/heater_power":   state["boiler"]["heater_power"],
            f"{base}/pump/running":          int(state["pump"]["running"]),
            f"{base}/pump/flow_rate":        state["pump"]["flow_rate"],
            f"{base}/filter/health":         state["filter"]["health"],
            f"{base}/steam_engine/rpm":      state["steam_engine"]["rpm"],
            f"{base}/steam_engine/power_kw": state["steam_engine"]["power_output"],
            f"{base}/battery/charge":        state["battery"]["charge"],
            f"{base}/feed_tank/level_pct":   state["feed_tank"]["level_pct"],
        }
        for topic, value in tags.items():
            _mc.publish(topic, str(round(float(value), 3)), qos=0)

except Exception:
    # paho-mqtt not installed or import error — run without MQTT
    def _setup_mqtt() -> None:
        print("[MQTT] paho-mqtt unavailable — skipping MQTT layer")

    def _publish_mqtt(state: dict) -> None:
        pass

# ---------------------------------------------------------------------------
# Simulation loop
# ---------------------------------------------------------------------------
async def _simulation_loop() -> None:
    last = time.time()
    historian_ctr = 0
    mqtt_ctr = 0

    while True:
        now = time.time()
        dt = min(now - last, 0.1)
        last = now

        simulator.update(dt)
        state = simulator.get_state()

        # Historian: every ~2 s (4 ticks × 0.5 s)
        historian_ctr += 1
        if historian_ctr >= 4:
            historian.record(state)
            historian_ctr = 0

        # MQTT + edge: every ~1 s (2 ticks)
        mqtt_ctr += 1
        if mqtt_ctr >= 2:
            _publish_mqtt(state)
            global _edge_cache
            _edge_cache = edge_gw.process(state)
            mqtt_ctr = 0

        # Broadcast to connected HMI clients
        await _broadcast({"type": "state", "data": state})

        await asyncio.sleep(0.5)

async def _broadcast(message: dict) -> None:
    if not clients:
        return
    payload = json.dumps(message)
    dead: set[WebSocket] = set()
    for ws in list(clients):
        try:
            await ws.send_text(payload)
        except Exception:
            dead.add(ws)
    clients.difference_update(dead)

# ---------------------------------------------------------------------------
# App lifecycle
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    _setup_mqtt()
    task = asyncio.create_task(_simulation_loop())
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass

app = FastAPI(title="Steam Plant Digital Twin", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# WebSocket — HMI bridge (Week 4)
# ---------------------------------------------------------------------------
@app.websocket("/ws")
async def ws_endpoint(websocket: WebSocket) -> None:
    await websocket.accept()
    clients.add(websocket)
    # Send current state immediately on connect
    await websocket.send_text(json.dumps({"type": "state", "data": simulator.get_state()}))
    try:
        while True:
            raw = await websocket.receive_text()
            _handle_command(json.loads(raw))
    except WebSocketDisconnect:
        clients.discard(websocket)


def _handle_command(msg: dict) -> None:
    kind = msg.get("type")
    if kind == "control":
        action = msg.get("action")
        if action == "setMode":
            simulator.mode = msg["value"]
            simulator.events.append({
                "message": f"Mode changed to {msg['value']}",
                "category": "OPERATOR",
                "timestamp": time.time(),
            })
        elif action == "setManualValue":
            simulator.set_manual_value(msg["path"], msg["value"])
    elif kind == "fault":
        simulator.inject_fault(msg["faultId"])
    elif kind == "clearFaults":
        simulator.clear_faults()
    elif kind == "reset":
        simulator.reset()

# ---------------------------------------------------------------------------
# REST endpoints
# ---------------------------------------------------------------------------
@app.get("/api/historian")
async def get_historian(limit: int = 200):
    return historian.query(limit=limit)

@app.get("/api/historian/summary")
async def get_historian_summary():
    return historian.get_summary()

@app.get("/api/alarms")
async def get_alarms(limit: int = 100):
    return historian.get_alarm_log(limit=limit)

@app.get("/api/edge")
async def get_edge():
    return _edge_cache

@app.get("/api/erp/production")
async def get_erp():
    return edge_gw.get_erp_summary(simulator.get_state())

class ChatRequest(BaseModel):
    message: str

@app.post("/api/ai/chat")
async def ai_chat(req: ChatRequest):
    state = simulator.get_state()
    reply = await asyncio.to_thread(ai_agent.chat, req.message, state)
    return {"reply": reply, "timestamp": time.time()}

_DIST = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend", "dist"))
_FALLBACK = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "ui", "index.html"))

from fastapi.staticfiles import StaticFiles
from fastapi.responses import Response as _Response

if os.path.isdir(_DIST):
    app.mount("/assets", StaticFiles(directory=os.path.join(_DIST, "assets")), name="assets")

@app.get("/")
async def serve_hmi():
    if os.path.isdir(_DIST):
        path = os.path.join(_DIST, "index.html")
    else:
        path = _FALLBACK
    with open(path, "rb") as f:
        content = f.read()
    return _Response(
        content=content,
        media_type="text/html",
        headers={"Cache-Control": "no-store, no-cache, must-revalidate", "Pragma": "no-cache"},
    )

@app.get("/api/status")
async def status():
    return {
        "mqtt_connected": mqtt_connected,
        "ws_clients": len(clients),
        "tick": simulator.tick,
        "mode": simulator.mode,
    }
