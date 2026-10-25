import type { WorkspaceGeometry, Result } from './contracts';
import type { LiveScene } from './live-contracts';
import type { CombatState, CombatResolution } from './combat-contracts';
import { CombatNpcLossesPanel } from './combat-npc-losses-ui';
const node = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) => {
  const n = document.createElement(tag);
  if (text !== undefined) n.textContent = text;
  return n;
};
const unwrap = <T>(r: Result<T>) => {
  if (!r.ok) throw new Error(r.error);
  return r.value;
};

/** Result projection and explicit World loss confirmation; Treasury owns distribution. */
export class CombatResolutionPanel {
  private owner: {
    token: string;
    sceneId: string;
    combatId: string;
    combatRevision: number;
    sceneRevision: number;
  } | null = null;
  private generation = 0;
  private reading = 0;
  private busy = false;
  private result: CombatResolution | null = null;
  private losses = new CombatNpcLossesPanel();
  private rows = node('div');
  private summary = node('p');
  private status = node('p');
  private more = node('button', 'Weitere Schätze');
  private refreshButton = node('button', 'Beute aktualisieren');
  constructor(
    private root: HTMLElement,
    private distribute: (id: string, sceneId: string, current: () => boolean) => Promise<void>,
    private closeStale: () => void,
    private confirmLosses?: (
      losses: import('./combat-contracts').CombatLossBasis[],
      revision: number,
      current: () => boolean,
    ) => Promise<boolean>,
    private openNpc?: (id: string, current: () => boolean) => Promise<void>,
  ) {
    root.className = 'combat-resolution';
    const title = node('h3', 'Nachbereitung'),
      scope = node(
        'p',
        'Zugehörige Schätze aus diesem Kampf, dieser Gruppe und ihrem aktuellen Ort. Andere Funde sind über die Schatzverwaltung erreichbar.',
      );
    scope.className = 'caption';
    this.status.setAttribute('role', 'status');
    this.summary.id = 'combat-resolution-summary';
    this.rows.id = 'combat-resolution-treasures';
    this.status.id = 'combat-resolution-status';
    this.more.type = this.refreshButton.type = 'button';
    this.more.id = 'combat-resolution-more';
    this.refreshButton.id = 'combat-resolution-refresh';
    this.more.textContent = 'Weitere Schätze';
    this.refreshButton.textContent = 'Nachbereitung aktualisieren';
    this.more.onclick = () => void this.read(true);
    this.refreshButton.onclick = () => void this.refresh();
    const tools = node('div');
    tools.className = 'toolbar';
    tools.append(this.refreshButton, this.more);
    root.append(title, this.summary, this.losses.root, scope, this.rows, this.status, tools);
    root.hidden = true;
  }
  context(
    workspace: WorkspaceGeometry | null,
    scene: LiveScene | null,
    combat: CombatState | null,
  ) {
    const next =
      workspace && scene && combat?.phase === 'finished' && combat.sceneId === scene.id
        ? {
            token: workspace.token,
            sceneId: scene.id,
            combatId: combat.id,
            combatRevision: combat.revision,
            sceneRevision: scene.revision,
          }
        : null;
    if (JSON.stringify(next) === JSON.stringify(this.owner)) return;
    this.generation++;
    this.reading++;
    this.owner = next;
    this.result = null;
    this.busy = false;
    this.root.hidden = !next;
    this.rows.replaceChildren();
    this.losses.clear();
    this.summary.textContent = '';
    this.status.textContent = '';
    this.closeStale();
    if (next) void this.read();
  }
  async refresh() {
    if (this.owner) await this.read();
  }
  setBlocked(blocked: boolean) {
    this.root.inert = blocked;
  }
  private current(owner: NonNullable<typeof this.owner>, generation: number) {
    return this.owner === owner && this.generation === generation;
  }
  private async read(append = false) {
    const owner = this.owner,
      g = this.generation;
    if (!owner || (append && (!this.result?.next || this.busy))) return;
    const request = ++this.reading;
    this.busy = true;
    this.losses.clear();
    this.refreshButton.disabled = true;
    this.more.disabled = true;
    this.status.textContent = 'Bestätigten Abschluss und Weltfolgen lesen…';
    if (!append) {
      this.result = null;
      this.rows.replaceChildren();
    }
    try {
      const result = unwrap(
        await window.campaign.combatResolution(
          owner.token,
          owner.sceneId,
          owner.combatId,
          append ? (this.result?.next ?? null) : null,
        ),
      );
      if (!this.current(owner, g) || request !== this.reading) return;
      if (
        result.combatId !== owner.combatId ||
        result.sceneId !== owner.sceneId ||
        result.combatRevision !== owner.combatRevision ||
        result.sceneRevision !== owner.sceneRevision
      )
        throw new Error('Scene oder Kampfstand hat sich geändert. Kampfstand aktualisieren.');
      this.result = {
        ...result,
        treasures: append
          ? [
              ...new Map(
                [...(this.result?.treasures ?? []), ...result.treasures].map((t) => [t.id, t]),
              ).values(),
            ]
          : result.treasures,
      };
      this.draw();
      this.status.textContent = '';
    } catch (error) {
      if (this.current(owner, g) && request === this.reading)
        this.status.textContent =
          'Beute konnte nicht gelesen werden: ' +
          (error as Error).message +
          ' Erneut aktualisieren.';
    } finally {
      if (this.current(owner, g) && request === this.reading) {
        this.busy = false;
        this.refreshButton.disabled = false;
        this.more.disabled = !this.result?.next;
        this.more.hidden = !this.result?.next;
      }
    }
  }
  private draw() {
    const owner = this.owner,
      result = this.result,
      g = this.generation;
    if (!owner || !result) return;
    const current = () => this.current(owner, g) && this.result === result && !this.busy;
    this.losses.draw(
      result.npcLosses ?? [],
      current,
      this.confirmLosses
        ? (losses, valid) => this.confirmLosses!(losses, owner.combatRevision, valid)
        : undefined,
      this.openNpc,
    );
    const reward = result.rewards;
    this.summary.textContent =
      'Ergebnis: ' +
      (result.outcome || 'ohne Ergebnistext') +
      ' · ' +
      (reward
        ? 'XP-Abschluss bestätigt: ' +
          reward.totalXp +
          ' XP gebucht' +
          (reward.recipientIds.length
            ? ' · ' + reward.shareXp + ' je Empfänger'
            : ' · keine XP-Empfänger') +
          '.'
        : 'Kein XP-Beleg verfügbar.');
    this.rows.replaceChildren();
    if (!result.treasures.length) {
      this.rows.append(node('p', 'Keine zugehörige Beute vorhanden.'));
      return;
    }
    for (const treasure of result.treasures) {
      const row = node('article');
      row.className = 'combat-resolution-treasure';
      row.dataset.treasureId = treasure.id;
      row.append(
        node('strong', treasure.title),
        node(
          'p',
          {
            combat: 'Aus diesem Kampf',
            scene: 'Der Gruppe zugeordnet',
            location: 'Am aktuellen Ort',
          }[treasure.source] +
            ' · ' +
            treasure.available +
            ' von ' +
            treasure.quantity +
            ' Einheiten unvergeben',
        ),
      );
      if (!treasure.available) {
        row.append(node('p', 'Bereits vollständig verteilt.'));
        this.rows.append(row);
        continue;
      }
      const open = node('button', 'Gemeinsam verteilen…');
      open.type = 'button';
      open.onclick = () => {
        void (async () => {
          if (!this.current(owner, g)) return;
          try {
            await this.distribute(treasure.id, owner.sceneId, () => this.current(owner, g));
          } catch (error) {
            if (this.current(owner, g)) this.status.textContent = (error as Error).message;
          }
        })();
      };
      row.append(open);
      this.rows.append(row);
    }
  }
}
