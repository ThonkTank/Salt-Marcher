package src.view.leftbartabs.sessionplanner;

import java.math.BigDecimal;
import java.util.Objects;

public record SessionPlannerTimelineMainViewInputEvent(TimelineInput timelineInput) {

    public SessionPlannerTimelineMainViewInputEvent {
        Objects.requireNonNull(timelineInput, "timelineInput");
    }

    public sealed interface TimelineInput permits SelectEncounterInput, SetEncounterAllocationInput, MoveEncounterInput,
            RemoveEncounterInput, RestGapInput {
    }

    public record SelectEncounterInput(long selectedEncounterToken)
            implements TimelineInput, SessionPlannerPublishedEvent.Mutation {
        public SelectEncounterInput {
            selectedEncounterToken = Math.max(0L, selectedEncounterToken);
        }
    }

    public record SetEncounterAllocationInput(
            long encounterToken,
            BigDecimal targetAllocationPercentage
    ) implements TimelineInput, SessionPlannerPublishedEvent.Mutation {
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
    ) implements TimelineInput, SessionPlannerPublishedEvent.Mutation {
        public MoveEncounterInput {
            encounterToken = Math.max(0L, encounterToken);
            direction = direction == null ? Direction.UP : direction;
        }

        boolean movesDown() {
            return direction.isDown();
        }
    }

    public record RemoveEncounterInput(long encounterTokenToRemove)
            implements TimelineInput, SessionPlannerPublishedEvent.Mutation {
        public RemoveEncounterInput {
            encounterTokenToRemove = Math.max(0L, encounterTokenToRemove);
        }
    }

    public record RestGapInput(
            long leftEncounterId,
            long rightEncounterId,
            RestSelection restSelection
    ) implements TimelineInput, SessionPlannerPublishedEvent.Mutation {
        public RestGapInput {
            leftEncounterId = Math.max(0L, leftEncounterId);
            rightEncounterId = Math.max(0L, rightEncounterId);
            restSelection = restSelection == null ? RestSelection.NONE : restSelection;
        }

        boolean clearsRestGap() {
            return restSelection.isNone();
        }
    }

    public enum Direction {
        UP,
        DOWN;

        boolean isDown() {
            return this == DOWN;
        }
    }

    public enum RestSelection {
        NONE,
        SHORT_REST,
        LONG_REST;

        static RestSelection normalized(RestSelection selection) {
            return selection == null ? NONE : selection;
        }

        boolean isNone() {
            return this == NONE;
        }
    }
}
