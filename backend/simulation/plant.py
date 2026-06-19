"""
Steam Boiler Plant Simulator — Python backend
Week 2 layer: field instrumentation + PLC closed-loop control
"""
import time
import math


class PlantSimulator:
    def __init__(self):
        self.mode = "AUTO"
        self.tick = 0
        self.electrical_load = 30.0  # 0-100 %

        # Equipment state dicts (serialise cleanly to JSON)
        self.feed_tank = {"volume": 800.0, "level_pct": 80.0}
        self.pump = {"running": False, "flow_rate": 0.0, "fault": False, "power_kw": 0.0}
        self.filter = {"health": 100.0, "effective_flow": 0.0, "blocked": False}
        self.boiler = {
            "water_volume": 300.0, "level_pct": 60.0,
            "pressure": 0.0, "temperature": 20.0,
            "heater_power": 50.0, "relief_open": False, "heater_fault": False,
        }
        self.steam_valve = {"open": False, "stuck": False, "stuck_type": ""}
        self.steam_engine = {"rpm": 0.0, "jammed": False, "power_output": 0.0}
        self.condenser = {"efficiency": 95.0, "condensate_flow": 0.0}
        self.battery = {
            "charge": 70.0, "voltage": 24.0, "current": 0.0, "depleted": False,
        }

        self.faults: dict[str, bool] = {}
        self.alarms: list[dict] = []
        self.events: list[dict] = []
        self._active_alarm_ids: set[str] = set()

        self._trend_pressure: list[float] = []
        self._trend_level: list[float] = []
        self._trend_rpm: list[float] = []
        self._trend_filter: list[float] = []

    # ------------------------------------------------------------------
    # Main update — called every simulation tick from the async loop
    # ------------------------------------------------------------------
    def update(self, dt: float) -> None:
        self.tick += 1
        if self.mode == "AUTO":
            self._plc_auto_control(dt)
        self._update_process(dt)
        self._check_alarms()
        self._capture_trends()

    # ------------------------------------------------------------------
    # Week-2 PLC: closed-loop auto control
    # ------------------------------------------------------------------
    def _plc_auto_control(self, dt: float) -> None:
        # Boiler level PID — simple bang-bang
        if self.boiler["level_pct"] < 50:
            self.pump["running"] = True
        elif self.boiler["level_pct"] > 80:
            self.pump["running"] = False

        # Pressure P-controller — trim heater power
        pressure = self.boiler["pressure"]
        target = 11.5  # bar setpoint
        error = target - pressure
        trim = min(5.0, max(-5.0, error * 3.0)) * dt
        self.boiler["heater_power"] = min(100.0, max(0.0, self.boiler["heater_power"] + trim))

        # Steam valve: auto open when pressure ≥ 10 bar
        if not self.steam_valve["stuck"]:
            self.steam_valve["open"] = pressure >= 10.0

    # ------------------------------------------------------------------
    # Process physics
    # ------------------------------------------------------------------
    def _update_process(self, dt: float) -> None:
        # --- Water path -----------------------------------------------
        pump_ok = self.pump["running"] and not self.pump["fault"]
        if pump_ok:
            self.pump["flow_rate"] = 40.0  # L/min
            self.pump["power_kw"] = 1.2
            drawn = 40.0 * dt / 60.0  # litres this tick
            self.feed_tank["volume"] = max(0.0, self.feed_tank["volume"] - drawn)
            # filter degrades with throughput
            self.filter["health"] = max(0.0, self.filter["health"] - drawn * 0.018)
            eff_frac = self.filter["health"] / 100.0
            effective = drawn * eff_frac
            self.filter["effective_flow"] = effective / dt if dt > 0 else 0.0
            self.boiler["water_volume"] = min(500.0, self.boiler["water_volume"] + effective)
        else:
            self.pump["flow_rate"] = 0.0
            self.pump["power_kw"] = 0.0
            self.filter["effective_flow"] = 0.0

        self.filter["blocked"] = self.filter["health"] < 15.0

        # --- Boiler heating -------------------------------------------
        if not self.boiler["heater_fault"]:
            heat = self.boiler["heater_power"] / 100.0 * 0.45 * dt  # bar/tick
            self.boiler["pressure"] = min(20.0, self.boiler["pressure"] + heat)
        self.boiler["temperature"] = 100.0 + self.boiler["pressure"] * 11.5

        # Natural heat loss
        self.boiler["pressure"] = max(0.0, self.boiler["pressure"] - 0.005 * dt)

        # --- Steam export ---------------------------------------------
        valve_open = self.steam_valve["open"]
        if self.steam_valve["stuck"]:
            valve_open = self.steam_valve["stuck_type"] == "open"

        steam_flow = 0.0
        if valve_open and self.boiler["pressure"] >= 8.0:
            steam_flow = (self.boiler["pressure"] - 8.0) * 0.38
            water_consumed = steam_flow * dt * 0.07
            self.boiler["water_volume"] = max(0.0, self.boiler["water_volume"] - water_consumed)
            pressure_drop = steam_flow * dt * 0.055
            self.boiler["pressure"] = max(0.0, self.boiler["pressure"] - pressure_drop)

        # --- Relief valve (overpressure) ------------------------------
        if self.boiler["pressure"] > 15.0:
            self.boiler["relief_open"] = True
            self.boiler["pressure"] = max(10.0, self.boiler["pressure"] - 0.9 * dt)
        else:
            self.boiler["relief_open"] = False

        # --- Steam engine ---------------------------------------------
        if self.steam_engine["jammed"]:
            target_rpm = 0.0
        else:
            target_rpm = steam_flow * 290.0
        alpha = min(1.0, 2.5 * dt)
        self.steam_engine["rpm"] += (target_rpm - self.steam_engine["rpm"]) * alpha
        self.steam_engine["rpm"] = max(0.0, self.steam_engine["rpm"])
        self.steam_engine["power_output"] = self.steam_engine["rpm"] / 3000.0 * 5.0  # kW

        # --- Condenser (condensate return) ---------------------------
        condensate = steam_flow * 0.055 * dt * (self.condenser["efficiency"] / 100.0)
        self.condenser["condensate_flow"] = condensate / dt if dt > 0 else 0.0
        self.feed_tank["volume"] = min(1000.0, self.feed_tank["volume"] + condensate)

        # --- Battery / electrical ------------------------------------
        power_in = self.steam_engine["power_output"]
        power_out = self.electrical_load / 100.0 * 5.0
        net_kw = power_in - power_out
        self.battery["charge"] = max(0.0, min(100.0, self.battery["charge"] + net_kw * dt * 0.38))
        self.battery["current"] = net_kw * 10.0
        self.battery["depleted"] = self.battery["charge"] < 5.0

        # --- Level recalculation -------------------------------------
        self.boiler["level_pct"] = self.boiler["water_volume"] / 500.0 * 100.0
        self.feed_tank["level_pct"] = self.feed_tank["volume"] / 1000.0 * 100.0

    # ------------------------------------------------------------------
    # Alarm generation
    # ------------------------------------------------------------------
    def _check_alarms(self) -> None:
        checks = [
            ("filter_degraded", self.filter["health"] < 25, "WARNING",
             "Filter degraded — health below 25 %"),
            ("filter_blocked", self.filter["health"] < 10, "CRITICAL",
             "Filter blocked — replace immediately"),
            ("boiler_low_water", self.boiler["level_pct"] < 15, "CRITICAL",
             "Boiler low water — risk of dry-fire"),
            ("overpressure", self.boiler["pressure"] > 15, "CRITICAL",
             "Boiler overpressure — relief valve open"),
            ("relief_open", self.boiler["relief_open"], "WARNING",
             "Pressure relief valve open"),
            ("pump_fault", self.pump["fault"], "CRITICAL",
             "Pump failure detected"),
            ("heater_fault", self.boiler["heater_fault"], "CRITICAL",
             "Heater failure detected"),
            ("engine_jam", self.steam_engine["jammed"], "CRITICAL",
             "Steam engine jam"),
            ("battery_low", self.battery["depleted"], "WARNING",
             "Battery charge critical (< 5 %)"),
            ("feed_tank_low", self.feed_tank["level_pct"] < 10, "WARNING",
             "Feed tank level low"),
        ]

        now = time.time()
        current_ids: set[str] = set()
        for alarm_id, condition, severity, message in checks:
            if condition:
                current_ids.add(alarm_id)
                if alarm_id not in self._active_alarm_ids:
                    self._active_alarm_ids.add(alarm_id)
                    self.alarms.append({
                        "id": alarm_id, "message": message,
                        "severity": severity, "timestamp": now, "active": True,
                    })
                    self._log_event(f"ALARM: {message}", "ALARM")

        cleared = self._active_alarm_ids - current_ids
        for alarm_id in cleared:
            self._active_alarm_ids.discard(alarm_id)
            self._log_event(f"CLEARED: {alarm_id.replace('_', ' ')}", "PROCESS")

        self.alarms = self.alarms[-60:]
        self.events = self.events[-120:]

    def _log_event(self, message: str, category: str) -> None:
        self.events.append({"message": message, "category": category, "timestamp": time.time()})

    def _capture_trends(self) -> None:
        max_pts = 200
        self._trend_pressure.append(round(self.boiler["pressure"], 3))
        self._trend_level.append(round(self.boiler["level_pct"], 2))
        self._trend_rpm.append(round(self.steam_engine["rpm"], 1))
        self._trend_filter.append(round(self.filter["health"], 2))
        if len(self._trend_pressure) > max_pts:
            self._trend_pressure = self._trend_pressure[-max_pts:]
            self._trend_level = self._trend_level[-max_pts:]
            self._trend_rpm = self._trend_rpm[-max_pts:]
            self._trend_filter = self._trend_filter[-max_pts:]

    # ------------------------------------------------------------------
    # Control API
    # ------------------------------------------------------------------
    def set_manual_value(self, path: str, value) -> None:
        parts = path.split(".")
        try:
            if parts[0] == "pump" and parts[1] == "running":
                self.pump["running"] = bool(value)
            elif parts[0] == "steam_valve" and parts[1] == "open":
                if not self.steam_valve["stuck"]:
                    self.steam_valve["open"] = bool(value)
            elif parts[0] == "boiler" and parts[1] == "heater_power":
                self.boiler["heater_power"] = float(min(100, max(0, value)))
            elif parts[0] == "electrical_load":
                self.electrical_load = float(min(100, max(0, value)))
        except Exception:
            pass
        self._log_event(f"Manual: {path} = {value}", "OPERATOR")

    def inject_fault(self, fault_id: str) -> None:
        self.faults[fault_id] = True
        if fault_id == "pump_failure":
            self.pump["fault"] = True
            self.pump["running"] = False
        elif fault_id == "heater_failure":
            self.boiler["heater_fault"] = True
        elif fault_id == "engine_jam":
            self.steam_engine["jammed"] = True
        elif fault_id == "valve_stuck_open":
            self.steam_valve["stuck"] = True
            self.steam_valve["stuck_type"] = "open"
            self.steam_valve["open"] = True
        elif fault_id == "valve_stuck_closed":
            self.steam_valve["stuck"] = True
            self.steam_valve["stuck_type"] = "closed"
            self.steam_valve["open"] = False
        elif fault_id == "filter_blocked":
            self.filter["health"] = 5.0
        self._log_event(f"FAULT INJECTED: {fault_id}", "FAULT")

    def clear_faults(self) -> None:
        self.faults.clear()
        self.pump["fault"] = False
        self.boiler["heater_fault"] = False
        self.steam_engine["jammed"] = False
        self.steam_valve["stuck"] = False
        self.steam_valve["stuck_type"] = ""
        self._active_alarm_ids.clear()
        self._log_event("All faults cleared by operator", "OPERATOR")

    def reset(self) -> None:
        self.__init__()

    # ------------------------------------------------------------------
    # Snapshot for WebSocket / historian
    # ------------------------------------------------------------------
    def get_state(self) -> dict:
        return {
            "tick": self.tick,
            "mode": self.mode,
            "electrical_load": self.electrical_load,
            "feed_tank": dict(self.feed_tank),
            "pump": dict(self.pump),
            "filter": dict(self.filter),
            "boiler": dict(self.boiler),
            "steam_valve": dict(self.steam_valve),
            "steam_engine": dict(self.steam_engine),
            "condenser": dict(self.condenser),
            "battery": dict(self.battery),
            "faults": dict(self.faults),
            "alarms": list(self.alarms[-15:]),
            "events": list(self.events[-30:]),
            "trends": {
                "pressure": list(self._trend_pressure[-100:]),
                "level": list(self._trend_level[-100:]),
                "rpm": list(self._trend_rpm[-100:]),
                "filter_health": list(self._trend_filter[-100:]),
            },
        }
