package features.world.dungeon.dungeonmap.structure.input;

/**
 * Canonical request for loading the derived room topology attached to one physical structure.
 */
@SuppressWarnings("unused")
public record LoadRoomTopologyInput(
        features.world.dungeon.dungeonmap.structure.model.Structure structure
) {
}
