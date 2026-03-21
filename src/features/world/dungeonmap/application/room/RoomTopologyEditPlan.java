package features.world.dungeonmap.application.room;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.TileShape;

sealed interface RoomTopologyEditPlan permits NoOpRoomEditPlan,
        CreateClusterRoomEditPlan,
        UpdateClusterRoomEditPlan,
        DeleteClusterRoomEditPlan,
        SplitClusterRoomEditPlan,
        LegacyBridgeRoomEditPlan {
}

record NoOpRoomEditPlan() implements RoomTopologyEditPlan {
}

record CreateClusterRoomEditPlan(
        long mapId,
        TileShape clusterShape,
        String roomName,
        Point2i roomAnchor
) implements RoomTopologyEditPlan {
}

record UpdateClusterRoomEditPlan(
        long clusterId,
        TileShape clusterShape,
        long roomId,
        Point2i roomAnchor
) implements RoomTopologyEditPlan {
}

record DeleteClusterRoomEditPlan(
        long clusterId
) implements RoomTopologyEditPlan {
}

record SplitClusterRoomEditPlan(
        DungeonLayout layout,
        long mapId,
        long sourceClusterId,
        Long sourceRoomId,
        java.util.List<SplitClusterFragmentPlan> fragments
) implements RoomTopologyEditPlan {
    SplitClusterRoomEditPlan {
        fragments = fragments == null ? java.util.List.of() : java.util.List.copyOf(fragments);
    }
}

record SplitClusterFragmentPlan(
        TileShape clusterShape,
        String roomName,
        Point2i roomAnchor
) {
}

record LegacyBridgeRoomEditPlan(
        TileShape shape,
        boolean deleteMode
) implements RoomTopologyEditPlan {
}
