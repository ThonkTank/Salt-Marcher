package features.world.dungeon.dungeonmap.structure.input;

/**
 * Canonical request for applying one physical topology mutation.
 */
@SuppressWarnings("unused")
public record MutateInput(
        features.world.dungeon.dungeonmap.structure.model.Structure structure,
        features.world.dungeon.dungeonmap.structure.model.StructureMutation mutation
) {
}
