package src.domain.party.published;

import org.jspecify.annotations.Nullable;

public record RestCadenceStatus(
        @Nullable Long characterId,
        RestMilestone nextMilestone,
        int xpDelta,
        RestCadenceUrgency urgency
) {

    public RestCadenceStatus {
        nextMilestone = nextMilestone == null ? RestMilestone.LONG_REST : nextMilestone;
        urgency = urgency == null ? RestCadenceUrgency.NORMAL : urgency;
    }
}
