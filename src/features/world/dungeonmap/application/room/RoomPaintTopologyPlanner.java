package features.world.dungeonmap.application.room;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.geometry.TileShape;
import features.world.dungeonmap.model.structures.cluster.SimpleClusterDeleteResult;
import features.world.dungeonmap.model.structures.cluster.SimpleClusterFragment;
import features.world.dungeonmap.model.structures.cluster.RoomCluster;
import features.world.dungeonmap.model.structures.cluster.SimpleClusterPaintExpansion;

import java.util.Comparator;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

public final class RoomPaintTopologyPlanner {

    public RoomTopologyEditPlan planPaint(DungeonLayout layout, TileShape shape) {
        if (layout == null || shape == null || shape.size() == 0) {
            return new NoOpRoomEditPlan();
        }
        List<RoomCluster> overlappingClusters = layout.overlappingClusters(shape).stream()
                .sorted(Comparator.comparing(cluster -> cluster.clusterId() == null ? Long.MAX_VALUE : cluster.clusterId()))
                .toList();
        if (overlappingClusters.isEmpty()) {
            return new CreateClusterRoomEditPlan(layout.mapId(), shape, nextRoomName(layout), shape.centerCell());
        }
        if (overlappingClusters.size() == 1) {
            RoomCluster cluster = overlappingClusters.getFirst();
            if (cluster.canAbsorbPaintShape(shape) && !layout.hasDependentCorridors(cluster)) {
                SimpleClusterPaintExpansion expansion = cluster.simplePaintExpansion(shape);
                return new UpdateClusterRoomEditPlan(
                        cluster.clusterId(),
                        expansion.clusterShape(),
                        expansion.roomId(),
                        expansion.roomAnchor());
            }
        }
        return new LegacyBridgeRoomEditPlan(shape, false);
    }

    public RoomTopologyEditPlan planDelete(DungeonLayout layout, TileShape shape) {
        if (layout == null || shape == null || shape.size() == 0) {
            return new NoOpRoomEditPlan();
        }
        List<RoomCluster> overlappingClusters = layout.overlappingClusters(shape);
        if (overlappingClusters.size() == 1) {
            RoomCluster cluster = overlappingClusters.getFirst();
            if (!layout.hasDependentCorridors(cluster)) {
                SimpleClusterDeleteResult deleteResult = cluster.simpleDelete(shape);
                if (deleteResult instanceof SimpleClusterDeleteResult.Unchanged) {
                    return new NoOpRoomEditPlan();
                }
                if (deleteResult instanceof SimpleClusterDeleteResult.Deleted) {
                    return new DeleteClusterRoomEditPlan(cluster.clusterId());
                }
                if (deleteResult instanceof SimpleClusterDeleteResult.Reduced reduced) {
                    return new UpdateClusterRoomEditPlan(
                            cluster.clusterId(),
                            reduced.clusterShape(),
                            cluster.singleRoom().roomId(),
                            reduced.roomAnchor());
                }
                if (deleteResult instanceof SimpleClusterDeleteResult.Split split) {
                    return new SplitClusterRoomEditPlan(
                            layout.mapId(),
                            cluster.clusterId(),
                            splitFragments(layout, cluster, split.fragments()));
                }
            }
        }
        return new LegacyBridgeRoomEditPlan(shape, true);
    }

    private static String nextRoomName(DungeonLayout layout) {
        int roomNumber = layout.rooms().size() + 1;
        return "Raum " + roomNumber;
    }

    private static List<SplitClusterFragmentPlan> splitFragments(
            DungeonLayout layout,
            RoomCluster cluster,
            List<SimpleClusterFragment> fragments
    ) {
        List<SplitClusterFragmentPlan> result = new ArrayList<>();
        String originalName = cluster.singleRoom().name();
        int nextRoomNumber = layout.rooms().size() + 1;
        for (int index = 0; index < fragments.size(); index++) {
            SimpleClusterFragment fragment = fragments.get(index);
            String roomName = index == 0
                    ? originalName
                    : "Raum " + nextRoomNumber++;
            result.add(new SplitClusterFragmentPlan(
                    fragment.clusterShape(),
                    roomName,
                    fragment.roomAnchor()));
        }
        return List.copyOf(result);
    }
}
