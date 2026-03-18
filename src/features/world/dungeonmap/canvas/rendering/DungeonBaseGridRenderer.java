package features.world.dungeonmap.canvas.rendering;

import features.world.dungeonmap.layout.model.DungeonLayout;
import features.world.dungeonmap.corridors.model.CorridorGeometry;
import features.world.dungeonmap.corridors.model.DungeonCorridor;
import features.world.dungeonmap.rooms.model.DungeonRoomCluster;
import javafx.scene.canvas.GraphicsContext;

import java.util.Set;
public final class DungeonBaseGridRenderer {

    private DungeonBaseGridRenderer() {
    }

    public static void renderBaseGrid(GraphicsContext gc, RenderContext context) {
        Set<CorridorRenderKeys.CorridorSegmentKey> openSegments = DungeonGridScreenMath.allDoorSegments(
                context.layout(),
                context::corridorGeometryForDisplay);
        Set<Long> encodedOpenSegments = DungeonGridScreenMath.encodeSegments(openSegments);
        context.drawGrid(gc);
        context.drawCorridors(gc, openSegments, encodedOpenSegments);
        for (DungeonRoomCluster cluster : context.clusters()) {
            context.drawRoom(gc, cluster, openSegments, encodedOpenSegments);
            context.drawClusterAndRoomAnchors(gc, cluster);
        }
        context.drawClusterEdges(gc);
        context.drawDoors(gc);
    }

    public interface RenderContext {
        DungeonLayout layout();
        Iterable<DungeonRoomCluster> clusters();
        CorridorGeometry corridorGeometryForDisplay(DungeonCorridor corridor);
        void drawGrid(GraphicsContext gc);
        void drawCorridors(
                GraphicsContext gc,
                Set<CorridorRenderKeys.CorridorSegmentKey> openSegments,
                Set<Long> encodedOpenSegments
        );
        void drawRoom(
                GraphicsContext gc,
                DungeonRoomCluster cluster,
                Set<CorridorRenderKeys.CorridorSegmentKey> openSegments,
                Set<Long> encodedOpenSegments
        );
        void drawClusterAndRoomAnchors(GraphicsContext gc, DungeonRoomCluster cluster);
        void drawClusterEdges(GraphicsContext gc);
        void drawDoors(GraphicsContext gc);
    }
}
