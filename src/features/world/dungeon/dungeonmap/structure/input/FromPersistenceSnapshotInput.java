package features.world.dungeon.dungeonmap.structure.input;

/**
 * Canonical request for rehydrating shared structure topology from persistence.
 */
@SuppressWarnings("unused")
public record FromPersistenceSnapshotInput(
        features.world.dungeon.dungeonmap.structure.model.Structure.PersistenceSnapshot snapshot
) {
}
