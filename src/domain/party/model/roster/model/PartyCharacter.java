package src.domain.party.model.roster.model;

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
}
