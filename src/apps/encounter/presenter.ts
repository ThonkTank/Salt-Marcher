// src/apps/encounter/presenter.ts
// Presenter orchestrating encounter state, persistence and updates from the
// session-store. It is intentionally UI-agnostic so it can be unit-tested and
// reused by different view implementations (Obsidian ItemView, future mobile UI,
// etc.).

import {
    DND5E_XP_THRESHOLDS,
    addPartyMember as storeAddPartyMember,
    addRule as storeAddRule,
    getEncounterXpState,
    publishEncounterEvent,
    removePartyMember as storeRemovePartyMember,
    removeRule as storeRemoveRule,
    replaceEncounterXpState,
    setEncounterXp as storeSetEncounterXp,
    subscribeEncounterXpState,
    subscribeToEncounterEvents,
    type EncounterEvent,
    type EncounterPartyMember,
    type EncounterRuleScope,
    type EncounterXpRule,
    type EncounterXpState,
    updateEncounterXpState,
    updatePartyMember as storeUpdatePartyMember,
    updateRule as storeUpdateRule,
} from "./session-store";

export interface EncounterPersistedState {
    session: EncounterSessionState | null;
    xp: EncounterXpState;
}

export interface EncounterSessionState {
    event: EncounterEvent;
    notes: string;
    status: EncounterResolutionStatus;
    resolvedAt?: string | null;
}

export type EncounterResolutionStatus = "pending" | "resolved";

export interface EncounterPresenterDeps {
    now?(): string;
}

export interface EncounterXpRuleMemberEffectView {
    readonly memberId: string;
    readonly memberName: string;
    readonly delta: number;
}

export interface EncounterXpRuleView {
    readonly rule: EncounterXpRule;
    readonly totalDelta: number;
    readonly perMemberDeltas: ReadonlyArray<EncounterXpRuleMemberEffectView>;
    readonly warnings: ReadonlyArray<string>;
}

export interface EncounterXpPartyMemberView {
    readonly member: EncounterPartyMember;
    readonly baseXp: number;
    readonly modifiersDelta: number;
    readonly totalXp: number;
    readonly xpToNextLevel: number | null;
    readonly warnings: ReadonlyArray<string>;
}

export interface EncounterXpViewModel {
    readonly baseEncounterXp: number;
    readonly totalEncounterXp: number;
    readonly party: ReadonlyArray<EncounterXpPartyMemberView>;
    readonly rules: ReadonlyArray<EncounterXpRuleView>;
    readonly warnings: ReadonlyArray<string>;
}

export interface EncounterViewState extends EncounterPersistedState {
    readonly xpView: EncounterXpViewModel;
}

export type EncounterStateListener = (state: EncounterViewState) => void;

const defaultDeps: Required<EncounterPresenterDeps> = {
    now: () => new Date().toISOString(),
};

export class EncounterPresenter {
    private persisted: EncounterPersistedState;
    private viewState: EncounterViewState;
    private readonly deps: Required<EncounterPresenterDeps>;
    private readonly listeners = new Set<EncounterStateListener>();
    private unsubscribeStore?: () => void;
    private unsubscribeXpStore?: () => void;

    constructor(initial?: EncounterPersistedState | null, deps?: EncounterPresenterDeps) {
        this.deps = { ...defaultDeps, ...deps };
        this.persisted = EncounterPresenter.normalise(initial);
        this.viewState = EncounterPresenter.createViewState(this.persisted);
        this.unsubscribeStore = subscribeToEncounterEvents((event) => this.applyEvent(event));
        this.unsubscribeXpStore = subscribeEncounterXpState((xp) => this.applyXpState(xp));
        if (initial?.xp) {
            replaceEncounterXpState(this.persisted.xp);
        }
    }

    dispose() {
        this.unsubscribeStore?.();
        this.unsubscribeXpStore?.();
        this.listeners.clear();
    }

    /** Restores persisted state (e.g. when `setViewData` fires before `onOpen`). */
    restore(state: EncounterPersistedState | null) {
        const normalisedSession = EncounterPresenter.normaliseSession(state?.session);
        this.persisted = {
            ...this.persisted,
            session: normalisedSession,
        };
        if (state?.xp) {
            replaceEncounterXpState(EncounterPresenter.normaliseXpState(state.xp));
        } else {
            this.emit();
        }
    }

    getState(): EncounterViewState {
        return this.viewState;
    }

