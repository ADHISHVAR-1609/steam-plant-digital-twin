export type OperatingMode = 'AUTO' | 'MANUAL'

export interface FeedTankState { volume: number; level_pct: number }
export interface PumpState { running: boolean; flow_rate: number; fault: boolean; power_kw: number }
export interface FilterState { health: number; effective_flow: number; blocked: boolean }
export interface BoilerState {
  water_volume: number; level_pct: number; pressure: number
  temperature: number; heater_power: number; relief_open: boolean; heater_fault: boolean
}
export interface SteamValveState { open: boolean; stuck: boolean; stuck_type: string }
export interface SteamEngineState { rpm: number; jammed: boolean; power_output: number }
export interface CondenserState { efficiency: number; condensate_flow: number }
export interface BatteryState { charge: number; voltage: number; current: number; depleted: boolean }

export interface AlarmEntry {
  id: string; message: string; severity: string; timestamp: number; active: boolean
}
export interface EventEntry { message: string; category: string; timestamp: number }
export interface TrendData {
  pressure: number[]; level: number[]; rpm: number[]; filter_health: number[]
}

export interface PlantState {
  tick: number; mode: OperatingMode; electrical_load: number
  feed_tank: FeedTankState; pump: PumpState; filter: FilterState
  boiler: BoilerState; steam_valve: SteamValveState; steam_engine: SteamEngineState
  condenser: CondenserState; battery: BatteryState
  faults: Record<string, boolean>; alarms: AlarmEntry[]; events: EventEntry[]
  trends: TrendData
}

export const DEFAULT_STATE: PlantState = {
  tick: 0, mode: 'AUTO', electrical_load: 30,
  feed_tank: { volume: 800, level_pct: 80 },
  pump: { running: false, flow_rate: 0, fault: false, power_kw: 0 },
  filter: { health: 100, effective_flow: 0, blocked: false },
  boiler: { water_volume: 300, level_pct: 60, pressure: 0, temperature: 20, heater_power: 50, relief_open: false, heater_fault: false },
  steam_valve: { open: false, stuck: false, stuck_type: '' },
  steam_engine: { rpm: 0, jammed: false, power_output: 0 },
  condenser: { efficiency: 95, condensate_flow: 0 },
  battery: { charge: 70, voltage: 24, current: 0, depleted: false },
  faults: {}, alarms: [], events: [],
  trends: { pressure: [], level: [], rpm: [], filter_health: [] },
}
