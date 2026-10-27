import { atlasElement as get, setAtlasText as setText } from './atlas-dom';
import { journeyPlayback } from "./journey-playback";
import { atlasPartyPoint } from "./atlas-runtime-model";
import {atlasWriteReference} from "./atlas-write-recovery";
import type {AtlasWriteReference,AtlasWriteStatus} from "./atlas-write-receipt";
import type { AtlasTravelCommand, AtlasLocalPreview, AtlasTravelAction, } from "./atlas-travel-contracts";
import { openWorld, atlasWorldTravelState, previewAtlasWorldTravel, startAtlasWorldTravel, refreshWorldAfterAtlasTravel } from "./world-ui";
import { atlasFrame, localToAtlas } from "./campaign-atlas-model";
import type { AtlasRenderView } from "./campaign-atlas-contracts";
import type { WorkspaceGeometry, Point } from "./contracts";
import { atlasDungeonState, openDungeon } from "./dungeon-ui";
interface AtlasJourneyHost {
    readonly data: AtlasRenderView | null;
    readonly owner: WorkspaceGeometry | null;
    readonly busy: boolean;
    readonly family: string;
    readonly refresh: (keepScene?: boolean) => Promise<boolean | undefined>;
    readonly render: (preview?: boolean) => void;
    readonly opts: {
        flush: () => Promise<boolean>;
        status: (text: string, error?: boolean) => void;
    };
    readonly error: (error: unknown) => void;
    readonly confirmed: () => void;
    readonly projected: () => void;
    readonly root: HTMLElement;
    readonly lastPoint: Point;
    readonly canvas: HTMLCanvasElement;
}
/** Owns travel previews, unresolved commands and journey playback. */
export class AtlasJourney {
    constructor(private host: AtlasJourneyHost) { }
    busy=false;
    invalidatePreview() {
        this.previewRequest++;
        this.retainedPreview = null;
        this.localPreview = null;
        this.playback.stop();
    }
    private retainedPreview: {preview: AtlasLocalPreview; fence: string} | null = null;
    beginContextRead(keepPreview = false) {
        const retry = this.travelReadState === 'failed';
        const preview = keepPreview ? this.localPreview : null;
        const fence = this.host.data?.region?.fence;
        this.invalidatePreview();
        this.retainedPreview = preview && fence ? {preview, fence} : null;
        this.travelReadState = 'loading';
        return retry;
    }
    completeContextRead(fence: string) {
        this.travelReadState = 'ready';
        this.localPreview = this.retainedPreview && this.retainedPreview.fence === fence ? this.retainedPreview.preview : null;
        this.retainedPreview = null;
    }
    failContextRead() {
        this.retainedPreview = null;
        this.travelReadState = 'failed';
    }
    selectEntrance(id: string | null) {
        this.invalidatePreview();
        this.entranceId = id;
    }
    /** A new authorization never changes the saved receipt identity. */
    async activate() {
        this.invalidatePreview();
        this.travelReadState = 'loading';
        this.entranceId = null;
        this.entranceOptions = '';
        this.busy = false;
        this.activation++;
        const owner = this.host.owner;
        if (!owner) return;
        const state = this.newRecovery(owner, 'loading');
        try {
            // An older activation may still be publishing/clearing this campaign's
            // slot. Read after it settles, never authorize travel from an early empty read.
            await this.referenceOperations.get(owner.campaign.id);
            if (!this.current(state)) return;
            await this.loadReference(state);
        } catch (error) {
            if (this.current(state)) this.failRecovery(state, error);
        }
    }
    pendingTravel: AtlasTravelCommand | AtlasWriteReference | {campaignId:string;state:'loading'|'error'} | null = null;
    private recovery: {
        owner: WorkspaceGeometry;
        activation: number;
        phase: 'running'|'loading'|'confirmed-durable-reference'|'error';
        reference: AtlasWriteReference|null;
        durableConfirmed: boolean;
        outcome: AtlasWriteStatus['outcome'];
        error?: string;
    } | null = null;
    private activation = 0;
    private referenceOperations = new Map<string, Promise<unknown>>();
    /** A0.14 can distinguish a completed keep from an attempted/failed keep,
     * even when the worker no longer accepts authorization reads. */
    get recoveryState() {
        const s = this.recovery;
        return s ? {phase:s.phase, running:this.busy, durableConfirmed:s.durableConfirmed,
            reference:s.reference ? structuredClone(s.reference) : null, outcome:s.outcome, error:s.error} : null;
    }
    private newRecovery(owner:WorkspaceGeometry, phase:'loading'|'running') {
        const state = {owner,activation:this.activation,phase,reference:null as AtlasWriteReference|null,durableConfirmed:false,outcome:'unknown' as AtlasWriteStatus['outcome']};
        this.recovery = state;
        this.pendingTravel = {campaignId:owner.campaign.id,state:'loading'};
        return state as NonNullable<AtlasJourney['recovery']>;
    }
    private current(state:NonNullable<AtlasJourney['recovery']>) {
        return this.recovery === state && this.ownsActivation(state);
    }
    private ownsActivation(state:NonNullable<AtlasJourney['recovery']>) {
        return this.host.owner===state.owner && this.activation===state.activation;
    }
    private track<T>(campaignId:string, task:Promise<T>):Promise<T> {
        this.referenceOperations.set(campaignId,task);
        void task.finally(()=>{if(this.referenceOperations.get(campaignId)===task)this.referenceOperations.delete(campaignId);}).catch(()=>{});
        return task;
    }
    private failRecovery(state:NonNullable<AtlasJourney['recovery']>, error:unknown) {
        state.phase = 'error'; state.error = (error as Error).message;
        get('atlas-recover').hidden = false;
        this.playback.stop();
        this.host.error(error);
    }
    private async loadReference(state:NonNullable<AtlasJourney['recovery']>) {
        const r = await window.campaign.atlasWriteReferences(state.owner.campaign.id,state.owner.token);
        if (!this.current(state)) return;
        if (!r.ok) throw Error(r.error);
        const ref = r.value.find(ref=>ref.family==='travel' && ref.campaignId===state.owner.campaign.id);
        state.reference = ref ?? null;
        state.durableConfirmed = !!ref;
        if (ref) {this.pendingTravel=ref;state.phase='confirmed-durable-reference';}
        else {this.pendingTravel=null;this.recovery=null;}
    }
    /** Read the receipt and clear its exact durable slot. Never replay a writer. */
    async recover():Promise<AtlasWriteStatus['outcome']|null> {
        const state = this.recovery;
        if (!state || !this.current(state) || this.busy) return null;
        this.playback.stop(); this.busy=true;
        const task = (async()=>{
            try {
                if (!state.reference || !state.durableConfirmed) {
                    await this.loadReference(state);
                    if (!this.current(state)) return this.recovery===null && this.ownsActivation(state) ? 'not-applied' as const : null;
                }
                const ref = state.reference!;
                const status = await window.campaign.atlasWriteStatus(ref,state.owner.token);
                if (!this.current(state)) return null;
                if (!status.ok) throw Error(status.error);
                state.outcome = status.value.outcome;
                if (state.outcome==='unknown') throw Error('Ausgang des Reiseauftrags weiterhin unbekannt. Speicherstand erneut klären.');
                const cleared = await window.campaign.clearAtlasWriteReference(ref,state.owner.token);
                if (!this.current(state)) return null;
                if (!cleared.ok) throw Error(cleared.error);
                this.pendingTravel=null;this.recovery=null;
                if (state.outcome==='applied') this.host.confirmed();
                return state.outcome;
            } catch(error) {
                if(this.current(state))this.failRecovery(state,error);
                return null;
            } finally {
                if(this.ownsActivation(state) && (!this.recovery || this.recovery===state)) {this.busy=false;this.renderTravel();}
            }
        })();
        return this.track(state.owner.campaign.id,task);
    }
    /** Projection failures retain the confirmed outcome in the Workbench. */
    async projectTravel(owner:WorkspaceGeometry, activation=this.activation) {
        const loaded = await this.host.refresh();
        if(this.host.owner!==owner || this.activation!==activation)return false;
        if(!loaded)throw Error('Reisestand gespeichert. Ansicht erneut laden.');
        await openDungeon();
        if(this.host.owner!==owner || this.activation!==activation)return false;
        await refreshWorldAfterAtlasTravel(owner.token,this.host.data?.geometry.sceneId ?? '');
        if(this.host.owner!==owner || this.activation!==activation)return false;
        this.host.projected();
        get('atlas-save-status').textContent='Reisestand gespeichert';
        this.host.render();
        return true;
    }
    entranceOptions = '';
    travelReadState: "loading" | "ready" | "failed" = "loading";
    previewRequest = 0;
    localPreview: AtlasLocalPreview | null = null;
    entranceId: string | null = null;
    worldPreview() {
        const state = atlasWorldTravelState(), p = state.preview, a = this.host.data;
        return p && state.token === this.host.owner?.token && a?.scene && !a.geometry.position &&
            p.request.sceneId === a.geometry.sceneId && p.request.mapId === a.terrain.id &&
            !get<HTMLButtonElement>("travel-preview-accept").disabled ? p : null;
    }
    renderTravel() {
        const console = document.getElementById("atlas-local-console");
        if (console)
            console.dataset.dungeon = String(!!this.host.data?.geometry.position);
        const unavailable = this.travelReadState === "loading"
            ? "Reisekontext wird geladen …"
            : this.travelReadState === "failed"
                ? "Reisekontext nicht verfügbar. Erneut laden, bevor du weiterreist."
                : !this.host.data?.scene ? "Keine Fokusgruppe für eine Reise vorhanden." : "";
        const locked = this.host.busy || !!this.pendingTravel || !!unavailable;
        get("atlas-context-fields").inert = this.host.family === "travel" && locked;
        const tools = document.getElementById("atlas-workspace-tools");
        if (tools)
            tools.inert = this.host.family === "travel" && locked;
        get("atlas-local-refresh").hidden = this.travelReadState !== "failed";
        get<HTMLButtonElement>("atlas-local-refresh").disabled = this.host.busy;
        // The live surface moves these controls outside atlas-context-fields.
        get<HTMLSelectElement>("atlas-entrance-choice").disabled = locked;
        for (const kind of ["preview", "place", "entrance", "start", "step", "round", "play", "pause", "end"])
            get<HTMLButtonElement>("atlas-local-" + kind).disabled = locked;
        if (unavailable)
            setText("atlas-local-status", unavailable);
        if (!this.host.data)
            return;
        const j = this.host.data.localJourney, dp = this.host.data.geometry.journey, hp = this.host.data.scene?.journey;
        const worldLeg = !this.host.data.geometry.position && hp && ['active', 'paused', 'interrupted'].includes(hp.status) && !j?.status.match(/^(active|paused)$/);
        setText('atlas-local-round', worldLeg ? 'Bis nächste Grenze' : 'Eine Runde');
        const wp = this.worldPreview();
        const text = wp
            ? (wp.distanceMeters / 1000).toFixed(1) + " km · " + (wp.durationSeconds / 3600).toFixed(2) + " h · Ankunft " + wp.arrival + (wp.warnings.length ? " · " + wp.warnings.join(" · ") : "")
            : this.localPreview
                ? this.localPreview.distanceMeters.toFixed(1) +
                    " m · " +
                    this.localPreview.seconds +
                    " s · geprüfte Vorschau"
                : j
                    ? "Lokaler Weg: " +
                        j.status +
                        " · " +
                        j.elapsedSeconds +
                        " / " +
                        j.seconds +
                        " s" +
                        (j.reason ? " · " + j.reason : "")
                    : this.host.data.geometry.position
                        ? "Gruppe im Innenraum. Raumziel wählen und Weg prüfen."
                        : hp
                            ? "Weltreise: " + hp.status
                            : "Ziel in der Karte wählen und Weg prüfen.";
        setText("atlas-local-status", unavailable || text);
        const journeyActive = !!(j || dp || hp);
        for (const kind of ['step', 'round', 'play', 'pause', 'end'])
            get('atlas-local-' + kind).hidden = !journeyActive;
        get<HTMLButtonElement>("atlas-local-start").disabled =
            locked || !(this.localPreview || wp || (this.host.data.geometry.position && atlasDungeonState().preview));
        setText("atlas-local-play", this.playback?.running
            ? "Wiedergabe anhalten"
            : "Wiedergabe starten");
        const at = atlasPartyPoint(this.host.data), pose = this.host.data.geometry.position;
        const near = this.host.data.entrances.filter((e) => {
            const b = this.host.data!.bindings.find((b) => b.kind === "dungeon" && b.ownerId === e.scopeId);
            if (!b ||
                !at ||
                (pose &&
                    (pose.scopeId !== e.scopeId ||
                        pose.floorId !== e.floorId ||
                        pose.roomId !== e.roomId)))
                return false;
            const p = localToAtlas(pose ? e.inside : e.outside, atlasFrame(this.host.data!, b));
            return Math.hypot(p.x - at.x, p.y - at.y) <= 3.048;
        });
        if (!this.entranceId && near.length === 1)
            this.entranceId = near[0]!.id;
        const choices = get<HTMLSelectElement>("atlas-entrance-choice");
        const optionsKey = JSON.stringify([this.entranceId, near.map(e => [e.id, this.host.data!.workspace.rooms.find(r => r.id === e.roomId)?.name ?? 'Eingang'])]);
        if (this.entranceOptions !== optionsKey) {
            this.entranceOptions = optionsKey;
            choices.replaceChildren();
            const empty = document.createElement("option");
            empty.value = "";
            empty.textContent = "Eingang wählen";
            choices.append(empty);
            for (const e of near) {
                const o = document.createElement("option");
                o.value = e.id;
                o.textContent =
                    this.host.data.workspace.rooms.find((r) => r.id === e.roomId)?.name ??
                        "Eingang";
                choices.append(o);
            }
            choices.value = this.entranceId ?? "";
        }
        get("atlas-entrance-field").hidden = near.length < 2;
        const e = this.host.data.entrances.find((e) => e.id === this.entranceId);
        get("atlas-local-entrance").hidden = !e;
        setText("atlas-local-entrance", pose
            ? "Eingang verlassen"
            : "Eingang betreten");
        for (const kind of ["step", "round", "play", "pause", "end"])
            get<HTMLButtonElement>("atlas-local-" + kind).disabled =
                locked ||
                    ![j?.status, dp?.status, hp?.status].some((s) => s === "active" || s === "paused");
    }
    async travel(action: AtlasTravelAction) {
        const owner = this.host.owner, sceneId = this.host.data?.geometry.sceneId;
        if (!owner || !sceneId || this.host.busy || this.pendingTravel || this.travelReadState !== 'ready') return false;
        // Reserve and capture before hashing/persistence yields control.
        const command:AtlasTravelCommand = structuredClone({commandId:crypto.randomUUID(),campaignId:owner.campaign.id,token:owner.token,sceneId,action});
        const state = this.newRecovery(owner,'running');
        this.pendingTravel=structuredClone(command);this.busy=true;
        const task = (async()=>{
            try {
                state.reference = await atlasWriteReference({kind:'travel',command});
                if(!this.current(state))return false;
                const kept = await window.campaign.keepAtlasWriteReference(state.reference,owner.token);
                if(!kept.ok)throw Error('Reiseauftrag nicht gesendet: '+kept.error);
                state.durableConfirmed=true;state.phase='confirmed-durable-reference';
                if(!this.current(state))return false;
                const r = await window.campaign.executeAtlasTravelCommit(command);
                if(!this.current(state))return false;
                if(!r.ok) {
                    if(r.errorKind==='store-outcome-unknown')throw Error('Ausgang des Reiseauftrags unbekannt. Speicherstand klären, bevor du weiterreist.');
                    // Even an ordinary error can follow a commit. Read the receipt.
                    const status=await window.campaign.atlasWriteStatus(state.reference,owner.token);
                    if(!this.current(state))return false;
                    if(!status.ok)throw Error(status.error);
                    state.outcome=status.value.outcome;
                    if(state.outcome==='unknown')throw Error('Ausgang des Reiseauftrags unbekannt. Speicherstand klären, bevor du weiterreist.');
                } else state.outcome='applied';
                const cleared=await window.campaign.clearAtlasWriteReference(state.reference,owner.token);
                if(!this.current(state))return false;
                if(!cleared.ok)throw Error(cleared.error);
                this.pendingTravel=null;this.recovery=null;
                if(state.outcome==='not-applied') {this.host.error(new Error(!r.ok?r.error:'Reiseauftrag nicht gespeichert.'));return false;}
                this.localPreview=null;this.host.confirmed();
                return await this.projectTravel(owner,state.activation);
            } catch(error) {
                if(this.current(state))this.failRecovery(state,error);
                else if(this.ownsActivation(state) && !this.recovery)this.host.error(error);
                return false;
            } finally {
                if(this.ownsActivation(state) && (!this.recovery || this.recovery===state)) {this.busy=false;this.renderTravel();}
            }
        })();
        return this.track(owner.campaign.id,task);
    }
    async travelControl(kind: string) {
        if (kind === "play" && this.playback.running) {
            this.playback.stop();
            return;
        }
        if (kind !== "play") {
            this.playback.stop();
            await this.playback.settled();
        }
        const a = this.host.data;
        if (!a?.scene || this.travelReadState !== "ready" || this.host.busy || this.pendingTravel || this.host.root.hidden)
            return;
        try {
            if (kind === "place") {
                await this.travel({
                    kind: "place",
                    point: this.host.lastPoint,
                    expectedPositionRevision: a.scene.position.revision,
                    expectedMembershipRevision: a.scene.scene.membershipRevision,
                });
                return;
            }
            if (kind === "entrance") {
                const e = a.entrances.find((e) => e.id === this.entranceId);
                if (e) {
                    await this.travel({
                        kind: "entrance",
                        id: e.id,
                        revision: e.revision,
                        direction: a.geometry.position ? "exit" : "enter",
                        expectedPositionRevision: a.scene.position.revision,
                        expectedMembershipRevision: a.scene.scene.membershipRevision,
                    });
                    await openDungeon();
                    await openWorld();
                }
                return;
            }
            if (kind === "preview") {
                if (a.geometry.position) {
                    get("dungeon-plan").click();
                    return;
                }
                const start = atlasPartyPoint(a);
                if (start &&
                    Math.hypot(start.x - this.host.lastPoint.x, start.y - this.host.lastPoint.y) >
                        5000) {
                    this.localPreview = null;
                    await previewAtlasWorldTravel();
                    this.renderTravel();
                    return;
                }
                this.localPreview = null;
                this.host.render();
                const owner = this.host.owner, request = ++this.previewRequest, r = await window.campaign.previewAtlasTravel(this.host.owner!.token, this.host.lastPoint);
                if (owner !== this.host.owner || request !== this.previewRequest || a !== this.host.data || this.host.root.hidden || this.travelReadState !== "ready")
                    return;
                if (!r.ok)
                    throw new Error(r.error);
                if (r.value.sceneId !== a.geometry.sceneId) {
                    this.travelReadState = "failed";
                    this.host.root.dataset.regionState = 'failed';
                    this.host.canvas.setAttribute('aria-busy', 'false');
                    this.localPreview = null;
                    this.host.render();
                    this.renderTravel();
                    throw new Error("Fokusgruppe inzwischen geändert. Reisekontext erneut laden.");
                }
                this.localPreview = r.value;
                this.host.render();
                return;
            }
            if (kind === "start") {
                if (this.localPreview)
                    await this.travel({ kind: "start", preview: this.localPreview });
                else if (a.geometry.position)
                    get("dungeon-confirm").click();
                else if (this.worldPreview())
                    await startAtlasWorldTravel();
                return;
            }
            const j = a.localJourney;
            if (j && ["active", "paused"].includes(j.status)) {
                if (kind === "play") {
                    if (j.status === "paused" && !await this.travel({
                            kind: "resume",
                            id: j.id,
                            expectedRevision: j.revision,
                        })) return;
                    this.playback.play();
                    return;
                }
                await this.travel({
                    kind: kind === "pause"
                        ? j.status === "paused"
                            ? "resume"
                            : "pause"
                        : (kind as "step" | "round" | "end"),
                    id: j.id,
                    expectedRevision: j.revision,
                });
                return;
            }
            if (a.geometry.position) {
                get(kind === "play"
                    ? "dungeon-play"
                    : kind === "pause"
                        ? "dungeon-pause"
                        : kind === "round"
                            ? "dungeon-round-step"
                            : kind === "step"
                                ? "dungeon-step"
                                : "dungeon-end").click();
            }
            else
                get(kind === "play"
                    ? "journey-play"
                    : kind === "pause"
                        ? "journey-pause"
                        : kind === "end"
                            ? "journey-end"
                            : kind === "round"
                                ? "journey-many"
                                : "journey-step").click();
        }
        catch (e) {
            this.host.error(e);
        }
    }
    playback = journeyPlayback({
        read: () => {
            const j = this.host.data?.localJourney;
            if (!j ||
                j.status !== "active" ||
                this.host.root.hidden ||
                document.hidden ||
                !this.host.owner ||
                this.travelReadState !== "ready" || this.pendingTravel || this.host.busy)
                return null;
            return {
                key: this.host.owner.token + ":" + j.id,
                revision: j.revision,
                nextIndex: j.revision,
                seconds: 3600,
            };
        },
        step: async () => {
            const j = this.host.data?.localJourney;
            return (!!j &&
                (await this.travel({
                    kind: "round",
                    id: j.id,
                    expectedRevision: j.revision,
                })));
        },
        changed: () => this.renderTravel(),
    });
}
