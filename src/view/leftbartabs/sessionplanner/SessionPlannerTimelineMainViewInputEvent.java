package src.view.leftbartabs.sessionplanner;

import java.math.BigDecimal;
import java.util.Objects;

public record SessionPlannerTimelineMainViewInputEvent(Interaction interaction) {

    public SessionPlannerTimelineMainViewInputEvent {
        Objects.requireNonNull(interaction, "interaction");
    }

    public sealed interface Interaction permits SelectEncounterInput, SetEncounterAllocationInput, MoveEncounterInput,
            RemoveEncounterInput, RestGapInput {
    }

    public record SelectEncounterInput(long encounterToken) implements Interaction {
        public SelectEncounterInput {
            encounterToken = Math.max(0L, encounterToken);
        }
    }

    public record SetEncounterAllocationInput(
            long encounterToken,
            BigDecimal targetAllocationPercentage
    ) implements Interaction {
        public SetEncounterAllocationInput {
            encounterToken = Math.max(0L, encounterToken);
            targetAllocationPercentage = targetAllocationPercentage == null
                    ? BigDecimal.ZERO
                    : targetAllocationPercentage;
        }
    }

    public record MoveEncounterInput(
            long encounterToken,
            Direction direction
    ) implements Interaction {
        public MoveEncounterInput {
            encounterToken = Math.max(0L, encounterToken);
            direction = direction == null ? Direction.UP : direction;
        }
    }

    public record RemoveEncounterInput(long encounterToken) implements Interaction {
        public RemoveEncounterInput {
            encounterToken = Math.max(0L, encounterToken);
        }
    }

    public record RestGapInput(
            long leftEncounterId,
            long rightEncounterId,
            RestSelection restSelection
    ) implements Interaction {
        public RestGapInput {
            leftEncounterId = Math.max(0L, leftEncounterId);
            rightEncounterId = Math.max(0L, rightEncounterId);
            restSelection = restSelection == null ? RestSelection.NONE : restSelection;
        }
    }

    public enum Direction {
        UP,
        DOWN
    }

    public enum RestSelection {
        NONE,
        SHORT_REST,
        LONG_REST
    }
}
