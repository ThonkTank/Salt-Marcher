package features.world.dungeonmap.canvas.rendering;

import features.world.dungeonmap.corridors.model.CorridorGeometry;
import features.world.dungeonmap.corridors.model.DoorSegment;
import features.world.dungeonmap.corridors.model.DungeonCorridor;
import features.world.dungeonmap.layout.model.DungeonLayout;
import features.world.dungeonmap.rooms.model.DungeonRoom;
import features.world.dungeonmap.rooms.model.DungeonRoomCluster;
import features.world.dungeonmap.foundation.geometry.Point2i;

import java.util.List;
import java.util.Set;

public final class DungeonBaseGridHitTester {

    private DungeonBaseGridHitTester() {
    }

    public static DungeonRoomCluster findClusterAt(LookupContext context, double screenX, double screenY) {
        Point2i cell = context.worldPointAt(screenX, screenY);
        DungeonRoomCluster cluster = context.clusterAtCell(cell);
        if (cluster != null) {
            return cluster;
        }
        return clusterAtCell(context, cell);
    }

    public static DungeonRoom findRoomAt(LookupContext context, double screenX, double screenY) {
        Point2i cell = context.worldPointAt(screenX, screenY);
        DungeonRoom room = context.roomAtCell(cell);
        if (room != null) {
            return room;
        }
        return roomAtCell(context, cell);
    }

    public static DungeonCorridor findCorridorAt(LookupContext context, double screenX, double screenY) {
        DungeonLayout layout = context.layout();
        if (layout == null) {
            return null;
        }
        Point2i cell = context.worldPointAt(screenX, screenY);
        List<Long> corridorIds = context.corridorIdsAtCell(cell);
        if (!corridorIds.isEmpty()) {
            return layout.corridorById(corridorIds.getFirst());
        }
        DungeonCorridor bestCorridor = null;
        double bestDistance = Double.POSITIVE_INFINITY;
        for (DungeonCorridor corridor : layout.corridors()) {
            CorridorGeometry geometry = context.corridorGeometryForDisplay(corridor);
            if (geometry == null) {
                continue;
            }
            if (!geometry.routable()) {
                double distance = context.distanceToInvalidCorridorLink(screenX, screenY, geometry);
                if (distance < bestDistance && distance <= DungeonCanvasTheme.CORRIDOR_LINK_HIT_RADIUS_PX) {
                    bestDistance = distance;
                    bestCorridor = corridor;
                }
                continue;
            }
            if (geometry.cells().contains(cell)) {
                return corridor;
            }
            for (DoorSegment door : geometry.doors()) {
                double distance = context.distanceToDoor(screenX, screenY, door);
                if (distance < bestDistance && distance <= DungeonCanvasTheme.DOOR_HIT_RADIUS_PX) {
                    bestDistance = distance;
                    bestCorridor = corridor;
                }
            }
        }
        return bestCorridor;
    }

    public static DungeonRoomCluster clusterAtCell(LookupContext context, Point2i cell) {
        DungeonLayout layout = context.layout();
        if (layout == null) {
            return null;
        }
        for (DungeonRoomCluster cluster : layout.clusters()) {
            if (context.clusterCellsFor(cluster).contains(cell)) {
                return cluster;
            }
        }
        return null;
    }

    public static DungeonRoom roomAtCell(LookupContext context, Point2i cell) {
        DungeonLayout layout = context.layout();
        if (layout == null) {
            return null;
        }
        for (DungeonRoom room : layout.rooms()) {
            if (context.roomCellsFor(room).contains(cell)) {
                return room;
            }
        }
        return null;
    }

    public interface LookupContext {
        DungeonLayout layout();
        Point2i worldPointAt(double screenX, double screenY);
        DungeonRoomCluster clusterAtCell(Point2i cell);
        DungeonRoom roomAtCell(Point2i cell);
        Set<Point2i> clusterCellsFor(DungeonRoomCluster cluster);
        Set<Point2i> roomCellsFor(DungeonRoom room);
        List<Long> corridorIdsAtCell(Point2i cell);
        CorridorGeometry corridorGeometryForDisplay(DungeonCorridor corridor);
        double distanceToInvalidCorridorLink(double screenX, double screenY, CorridorGeometry geometry);
        double distanceToDoor(double screenX, double screenY, DoorSegment door);
    }
}
