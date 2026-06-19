"""
Week-5 layer: Historian — SQLite time-series + alarm log
"""
import sqlite3
import time
import os

DB_PATH = os.getenv("HISTORIAN_DB", "historian.db")


def _conn() -> sqlite3.Connection:
    c = sqlite3.connect(DB_PATH)
    c.row_factory = sqlite3.Row
    return c


def init_db() -> None:
    with _conn() as c:
        c.execute("""
            CREATE TABLE IF NOT EXISTS process_data (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                ts          REAL NOT NULL,
                pressure    REAL,
                boiler_lvl  REAL,
                rpm         REAL,
                filter_hlth REAL,
                battery_chg REAL,
                heater_pwr  REAL,
                pump_run    INTEGER,
                valve_open  INTEGER,
                steam_pwr   REAL
            )
        """)
        c.execute("""
            CREATE TABLE IF NOT EXISTS alarm_log (
                id        INTEGER PRIMARY KEY AUTOINCREMENT,
                ts        REAL NOT NULL,
                alarm_id  TEXT NOT NULL,
                message   TEXT NOT NULL,
                severity  TEXT NOT NULL
            )
        """)
        c.execute("CREATE INDEX IF NOT EXISTS idx_pd_ts ON process_data(ts)")
        c.execute("CREATE INDEX IF NOT EXISTS idx_al_ts ON alarm_log(ts)")


class Historian:
    def __init__(self) -> None:
        init_db()
        self._tick = 0

    def record(self, state: dict) -> None:
        b = state["boiler"]
        with _conn() as c:
            c.execute("""
                INSERT INTO process_data
                    (ts, pressure, boiler_lvl, rpm, filter_hlth, battery_chg,
                     heater_pwr, pump_run, valve_open, steam_pwr)
                VALUES (?,?,?,?,?,?,?,?,?,?)
            """, (
                time.time(),
                b["pressure"], b["level_pct"],
                state["steam_engine"]["rpm"],
                state["filter"]["health"],
                state["battery"]["charge"],
                b["heater_power"],
                int(state["pump"]["running"]),
                int(state["steam_valve"]["open"]),
                state["steam_engine"]["power_output"],
            ))

        # Also log any new active alarms
        for alarm in state.get("alarms", []):
            if alarm.get("active"):
                with _conn() as c:
                    exists = c.execute(
                        "SELECT 1 FROM alarm_log WHERE alarm_id=? AND ts>?",
                        (alarm["id"], time.time() - 5)
                    ).fetchone()
                    if not exists:
                        c.execute(
                            "INSERT INTO alarm_log (ts, alarm_id, message, severity) VALUES (?,?,?,?)",
                            (alarm["timestamp"], alarm["id"], alarm["message"], alarm["severity"]),
                        )

    def query(self, limit: int = 200) -> list[dict]:
        with _conn() as c:
            rows = c.execute(
                "SELECT * FROM process_data ORDER BY ts DESC LIMIT ?", (limit,)
            ).fetchall()
        return [dict(r) for r in reversed(rows)]

    def get_alarm_log(self, limit: int = 100) -> list[dict]:
        with _conn() as c:
            rows = c.execute(
                "SELECT * FROM alarm_log ORDER BY ts DESC LIMIT ?", (limit,)
            ).fetchall()
        return [dict(r) for r in rows]

    def get_summary(self) -> dict:
        with _conn() as c:
            row = c.execute("""
                SELECT
                    COUNT(*)        AS total_samples,
                    MIN(ts)         AS first_ts,
                    MAX(ts)         AS last_ts,
                    AVG(pressure)   AS avg_pressure,
                    MAX(pressure)   AS max_pressure,
                    AVG(rpm)        AS avg_rpm
                FROM process_data
            """).fetchone()
        return dict(row) if row else {}
