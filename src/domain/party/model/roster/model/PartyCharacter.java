package src.domain.party.model.roster.model;

import java.util.Objects;
public final class PartyCharacter {

    private final long id;
    private final PartyCharacterIdentity identity;
    private final PartyCharacterProgress progress;
    private final PartyCharacterCombatProfile combat;
    private final PartyMembership membership;
    private final PartyCharacterTravelState travel;

    public PartyCharacter(
            long id,
            PartyCharacterIdentity identity,
            PartyCharacterProgress progress,
            PartyCharacterCombatProfile combat,
            PartyMembership membership
    ) {
        this(
                id,
                identity,
                progress,
                combat,
                membership,
                PartyCharacterTravelState.attachedWithoutLocation());
    }

    public PartyCharacter(
            long id,
            PartyCharacterIdentity identity,
            PartyCharacterProgress progress,
            PartyCharacterCombatProfile combat,
            PartyMembership membership,
            PartyCharacterTravelState travel
    ) {
        this.id = Math.max(1L, id);
        this.identity = Objects.requireNonNull(identity, "identity");
        this.progress = Objects.requireNonNull(progress, "progress");
        this.combat = Objects.requireNonNull(combat, "combat");
        this.membership = Objects.requireNonNullElse(membership, PartyMembership.RESERVE);
        this.travel = travel == null ? PartyCharacterTravelState.attachedWithoutLocation() : travel;
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

    public PartyCharacterTravelState travel() {
        return travel;
    }

    public PartyCharacter update(PartyCharacterDraft draft) {
        return new PartyCharacter(
                id,
                new PartyCharacterIdentity(draft.name(), draft.playerName()),
                progress.withLevel(draft.level()),
                new PartyCharacterCombatProfile(draft.passivePerception(), draft.armorClass()),
                membership,
                travel);
    }

    public PartyCharacter withMembership(PartyMembership nextMembership) {
        return new PartyCharacter(
                id,
                identity,
                progress,
                combat,
                nextMembership,
                travel);
    }

    public PartyCharacter awardXp(int xpAmount) {
        return adjustXp(Math.max(0, xpAmount));
    }

    public PartyCharacter adjustXp(int xpDelta) {
        return new PartyCharacter(
                id,
                identity,
                progress.adjustXp(xpDelta),
                combat,
                membership,
                travel);
    }

    public PartyCharacter afterRest(PartyRestType restType) {
        return new PartyCharacter(id, identity, progress.afterRest(restType), combat, membership, travel);
    }

    public PartyCharacter moveTo(PartyTravelLocation location, boolean attachToPartyToken) {
        return new PartyCharacter(
                id,
                identity,
                progress,
                combat,
                membership,
                new PartyCharacterTravelState(location, attachToPartyToken));
    }
}
