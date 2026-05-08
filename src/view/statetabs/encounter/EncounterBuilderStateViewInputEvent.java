package src.view.statetabs.encounter;

import java.util.Objects;

public record EncounterBuilderStateViewInputEvent(Interaction builderInput) {

    public EncounterBuilderStateViewInputEvent {
        Objects.requireNonNull(builderInput, "builderInput");
    }

    public sealed interface Interaction permits GenerateInput, ShiftAlternativeInput, SaveCurrentPlanInput,
            OpenSavedPlanInput, ChangeRosterCountInput, RemoveCreatureInput, UndoRemoveInput,
            ClearGenerationHistoryInput, OpenInitiativeInput, OpenCreatureDetailInput {
    }

    public static final class GenerateInput implements Interaction {
    }

    public record ShiftAlternativeInput(int alternativeShift) implements Interaction {
    }

    public static final class SaveCurrentPlanInput implements Interaction {
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

    public static final class RemoveCreatureInput implements Interaction {

        private final long creatureId;

        public RemoveCreatureInput(long creatureId) {
            this.creatureId = Math.max(0L, creatureId);
        }

        public long creatureId() {
            return creatureId;
        }
    }

    public record UndoRemoveInput(long undoToken) implements Interaction {
        public UndoRemoveInput {
            undoToken = Math.max(0L, undoToken);
        }
    }

    public static final class ClearGenerationHistoryInput implements Interaction {
    }

    public static final class OpenInitiativeInput implements Interaction {
    }

    public static final class OpenCreatureDetailInput implements Interaction {

        private final long creatureId;

        public OpenCreatureDetailInput(long creatureId) {
            this.creatureId = Math.max(0L, creatureId);
        }

        public long creatureId() {
            return creatureId;
        }
    }
}
