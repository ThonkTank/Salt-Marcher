package src.domain.party.entity;

import src.domain.party.api.CharacterDraft;
import src.domain.party.valueobject.PartyMembership;
import src.domain.party.valueobject.PartyRestType;

import java.util.Objects;

public final class PartyCharacter {

    private final long id;
    private final PartyCharacterIdentity identity;
    private final PartyCharacterProgress progress;
    private final PartyCharacterCombatProfile combat;
    private final PartyMembership membership;

    public PartyCharacter(
            long id,
            PartyCharacterIdentity identity,
            PartyCharacterProgress progress,
            PartyCharacterCombatProfile combat,
            PartyMembership membership
    ) {
        this.id = Math.max(1L, id);
        this.identity = Objects.requireNonNull(identity, "identity");
        this.progress = Objects.requireNonNull(progress, "progress");
        this.combat = Objects.requireNonNull(combat, "combat");
        this.membership = Objects.requireNonNullElse(membership, PartyMembership.RESERVE);
    }

    public long id() {
        return id;
    }

    public PartyCharacterIdentity identity() {
        return identity;
    }

    public PartyCharacterProgress progress() {
        return progress;
    }

    public PartyCharacterCombatProfile combat() {
        return combat;
    }

    public PartyMembership membership() {
        return membership;
    }

    public PartyCharacter update(CharacterDraft draft) {
        return new PartyCharacter(
                id,
                new PartyCharacterIdentity(draft.name(), draft.playerName()),
                progress.withLevel(draft.level()),
                new PartyCharacterCombatProfile(draft.passivePerception(), draft.armorClass()),
                membership);
    }

    public PartyCharacter withMembership(PartyMembership nextMembership) {
        return new PartyCharacter(
                id,
                identity,
                progress,
                combat,
                nextMembership);
    }

    public PartyCharacter awardXp(int xpAmount) {
        return new PartyCharacter(
                id,
                identity,
                progress.awardXp(xpAmount),
                combat,
                membership);
    }

    public PartyCharacter afterRest(PartyRestType restType) {
        return new PartyCharacter(id, identity, progress.afterRest(restType), combat, membership);
    }
}
