package features.world.dungeon.dungeonmap.structure.input;

/**
 * Canonical request for projecting shared structure topology onto one level.
 */
@SuppressWarnings("unused")
public record ProjectToLevelInput(
        features.world.dungeon.dungeonmap.structure.model.Structure structure,
        int levelZ
) {
}
