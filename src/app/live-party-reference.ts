import type {CharacterHealth} from './progression';

export interface PartyHealthReference {
  health?: CharacterHealth | null;
  healthCombat?: {title:string};
  lastCombatStatus?: Pick<CharacterHealth,'tempHp'|'conditions'|'concentrating'>;
}

export function partyHealthFacts(row:PartyHealthReference|undefined){
  const status=row?.health??row?.lastCombatStatus;
  const health=row?.health?row.health.hp+' / '+row.health.maxHp+' HP':row?.healthCombat?'HP im Kampf „'+row.healthCombat.title+'“':'HP offen';
  const effects=[status?.tempHp?status.tempHp+' temp. HP':'',status?.conditions??'',status?.concentrating?'Konzentration':'',row?.health?.death?.dead?'Tot':row?.health?.death?.stable?'Stabilisiert':''].filter(Boolean).join(' · ');
  return health+(effects?' · '+effects:'');
}
