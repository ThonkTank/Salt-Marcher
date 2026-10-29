import type { ManualPlan } from '../../features/planner/manual-planner';
import type { EditorSession } from '../shared/editor-session';
import type { Note } from './note-data';
import {
  preparationTarget,
  type Preparation,
  type PreparationAPI,
  type PreparationChange,
  type PreparationCommand,
  type PreparationEdit,
} from './preparation-contracts';
import { PreparationDraftOwner, preparationDraftKey } from './preparation-draft-owner';

type WritePorts = {
  api: PreparationAPI;
  session: EditorSession;
  drafts: PreparationDraftOwner;
  context(): { token: string; campaignId: string } | null;
  acceptPreparation(data: Preparation): void;
  acceptPlan(plan: ManualPlan | null, id: string): void;
  confirmedNote(id: string): Note | undefined;
  refreshSearch(): Promise<void>;
  redraw(kind: PreparationChange['kind']): Promise<void>;
  afterResolved(change: PreparationChange, current: () => boolean): Promise<void>;
  afterSaved(change: PreparationEdit, beforeNote?: Note): Promise<boolean>;
  changed(): void;
  feedback(text: string, error?: boolean): void;
  mergePending(): boolean;
  composing(): boolean;
  flushNarrative(): Promise<boolean>;
  flushPlanning(): Promise<boolean>;
  cancelAutosave(): void;
};

/** One authority for accepted commands, acknowledgements and the ordered drain.
 * Views receive status projections and named actions, never this mutable state. */
