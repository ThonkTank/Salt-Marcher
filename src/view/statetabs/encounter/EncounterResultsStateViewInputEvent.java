package src.view.statetabs.encounter;

import java.util.Objects;

public record EncounterResultsStateViewInputEvent(Interaction interaction) {

    public EncounterResultsStateViewInputEvent {
        Objects.requireNonNull(interaction, "interaction");
    }

    public sealed interface Interaction permits AwardInteraction, ReturnInteraction {
    }

    public record AwardInteraction() implements Interaction {
    }

    public record ReturnInteraction() implements Interaction {
    }
}
