package src.view.leftbartabs.sessionplanner;

import java.math.BigDecimal;
import java.util.Objects;

public record SessionPlannerPublishedEvent(Mutation mutation) {

    public SessionPlannerPublishedEvent {
        Objects.requireNonNull(mutation, "mutation");
    }

    public sealed interface Mutation permits SessionPlannerViewInputEvent.SimpleActionInput,
            SessionPlannerViewInputEvent.ParticipantInput, SetEncounterDaysMutation,
            SessionPlannerViewInputEvent.AttachPlanInput, SessionPlannerViewInputEvent.EncounterActionInput,
            SessionPlannerViewInputEvent.MoveEncounterInput, SessionPlannerViewInputEvent.EncounterAllocationInput,
            SessionPlannerViewInputEvent.RestGapInput, SessionPlannerViewInputEvent.LootRemovalInput {
    }

    public record SetEncounterDaysMutation(BigDecimal encounterDays) implements Mutation {
        public SetEncounterDaysMutation {
            encounterDays = encounterDays == null ? BigDecimal.ONE : encounterDays;
        }
    }

}
