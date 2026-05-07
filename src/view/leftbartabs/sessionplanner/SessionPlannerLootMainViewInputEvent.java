package src.view.leftbartabs.sessionplanner;

import java.util.Objects;

public record SessionPlannerLootMainViewInputEvent(Interaction interaction) {

    public SessionPlannerLootMainViewInputEvent {
        Objects.requireNonNull(interaction, "interaction");
    }

    public sealed interface Interaction permits AddLootPlaceholderInput, RemoveLootPlaceholderInput {
    }

    public record AddLootPlaceholderInput() implements Interaction {
    }

    public record RemoveLootPlaceholderInput(long lootToken) implements Interaction {
        public RemoveLootPlaceholderInput {
            lootToken = Math.max(0L, lootToken);
        }
    }
}
