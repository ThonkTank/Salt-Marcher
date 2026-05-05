package src.view.statetabs.encounter;

import java.util.Objects;

public record EncounterBuilderStateViewInputEvent(Interaction interaction) {

    public EncounterBuilderStateViewInputEvent {
        Objects.requireNonNull(interaction, "interaction");
    }

    public sealed interface Interaction permits GeneratorInteraction, PlanInteraction, RosterInteraction,
            UndoInteraction, DetailInteraction, BuilderActionInteraction {
    }

    public record GeneratorInteraction(boolean generateRequested, int alternativeShift) implements Interaction {
    }

    public record PlanInteraction(boolean saveCurrentPlanRequested, long selectedPlanId) implements Interaction {
        public PlanInteraction {
            selectedPlanId = Math.max(0L, selectedPlanId);
        }
    }

    public record RosterInteraction(long creatureId, int delta, boolean removalRequested) implements Interaction {
        public RosterInteraction {
            creatureId = Math.max(0L, creatureId);
        }
    }

    public record UndoInteraction(long token) implements Interaction {
        public UndoInteraction {
            token = Math.max(0L, token);
        }
    }

    public record DetailInteraction(long creatureId) implements Interaction {
        public DetailInteraction {
            creatureId = Math.max(0L, creatureId);
        }
    }

    public record BuilderActionInteraction(boolean clearHistoryRequested, boolean startInitiativeRequested) implements Interaction {
    }
}
