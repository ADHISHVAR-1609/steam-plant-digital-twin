"""
Week-7 layer: LLM-based AI operator assistant (Claude)
"""
import os
import anthropic


SYSTEM_PROMPT = """You are an expert steam plant operator assistant embedded in an industrial HMI.
Your role is to help operators understand plant status, diagnose faults, and recommend actions.
Be concise, technical, and safety-focused. Use bar, L/min, kW, and % as units.
When alarms are active always address them first. Keep responses under 120 words."""


class AIAgent:
    def __init__(self) -> None:
        api_key = os.getenv("ANTHROPIC_API_KEY", "")
        self.client = anthropic.Anthropic(api_key=api_key) if api_key else None
        self.history: list[dict] = []

    def _build_context(self, state: dict) -> str:
        b = state["boiler"]
        alarms = [a["message"] for a in state.get("alarms", []) if a.get("active")]
        faults = list(state.get("faults", {}).keys())
        return (
            f"[Plant snapshot]\n"
            f"Mode: {state['mode']}  |  Tick: {state['tick']}\n"
            f"Boiler: {b['pressure']:.1f} bar  {b['level_pct']:.0f}% level  "
            f"{b['temperature']:.0f}°C  heater {b['heater_power']:.0f}%\n"
            f"Pump: {'ON' if state['pump']['running'] else 'OFF'}  "
            f"flow {state['pump']['flow_rate']:.0f} L/min\n"
            f"Filter health: {state['filter']['health']:.0f}%\n"
            f"Steam engine: {state['steam_engine']['rpm']:.0f} RPM  "
            f"{state['steam_engine']['power_output']:.2f} kW\n"
            f"Battery: {state['battery']['charge']:.0f}%  "
            f"load {state['electrical_load']:.0f}%\n"
            f"Active alarms: {alarms or 'None'}\n"
            f"Active faults: {faults or 'None'}\n"
        )

    def chat(self, user_message: str, state: dict) -> str:
        if not self.client:
            return (
                "AI agent offline — set ANTHROPIC_API_KEY in your .env file to enable. "
                "Current state: pressure %.1f bar, level %.0f%%, RPM %.0f."
            ) % (
                state["boiler"]["pressure"],
                state["boiler"]["level_pct"],
                state["steam_engine"]["rpm"],
            )

        context = self._build_context(state)
        self.history.append({
            "role": "user",
            "content": f"{context}\nOperator: {user_message}",
        })

        response = self.client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=256,
            system=SYSTEM_PROMPT,
            messages=self.history[-12:],
        )
        reply = response.content[0].text
        self.history.append({"role": "assistant", "content": reply})
        # cap history
        self.history = self.history[-24:]
        return reply