    subscribe(listener: EncounterStateListener): () => void {
        this.listeners.add(listener);
        listener(this.viewState);
        return () => {
            this.listeners.delete(listener);
        };
    }

    setNotes(notes: string) {
        if (!this.persisted.session) return;
        if (this.persisted.session.notes === notes) return;
        this.persisted = {
            ...this.persisted,
            session: {
                ...this.persisted.session,
                notes,
            },
        };
        this.emit();
    }

    markResolved() {
        const session = this.persisted.session;
        if (!session) return;
        if (session.status === "resolved") return;
        this.persisted = {
            ...this.persisted,
            session: {
                ...session,
                status: "resolved",
                resolvedAt: this.deps.now(),
            },
        };
        this.emit();
    }

    reset() {
        if (!this.persisted.session) return;
        this.persisted = {
            ...this.persisted,
            session: null,
        };
        this.emit();
    }

    setEncounterXp(value: number) {
        const sanitized = sanitizeNonNegativeNumber(value);
        if (sanitized === this.persisted.xp.encounterXp) return;
        storeSetEncounterXp(sanitized);
    }

    addPartyMember(member: EncounterPartyMember) {
        const sanitized = EncounterPresenter.normalisePartyMember(member);
        if (this.persisted.xp.party.some((existing) => existing.id === sanitized.id)) {
            this.updatePartyMember(sanitized.id, sanitized);
            return;
        }
        storeAddPartyMember(sanitized);
    }

    updatePartyMember(id: string, patch: Partial<EncounterPartyMember>) {
        const existing = this.persisted.xp.party.find((member) => member.id === id);
        if (!existing) return;
        const sanitizedPatch = EncounterPresenter.normalisePartyMemberPatch(patch, existing);
        const next = { ...existing, ...sanitizedPatch };
        if (shallowEqualPartyMembers(existing, next)) return;
        storeUpdatePartyMember(id, sanitizedPatch);
    }

    removePartyMember(id: string) {
        if (!this.persisted.xp.party.some((member) => member.id === id)) return;
        storeRemovePartyMember(id);
    }

    addRule(rule: EncounterXpRule) {
        const sanitized = EncounterPresenter.normaliseRule(rule);
        if (this.persisted.xp.rules.some((existing) => existing.id === sanitized.id)) {
            this.updateRule(sanitized.id, sanitized);
            return;
        }
        storeAddRule(sanitized);
    }

    updateRule(id: string, patch: Partial<EncounterXpRule>) {
        const existing = this.persisted.xp.rules.find((rule) => rule.id === id);
        if (!existing) return;
        const sanitizedPatch = EncounterPresenter.normaliseRulePatch(patch, existing);
        const next = { ...existing, ...sanitizedPatch };
        if (shallowEqualRules(existing, next)) return;
        storeUpdateRule(id, sanitizedPatch);
    }

    toggleRule(id: string, enabled?: boolean) {
        const existing = this.persisted.xp.rules.find((rule) => rule.id === id);
        if (!existing) return;
        const nextEnabled = enabled ?? !existing.enabled;
        if (existing.enabled === nextEnabled) return;
        storeUpdateRule(id, { enabled: nextEnabled });
    }

    moveRule(id: string, targetIndex: number) {
        updateEncounterXpState((draft) => {
            const currentIndex = draft.rules.findIndex((rule) => rule.id === id);
            if (currentIndex === -1) return;
            const normalisedIndex = clampIndex(targetIndex, draft.rules.length);
            if (normalisedIndex === currentIndex) return;
            const [rule] = draft.rules.splice(currentIndex, 1);
            draft.rules.splice(normalisedIndex, 0, rule);
        });
    }

    resetXpState() {
        replaceEncounterXpState({
            party: [],
            encounterXp: 0,
            rules: [],
        });
    }

    private applyEvent(event: EncounterEvent) {
        const prev = this.persisted.session;
        if (!prev || prev.event.id !== event.id) {
            // New encounter: wipe notes/resolution state.
            this.persisted = {
                ...this.persisted,
                session: {
                    event,
                    notes: "",
                    status: "pending",
                },
            };
        } else {
            // Same encounter (e.g. view reopened) → keep notes/resolution.
            this.persisted = {
                ...this.persisted,
                session: {
                    ...prev,
                    event,
                },
            };
        }
        this.emit();
    }

    private applyXpState(xp: EncounterXpState) {
        this.persisted = {
            ...this.persisted,
            xp: EncounterPresenter.normaliseXpState(xp),
        };
        this.emit();
    }

