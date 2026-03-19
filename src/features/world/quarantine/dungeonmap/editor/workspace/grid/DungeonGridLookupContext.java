package features.world.quarantine.dungeonmap.editor.workspace.grid;

import features.world.quarantine.dungeonmap.layout.model.DungeonLayout;
import features.world.quarantine.dungeonmap.corridors.model.topology.CorridorGeometry;
import features.world.quarantine.dungeonmap.corridors.model.primitives.DoorSegment;
import features.world.quarantine.dungeonmap.corridors.model.DungeonCorridor;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoom;
import features.world.quarantine.dungeonmap.rooms.model.DungeonRoomCluster;
import features.world.quarantine.dungeonmap.foundation.geometry.Point2i;
import features.world.quarantine.dungeonmap.canvas.grid.DungeonBaseGridHitTester;
import features.world.quarantine.dungeonmap.foundation.geometry.ScreenPoint;

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
        if (!pane.interactions().previewModel().geometry().previewClusterCenters().isEmpty()) {
            return pane.interactions().previewModel().geometry().previewClusterAtCell(cell);
        }
        if (pane.renderData() != null) {
            return pane.renderData().clusterAtCell(cell);
        }
        return null;
    }

    @Override
    public DungeonRoom roomAtCell(Point2i cell) {
        if (!pane.interactions().previewModel().geometry().previewClusterCenters().isEmpty()) {
            return pane.interactions().previewModel().geometry().previewRoomAtCell(cell);
        }
        if (pane.renderData() != null) {
            return pane.renderData().roomAtCell(cell);
        }
        return null;
    }

    @Override
    public Set<Point2i> clusterCellsFor(DungeonRoomCluster cluster) {
        return pane.interactions().previewModel().geometry().clusterCellsFor(cluster);
    }

    @Override
    public Set<Point2i> roomCellsFor(DungeonRoom room) {
        return pane.interactions().previewModel().geometry().roomCellsFor(room);
    }

    @Override
    public List<Long> corridorIdsAtCell(Point2i cell) {
        if (!pane.interactions().previewModel().geometry().previewClusterCenters().isEmpty() || pane.renderData() == null) {
            return List.of();
        }
        return pane.renderData().corridorIdsAtCell(cell);
    }

    @Override
    public CorridorGeometry corridorGeometryForDisplay(DungeonCorridor corridor) {
        return pane.interactions().corridorWorkspace().corridorInteractionSupport().corridorGeometryForDisplay(corridor);
    }

    @Override
    public double distanceToInvalidCorridorLink(double screenX, double screenY, CorridorGeometry geometry) {
        return pane.interactions().previewModel().geometry().distanceToInvalidCorridorLink(new ScreenPoint(screenX, screenY), geometry);
    }

    @Override
    public double distanceToDoor(double screenX, double screenY, DoorSegment door) {
        return pane.interactions().previewModel().geometry().distanceToDoor(new ScreenPoint(screenX, screenY), door);
    }
}
