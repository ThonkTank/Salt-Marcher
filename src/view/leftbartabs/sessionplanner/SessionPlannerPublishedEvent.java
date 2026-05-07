package src.view.leftbartabs.sessionplanner;

import java.math.BigDecimal;
import java.util.Objects;

public record SessionPlannerPublishedEvent(Mutation mutation) {

    public SessionPlannerPublishedEvent {
        Objects.requireNonNull(mutation, "mutation");
    }

    public sealed interface Mutation permits CreateSessionMutation, AddParticipantMutation, RemoveParticipantMutation,
            SetEncounterDaysMutation, AttachPlanMutation, RemoveEncounterMutation, MoveEncounterMutation,
            SelectEncounterMutation, SetEncounterAllocationMutation, SetRestGapMutation, ClearRestGapMutation,
            AddLootPlaceholderMutation, RemoveLootPlaceholderMutation {
    }

    public record CreateSessionMutation() implements Mutation {
    }

    public record AddParticipantMutation(long characterId) implements Mutation {
        public AddParticipantMutation {
            characterId = Math.max(0L, characterId);
        }
    }

    public record RemoveParticipantMutation(long characterId) implements Mutation {
        public RemoveParticipantMutation {
            characterId = Math.max(0L, characterId);
        }
    }

    public record SetEncounterDaysMutation(BigDecimal encounterDays) implements Mutation {
        public SetEncounterDaysMutation {
            encounterDays = encounterDays == null ? BigDecimal.ONE : encounterDays;
        }
    }

    public record AttachPlanMutation(long planId) implements Mutation {
        public AttachPlanMutation {
            planId = Math.max(0L, planId);
        }
    }

    public record RemoveEncounterMutation(long encounterToken) implements Mutation {
        public RemoveEncounterMutation {
            encounterToken = Math.max(0L, encounterToken);
        }
    }

    public record MoveEncounterMutation(
            long encounterToken,
            Direction direction
    ) implements Mutation {
        public MoveEncounterMutation {
            encounterToken = Math.max(0L, encounterToken);
            direction = direction == null ? Direction.UP : direction;
        }
    }

    public record SelectEncounterMutation(long encounterToken) implements Mutation {
        public SelectEncounterMutation {
            encounterToken = Math.max(0L, encounterToken);
        }
    }

    public record SetEncounterAllocationMutation(
            long encounterToken,
            BigDecimal budgetPercentage
    ) implements Mutation {
        public SetEncounterAllocationMutation {
            encounterToken = Math.max(0L, encounterToken);
            budgetPercentage = budgetPercentage == null ? BigDecimal.ZERO : budgetPercentage;
        }
    }

    public record SetRestGapMutation(
            long leftEncounterId,
            long rightEncounterId,
            RestSelection restSelection
    ) implements Mutation {
        public SetRestGapMutation {
            leftEncounterId = Math.max(0L, leftEncounterId);
            rightEncounterId = Math.max(0L, rightEncounterId);
            restSelection = restSelection == null ? RestSelection.NONE : restSelection;
        }
    }

    public record ClearRestGapMutation(
            long leftEncounterId,
            long rightEncounterId
    ) implements Mutation {
        public ClearRestGapMutation {
            leftEncounterId = Math.max(0L, leftEncounterId);
            rightEncounterId = Math.max(0L, rightEncounterId);
        }
    }

    public record AddLootPlaceholderMutation() implements Mutation {
    }

    public record RemoveLootPlaceholderMutation(long lootToken) implements Mutation {
        public RemoveLootPlaceholderMutation {
            lootToken = Math.max(0L, lootToken);
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
