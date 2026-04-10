package features.world.dungeon.dungeonmap.structure.input;

/**
 * Canonical request for loading one level-local boundary projection from shared structure topology.
 */
@SuppressWarnings("unused")
public record LoadBoundaryAtLevelInput(
        features.world.dungeon.dungeonmap.structure.model.Structure structure,
        int levelZ
) {
}
