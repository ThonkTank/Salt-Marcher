package features.creatures.api;

import features.creatures.model.Creature;

import java.util.Objects;
import java.util.function.Consumer;

public record CreatureBrowserRowAction(
        String label,
        String tooltip,
        Consumer<Creature> handler) {

    public CreatureBrowserRowAction {
        Objects.requireNonNull(label, "label");
        Objects.requireNonNull(handler, "handler");
    }
}