    private emit() {
        this.viewState = EncounterPresenter.createViewState(this.persisted);
        for (const listener of [...this.listeners]) {
            listener(this.viewState);
        }
    }

    private static normalise(initial?: EncounterPersistedState | null): EncounterPersistedState {
        return {
            session: EncounterPresenter.normaliseSession(initial?.session),
            xp: EncounterPresenter.normaliseXpState(initial?.xp ?? getEncounterXpState()),
        };
    }

    private static createViewState(persisted: EncounterPersistedState): EncounterViewState {
        return {
            session: persisted.session,
            xp: persisted.xp,
            xpView: deriveEncounterXpView(persisted.xp),
        };
    }

    private static normaliseSession(session?: EncounterSessionState | null): EncounterSessionState | null {
        if (!session || !session.event) {
            return null;
        }
        const status: EncounterResolutionStatus = session.status === "resolved" ? "resolved" : "pending";
        return {
            event: session.event,
            notes: session.notes ?? "",
            status,
            resolvedAt: session.resolvedAt ?? null,
        };
    }

    private static normaliseXpState(xp?: EncounterXpState | null): EncounterXpState {
        const baseEncounterXp = sanitizeNonNegativeNumber(xp?.encounterXp ?? 0);
        const party = Object.freeze((xp?.party ?? []).map((member) => ({
            ...EncounterPresenter.normalisePartyMember(member),
        }))) as ReadonlyArray<EncounterPartyMember>;
        const rules = Object.freeze((xp?.rules ?? []).map((rule) => ({
            ...EncounterPresenter.normaliseRule(rule),
        }))) as ReadonlyArray<EncounterXpRule>;
        return {
            party,
            encounterXp: baseEncounterXp,
            rules,
        };
    }

    private static normalisePartyMember(member: EncounterPartyMember): EncounterPartyMember {
        return {
            ...member,
            level: sanitizeLevel(member.level),
            currentXp: sanitizeOptionalNonNegativeNumber(member.currentXp),
        };
    }

    private static normalisePartyMemberPatch(
        patch: Partial<EncounterPartyMember>,
        existing: EncounterPartyMember,
    ): Partial<EncounterPartyMember> {
        const next: Partial<EncounterPartyMember> = {};
        if (patch.name !== undefined) {
            next.name = patch.name;
        }
        if (patch.level !== undefined) {
            next.level = sanitizeLevel(patch.level);
        }
        if (patch.currentXp !== undefined) {
            next.currentXp = sanitizeOptionalNonNegativeNumber(patch.currentXp);
        }
        if (patch.currentXp === null) {
            next.currentXp = undefined;
        }
        if (patch.id !== undefined && patch.id !== existing.id) {
            next.id = existing.id;
        }
        return next;
    }

    private static normaliseRule(rule: EncounterXpRule): EncounterXpRule {
        return {
            ...rule,
            modifierValue: EncounterPresenter.normaliseRuleModifierValue(rule.modifierType, rule.modifierValue),
            enabled: rule.enabled !== false,
            scope: sanitizeRuleScope(rule.scope),
            notes: rule.notes ?? (rule.notes === "" ? "" : undefined),
        };
    }

    private static normaliseRulePatch(
        patch: Partial<EncounterXpRule>,
        existing: EncounterXpRule,
    ): Partial<EncounterXpRule> {
        const next: Partial<EncounterXpRule> = {};
        if (patch.title !== undefined) {
            next.title = patch.title;
        }
        if (patch.scope !== undefined) {
            next.scope = sanitizeRuleScope(patch.scope);
        }
        if (patch.modifierType !== undefined) {
            next.modifierType = patch.modifierType;
        }
        if (patch.modifierValue !== undefined) {
            const modifierType = patch.modifierType ?? existing.modifierType;
            next.modifierValue = EncounterPresenter.normaliseRuleModifierValue(modifierType, patch.modifierValue);
        } else if (patch.modifierType !== undefined) {
            next.modifierValue = EncounterPresenter.normaliseRuleModifierValue(
                patch.modifierType,
                existing.modifierValue,
            );
        }
        if (patch.enabled !== undefined) {
            next.enabled = !!patch.enabled;
        }
        if (patch.notes !== undefined) {
            next.notes = patch.notes;
        }
        return next;
    }

