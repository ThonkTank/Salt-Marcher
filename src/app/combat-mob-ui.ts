import {
  combatOrder,
  type CombatState,
  type Combatant,
} from "./combat-contracts";

export interface CombatMob {
  id: string;
  members: Combatant[];
  front: Combatant;
  living: number;
  active: Combatant | null;
  completed: number;
}
/** Packing is a projection of the saved partition, never another roster or HP pool. */
export function combatMobs(combat: CombatState): CombatMob[] {
  const order = combatOrder(combat),
    groups = new Map<string, Combatant[]>();
  for (const actor of order) {
    if (actor.characterId || actor.partitionKind !== "mob") continue;
    const members = groups.get(actor.groupId) ?? [];
    members.push(actor);
    groups.set(actor.groupId, members);
  }
  const positions = new Map(order.map((actor, index) => [actor.id, index]));
  const turn =
    combat.phase === "running"
      ? order.findIndex((actor) => actor.id === combat.turnId)
      : -1;
  return [...groups].map(([id, members]) => ({
    id,
    members,
    front:
      members.find((actor) => actor.hp > 0 && !actor.death?.dead) ??
      members[0]!,
    living: members.filter((actor) => actor.hp > 0 && !actor.death?.dead)
      .length,
    active:
      members.find(
        (actor) => actor.id === combat.turnId && combat.phase === "running",
      ) ?? null,
    completed:
      turn < 0
        ? 0
        : members.filter((actor) => positions.get(actor.id)! < turn).length,
  }));
}
/** Legacy/catalog troops may clone their source; prepared world groups use their own picker. */
export function canReinforceTroop(members:Combatant[]):boolean {
 const actor=members[0];
 return !!actor?.sourceId&&(!actor.worldActorId||actor.sourceOrdinal!==undefined)&&(members.length>1||actor.partitionKind==='mob');
}
const node = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) => {
  const el = document.createElement(tag);
  if (text !== undefined) el.textContent = text;
  return el;
};
export function combatMobRow(
  mob: CombatMob,
  combat: CombatState,
  options: {
    expanded: boolean;
    selected: string | null;
    current: () => boolean;
    choose: (id: string) => void;
    health: (id: string) => void;
    initiative: (id: string) => void;
    toggle: () => void;
    reinforce?: (groupId:string) => void;
  },
): HTMLTableRowElement {
  const row = node("tr"),
    cell = node("td"),
    card = node("article"),
    heading = node("div"),
    title = node("strong"),
    toggle = node(
      "button",
      options.expanded ? "Mitglieder zuklappen" : "Mitglieder zeigen",
    );
  row.dataset.mobId = mob.id;
  row.className = "combat-mob-row";
  if (mob.active) row.classList.add("current-turn");
  cell.colSpan = 5;
  card.className = "combat-mob-card";
  heading.className = "toolbar";
  const source = combat.sources?.find(
      (source) => source.id === mob.front.sourceId,
    ),
    name = mob.front.groupName || source?.name || "Monstertrupp";
  title.textContent =
    name + " · " + mob.living + " / " + mob.members.length + " mit HP";
  toggle.type = "button";
  toggle.className = "combat-mob-toggle";
  toggle.setAttribute("aria-expanded", String(options.expanded));
  toggle.setAttribute("aria-label", name + " · " + toggle.textContent);
  toggle.onclick = () => {
    if (options.current()) options.toggle();
  };
  heading.append(title, toggle);
  if(combat.phase==='running'&&options.reinforce&&canReinforceTroop(mob.members)){
    const reinforce=node('button','Verstärken…');reinforce.type='button';reinforce.className='combat-mob-reinforce';
    reinforce.setAttribute('aria-label',name+' · '+mob.front.name+' · Trupp verstärken');
    reinforce.onclick=()=>{if(options.current())options.reinforce!(mob.id);};heading.append(reinforce);
  }
  card.append(heading);
  // Expanded rows already expose every member's HP, initiative and conditions.
  if (!options.expanded) {
    const front = node("div"),
      choose = node("button", mob.front.name),
      hp = node(
        "button",
        mob.front.hp +
          " / " +
          mob.front.maxHp +
          " HP" +
          (mob.front.tempHp ? " + " + mob.front.tempHp + " temporär" : ""),
      ),
      initiative = node("button", "Initiative " + mob.front.initiative);
    front.className = "toolbar";
    choose.type = hp.type = initiative.type = "button";
    choose.dataset.mobFrontId = mob.front.id;
    choose.setAttribute(
      "aria-pressed",
      String(options.selected === mob.front.id),
    );
    choose.onclick = () => {
      if (options.current()) options.choose(mob.front.id);
    };
    hp.className = "combat-mob-health";
    hp.setAttribute("aria-label", mob.front.name + " · Schaden oder Heilung");
    hp.dataset.combatReadonly = initiative.dataset.combatReadonly = String(
      !["preparing", "running"].includes(combat.phase),
    );
    hp.onclick = () => {
      if (options.current()) options.health(mob.front.id);
    };
    initiative.onclick = () => {
      if (options.current()) options.initiative(mob.front.id);
    };
    front.append(
      node(
        "span",
        mob.living ? "Vorne:" : "Kein Mitglied über 0 HP · Einzelwerte:",
      ),
      choose,
      hp,
      node("span", "RK " + (mob.front.armorClass??"offen")),
      initiative,
    );
    card.append(front);
    const status = [
      mob.front.conditions,
      mob.front.concentrating ? "Konzentration" : "",
      ...(mob.front.timedEffects?.map(
        (effect) => effect.name + " · " + effect.remaining + " Runden",
      ) ?? []),
    ]
      .filter(Boolean)
      .join(" · ");
    card.append(
      node(
        "p",
        (mob.front.hiddenFromPlayers ? "Auf Spieleranzeige verborgen · " : "") +
          "Vorderes Mitglied: " +
          (status || "Keine Zustände") +
          ".",
      ),
    );
    if (
      new Set(
        mob.members.map((actor) =>
          JSON.stringify([
            actor.conditions,
            actor.concentrating,
            actor.armorClass,
            actor.hiddenFromPlayers,
            actor.role,
          ]),
        ),
      ).size > 1
    )
      card.append(
        node(
          "p",
          "Mitglieder haben unterschiedliche Werte, Zustände oder Sichtbarkeit. Einzelheiten unter „Mitglieder zeigen“.",
        ),
      );
  }
  card.append(
    node(
      "p",
      combat.phase === "running"
        ? (mob.active ? "Am Zug: " + mob.active.name + " · " : "") +
            mob.completed +
            " / " +
            mob.members.length +
            " Züge in dieser Runde beendet. Jeder Teilnehmer behält seinen Zug."
        : combat.phase === "preparing"
          ? "Gemeinsame Initiative · individuelle HP und Zustände."
          : "Abgeschlossener Stand · individuelle HP und Zustände bleiben erhalten.",
    ),
  );
  if (!options.expanded && mob.active && mob.active.id !== mob.front.id) {
    const active = node(
      "button",
      "Aktiven Teilnehmer öffnen: " + mob.active.name,
    );
    active.type = "button";
    active.onclick = () => {
      if (options.current()) options.choose(mob.active!.id);
    };
    card.append(active);
  }
  cell.append(card);
  row.append(cell);
  return row;
}
