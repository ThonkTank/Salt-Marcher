package features.world.dungeon.dungeonmap.structure.input;

/**
 * Canonical request for loading one level-local surface projection from shared structure topology.
 */
@SuppressWarnings("unused")
public record LoadSurfaceAtLevelInput(
        features.world.dungeon.dungeonmap.structure.model.Structure structure,
        int levelZ
) {
}
