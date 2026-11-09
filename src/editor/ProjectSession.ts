import type {
  AtlasDesktop,
  CommitReceipt,
  PreparedDocument,
  ProjectInfo,
  SaveResult,
} from "./bridge";
import type { EditorDocument } from "./model";

type FileActionOwner = "renderer" | "native";

interface SessionObserver {
  changed(): void;
  persisted(receipt: CommitReceipt): void;
  failed(error: Error): void;
}

const asError = (error: unknown) =>
  error instanceof Error ? error : new Error(String(error));

/** File lifecycle and one ordered writer; accepted changes belong to the document. */
export class ProjectSession {
  private document: EditorDocument | null = null;
  private project: ProjectInfo | null = null;
  private writer: Promise<void> | null = null;
  private fileOwner: FileActionOwner | null = null;
  private recovery = false;
  private failure: Error | null = null;

  constructor(
    private readonly bridge: AtlasDesktop,
    private readonly observer: SessionObserver,
  ) {}

  attach(document: EditorDocument, project: ProjectInfo): void {
    if (this.writer)
      throw new Error("Laufende Schreibaufträge zuerst abschließen.");
    this.document = document;
    this.project = { ...project };
    this.failure = null;
    this.recovery = false;
  }

  get error(): Error | null {
    return this.failure;
  }

  get recovering(): boolean {
    return this.recovery;
  }

  get changingProject(): boolean {
    return this.fileOwner !== null;
  }

  get writing(): boolean {
    return this.writer !== null;
  }

  get editable(): boolean {
    return !this.failure && !this.recovery && !this.changingProject;
  }

  get saved(): boolean {
    return Boolean(
      this.document &&
      this.project?.savedSequence === this.document.sequence &&
      !this.document.active,
    );
  }

  /** New local changes wake the same writer; there is no second pending queue. */
  persist(): void {
    const document = this.document;
    if (!document || this.writer || this.failure || this.recovery) return;
    if (!document.pendingChanges().length) return;
    const run = async () => {
      while (document === this.document) {
        const change = document.pendingChanges()[0];
        if (!change) return;
        const receipt = await this.bridge.commit({
          sessionId: change.sessionId,
          sequence: change.sequence,
          transactionId: change.transactionId,
          patches: change.patches.map(({ key, after }) => ({ key, after })),
        });
        if (document !== this.document) return;
        document.acknowledge(receipt);
        this.observer.persisted(receipt);
      }
    };
    this.writer = run()
      .catch((error: unknown) => {
        if (document === this.document) {
          this.failure = asError(error);
          this.observer.failed(this.failure);
        }
        throw error;
      })
      .finally(() => {
        this.writer = null;
        this.observer.changed();
        // A change may arrive after the drain's final check, before this finally.
        this.persist();
      });
    void this.writer.catch(() => {});
    this.observer.changed();
  }

  /** Wait for every accepted change, including changes accepted during an ACK. */
  async flush(): Promise<void> {
    this.persist();
    while (this.writer) await this.writer;
    if (this.failure) throw this.failure;
  }

  preparedDocument(): PreparedDocument {
    const document = this.requireDocument();
    return {
      sessionId: document.sessionId,
      sequence: document.sequence,
      persistenceError: this.failure?.message ?? null,
    };
  }

  beginFileAction(owner: FileActionOwner): void {
    if (this.changingProject || this.recovery)
      throw new Error(
        "Ein Datei- oder Wiederherstellungsvorgang ist bereits offen.",
      );
    this.fileOwner = owner;
    this.observer.changed();
  }

  endFileAction(owner: FileActionOwner): void {
    if (this.fileOwner !== owner) return;
    this.fileOwner = null;
    this.observer.changed();
  }

  /** A failed write still permits the host to offer explicit Discard or Cancel. */
  async prepareFileAction(): Promise<PreparedDocument> {
    await this.flush().catch(() => {});
    return this.preparedDocument();
  }

  async changeProject(empty: boolean): Promise<ProjectInfo | null> {
    const prepared = await this.prepareFileAction();
    return empty
      ? this.bridge.newProject(prepared)
      : this.bridge.openProject(prepared);
  }

  async save(saveAs = false): Promise<SaveResult | null> {
    if (this.changingProject) return null;
    const document = this.requireDocument();
    if (this.failure) await this.recover();
    await this.flush();
    if (document !== this.document)
      throw new Error("Das Projekt wurde inzwischen gewechselt.");
    const boundary = {
      sessionId: document.sessionId,
      sequence: document.sequence,
    };
    const result = await this.bridge.saveProject({
      ...boundary,
      saveAs,
    });
    if (result && document === this.document && this.project) {
      if (
        result.sessionId !== boundary.sessionId ||
        result.savedSequence !== boundary.sequence ||
        !Number.isSafeInteger(result.sequence) ||
        result.sequence < boundary.sequence ||
        result.sequence > document.sequence ||
        typeof result.path !== "string" ||
        !result.path
      )
        throw new Error(
          "Die gespeicherte Datei gehört nicht zum reservierten Dokumentstand.",
        );
      this.project.savedSequence = result.savedSequence;
      this.project.path = result.path;
      this.observer.changed();
    }
    return result;
  }

  /** Verify/replay the original IDs after a lost ACK; never guess which write ran. */
  async recover(): Promise<void> {
    if (this.recovery)
      throw new Error("Der Speicherstand wird bereits geprüft.");
    const document = this.requireDocument();
    this.recovery = true;
    this.observer.changed();
    try {
      await this.writer?.catch(() => {});
      const actual = await this.bridge.status();
      if (
        document !== this.document ||
        actual.sessionId !== document.sessionId ||
        actual.sequence < document.persistedSequence ||
        actual.sequence > document.sequence
      )
        throw new Error(
          "Die Arbeitskopie passt nicht zum erhaltenen Editorstand. Änderungen bleiben im Editor; sie wurden nicht verworfen.",
        );
      let checkedSequence = actual.sequence;
      for (const change of document.pendingChanges()) {
        if (change.sequence > checkedSequence + 1)
          throw new Error(
            "Die ausstehenden Änderungen sind nicht lückenlos wiederherstellbar.",
          );
        const receipt = await this.bridge.commit({
          sessionId: change.sessionId,
          sequence: change.sequence,
          transactionId: change.transactionId,
          patches: change.patches.map(({ key, after }) => ({ key, after })),
        });
        if (document !== this.document)
          throw new Error("Das Projekt wurde inzwischen gewechselt.");
        document.acknowledge(receipt);
        checkedSequence = Math.max(checkedSequence, receipt.sequence);
        this.observer.persisted(receipt);
      }
      if (checkedSequence !== document.sequence)
        throw new Error(
          "Die Arbeitskopie enthält noch nicht alle angenommenen Änderungen.",
        );
      this.failure = null;
    } catch (error) {
      this.failure = asError(error);
      this.observer.failed(this.failure);
      throw error;
    } finally {
      this.recovery = false;
      this.observer.changed();
    }
  }

  private requireDocument(): EditorDocument {
    if (!this.document) throw new Error("Das Projekt ist noch nicht geöffnet.");
    return this.document;
  }
}
