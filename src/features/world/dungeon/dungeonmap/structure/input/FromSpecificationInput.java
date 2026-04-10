package features.world.dungeon.dungeonmap.structure.input;

/**
 * Canonical request for materializing shared structure topology from authored level specifications.
 */
@SuppressWarnings("unused")
public record FromSpecificationInput(
        features.world.dungeon.dungeonmap.structure.model.StructureSpecification specification
) {
}
