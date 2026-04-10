package features.creatures.catalog.input;

import features.creatures.model.Creature;

@SuppressWarnings("unused")
public record LoadCreatureInput(Long creatureId) {

    public record LoadedCreatureInput(boolean success, Creature creature) {
    }
}
