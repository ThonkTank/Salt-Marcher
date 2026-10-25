import type { CombatAction, CombatState } from './combat-contracts';
import { combatStartIssue } from './combat-contracts';
import type { InitiativeWorkingDraft } from './combat-draft-contracts';
import { CombatDraftCache } from './combat-draft-cache';
import {
  initiativeBasis,
  initiativeBasisMatches,
  initiativeGroups,
  initiativeNumber,
  rolledMonsterInitiatives,
} from './combat-initiative';

/** Initiative has its own durable draft; it never submits the fighter editor. */
export class CombatInitiativePanel {
  private combat: CombatState | null = null;
  private owner: { campaignId: string; token: string } | null = null;
  private blocked = true;
  private loading = false;
  private saving = false;
  private request = 0;
  private draft: InitiativeWorkingDraft | null = null;
  private basis: ReturnType<typeof initiativeBasis> | null = null;
  private revision = 0;
  private inputs = new Map<string, HTMLInputElement>();
  private message: string | null = null;
  private undoRoll: Map<string, string> | null = null;
  private el = <T extends HTMLElement>(id: string) => this.root.querySelector('#' + id) as T;
  constructor(
    private root: HTMLDialogElement,
    private cache: CombatDraftCache,
    private commit: (a: CombatAction, revision: number) => Promise<boolean>,
    private report: (s: string, error?: boolean) => void,
  ) {
    root.innerHTML = `<form id="initiative-form"><div class="toolbar"><h2>Initiative eintragen</h2><button id="initiative-close" type="button">Schließen</button></div><p>Ein Wert pro Figur oder gemeinsamem Trupp. HP und andere offene Figurenwerte werden hier nicht übernommen.</p><div class="toolbar"><label for="initiative-mode">Monsterwürfel</label><select id="initiative-mode"><option value="normal">W20 + Bonus</option><option value="advantage">Mit Vorteil</option><option value="disadvantage">Mit Nachteil</option></select><button id="initiative-roll" type="button">Monster würfeln</button><button id="initiative-roll-undo" type="button">Wurf verwerfen</button></div><p id="initiative-status" role="status"></p><div id="initiative-rows"></div><textarea id="initiative-preserved" aria-label="Erhaltene Initiativwerte zum Kopieren" readonly hidden rows="6"></textarea><button id="initiative-reload" type="button" hidden>Entwurf verwerfen und neu laden</button><div class="toolbar initiative-actions"><button id="initiative-save" type="submit">Initiative übernehmen</button><button id="initiative-start" type="button">Übernehmen und Kampf beginnen</button></div></form>`;
    this.el('initiative-close').onclick = () => {
      void this.close();
    };
    root.addEventListener('cancel', (e) => {
      e.preventDefault();
      void this.close();
    });
    this.el<HTMLFormElement>('initiative-form').onsubmit = (e) => {
      e.preventDefault();
      void this.save(false);
    };
    this.el('initiative-start').onclick = () => {
      void this.save(true);
    };
    this.el('initiative-roll').onclick = () => this.roll();
    this.el('initiative-roll-undo').onclick = () => {
      if (!this.undoRoll) return;
      for (const [id, value] of this.undoRoll) {
        const input = this.inputs.get(id);
        if (input) input.value = value;
      }
      this.undoRoll = null;
      this.keep();
      this.controls();
    };
    this.el('initiative-reload').onclick = () => {
      void this.reload();
    };
  }

