package src.domain.dungeon.published;

/**
 * Query for loading one authored map snapshot.
 */
public record LoadMapSnapshotQuery(
        DungeonMapId mapId,
        int targetFloor
) {
}
