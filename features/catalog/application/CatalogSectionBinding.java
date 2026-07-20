package features.catalog.application;

import java.util.Objects;

/** One typed section bound directly from its canonical BrowseSession state to the shared renderer. */
public record CatalogSectionBinding<Q, R, K>(
        CatalogSectionDefinition<Q, R, K> definition,
        CatalogSectionState<Q, R, K> state,
        CatalogSectionCommands<Q, K> commands,
        String actionMessage,
        CatalogConfirmation<K> confirmation
) {
    public CatalogSectionBinding {
        definition = Objects.requireNonNull(definition, "definition");
        state = Objects.requireNonNull(state, "state");
        commands = Objects.requireNonNull(commands, "commands");
        actionMessage = Objects.requireNonNullElse(actionMessage, "");
        confirmation = Objects.requireNonNull(confirmation, "confirmation");
        if (definition.id() == null) {
            throw new IllegalArgumentException("Catalog section definition must have an id.");
        }
    }
}
