package src.domain.party.model.roster.model;

import java.util.Objects;

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

    public PartyCharacter {
        id = Math.max(1L, id);
        identity = Objects.requireNonNull(identity, "identity");
        progress = Objects.requireNonNull(progress, "progress");
        combat = Objects.requireNonNull(combat, "combat");
        membership = Objects.requireNonNullElse(membership, PartyMembership.RESERVE);
        travel = travel == null ? PartyCharacterTravelState.attachedWithoutLocation() : travel;
    }
}
