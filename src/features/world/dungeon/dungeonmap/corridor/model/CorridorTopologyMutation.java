package features.world.dungeon.dungeonmap.corridor.model;

import features.world.dungeon.geometry.GridSegment;

/**
 * Canonical public corridor topology-delete vocabulary.
 */
public sealed interface CorridorTopologyMutation permits
        CorridorTopologyMutation.DeleteDoor,
        CorridorTopologyMutation.DeleteSegment,
        CorridorTopologyMutation.DeleteNode {

    record DeleteDoor(GridSegment boundarySegment) implements CorridorTopologyMutation {
    }

    record DeleteSegment(Long segmentId) implements CorridorTopologyMutation {
    }

    record DeleteNode(Long nodeId) implements CorridorTopologyMutation {
    }
}
