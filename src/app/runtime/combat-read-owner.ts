import type { WorkspaceGeometry } from '../shared/contracts';
import { EditorSession } from '../shared/editor-session';
import type { CombatView } from './combat-contracts';
import type { CombatDraftCache } from './combat-draft-cache';
import type { CombatState } from './combat-state-contracts';

interface Host {
  session: EditorSession;
  api: Pick<Window['campaign'], 'combat'>;
  cache: Pick<CombatDraftCache, 'load'>;
  context: () => {
    workspace: WorkspaceGeometry;
    sceneId: string;
    combat: CombatState | null;
    partyBasis: string;
  } | null;
  accept: (view: CombatView) => void;
  clear: () => void;
  render: () => void;
  lock: () => void;
  renderFighter: () => void;
  renderSelection: () => void;
  renderNotes: () => void;
  revealFighter: () => void;
  listDrafts: () => Promise<unknown>;
  partyChanged: () => void;
  loadingStarted: () => void;
  loaded: () => void;
  tell: (message: string, error?: boolean) => void;
}

/** Owns load targets, selection and every draft-read publication lease.
 * CombatDraftCache alone owns the persisted/raw draft data. */
export class CombatReadOwner {
  private revision = 0;
  private fighterRequest = 0;
  private notesRequest = 0;
  private chosen: string | null = null;
  private pending = false;
  private problem: string | null = null;
  private target: string | null = null;
  private recent: CombatView['recent'] = [];
  private fighterPending = false;
  private notesPending = false;
  constructor(private readonly host: Host) {}
  get version() {
    return this.revision;
  }
  get selected() {
    return this.chosen;
  }
  get loading() {
    return this.pending;
  }
  get error() {
    return this.problem;
  }
  get requestedId() {
    return this.target;
  }
  get knownRecent() {
    return this.recent;
  }
  get editorLoading() {
    return this.fighterPending;
  }
  get notesLoading() {
    return this.notesPending;
  }
  invalidate() {
    this.revision++;
  }
  reset() {
    this.invalidate();
    this.fighterRequest++;
    this.notesRequest++;
    this.pending = false;
    this.problem = null;
    this.target = null;
    this.recent = [];
    this.fighterPending = false;
    this.notesPending = false;
    this.chosen = null;
  }
  accept(view: CombatView) {
    this.target = view.combat?.id ?? null;
    this.recent = view.recent;
  }
  retainSelection(combat: CombatState | null) {
    if (this.chosen && !combat?.participants.some((p) => p.id === this.chosen)) this.chosen = null;
  }
  choose = async (id: string) => {
    const basis = this.host.context();
    if (!basis?.combat) return;
    this.chosen = id;
    const lease = this.host.session.read(),
      request = ++this.fighterRequest,
      combatId = basis.combat.id;
    const current = () =>
      lease.current() &&
      request === this.fighterRequest &&
      this.chosen === id &&
      this.host.context()?.combat?.id === combatId;
    this.fighterPending = true;
    this.host.renderFighter();
    this.host.renderSelection();
    this.host.lock();
    try {
      await this.host.cache.load(
        basis.workspace.token,
        basis.workspace.campaign.id,
        combatId,
        'fighter',
        id,
      );
    } catch (error) {
      if (current()) this.host.tell((error as Error).message, true);
    } finally {
      if (current()) {
        this.fighterPending = false;
        this.host.renderFighter();
        this.host.lock();
        this.host.revealFighter();
      }
      lease.finish();
    }
  };
  loadNotes = async () => {
    const basis = this.host.context();
    if (!basis?.combat) return;
    const lease = this.host.session.read(),
      request = ++this.notesRequest,
      id = basis.combat.id;
    const current = () =>
      lease.current() && request === this.notesRequest && this.host.context()?.combat?.id === id;
    this.notesPending = true;
    this.host.lock();
    try {
      await this.host.cache.load(
        basis.workspace.token,
        basis.workspace.campaign.id,
        id,
        'notes',
        id,
      );
    } catch (error) {
      if (current()) this.host.tell((error as Error).message, true);
    } finally {
      if (current()) {
        this.notesPending = false;
        this.host.renderNotes();
        this.host.lock();
      }
      lease.finish();
    }
  };
  load = async (id?: string): Promise<boolean> => {
    const basis = this.host.context();
    if (!basis) return false;
    this.host.loadingStarted();
    this.fighterRequest++;
    this.fighterPending = false;
    const lease = this.host.session.read(),
      request = ++this.revision,
      target = id ?? basis.combat?.id ?? this.target;
    this.target = target ?? null;
    this.pending = true;
    this.problem = null;
    this.host.lock();
    const current = () =>
      lease.current() &&
      request === this.revision &&
      this.host.context()?.workspace.token === basis.workspace.token &&
      this.host.context()?.sceneId === basis.sceneId;
    try {
      const response = await this.host.api.combat(
        basis.workspace.token,
        basis.sceneId,
        target ?? undefined,
      );
      if (!current()) return false;
      if (!response.ok) throw new Error(response.error);
      const result = response.value;
      if (
        (result.combat &&
          (result.combat.sceneId !== basis.sceneId || (target && result.combat.id !== target))) ||
        (target && !result.combat)
      )
        throw new Error('Begegnungsantwort passt nicht zur gewählten Begegnung.');
      this.host.accept(result);
      this.host.render();
      await Promise.all([
        this.loadNotes(),
        this.chosen ? this.choose(this.chosen) : Promise.resolve(),
      ]);
      if (!current()) return false;
      void this.host.listDrafts();
      if (basis.partyBasis !== this.host.context()?.partyBasis) this.host.partyChanged();
      return true;
    } catch (error) {
      if (current()) {
        this.problem = (error as Error).message;
        this.chosen = null;
        this.host.clear();
        this.host.render();
        this.host.tell(this.problem, true);
      }
    } finally {
      if (current()) {
        this.pending = false;
        this.host.lock();
        this.host.loaded();
      }
      lease.finish();
    }
    return false;
  };
}
