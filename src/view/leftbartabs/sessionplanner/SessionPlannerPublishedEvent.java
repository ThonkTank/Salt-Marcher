package src.view.leftbartabs.sessionplanner;

import java.math.BigDecimal;
import java.util.Objects;

public record SessionPlannerPublishedEvent(Mutation mutation) {

    public SessionPlannerPublishedEvent {
        Objects.requireNonNull(mutation, "mutation");
    }

    public sealed interface Mutation permits SessionPlannerControlsViewInputEvent.CreateSessionTrigger,
            SessionPlannerControlsViewInputEvent.AddParticipantInput,
            SessionPlannerControlsViewInputEvent.RemoveParticipantInput,
            SessionPlannerControlsViewInputEvent.AttachPlanInput,
            SessionPlannerTimelineMainViewInputEvent.SelectEncounterInput,
            SessionPlannerTimelineMainViewInputEvent.SetEncounterAllocationInput,
            SessionPlannerTimelineMainViewInputEvent.MoveEncounterInput,
            SessionPlannerTimelineMainViewInputEvent.RemoveEncounterInput,
            SessionPlannerTimelineMainViewInputEvent.RestGapInput,
            SessionPlannerLootMainViewInputEvent.AddLootPlaceholderTrigger,
            SessionPlannerLootMainViewInputEvent.RemoveLootPlaceholderInput,
            SetEncounterDaysMutation {
    }

    public record SetEncounterDaysMutation(BigDecimal encounterDays) implements Mutation {
        public SetEncounterDaysMutation {
            encounterDays = encounterDays == null ? BigDecimal.ONE : encounterDays;
        }
    }
}
