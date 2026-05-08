package src.view.leftbartabs.sessionplanner;

import java.util.Objects;

public record SessionPlannerLootMainViewInputEvent(LootInput lootInput) {

    public SessionPlannerLootMainViewInputEvent {
        Objects.requireNonNull(lootInput, "lootInput");
    }

    public sealed interface LootInput permits AddLootPlaceholderTrigger, RemoveLootPlaceholderInput {
    }

    public enum AddLootPlaceholderTrigger implements LootInput, SessionPlannerPublishedEvent.Mutation {
        ADD_LOOT_PLACEHOLDER
    }

    public record RemoveLootPlaceholderInput(long lootToken)
            implements LootInput, SessionPlannerPublishedEvent.Mutation {
        public RemoveLootPlaceholderInput {
            lootToken = Math.max(0L, lootToken);
        }
    }
}