export class PreparationWriteCoordinator {
  readonly #failed;
  readonly #flush;
  readonly #accepted;
  readonly #changes = new Set<Promise<void>>();
  #blocked = false;
  constructor(private readonly ports: WritePorts) {
    this.#failed = ports.session.command<PreparationCommand>();
    this.#flush = ports.session.operation<Promise<boolean>>();
    this.#accepted = ports.session.operation<Promise<void>>();
  }
  get blocked() {
    return this.#blocked;
  }
  get failedCommand() {
    return this.#failed.value;
  }
  get changing() {
    return this.#changes.size > 0;
  }
  restoreCommand(command: PreparationCommand) {
    this.#failed.value = command;
    this.#blocked = true;
    this.ports.changed();
  }
  blockConflict() {
    this.#blocked = true;
    this.ports.changed();
  }
  resetVisible() {
    this.#blocked = false;
    this.#failed.value = null;
  }
  resolveCommand(command: PreparationCommand) {
    if (this.#failed.value !== command) return false;
    this.#blocked = false;
    this.#failed.value = null;
    return true;
  }
  async waitForChanges() {
    await Promise.all(this.#changes);
  }
  async change(
    change: PreparationChange,
    redraw = true,
    stillCurrent: () => boolean = () => true,
  ): Promise<boolean> {
    const context = this.ports.context();
    if (!context || this.#blocked || !stillCurrent()) return false;
    if (this.changing) {
      this.ports.feedback('Vorherige Vorbereitung wird noch gespeichert.');
      return false;
    }
    const current = this.ports.session.capture(
      () => [this.ports.context()?.token, this.ports.session.generation],
      stillCurrent,
    );
    const target = preparationTarget(change),
      key = preparationDraftKey(target.kind, target.id);
    const command: PreparationCommand = {
      commandId: crypto.randomUUID(),
      token: context.token,
      campaignId: context.campaignId,
      draftWriteId: this.ports.drafts.saved(key)?.writeId,
      change,
    };
    this.ports.feedback('Wird gespeichert…');
    let complete!: () => void;
    const completion = new Promise<void>((resolve) => {
      complete = resolve;
    });
    this.#changes.add(completion);
    this.#accepted.value = completion;
    try {
      const response =
        command.change.kind === 'plan'
          ? await this.ports.api.changePreparationPlan(command)
          : await this.ports.api.changePreparation(command);
      if (!response.ok) throw new Error(response.error);
      if (!current()) return false;
      if (command.change.kind === 'plan')
        this.ports.acceptPlan(response.value as ManualPlan, command.change.plan.id);
      else this.ports.acceptPreparation(response.value as Preparation);
      if (command.change.kind !== 'plan') await this.ports.refreshSearch();
      if (!current()) return false;
      this.ports.drafts.forget(key);
      if (command.change.kind === 'plan') this.ports.drafts.acknowledge(command.change);
      if (redraw) await this.ports.redraw(command.change.kind);
      if (!current()) return false;
      this.ports.changed();
      this.ports.feedback('Gespeichert.');
      return true;
    } catch (error) {
      if (!current()) return false;
      if (change.kind === 'plan') this.ports.drafts.failedPlan(change.plan);
      this.restoreCommand(command);
      try {
        await this.ports.drafts.retain();
        if (!current()) return false;
        this.ports.feedback(
          (error as Error).message + ' Entwurf gesichert. Kein automatischer Neuversuch.',
          true,
        );
      } catch (draftError) {
        if (!current()) return false;
        this.ports.feedback(
          (error as Error).message +
            ' Entwurf bleibt im Speicher: ' +
            (draftError as Error).message,
          true,
        );
      }
      return false;
    } finally {
      this.#changes.delete(completion);
      complete();
    }
  }
  async flush(skipPlanning = false, skipNarrative = false): Promise<boolean> {
    const current = this.ports.session.capture(() => [this.ports.context()?.token]);
    if (this.ports.mergePending()) return false;
    if (!skipNarrative && !(await this.ports.flushNarrative())) return false;
    if (!current()) return false;
    if (!skipPlanning && !(await this.ports.flushPlanning())) return false;
    if (!current()) return false;
    this.ports.cancelAutosave();
    if (this.#flush.value) {
      const result = await this.#flush.value;
      return result && current() ? this.flush(skipPlanning, skipNarrative) : false;
    }
    if (this.changing) {
      await this.waitForChanges();
      return current() ? this.flush(skipPlanning, skipNarrative) : false;
    }
    if (!this.ports.context()) return true;
    if (this.ports.session.reading || this.#blocked || this.ports.composing()) return false;
    const kinds = ['note', 'plan', 'location'] as const;
    if (!kinds.some((kind) => this.ports.drafts.pending(kind))) {
      if (this.ports.drafts.openInput) {
        await this.ports.drafts.retain();
        if (!current()) return false;
        this.ports.drafts.markOpen(false);
        this.ports.changed();
        this.ports.feedback('Gespeichert.');
      }
      return true;
    }
    this.#flush.value = (async () => {
      for (const kind of kinds) {
        const change = this.ports.drafts.pending(kind);
        if (!change) continue;
        const beforeNote =
          change.kind === 'note' ? this.ports.confirmedNote(change.note.id) : undefined;
        if (!(await this.change(change, false)) || !current()) return false;
        this.ports.drafts.acknowledge(change);
        if (!(await this.ports.afterSaved(change, beforeNote)) || !current()) return false;
      }
      const open = this.ports.drafts.updateOpenInput();
      this.ports.changed();
      this.ports.feedback(
        open ? 'Weitere Vorbereitungseingabe offen – noch nicht gespeichert.' : 'Gespeichert.',
      );
      return true;
    })();
    const okay = await this.#flush.value;
    return okay && current() ? this.flush(skipPlanning, skipNarrative) : false;
  }
  async waitForFlush() {
    return this.#flush.value ? await this.#flush.value : true;
  }
  async reconcile() {
    const command = this.#failed.value,
      context = this.ports.context();
    if (!command || !context) return false;
    const owns = this.ports.session.capture(() => [this.ports.context()?.token]);
    const current = () => owns() && this.#failed.value === command;
    try {
      const response =
        command.change.kind === 'plan'
          ? await this.ports.api.reconcilePreparationPlan(command, context.token)
          : await this.ports.api.reconcilePreparation(command, context.token);
      if (!response.ok) throw new Error(response.error);
      const result = response.value;
      if (!current()) return false;
      if (result.targetChanged || result.outcome === 'conflict') {
        this.ports.feedback(
          result.outcome === 'applied'
            ? 'Speicherung bestätigt, aber der aktuelle Vorbereitungsstand ist verändert oder nicht verlässlich lesbar. Entwurf bleibt offen; sichere den Text vor dem Verwerfen.'
            : 'Vorbereitungskonflikt bestätigt. Entwurf bleibt offen; sichere den Text vor dem Verwerfen.',
          true,
        );
        return false;
      }
      const sourceBefore =
        command.change.kind === 'note' && command.change.excerpt
          ? this.ports.confirmedNote(command.change.excerpt.id)
          : undefined;
      if ('plan' in result && command.change.kind === 'plan')
        this.ports.acceptPlan(result.plan, command.change.plan.id);
      else if ('data' in result) this.ports.acceptPreparation(result.data);
      if (
        !(await this.ports.drafts.reconcileRetained(
          command,
          context.token,
          sourceBefore,
          current,
        )) ||
        !current()
      )
        return false;
      this.resolveCommand(command);
      await this.ports.drafts.retain();
      if (!owns()) return false;
      await this.ports.afterResolved(command.change, owns);
      if (!owns()) return false;
      this.ports.changed();
      this.ports.feedback(
        result.outcome === 'applied'
          ? 'Speicherung der Vorbereitung bestätigt. Weitere Eingaben bleiben offen.'
          : command.change.kind === 'note' && command.change.excerpt
            ? 'Auszug nicht übernommen. Der Originaltext bleibt in der Quelle; dort erneut markieren und ausdrücklich übernehmen.'
            : 'Änderung nicht gespeichert. Eingabe abschließen, um den Entwurf erneut zu übernehmen.',
      );
      return true;
    } catch (error) {
      if (owns()) this.ports.feedback((error as Error).message + ' Status bleibt ungeklärt.', true);
      return false;
    }
  }
}