    private static normaliseRuleModifierValue(type: EncounterXpRule["modifierType"], value: number): number {
        if (type === "flat" || type === "flatPerAverageLevel" || type === "flatPerTotalLevel") {
            return sanitizeNumber(value);
        }
        return clampPercentage(sanitizeNumber(value));
    }
}

interface MutableEncounterXpPartyMemberView {
    member: EncounterPartyMember;
    baseXp: number;
    modifiersDelta: number;
    totalXp: number;
    xpToNextLevel: number | null;
    warnings: string[];
}

function deriveEncounterXpView(state: EncounterXpState): EncounterXpViewModel {
    const party = state.party ?? [];
    const baseEncounterXp = sanitizeNonNegativeNumber(state.encounterXp ?? 0);
    const partyCount = party.length;
    const basePerMember = partyCount > 0 ? baseEncounterXp / partyCount : 0;
    const globalWarnings: string[] = [];
    if (partyCount === 0 && baseEncounterXp > 0) {
        pushWarning(globalWarnings, "Encounter XP assigned but no party members present.");
    }

    const members: MutableEncounterXpPartyMemberView[] = party.map((member) => {
        const xpToNext = calculateXpToNextLevel(member.level, member.currentXp);
        const warnings: string[] = [];
        if (xpToNext === null) {
            const sanitizedLevel = sanitizeLevel(member.level);
            if (sanitizedLevel >= 20) {
                pushWarning(warnings, "Maximum level reached.");
            } else {
                pushWarning(warnings, "XP threshold for next level unavailable.");
            }
        }
        return {
            member,
            baseXp: basePerMember,
            modifiersDelta: 0,
            totalXp: basePerMember,
            xpToNextLevel: xpToNext,
            warnings,
        };
    });

    const ruleViews: EncounterXpRuleView[] = [];

    for (const rule of state.rules ?? []) {
        const ruleWarnings: string[] = [];
        const perMemberDeltas: EncounterXpRuleMemberEffectView[] = [];
        let totalDelta = 0;

        if (!rule.enabled) {
            for (const member of members) {
                perMemberDeltas.push({
                    memberId: member.member.id,
                    memberName: member.member.name,
                    delta: 0,
                });
            }
            ruleViews.push({ rule, totalDelta, perMemberDeltas, warnings: ruleWarnings });
            continue;
        }

        if (!partyCount) {
            if (rule.modifierValue !== 0) {
                pushWarning(ruleWarnings, "Rule effect ignored because no party members are present.");
            }
            ruleViews.push({ rule, totalDelta, perMemberDeltas, warnings: ruleWarnings });
            for (const warning of ruleWarnings) {
                pushWarning(globalWarnings, warning);
            }
            continue;
        }

        if (rule.scope !== "xp") {
            for (const member of members) {
                perMemberDeltas.push({
                    memberId: member.member.id,
                    memberName: member.member.name,
                    delta: 0,
                });
            }
            ruleViews.push({ rule, totalDelta, perMemberDeltas, warnings: ruleWarnings });
            continue;
        }

        const appendMemberDelta = (member: MutableEncounterXpPartyMemberView, delta: number) => {
            member.modifiersDelta += delta;
            member.totalXp += delta;
            perMemberDeltas.push({
                memberId: member.member.id,
                memberName: member.member.name,
                delta,
            });
            totalDelta += delta;
        };

        switch (rule.modifierType) {
            case "flat": {
                const perMember = rule.modifierValue / partyCount;
                for (const member of members) {
                    appendMemberDelta(member, perMember);
                }
                break;
            }
            case "flatPerAverageLevel": {
                let totalLevels = 0;
                for (const member of members) {
                    totalLevels += sanitizeLevel(member.member.level);
                }
                const averageLevel = totalLevels / partyCount;
                const totalAverageDelta = rule.modifierValue * averageLevel;
                const perMember = totalAverageDelta / partyCount;
                for (const member of members) {
                    appendMemberDelta(member, perMember);
                }
                break;
            }
            case "flatPerTotalLevel": {
                for (const member of members) {
                    const sanitizedLevel = sanitizeLevel(member.member.level);
                    const delta = rule.modifierValue * sanitizedLevel;
                    appendMemberDelta(member, delta);
                }
                break;
            }
            case "percentTotal": {
                const percent = rule.modifierValue / 100;
                for (const member of members) {
                    const delta = member.totalXp * percent;
                    appendMemberDelta(member, delta);
                }
                break;
            }
            case "percentNextLevel": {
                let aggregateNext = 0;
                for (const member of members) {
                    if (member.xpToNextLevel == null) {
                        pushWarning(ruleWarnings, `${member.member.name} has no next-level XP threshold.`);
                        continue;
                    }
                    aggregateNext += member.xpToNextLevel;
                }
                if (aggregateNext === 0) {
                    for (const member of members) {
                        perMemberDeltas.push({
                            memberId: member.member.id,
                            memberName: member.member.name,
                            delta: 0,
                        });
                    }
                    break;
                }
                const total = aggregateNext * (rule.modifierValue / 100);
                const perMember = total / partyCount;
                for (const member of members) {
                    appendMemberDelta(member, perMember);
                }
                break;
            }
        }

        ruleViews.push({ rule, totalDelta, perMemberDeltas, warnings: ruleWarnings });
        for (const warning of ruleWarnings) {
            pushWarning(globalWarnings, warning);
        }
    }

    const finalParty: EncounterXpPartyMemberView[] = members.map((member) => ({
        member: member.member,
        baseXp: member.baseXp,
        modifiersDelta: member.modifiersDelta,
        totalXp: member.totalXp,
        xpToNextLevel: member.xpToNextLevel,
        warnings: member.warnings,
    }));

    const totalEncounterXp = finalParty.reduce((sum, member) => sum + member.totalXp, 0);

    return {
        baseEncounterXp,
        totalEncounterXp,
        party: finalParty,
        rules: ruleViews,
        warnings: globalWarnings,
    };
}

