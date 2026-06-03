package src.domain.party.model.roster;

import java.util.Objects;
import org.jspecify.annotations.Nullable;

public record PartyCharacter(
        long id,
        PartyCharacterIdentity identity,
        PartyCharacterProgress progress,
        PartyCharacterCombatProfile combat,
        PartyMembership membership,
        PartyCharacterTravelState travel
) {
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
            @Nullable PartyMembership membership,
            @Nullable PartyCharacterTravelState travel
    ) {
        this.id = Math.max(1L, id);
        this.identity = Objects.requireNonNull(identity, "identity");
        this.progress = Objects.requireNonNull(progress, "progress");
        this.combat = Objects.requireNonNull(combat, "combat");
        this.membership = Objects.requireNonNullElse(membership, PartyMembership.RESERVE);
        this.travel = travel == null ? PartyCharacterTravelState.attachedWithoutLocation() : travel;
    }

    public static PartyCharacter fromDraft(long id, PartyCharacterDraft draft, PartyMembership membership) {
        return new PartyCharacter(
                id,
                new PartyCharacterIdentity(draft.name(), draft.playerName()),
                PartyCharacterProgress.startingAtLevel(draft.level()),
                new PartyCharacterCombatProfile(draft.passivePerception(), draft.armorClass()),
                membership);
    }

    public PartyCharacter withDraft(PartyCharacterDraft draft) {
        return new PartyCharacter(
                id,
                new PartyCharacterIdentity(draft.name(), draft.playerName()),
                progress.withLevel(draft.level()),
                new PartyCharacterCombatProfile(draft.passivePerception(), draft.armorClass()),
                membership,
                travel);
    }

    public PartyCharacter withMembership(PartyMembership nextMembership) {
        return new PartyCharacter(id, identity, progress, combat, nextMembership, travel);
    }

    public PartyCharacter withAdjustedXp(int xpDelta) {
        return new PartyCharacter(id, identity, progress.adjustXp(xpDelta), combat, membership, travel);
    }

    public PartyCharacter withRest(PartyRestType restType) {
        return new PartyCharacter(id, identity, progress.afterRest(restType), combat, membership, travel);
    }

    public PartyCharacter withTravel(PartyTravelLocation location, boolean attachToPartyToken) {
        return new PartyCharacter(
                id,
                identity,
                progress,
                combat,
                membership,
                new PartyCharacterTravelState(location, attachToPartyToken));
    }
}
