"""
Week-6 layer: Edge gateway + ERP stub
Performs lightweight on-edge aggregation and exposes a mock ERP endpoint.
"""
import time
from collections import deque


class EdgeGateway:
    """Aggregates process data at the edge and interfaces with the ERP stub."""

    def __init__(self) -> None:
        self._pressure_buf: deque[float] = deque(maxlen=120)  # 1-min rolling window
        self._rpm_buf: deque[float] = deque(maxlen=120)
        self._power_buf: deque[float] = deque(maxlen=120)
        self._shift_energy_kwh = 0.0
        self._last_ts = time.time()
        self._edge_alerts: list[dict] = []

    def process(self, state: dict) -> dict:
        now = time.time()
        dt = now - self._last_ts
        self._last_ts = now

        pressure = state["boiler"]["pressure"]
        rpm = state["steam_engine"]["rpm"]
        power_kw = state["steam_engine"]["power_output"]

        self._pressure_buf.append(pressure)
        self._rpm_buf.append(rpm)
        self._power_buf.append(power_kw)

        # Accumulate energy produced this session
        self._shift_energy_kwh += power_kw * dt / 3600.0

        # Edge anomaly detection — flag sustained high pressure
        avg_p = sum(self._pressure_buf) / max(1, len(self._pressure_buf))
        edge_alert = avg_p > 13.5

        if edge_alert:
            self._edge_alerts.append({
                "ts": now,
                "type": "HIGH_PRESSURE",
                "value": round(avg_p, 2),
                "message": f"1-min avg pressure {avg_p:.2f} bar — approaching relief threshold",
            })
            self._edge_alerts = self._edge_alerts[-20:]

        return {
            "avg_pressure_1min": round(avg_p, 3),
            "avg_rpm_1min": round(sum(self._rpm_buf) / max(1, len(self._rpm_buf)), 1),
            "edge_alert": edge_alert,
            "shift_energy_kwh": round(self._shift_energy_kwh, 4),
            "alerts": list(self._edge_alerts[-5:]),
        }

    def get_erp_summary(self, state: dict) -> dict:
        """Mock ERP endpoint — production KPIs that an ERP system would consume."""
        avg_p = sum(self._pressure_buf) / max(1, len(self._pressure_buf)) if self._pressure_buf else 0
        efficiency = min(100.0, (state["steam_engine"]["rpm"] / 3000.0) * 100.0)
        return {
            "erp_system": "SAP S/4HANA (stub)",
            "plant": "Steam Plant A1",
            "shift": "Day",
            "production": {
                "energy_kwh": round(self._shift_energy_kwh, 3),
                "avg_pressure_bar": round(avg_p, 2),
                "plant_efficiency_pct": round(efficiency, 1),
                "uptime_pct": 99.1,
            },
            "maintenance": {
                "filter_health_pct": round(state["filter"]["health"], 1),
                "filter_replace_due": state["filter"]["health"] < 30,
                "active_faults": list(state["faults"].keys()),
            },
            "alarms_last_hour": len(state.get("alarms", [])),
            "timestamp": time.time(),
        }
