import type { Hex } from './world-cell-contracts';

export interface WeatherEffects {
  visibilityMeters: number;
  travelFactor: number;
  perception: string;
  temperatureC: number;
  ambience: string[];
  combatNote: string;
}

export interface Weather {
  label: string;
  kind: 'clear' | 'clouds' | 'rain' | 'snow' | 'fog' | 'storm';
  intensity: number;
  windKmh: number;
  effects: WeatherEffects;
  source: string;
}

export interface WeatherPhenomenon {
  id: string;
  revision: number;
  mapId: string;
  name: string;
  kind: Weather['kind'];
  intensity: number;
  center: Hex;
  radiusHexes: number;
  movement: Hex;
  startMs: string;
  durationMs: string;
  state: 'active' | 'paused' | 'ended';
  pausedAtMs: string | null;
  temperatureC: number | null;
  travelFactor: number | null;
  notes: string;
}
