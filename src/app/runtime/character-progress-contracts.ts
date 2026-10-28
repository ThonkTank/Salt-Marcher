export interface Progress {
  characterId: string;
  revision: number;
  xp: number | null;
  rest: { known: boolean; longXp: number; shortXp: number; baseline: number; sections: number };
  health: {
    hp: number;
    maxHp: number;
    tempHp: number;
    conditions: string;
    concentrating: boolean;
    death?: { successes: number; failures: number; stable: boolean; dead: boolean };
  } | null;
  /** Current conditions/temporary HP when normal HP are intentionally unknown. */
  combatStatus?: { tempHp: number; conditions: string; concentrating: boolean };
}

export type CharacterHealth = NonNullable<Progress['health']> & {
  death?: { successes: number; failures: number; stable: boolean; dead: boolean };
};

export type DeathSaveResult =
  | 'success'
  | 'failure'
  | 'natural-20'
  | 'natural-1'
  | 'stabilize'
  | 'reset'
  | 'dead';
