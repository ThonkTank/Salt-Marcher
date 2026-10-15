import {bindAnchoredPopup} from './anchored-popup';
import type { Workspace } from "./contracts";
import type { DayView } from "./adventuring-day-contracts";
import { onProgressChanged } from "./progression-ui";
import {renderDayPacing} from './adventuring-day-pacing-ui';

const el = <T extends HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const number = (n: number) =>
  n.toLocaleString("de-DE", { maximumFractionDigits: 2 });
let workspace: Workspace | null = null,
  source: "active" | "custom" = "active",
  mode: "budget" | "progress" = "budget",
  rows: { level: string; count: string }[] = [],
  generation = 0,
  timer: ReturnType<typeof setTimeout> | null = null,
  tell: (s: string, error?: boolean) => void;
// Keep editing text until the calculation boundary; an empty field is not zero.
const numericDraft = (value: string) => (value.trim() ? Number(value) : NaN);
const opened = () => el("day-popover").matches(":popover-open");
function state() {
  el("day-source").textContent =
    source === "active"
      ? "Aktive Party · bestätigte XP"
      : "Eigene Rechnerzeilen";
  el("day-progress-inputs").hidden = mode !== "progress";
  el("day-reward-field").hidden = !el<HTMLInputElement>("day-separate-reward")
    .checked;
  for (const m of ["budget", "progress"])
    el("day-mode-" + m).setAttribute("aria-pressed", String(mode === m));
}
function renderRows() {
  const root = el("day-rows");
  root.replaceChildren();
  for (const [i, row] of rows.entries()) {
    const line = document.createElement("div");
    line.className = "day-row";
    const level = document.createElement("input"),
      count = document.createElement("input"),
      remove = document.createElement("button");
    level.type = count.type = "number";
    level.min = count.min = "1";
    level.max = "20";
    count.max = "99";
    level.step = count.step = "1";
    level.value = row.level;
    level.placeholder = "Level offen";
    count.value = row.count;
    level.setAttribute("aria-label", "Level Zeile " + (i + 1));
    count.setAttribute("aria-label", "Anzahl Zeile " + (i + 1));
    remove.type = "button";
    remove.textContent = "Entfernen";
    level.oninput = () => {
      row.level = level.value;
      source = "custom";
      state();
      schedule();
    };
    count.oninput = () => {
      row.count = count.value;
      source = "custom";
      state();
      schedule();
    };
    remove.onclick = () => {
      rows.splice(i, 1);
      source = "custom";
      state();
      renderRows();
      schedule();
    };
    line.append(level, count, remove);
    root.append(line);
  }
}
function table(root: HTMLElement, headings: string[], values: string[][]) {
  const t = document.createElement("table"),
    head = document.createElement("tr");
  for (const title of headings) {
    const th = document.createElement("th");
    th.textContent = title;
    head.append(th);
  }
  t.append(head);
  for (const cells of values) {
    const tr = document.createElement("tr");
    for (const text of cells) {
      const td = document.createElement("td");
      td.textContent = text;
      tr.append(td);
    }
    t.append(tr);
  }
  root.append(t);
}
function draw(value: DayView) {
  el('day-popover').setAttribute('aria-busy','false');
  el('day-trigger').setAttribute('aria-busy','false');
  const snapshot = value.snapshot;
  el("day-trigger").textContent = !snapshot.partySize
    ? "Kein Rastbudget"
    : !snapshot.available
      ? "Rastbudget offen"
      : "SR " + number(snapshot.shortXp!) + " · LR " + number(snapshot.longXp!);
  el("day-trigger").title = snapshot.available
    ? "Bisherige XP-Belastung seit kurzer/langer Rast · Tagesbudget " +
      number(snapshot.dailyBudget!)
    : snapshot.reason;
  el("party-shortcut").textContent = snapshot.partySize
    ? snapshot.partySize +
      " Figuren · " +
      (snapshot.averageLevel === null
        ? "Level offen"
        : "Ø Level " + number(snapshot.averageLevel))
    : "Party öffnen";
  if (!opened()) return;
  renderDayPacing(el('day-pacing'),value.pacing,source==='active'&&mode==='progress');
  el("day-status").textContent = value.problem ?? snapshot.reason;
  if (source === "active") {
    rows = snapshot.rows.map((r) => ({
      level: r.level === null ? "" : String(r.level),
      count: String(r.count),
    }));
    renderRows();
  }
  state();
  const summary = el("day-summary"),
    timeline = el("day-timeline"),
    party = el("day-current");
  summary.replaceChildren();
  timeline.replaceChildren();
  party.replaceChildren();
  if (snapshot.members.length) {
    table(
      party,
      ["Aktuelle Figur", "Level", "SR / LR verbraucht", "Bis nächste Marke / LR"],
      snapshot.members
        .slice(0, 40)
        .map((c) => [
          c.name,
          c.level === null ? "offen" : String(c.level),
          c.restKnown
            ? number(c.shortXp) + " / " + number(c.longXp)
            : "Rast offen",
          c.nextShort === null
            ? "offen"
            : number(c.nextShort) + " / " + number(c.remainingLong!),
        ]),
    );
    if (snapshot.members.length > 40) {
      const p = document.createElement("p");
      p.textContent =
        "Erste 40 Figuren angezeigt; Summen berücksichtigen die gesamte aktive Party.";
      party.append(p);
    }
  }
  const c = value.calculation;
  if (!c) return;
  const heading=document.createElement('h3');heading.textContent='Tagesmodell ab langer Rast';summary.append(heading);
  const facts = document.createElement("p");
  facts.className = "day-budget";
  facts.textContent =
    number(c.partySize) +
    " Figuren · " +
    number(c.dailyBudget) +
    " XP Tagesbudget";
  summary.append(facts);
  table(
    summary,
    ["Kurze Rast 1", "Kurze Rast 2", "Lange Rast"],
    [c.milestones.map(number)],
  );
  table(
    summary,
    ["Leicht", "Mittel", "Schwer", "Tödlich"],
    [c.thresholds.map(number)],
  );
  if (mode === "progress") {
    const progress = document.createElement("p");
    progress.id = "day-progress-summary";
    progress.textContent =
      number(c.completedDays) +
      " volle Tage · " +
      number(c.dayProgress * 100) +
      " % des nächsten Tags · " +
      number(c.shortRests) +
      " kurze / " +
      number(c.longRests) +
      " lange Rasten";
    summary.append(progress);
    const xp = document.createElement("p");
    xp.textContent =
      "Verdienst: " +
      number(c.shareXp) +
      " XP je Figur · insgesamt " +
      number(c.totalAwardXp) +
      " XP nach aufgerundeter Verteilung";
    summary.append(xp);
    table(
      summary,
      [
        "Figur / Startlevel",
        "Anzahl",
        "XP vorher → danach",
        "Level vorher → danach",
      ],
      c.projections
        .slice(0, 40)
        .map((p) => [
          p.name,
          String(p.count),
          number(p.beforeXp) + " → " + number(p.afterXp),
          p.beforeLevel + " → " + p.afterLevel,
        ]),
    );
    for (const event of c.timeline) {
      const li = document.createElement("li");
      li.textContent =
        event.label + " · bei " + number(event.xp) + " Gruppen-XP";
      timeline.append(li);
    }
  }
  el("day-timeline-card").hidden = mode !== "progress";
}
async function refresh() {
  const owner = workspace,
    request = ++generation;
  if (!owner) return;
  const open = opened(),
    input = {
      source: open ? source : ("active" as const),
      rows: open
        ? rows.map((r) => ({
            level: numericDraft(r.level),
            count: numericDraft(r.count),
          }))
        : [],
      totalXp:
        open && mode === "progress"
          ? numericDraft(el<HTMLInputElement>("day-total-xp").value)
          : 0,
      ...(open &&
      mode === "progress" &&
      el<HTMLInputElement>("day-separate-reward").checked
        ? {
            rewardXp: numericDraft(el<HTMLInputElement>("day-reward-xp").value),
          }
        : {}),
    };
  if (open) {
    el('day-popover').setAttribute('aria-busy','true');
    el('day-trigger').setAttribute('aria-busy','true');
    el('day-trigger').textContent='Rastbudget wird geladen…';
    el("day-status").textContent = "Rastbudget wird geladen…";
    el("day-summary").replaceChildren();
    el("day-timeline").replaceChildren();
    el('day-current').replaceChildren();
    el('day-pacing').replaceChildren();
  }
  try {
    const result = await window.campaign.adventuringDay(owner.token, input);
    if (owner.token !== workspace?.token || request !== generation) return;
    if (!result.ok) throw new Error(result.error);
    draw(result.value);
  } catch (error) {
    if (owner.token !== workspace?.token || request !== generation) return;
    el("day-trigger").textContent = "Rastbudget nicht verfügbar";
    el('day-trigger').setAttribute('aria-busy','false');
    el('day-popover').setAttribute('aria-busy','false');
    if (opened()) el("day-status").textContent = (error as Error).message;
  }
}
function schedule() {
  generation++;
  if (timer) clearTimeout(timer);
  if (opened()) {
    el('day-trigger').setAttribute('aria-busy','true');
    el('day-trigger').textContent='Rastbudget wird geladen…';
    el('day-popover').setAttribute('aria-busy','true');
    el("day-summary").replaceChildren();
    el("day-timeline").replaceChildren();
    el('day-current').replaceChildren();
    el('day-pacing').replaceChildren();
    el("day-status").textContent = "Berechnung wird aktualisiert…";
  }
  timer = setTimeout(() => {
    timer = null;
    void refresh();
  }, 120);
}
export function activateDayCalculator(next: Workspace | null) {
  workspace = next;
  generation++;
  if (timer) clearTimeout(timer);
  timer = null;
  if (opened()) el("day-popover").hidePopover();
  rows = [];
  source = "active";
  el<HTMLInputElement>("day-total-xp").value = "0";
  el<HTMLInputElement>("day-reward-xp").value = "0";
  el<HTMLInputElement>("day-separate-reward").checked = false;
  el<HTMLButtonElement>("day-trigger").disabled = !next;
  el("day-trigger").textContent = "Rastbudget";
  el('day-trigger').setAttribute('aria-busy','false');
  el('day-popover').setAttribute('aria-busy','false');
  el('day-pacing').replaceChildren();
  el("party-shortcut").textContent = "Party öffnen";
  renderRows();
  state();
  if (next) void refresh();
}
export function initDayCalculator(status: typeof tell, openParty: () => void) {
  tell = status;
  const popup=bindAnchoredPopup(el<HTMLButtonElement>('day-trigger'),el('day-popover'),760);
  el('day-trigger').onclick=()=>{if(popup.toggle())void refresh();};
  el('day-close').onclick=popup.close;
  el("day-party-open").onclick = () => {
    el("day-popover").hidePopover();
    openParty();
  };
  el("day-active").onclick = () => {
    source = "active";
    state();
    void refresh();
  };
  el("day-add").onclick = () => {
    if (rows.length >= 20) {
      tell("Höchstens 20 Rechnerzeilen.", true);
      return;
    }
    rows.push({ level: "1", count: "1" });
    source = "custom";
    state();
    renderRows();
    schedule();
  };
  el("day-clear").onclick = () => {
    rows = [];
    source = "custom";
    state();
    renderRows();
    schedule();
  };
  for (const m of ["budget", "progress"] as const)
    el("day-mode-" + m).onclick = () => {
      mode = m;
      state();
      schedule();
    };
  for (const id of ["day-total-xp", "day-reward-xp", "day-separate-reward"])
    el(id).addEventListener("input", () => {
      state();
      schedule();
    });
  onProgressChanged(schedule);
  document.addEventListener("campaign-party-changed", schedule);
  state();
}
