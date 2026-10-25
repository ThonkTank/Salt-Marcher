import type { DungeonTrace, DungeonTraceRules } from './dungeon-contracts';
export const trackSurfaces = ['stone', 'mud', 'sand', 'snow', 'water', 'vegetation'] as const;
export const movementModes = ['walk', 'sneak', 'run', 'crawl', 'swim', 'fly'] as const;
export function defaultTraceRules(): DungeonTraceRules {
  return {
    generate: true,
    movement: 'walk',
    surface: 'auto',
    environment: 'dry',
    strength: 100,
    dcOverride: null,
    lifetimeSeconds: null,
    decayPerHour: null,
    skill: 'perception',
  };
}
export function traceProfile(r: DungeonTraceRules, surface: string) {
  const floor: Record<string, { dc: number; decay: number; life: number }> = {
      stone: { dc: 10, decay: 5, life: 86400 },
      mud: { dc: 5, decay: 8, life: 43200 },
      sand: { dc: 8, decay: 12, life: 28800 },
      snow: { dc: 5, decay: 10, life: 36000 },
      water: { dc: 15, decay: 600, life: 600 },
      vegetation: { dc: 10, decay: 10, life: 36000 },
    },
    p = floor[surface] ?? floor.stone!,
    quiet = r.movement === 'sneak',
    fast = r.movement === 'run';
  return {
    dc: r.dcOverride ?? Math.max(0, p.dc + (quiet ? 5 : fast ? -3 : 0)),
    strength: r.strength * (quiet ? 0.65 : r.movement === 'swim' ? 0.6 : 1),
    decayPerHour:
      r.decayPerHour ??
      p.decay *
        (r.environment === 'rain'
          ? 3
          : r.environment === 'wind' && (surface === 'sand' || surface === 'snow')
            ? 4
            : r.environment === 'snow'
              ? 2
              : 1),
    lifetimeSeconds: r.lifetimeSeconds ?? p.life * (r.environment === 'rain' ? 0.5 : 1),
    soundRange: r.movement === 'fly' ? 6 : quiet ? 6 : fast ? 30 : r.movement === 'crawl' ? 8 : 18,
    soundDc: quiet || r.movement === 'fly' ? 15 : fast ? 5 : 10,
  };
}
export function trackAt(t: DungeonTrace, epochId: string, instantMs: string) {
  if (t.epochId !== epochId) return { alive: false, strength: 0, dc: 100, ageSeconds: 0 };
  const ageSeconds = Number((BigInt(instantMs) - BigInt(t.instantMs)) / 1000n);
  if (ageSeconds < 0) return { alive: false, strength: 0, dc: 100, ageSeconds };
  const lifetime = t.lifetimeSeconds ?? 86400,
    legacy = t.profile === 'dungeon-tracks-v1',
    strength = Math.max(0, t.strength - ((t.decayPerHour ?? (legacy ? 0 : 5)) * ageSeconds) / 3600),
    dc =
      t.dc +
      (legacy
        ? Math.floor(ageSeconds / 3600)
        : Math.floor(Math.max(0, t.strength - strength) / 10));
  return { alive: ageSeconds <= lifetime && strength > 0, strength, dc, ageSeconds };
}
