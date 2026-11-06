import type { Character, CharacterProfile, LiveScene } from './live-scene-contracts';
import type { LiveAck, LiveAction, LiveView } from './live-contracts';

const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
export const liveSceneContent = (scene: LiveScene) => ({
  title: scene.title,
  notes: scene.notes,
  readAloud: scene.readAloud ?? '',
  locationId: scene.locationId,
});

/** Owns confirmed projections, selected character, literal input and CAS bases.
 * Neither a read nor an unrelated receipt confirms newer user input. */
export class LiveDraftOwner {
  private data: LiveView | null = null;
  private selected: string | null = null;
  private characterDraft: Character | null = null;
  private sceneDraft: LiveScene | null = null;
  private readonly content = liveSceneContent;
  get view(): Readonly<LiveView> | null {
    return this.data;
  }
  get selection() {
    return this.selected;
  }
  get character(): Readonly<Character> | null {
    return this.characterDraft;
  }
  get scene(): Readonly<LiveScene> | null {
    return this.sceneDraft;
  }
  originalCharacter = () => this.data?.roster.find((c) => c.id === this.selected);
  characterEdited = () =>
    !!this.characterDraft &&
    (!this.originalCharacter() ||
      !equal(this.characterDraft.profile, this.originalCharacter()!.profile));
  sceneEdited = () =>
    !!this.sceneDraft &&
    (!this.data?.scene || !equal(this.content(this.sceneDraft), this.content(this.data.scene)));
  changed = () => this.characterEdited() || this.sceneEdited();
  reset() {
    this.data = null;
    this.selected = null;
    this.discardInput();
  }
  discardInput() {
    this.characterDraft = null;
    this.sceneDraft = null;
  }
  select(id: string) {
    this.selected = id;
    this.characterDraft = this.originalCharacter()
      ? structuredClone(this.originalCharacter()!)
      : null;
  }
  editProfile(profile: CharacterProfile) {
    if (this.characterDraft) this.characterDraft = { ...this.characterDraft, profile };
  }
  editScene(fields: Partial<Pick<LiveScene, 'title' | 'notes' | 'readAloud' | 'locationId'>>) {
    if (this.sceneDraft) this.sceneDraft = { ...this.sceneDraft, ...fields };
  }
  restoreScene() {
    this.sceneDraft = this.data?.scene ? structuredClone(this.data.scene) : null;
  }
  readFailed() {
    const keepScene = this.sceneEdited(),
      keepCharacter = this.characterEdited();
    this.data = null;
    if (!keepScene) this.sceneDraft = null;
    if (!keepCharacter) this.characterDraft = null;
  }
  acceptClock(scene: Pick<LiveScene, 'id' | 'clock'>): boolean {
    const current = this.data?.scene;
    if (
      !current ||
      current.id !== scene.id ||
      current.clock.epochId !== scene.clock.epochId ||
      current.clock.revision > scene.clock.revision
    )
      return false;
    current.clock = scene.clock;
    for (const row of this.data!.scenes) if (row.id === scene.id) row.clock = scene.clock;
    return true;
  }
  accept(live: LiveView) {
    const dirtyScene = this.sceneEdited(),
      dirtyCharacter = this.characterEdited();
    this.data = live;
    this.selected = live.roster.some((c) => c.id === this.selected)
      ? this.selected
      : (live.roster[0]?.id ?? null);
    this.characterDraft =
      dirtyCharacter && this.characterDraft?.id === this.selected && this.characterEdited()
        ? {
            ...this.originalCharacter()!,
            profile: this.characterDraft!.profile,
            profileRevision: this.characterDraft!.profileRevision,
          }
        : this.originalCharacter()
          ? structuredClone(this.originalCharacter()!)
          : null;
    this.sceneDraft =
      dirtyScene && this.sceneDraft?.id === live.scene?.id && this.sceneEdited()
        ? { ...live.scene!, ...this.content(this.sceneDraft!), revision: this.sceneDraft!.revision }
        : live.scene
          ? structuredClone(live.scene)
          : null;
  }
  acceptAck(ack: LiveAck, action: LiveAction, submittedProfile?: CharacterProfile) {
    if (!this.data) return;
    const priorScene = this.data.scene,
      priorCharacter = this.originalCharacter();
    this.data.rosterRevision = ack.rosterRevision;
    if (ack.archivedRosterCount !== undefined)
      this.data.archivedRosterCount = ack.archivedRosterCount;
    if (ack.character) {
      const current = ack.character;
      this.data.roster = this.data.roster.some((c) => c.id === current.id)
        ? this.data.roster.map((c) => (c.id === current.id ? current : c))
        : [...this.data.roster, current];
      if (current.archived) {
        this.data.roster = this.data.roster.filter((c) => c.id !== current.id);
        if (this.selected === current.id) {
          this.selected = this.data.roster[0]?.id ?? null;
          this.characterDraft = this.originalCharacter()
            ? structuredClone(this.originalCharacter()!)
            : null;
        }
      }
      if (this.characterDraft?.id === current.id) {
        const dirty = priorCharacter && !equal(this.characterDraft.profile, priorCharacter.profile);
        const keepProfile =
          action.kind === 'profile'
            ? !submittedProfile || this.characterDraft.profile !== submittedProfile
            : dirty;
        this.characterDraft = keepProfile
          ? {
              ...current,
              profile: this.characterDraft.profile,
              profileRevision:
                action.kind === 'profile'
                  ? current.profileRevision
                  : this.characterDraft.profileRevision,
            }
          : structuredClone(current);
      }
    }
    if (ack.session) {
      const session = ack.session;
      this.data.primaryId = session.primaryId;
      this.data.focusId = session.focusId;
      this.data.focusRevision = session.focusRevision;
      this.data.archiveCount = session.archiveCount;
      this.data.roster = this.data.roster.map((c) => ({
        ...c,
        ...session.members.find((m) => m.id === c.id),
      }));
      if (this.characterDraft) {
        const m = session.members.find((m) => m.id === this.characterDraft!.id);
        if (m) this.characterDraft = { ...this.characterDraft, ...m };
      }
      this.data.scenes = this.data.scenes
        .filter((s) => !session.retired.some((r) => r.id === s.id))
        .map((s) => ({
          ...s,
          ...session.groups.find((g) => g.id === s.id),
          primary: s.id === session.primaryId,
        }));
      if (session.createdScene && !this.data.scenes.some((s) => s.id === session.createdScene!.id))
        this.data.scenes.push(session.createdScene);
    }
    if (ack.scene) {
      this.data.scene = ack.scene;
      if (action.kind === 'scene-content' && this.sceneDraft?.id === ack.scene.id)
        this.sceneDraft = { ...ack.scene, ...this.content(this.sceneDraft) };
      else if (
        this.sceneDraft?.id === ack.scene.id &&
        priorScene &&
        !equal(this.content(this.sceneDraft), this.content(priorScene))
      )
        this.sceneDraft = {
          ...ack.scene,
          ...this.content(this.sceneDraft),
          revision: this.sceneDraft.revision,
        };
      else this.sceneDraft = structuredClone(ack.scene);
      this.data.scenes = this.data.scenes.map((s) =>
        s.id === ack.scene!.id
          ? {
              ...s,
              title: ack.scene!.title,
              members: ack.scene!.members.length,
              membershipRevision: ack.scene!.membershipRevision,
              clock: ack.scene!.clock,
            }
          : s,
      );
    }
  }
}
