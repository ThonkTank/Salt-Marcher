package src.view.statetabs.encounter;

import java.util.Objects;

public record EncounterBuilderStateViewInputEvent(Interaction interaction) {

    public EncounterBuilderStateViewInputEvent {
        Objects.requireNonNull(interaction, "interaction");
    }

    public sealed interface Interaction permits GenerateInput, ShiftAlternativeInput, SaveCurrentPlanInput,
            OpenSavedPlanInput, ChangeRosterCountInput, RemoveCreatureInput, UndoRemoveInput,
            ClearGenerationHistoryInput, OpenInitiativeInput, OpenCreatureDetailInput {
    }

    public record GenerateInput() implements Interaction {
    }

    public record ShiftAlternativeInput(int alternativeShift) implements Interaction {
    }

    public record SaveCurrentPlanInput() implements Interaction {
    }

    public record OpenSavedPlanInput(long selectedPlanId) implements Interaction {
        public OpenSavedPlanInput {
            selectedPlanId = Math.max(0L, selectedPlanId);
        }
    }

    public record ChangeRosterCountInput(long creatureId, int delta) implements Interaction {
        public ChangeRosterCountInput {
            creatureId = Math.max(0L, creatureId);
        }
    }

    public record RemoveCreatureInput(long creatureId) implements Interaction {
        public RemoveCreatureInput {
            creatureId = Math.max(0L, creatureId);
        }
    }

    public record UndoRemoveInput(long undoToken) implements Interaction {
        public UndoRemoveInput {
            undoToken = Math.max(0L, undoToken);
        }
    }

    public record ClearGenerationHistoryInput() implements Interaction {
    }

    public record OpenInitiativeInput() implements Interaction {
    }

    public record OpenCreatureDetailInput(long creatureId) implements Interaction {
        public OpenCreatureDetailInput {
            creatureId = Math.max(0L, creatureId);
        }
    }
}
