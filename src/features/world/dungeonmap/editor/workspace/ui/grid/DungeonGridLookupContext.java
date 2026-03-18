package features.world.dungeonmap.editor.workspace.ui.grid;

import features.world.dungeonmap.layout.model.DungeonLayout;
import features.world.dungeonmap.corridors.model.CorridorGeometry;
import features.world.dungeonmap.corridors.model.DoorSegment;
import features.world.dungeonmap.corridors.model.DungeonCorridor;
import features.world.dungeonmap.rooms.model.DungeonRoom;
import features.world.dungeonmap.rooms.model.DungeonRoomCluster;
import features.world.dungeonmap.foundation.geometry.Point2i;
import features.world.dungeonmap.canvas.rendering.DungeonBaseGridHitTester;

import java.util.List;
import java.util.Set;

final class DungeonGridLookupContext implements DungeonBaseGridHitTester.LookupContext {

    private final DungeonGridPane pane;

    DungeonGridLookupContext(DungeonGridPane pane) {
        this.pane = pane;
    }

    @Override
    public DungeonLayout layout() {
        return pane.dungeonLayout();
    }

    @Override
    public Point2i worldPointAt(double screenX, double screenY) {
        return pane.worldPointAt(screenX, screenY);
    }

    @Override
    public DungeonRoomCluster clusterAtCell(Point2i cell) {
        if (!pane.previewModel().previewClusterCenters().isEmpty()) {
            return pane.previewModel().previewClusterAtCell(cell);
        }
        if (pane.layoutRenderData() != null) {
            return pane.layoutRenderData().clusterAtCell(cell);
        }
        return null;
    }

    @Override
    public DungeonRoom roomAtCell(Point2i cell) {
        if (!pane.previewModel().previewClusterCenters().isEmpty()) {
            return pane.previewModel().previewRoomAtCell(cell);
        }
        if (pane.layoutRenderData() != null) {
            return pane.layoutRenderData().roomAtCell(cell);
        }
        return null;
    }

    @Override
    public Set<Point2i> clusterCellsFor(DungeonRoomCluster cluster) {
        return pane.previewModel().clusterCellsFor(cluster);
    }

    @Override
    public Set<Point2i> roomCellsFor(DungeonRoom room) {
        return pane.previewModel().roomCellsFor(room);
    }

    @Override
    public List<Long> corridorIdsAtCell(Point2i cell) {
        if (!pane.previewModel().previewClusterCenters().isEmpty() || pane.layoutRenderData() == null) {
            return List.of();
        }
        return pane.layoutRenderData().corridorIdsAtCell(cell);
    }

    @Override
    public CorridorGeometry corridorGeometryForDisplay(DungeonCorridor corridor) {
        return pane.corridorWorkspace().corridorGeometryForDisplay(corridor);
    }

    @Override
    public double distanceToInvalidCorridorLink(double screenX, double screenY, CorridorGeometry geometry) {
        return pane.previewModel().distanceToInvalidCorridorLink(screenX, screenY, geometry);
    }

    @Override
    public double distanceToDoor(double screenX, double screenY, DoorSegment door) {
        return pane.previewModel().distanceToDoor(screenX, screenY, door);
    }
}
