package src.domain.creatures.published;

/** Read-only Creatures capability for consumers that validate stable references. */
@FunctionalInterface
public interface CreatureReferenceApi {

    CreatureDetailResult find(long creatureId);
}