export function calculateXpToNextLevel(level: number, currentXp?: number): number | null {
    const sanitizedLevel = sanitizeLevel(level);
    if (sanitizedLevel >= 20) {
        return null;
    }
    const currentThreshold = DND5E_XP_THRESHOLDS[sanitizedLevel];
    const nextThreshold = DND5E_XP_THRESHOLDS[sanitizedLevel + 1];
    if (typeof currentThreshold !== "number" || typeof nextThreshold !== "number") {
        return null;
    }
    const effectiveCurrentXp = sanitizeOptionalNonNegativeNumber(currentXp) ?? currentThreshold;
    if (effectiveCurrentXp >= nextThreshold) {
        return 0;
    }
    return nextThreshold - effectiveCurrentXp;
}

function sanitizeRuleScope(scope: unknown): EncounterRuleScope {
    if (scope === "gold") {
        return "gold";
    }
    return "xp";
}

function sanitizeNumber(value: unknown): number {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        return 0;
    }
    return value;
}

function sanitizeNonNegativeNumber(value: unknown): number {
    const numeric = sanitizeNumber(value);
    return numeric < 0 ? 0 : numeric;
}

function sanitizeOptionalNonNegativeNumber(value: unknown): number | undefined {
    if (value === null || value === undefined) {
        return undefined;
    }
    return sanitizeNonNegativeNumber(value);
}

function sanitizeLevel(level: unknown): number {
    const numeric = Math.floor(sanitizeNumber(level));
    return numeric < 1 ? 1 : numeric;
}

function clampPercentage(value: number): number {
    if (!Number.isFinite(value)) {
        return 0;
    }
    if (value > 100) return 100;
    if (value < -100) return -100;
    return value;
}

function clampIndex(index: number, length: number): number {
    if (length <= 0) return 0;
    if (!Number.isFinite(index)) return 0;
    const truncated = Math.trunc(index);
    if (truncated < 0) return 0;
    if (truncated >= length) return length - 1;
    return truncated;
}

function pushWarning(collection: string[], warning: string) {
    if (!warning) return;
    if (!collection.includes(warning)) {
        collection.push(warning);
    }
}

function shallowEqualPartyMembers(a: EncounterPartyMember, b: EncounterPartyMember): boolean {
    return (
        a.id === b.id &&
        a.name === b.name &&
        a.level === b.level &&
        (a.currentXp ?? undefined) === (b.currentXp ?? undefined)
    );
}

function shallowEqualRules(a: EncounterXpRule, b: EncounterXpRule): boolean {
    return (
        a.id === b.id &&
        a.title === b.title &&
        a.modifierType === b.modifierType &&
        a.modifierValue === b.modifierValue &&
        a.enabled === b.enabled &&
        a.scope === b.scope &&
        (a.notes ?? "") === (b.notes ?? "")
    );
}

// Convenience helper for tests & manual triggers.
export function publishManualEncounter(event: Omit<EncounterEvent, "source">) {
    publishEncounterEvent({ ...event, source: "manual" });
}