  private identity() {
    return this.owner && this.combat
      ? JSON.stringify([this.owner.campaignId, this.owner.token, this.combat.id])
      : '';
  }
  private isOpen() {
    return this.root.hasAttribute('open');
  }
  private hide() {
    if (typeof this.root.close === 'function') this.root.close();
    else this.root.removeAttribute('open');
  }
  context(
    c: CombatState | null,
    owner: { campaignId: string; token: string } | null,
    blocked: boolean,
  ) {
    const before = this.identity();
    this.combat = c;
    this.owner = owner;
    this.blocked = blocked;
    if (before !== this.identity()) {
      this.request++;
      this.hide();
      this.inputs.clear();
      this.draft = null;
      this.basis = null;
      this.loading = false;
      this.undoRoll = null;
    }
    if (this.isOpen()) this.controls();
  }
  async open(focusId?: string) {
    if (!this.combat || !this.owner || this.blocked) return;
    const identity = this.identity(),
      request = ++this.request,
      { token, campaignId } = this.owner,
      c = this.combat;
    this.message = null;
    this.loading = true;
    this.el('initiative-rows').replaceChildren();
    this.inputs.clear();
    this.el('initiative-status').textContent = 'Initiative wird geladen…';
    if (!this.isOpen()) {
      if (typeof this.root.showModal === 'function') this.root.showModal();
      else this.root.setAttribute('open', '');
    }
    this.controls();
    try {
      const d = await this.cache.load(token, campaignId, c.id, 'initiative', c.id);
      if (request !== this.request || identity !== this.identity()) return;
      this.draft = d?.kind === 'initiative' ? d : null;
      this.basis = structuredClone(this.draft?.basis ?? initiativeBasis(c));
      this.revision = this.draft?.revision ?? c.revision;
      this.undoRoll = null;
      const values = new Map(this.draft?.values.map((v) => [v.participantId, v.raw]));
      for (const group of initiativeGroups(c)) {
        const p = group[0]!,
          row = document.createElement('label'),
          name = document.createElement('span'),
          detail = document.createElement('small'),
          input = document.createElement('input');
        row.className = 'initiative-row';
        name.textContent =
          (p.groupName ?? p.name) + (group.length > 1 ? ' · ' + group.length + ' Teilnehmer' : '');
        detail.textContent =
          group.length > 1
            ? group.map((p) => p.name).join(', ')
            : p.characterId
              ? 'Party'
              : 'Einzelinitiative';
        input.type = 'text';
        input.inputMode = 'numeric';
        input.maxLength = 100;
        input.value =
          values.get(group.find((member) => values.has(member.id))?.id ?? p.id) ??
          String(p.initiative);
        input.dataset.participantId = p.id;
        input.setAttribute('aria-label', 'Initiative ' + (p.groupName ?? p.name));
        input.oninput = () => {
          this.message = null;
          if (!p.characterId) this.undoRoll = null;
          this.keep();
          this.controls();
        };
        name.append(detail);
        row.append(name, input);
        this.el('initiative-rows').append(row);
        this.inputs.set(p.id, input);
      }
      this.loading = false;
      this.controls();
      const group = initiativeGroups(c).find((g) => g.some((p) => p.id === focusId)),
        input = this.inputs.get(group?.[0]?.id ?? c.participants[0]?.id ?? '');
      input?.focus();
      input?.select();
    } catch (error) {
      if (request === this.request) {
        this.loading = true;
        this.el('initiative-status').textContent =
          'Initiative konnte nicht geladen werden: ' + (error as Error).message;
        this.report((error as Error).message, true);
        this.controls();
      }
    }
  }
  private keep() {
    if (!this.owner || !this.combat || !this.basis || this.loading || this.saving) return;
    const d: InitiativeWorkingDraft = {
      version: 1,
      kind: 'initiative',
      writeId: crypto.randomUUID(),
      combatId: this.combat.id,
      sceneId: this.combat.sceneId,
      targetId: this.combat.id,
      revision: this.revision,
      basis: structuredClone(this.basis),
      values: [...this.inputs].map(([participantId, input]) => ({
        participantId,
        raw: input.value,
      })),
    };
    this.draft = d;
    void this.cache.put(this.owner.token, this.owner.campaignId, d);
  }
  private stale() {
    return !!this.combat && !!this.basis && !initiativeBasisMatches(this.basis, this.combat);
  }
  private controls() {
    const unavailable = this.blocked || this.loading || this.saving,
      stale = this.stale();
    for (const input of this.inputs.values()) input.disabled = unavailable || stale;
    for (const id of ['initiative-save', 'initiative-start', 'initiative-roll', 'initiative-mode'])
      this.el<HTMLInputElement>(id).disabled = unavailable || stale || !this.inputs.size;
    this.el('initiative-start').hidden = this.combat?.phase !== 'preparing';
    this.el<HTMLButtonElement>('initiative-roll-undo').disabled =
      unavailable || stale || !this.undoRoll;
    const startIssue = this.combat?.phase === 'preparing' ? combatStartIssue(this.combat) : null;
    if (startIssue) this.el<HTMLButtonElement>('initiative-start').disabled = true;
    this.el<HTMLButtonElement>('initiative-reload').hidden = !stale && !this.loading;
    this.el<HTMLButtonElement>('initiative-reload').disabled = this.blocked || this.saving;
    this.el('initiative-reload').textContent = this.loading
      ? 'Initiative erneut laden'
      : 'Entwurf verwerfen und neu laden';
    this.el('initiative-preserved').hidden = !stale;
    this.el<HTMLTextAreaElement>('initiative-preserved').value =
      this.draft?.values
        .map(
          (v, i) =>
            (this.combat?.participants.find((p) => p.id === v.participantId)?.name ??
              'Ehemaliger Teilnehmer ' + (i + 1)) +
            ': ' +
            v.raw,
        )
        .join('\n') ?? '';
    if (stale)
      this.el('initiative-status').textContent =
        'Initiative oder Teilnehmer inzwischen geändert. Deine Eingabe bleibt erhalten. Vor dem Übernehmen den aktuellen Stand abgleichen.';
    else if (!this.loading)
      this.el('initiative-status').textContent =
        this.message ??
        startIssue ??
        (this.draft
          ? 'Eingabe wird als Entwurf gesichert. Erst Übernehmen ändert den Kampf.'
          : 'Werte eintragen oder nur die Monster würfeln. Spielerwerte bleiben beim Würfeln erhalten.');
  }
  private roll() {
    if (!this.combat || this.blocked || this.loading || this.saving || this.stale()) return;
    this.message = null;
    const rolled = rolledMonsterInitiatives(
      this.combat,
      this.el<HTMLSelectElement>('initiative-mode').value as
        | 'normal'
        | 'advantage'
        | 'disadvantage',
    );
    this.undoRoll = new Map(
      rolled.map((v) => [v.participantId, this.inputs.get(v.participantId)!.value]),
    );
    for (const v of rolled) this.inputs.get(v.participantId)!.value = String(v.initiative);
    this.keep();
    this.controls();
  }
  private async save(start: boolean) {
    if (!this.combat || !this.owner || this.blocked || this.loading || this.saving || this.stale())
      return;
    try {
      const values = [...this.inputs].map(([participantId, input]) => ({
        participantId,
        initiative: initiativeNumber(input.value),
      }));
      this.keep();
      this.saving = true;
      this.controls();
      const okay = await this.commit(
        { kind: 'initiative', values, ...(start ? { start: true } : {}) },
        this.combat.revision,
      );
      if (okay) this.hide();
      else
        this.message =
          'Initiative nicht übernommen. Speicherstatus prüfen; deine Eingabe bleibt erhalten.';
    } catch (error) {
      this.message = (error as Error).message;
      this.report((error as Error).message, true);
    } finally {
      this.saving = false;
      this.controls();
    }
  }
  private async close() {
    if (!this.owner || (await this.cache.flush(this.owner.campaignId))) this.hide();
    else
      this.el('initiative-status').textContent =
        'Entwurf noch nicht gesichert. Bitte Sicherung erneut versuchen.';
  }
  private async reload() {
    if (!this.combat || !this.owner) return;
    try {
      if (!this.loading)
        await this.cache.discard(
          this.owner.token,
          this.owner.campaignId,
          this.combat.id,
          'initiative',
          this.combat.id,
        );
      await this.open();
    } catch (e) {
      this.report((e as Error).message, true);
    }
  }
  accepted(d: InitiativeWorkingDraft) {
    if (this.draft?.writeId === d.writeId && this.combat?.id === d.combatId) this.hide();
  }
}
