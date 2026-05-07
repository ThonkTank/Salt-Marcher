package src.view.leftbartabs.sessionplanner;

import java.math.BigDecimal;
import java.util.Objects;

public record SessionPlannerViewInputEvent(Input input) {

    public SessionPlannerViewInputEvent {
        Objects.requireNonNull(input, "input");
    }

    public sealed interface Input permits SimpleActionInput, ParticipantInput, EncounterDaysInput, AttachPlanInput,
            EncounterActionInput, MoveEncounterInput, EncounterAllocationInput, RestGapInput, LootRemovalInput {
    }

    public record SimpleActionInput(SessionPlannerSimpleAction action)
            implements Input, SessionPlannerPublishedEvent.Mutation {
        public SimpleActionInput {
            action = SessionPlannerSimpleAction.fallback(action);
        }
    }

    public record ParticipantInput(SessionPlannerParticipantChange change)
            implements Input, SessionPlannerPublishedEvent.Mutation {
        public ParticipantInput {
            change = change == null
                    ? new SessionPlannerParticipantChange(SessionPlannerParticipantAction.ADD, 0L)
                    : change;
        }
    }

    public record EncounterDaysInput(String encounterDaysText) implements Input {
        public EncounterDaysInput {
            encounterDaysText = encounterDaysText == null ? "" : encounterDaysText.trim();
        }
    }

    public record AttachPlanInput(SessionPlannerPlanRef plan)
            implements Input, SessionPlannerPublishedEvent.Mutation {
        public AttachPlanInput {
            plan = plan == null ? new SessionPlannerPlanRef(0L) : plan;
        }
    }

    public record EncounterActionInput(
            SessionPlannerEncounterAction action,
            SessionPlannerEncounterRef encounter
    ) implements Input, SessionPlannerPublishedEvent.Mutation {
        public EncounterActionInput {
            action = SessionPlannerEncounterAction.fallback(action);
            encounter = encounter == null ? new SessionPlannerEncounterRef(0L) : encounter;
        }
    }

    public record MoveEncounterInput(SessionPlannerMoveChange change)
            implements Input, SessionPlannerPublishedEvent.Mutation {
        public MoveEncounterInput {
            change = change == null
                    ? new SessionPlannerMoveChange(new SessionPlannerEncounterRef(0L), null)
                    : change;
        }
    }

    public record EncounterAllocationInput(SessionPlannerEncounterAllocationChange change)
            implements Input, SessionPlannerPublishedEvent.Mutation {
        public EncounterAllocationInput {
            change = change == null
                    ? new SessionPlannerEncounterAllocationChange(new SessionPlannerEncounterRef(0L), BigDecimal.ZERO)
                    : change;
        }
    }

    public record RestGapInput(SessionPlannerRestGapChange change)
            implements Input, SessionPlannerPublishedEvent.Mutation {
        public RestGapInput {
            change = change == null
                    ? new SessionPlannerRestGapChange(
                            new SessionPlannerRestGapRef(0L, 0L),
                            null)
                    : change;
        }
    }

    public record LootRemovalInput(SessionPlannerLootRef loot)
            implements Input, SessionPlannerPublishedEvent.Mutation {
        public LootRemovalInput {
            loot = loot == null ? new SessionPlannerLootRef(0L) : loot;
        }
    }
}
