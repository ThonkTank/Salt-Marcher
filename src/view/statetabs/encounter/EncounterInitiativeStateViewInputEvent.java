package src.view.statetabs.encounter;

import java.util.List;
import java.util.Objects;

public record EncounterInitiativeStateViewInputEvent(Interaction interaction) {

    public EncounterInitiativeStateViewInputEvent {
        Objects.requireNonNull(interaction, "interaction");
    }

    public sealed interface Interaction permits BackNavigationInteraction, SubmissionInteraction {
    }

    public record BackNavigationInteraction() implements Interaction {
    }

    public record SubmissionInteraction(List<InitiativeEntry> initiatives) implements Interaction {
        public SubmissionInteraction {
            initiatives = initiatives == null ? List.of() : List.copyOf(initiatives);
        }
    }

    public record InitiativeEntry(String id, int initiative) {
    }
}
