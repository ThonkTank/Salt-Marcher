package src.view.leftbartabs.dungeoneditor;

import java.util.List;
import java.util.Set;
import javafx.scene.input.MouseButton;
import javafx.scene.input.MouseEvent;
import src.domain.dungeon.published.DungeonEditorHandleKind;
import src.domain.dungeon.published.DungeonEditorPreview;
import src.domain.dungeon.published.DungeonEditorHandleSnapshot;
import src.domain.dungeon.published.DungeonEditorMapSurfaceSnapshot;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel;
import src.view.slotcontent.main.dungeonmap.DungeonMapView;
import static src.view.leftbartabs.dungeoneditor.DungeonEditorBehaviorHarnessSupport.*;

final class DungeonEditorClusterLabelHandleHarness {

    private static final String OWNER = "DungeonEditorClusterLabelHandleHarness";
    private static final String CLUSTER_CORNER_KIND = DungeonEditorHandleKind.CLUSTER_CORNER.name();
    private static final String CLUSTER_WALL_RUN_KIND = DungeonEditorHandleKind.CLUSTER_WALL_RUN.name();

    private DungeonEditorClusterLabelHandleHarness() {
    }

    static void run(List<String> results) throws Exception {
        route(results, () -> verifyDefaultClusterLabelText(results));
        route(results, () -> verifyComplexClusterLabelAndHandles(results));
        route(results, () -> verifyComplexClusterTrueCornerDrag(results));
    }

    private static void route(
            List<String> results,
            DungeonEditorBehaviorHarnessSupport.ThrowingRunnable action
    ) throws Exception {
        DungeonEditorBehaviorHarnessSupport.runRouteProof(results, OWNER, action);
    }

    private static void verifyDefaultClusterLabelText(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();

        long mapId = createMapThroughControls(controls, runtime, "Default Cluster Label Map");
        runtime.database().seedF1SingleRoom(mapId, "R1", 0, 1, 1);
        createMapThroughControls(controls, runtime, "Default Cluster Label Reload Hop");
        selectMap(controls, "Default Cluster Label Map");

        DungeonEditorMapSurfaceSnapshot snapshot = runtime.mapSurfaceModel().current();
        DungeonEditorHandleSnapshot label = singleClusterLabel(snapshot, "DE-LABEL-001");
        assertEquals("Cluster " + label.ref().clusterId(), label.label(),
                "DE-LABEL-001 default cluster label text");
        assertTrue(!"R1".equals(label.label()),
                "DE-LABEL-001 cluster label does not reuse the first room name");
        assertEquals("LABEL", binding.mapContentModel()
                        .resolvePointerTarget(label.cell().q() + 0.5, label.cell().r() + 0.5)
                        .targetKind()
                        .name(),
                "DE-LABEL-001 cluster label hit remains a label target");
        results.add("DE-LABEL-001 Ready: F1_SINGLE_ROOM publishes default Cluster <clusterId> label text");
    }

    private static void verifyComplexClusterLabelAndHandles(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();

        long mapId = createMapThroughControls(controls, runtime, "Complex Cluster Handles Map");
        runtime.database().seedF15ComplexCluster(mapId);
        createMapThroughControls(controls, runtime, "Complex Cluster Handles Reload Hop");
        selectMap(controls, "Complex Cluster Handles Map");

        DungeonEditorMapSurfaceSnapshot snapshot = runtime.mapSurfaceModel().current();
        DungeonEditorHandleSnapshot label = singleClusterLabel(snapshot, "DE-LABEL-002");
        assertEquals(11, label.cell().q(), "DE-LABEL-002 label centroid q");
        assertEquals(11, label.cell().r(), "DE-LABEL-002 label centroid r");
        assertEquals(0, label.cell().level(), "DE-LABEL-002 label centroid level");
        assertTrue(!hasClusterLabelAt(snapshot, 10, 10, 0),
                "DE-LABEL-002 label does not use the authored cluster center");
        assertTrue(renderHasLabelAt(binding.mapContentModel(), label.label(), 11.5, 11.5),
                "DE-LABEL-002 render scene places the cluster label at the published centroid cell");
        results.add("DE-LABEL-002 Ready: F15_COMPLEX_CLUSTER label uses authored floor-cell centroid");

        assertClusterCorners(snapshot, Set.of(
                "10,10,0",
                "13,10,0",
                "13,11,0",
                "11,11,0",
                "11,13,0",
                "10,13,0"));
        assertTrue(!hasHandleAt(snapshot, CLUSTER_CORNER_KIND, 13, 13, 0),
                "DE-CLUSTER-001 does not publish the missing bounding-box corner");
        assertWallRunHandles(snapshot, Set.of(
                "11,10,0,NORTH@11.0,10.0",
                "12,11,0,SOUTH@12.0,11.0",
                "11,11,0,EAST@11.0,11.0",
                "10,11,0,WEST@10.0,11.0"));
        assertTrue(renderHasVisualOnlyWallRunMarkerAt(binding.mapContentModel(), 11.0, 10.0),
                "DE-CLUSTER-001 render scene places a visual-only horizontal wall-run marker on the wall line");
        results.add("DE-CLUSTER-001 Ready: F15_COMPLEX_CLUSTER publishes true corner handles and visual-only wall-run midpoint markers");
    }

    private static void verifyComplexClusterTrueCornerDrag(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();

        long mapId = createMapThroughControls(controls, runtime, "Complex Cluster Corner Move Map");
        runtime.database().seedF15ComplexCluster(mapId);
        createMapThroughControls(controls, runtime, "Complex Cluster Corner Move Reload Hop");
        selectMap(controls, "Complex Cluster Corner Move Map");
        click(button(controls, "Auswahl"));

        DungeonEditorMapSurfaceSnapshot initialSurface = runtime.mapSurfaceModel().current();
        DungeonEditorHandleSnapshot cornerHandle =
                firstClusterCornerHandleAt(initialSurface, 13, 11, 0, "DE-CLUSTER-003");
        long clusterId = cornerHandle.ref().clusterId();
        long geometryRowsBefore = runtime.database().countAuthoredGeometryRows(mapId);
        List<String> boundaryRowsBefore = runtime.database().roomBoundaryEdgeState(mapId);
        Set<String> cellsBefore = surfaceCellSet(initialSurface);
        assertEquals(Set.of("10,10,0", "13,10,0", "13,11,0", "11,11,0", "11,13,0", "10,13,0"),
                runtime.database().absoluteClusterVertices(clusterId),
                "DE-CLUSTER-003 starts from F15 true authored vertices");
        assertEquals("HANDLE", binding.mapContentModel().resolvePointerTarget(13.0, 11.0).targetKind().name(),
                "DE-CLUSTER-003 resolves the true inner corner as a handle");

        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_PRESSED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(13.0),
                viewport.sceneToScreenY(11.0),
                false);
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_DRAGGED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(14.0),
                viewport.sceneToScreenY(12.0),
                false);

        DungeonEditorMapSurfaceSnapshot previewSurface = runtime.mapSurfaceModel().current();
        assertEquals(geometryRowsBefore, runtime.database().countAuthoredGeometryRows(mapId),
                "DE-CLUSTER-003 drag preview leaves authored DB row count unchanged");
        assertEquals(boundaryRowsBefore, runtime.database().roomBoundaryEdgeState(mapId),
                "DE-CLUSTER-003 drag preview leaves persisted boundary rows unchanged");
        assertTrue(previewSurface.preview() instanceof DungeonEditorPreview.MoveHandlePreview,
                "DE-CLUSTER-003 publishes a move-handle preview during true-corner drag");
        DungeonEditorPreview.MoveHandlePreview preview =
                (DungeonEditorPreview.MoveHandlePreview) previewSurface.preview();
        assertEquals(cornerHandle.ref().kind(), preview.handleRef().kind(),
                "DE-CLUSTER-003 preview handle kind");
        assertEquals(1L, preview.deltaQ(), "DE-CLUSTER-003 preview delta q");
        assertEquals(1L, preview.deltaR(), "DE-CLUSTER-003 preview delta r");
        assertEquals(0L, preview.deltaLevel(), "DE-CLUSTER-003 preview delta level");

        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_RELEASED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(14.0),
                viewport.sceneToScreenY(12.0),
                false);

        DungeonEditorMapSurfaceSnapshot committedSurface = runtime.mapSurfaceModel().current();
        assertEquals(DungeonEditorPreview.none(), committedSurface.preview(),
                "DE-CLUSTER-003 clears true-corner move preview after release");
        Set<String> committedVertices = runtime.database().absoluteClusterVertices(clusterId);
        assertTrue(committedVertices.contains("14,12,0"),
                "DE-CLUSTER-003 persists the dragged true corner at the target point");
        assertTrue(!committedVertices.contains("13,13,0"),
                "DE-CLUSTER-003 still does not fall back to the missing bounding-box corner");
        assertTrue(!cellsBefore.equals(surfaceCellSet(committedSurface)),
                "DE-CLUSTER-003 committed surface cells change after true-corner move");
        assertTrue(!boundaryRowsBefore.equals(runtime.database().roomBoundaryEdgeState(mapId)),
                "DE-CLUSTER-003 recomputes persisted boundary rows after release");
        assertEquals(runtime.database().countWallBoundaryRows(mapId),
                runtime.database().countDistinctWallBoundaryTopologyRefs(mapId),
                "DE-CLUSTER-003 persists no duplicate wall topology refs on boundary rows");
        assertEquals(0L, runtime.database().countUnreferencedWallTopologyElements(mapId),
                "DE-CLUSTER-003 leaves no orphan wall topology rows");
        assertClusterCornerHandleAt(committedSurface, 14, 12, 0, "DE-CLUSTER-003");
        assertTrue(renderHasBoundaryNear(binding.mapContentModel(), "WALL", 14.0, 11.5),
                "DE-CLUSTER-003 render scene redraws the moved vertical wall span");
        assertTrue(renderHasBoundaryNear(binding.mapContentModel(), "WALL", 13.5, 12.0),
                "DE-CLUSTER-003 render scene redraws the moved horizontal wall span");

        selectMap(controls, "Complex Cluster Corner Move Reload Hop");
        selectMap(controls, "Complex Cluster Corner Move Map");
        assertTrue(runtime.database().absoluteClusterVertices(clusterId).contains("14,12,0"),
                "DE-CLUSTER-003 reload keeps the dragged true corner");
        assertClusterCornerHandleAt(runtime.mapSurfaceModel().current(), 14, 12, 0, "DE-CLUSTER-003 reload");
        assertTrue(renderHasBoundaryNear(binding.mapContentModel(), "WALL", 14.0, 11.5),
                "DE-CLUSTER-003 reload render keeps the moved vertical wall span");
        assertTrue(renderHasBoundaryNear(binding.mapContentModel(), "WALL", 13.5, 12.0),
                "DE-CLUSTER-003 reload render keeps the moved horizontal wall span");

        results.add("DE-CLUSTER-003 Ready: F15_COMPLEX_CLUSTER true-corner drag commits through SQLite and reload");
    }

    private static DungeonEditorHandleSnapshot singleClusterLabel(
            DungeonEditorMapSurfaceSnapshot snapshot,
            String message
    ) {
        List<DungeonEditorHandleSnapshot> labels = snapshot.surface().map().editorHandles().stream()
                .filter(handle -> "CLUSTER_LABEL".equals(handle.ref().kind().name()))
                .toList();
        assertEquals(1, labels.size(), message + " publishes one cluster label");
        return labels.getFirst();
    }

    private static boolean hasClusterLabelAt(
            DungeonEditorMapSurfaceSnapshot snapshot,
            int q,
            int r,
            int level
    ) {
        return hasHandleAt(snapshot, "CLUSTER_LABEL", q, r, level);
    }

    private static boolean hasHandleAt(
            DungeonEditorMapSurfaceSnapshot snapshot,
            String kind,
            int q,
            int r,
            int level
    ) {
        return snapshot.surface().map().editorHandles().stream()
                .anyMatch(handle -> kind.equals(handle.ref().kind().name())
                        && handle.cell().q() == q
                        && handle.cell().r() == r
                        && handle.cell().level() == level);
    }

    private static void assertClusterCorners(
            DungeonEditorMapSurfaceSnapshot snapshot,
            Set<String> expected
    ) {
        Set<String> actual = snapshot.surface().map().editorHandles().stream()
                .filter(handle -> CLUSTER_CORNER_KIND.equals(handle.ref().kind().name()))
                .map(DungeonEditorClusterLabelHandleHarness::handleCellKey)
                .collect(java.util.stream.Collectors.toCollection(java.util.LinkedHashSet::new));
        assertEquals(expected, actual, "DE-CLUSTER-001 authored corner handle set");
    }

    private static void assertWallRunHandles(
            DungeonEditorMapSurfaceSnapshot snapshot,
            Set<String> expected
    ) {
        Set<String> actual = snapshot.surface().map().editorHandles().stream()
                .filter(handle -> CLUSTER_WALL_RUN_KIND.equals(handle.ref().kind().name()))
                .map(handle -> handleCellKey(handle)
                        + "," + handle.ref().direction()
                        + "@" + handle.markerQ()
                        + "," + handle.markerR())
                .collect(java.util.stream.Collectors.toCollection(java.util.LinkedHashSet::new));
        assertEquals(expected, actual, "DE-CLUSTER-001 wall-run geometric marker set");
    }

    private static String handleCellKey(DungeonEditorHandleSnapshot handle) {
        return handle.cell().q() + "," + handle.cell().r() + "," + handle.cell().level();
    }

    private static boolean renderHasLabelAt(
            DungeonMapContentModel mapContentModel,
            String text,
            double q,
            double r
    ) {
        return mapContentModel.canvasStateProperty().get().renderScene().texts().stream()
                .anyMatch(label -> text.equals(label.text())
                        && Math.abs(label.centerX() - q) < 0.000_001
                        && Math.abs(label.centerY() - r) < 0.000_001);
    }

    private static boolean glyphMatchesHandleKind(DungeonMapContentModel.GlyphPrimitive glyph, String handleKind) {
        if (CLUSTER_WALL_RUN_KIND.equals(handleKind)) {
            return glyph.hitRef().isBlank() && "-".equals(glyph.label());
        }
        return glyph.hitRef().startsWith("marker:" + handleKind + ":");
    }

    private static double glyphCenterQ(DungeonMapContentModel.GlyphPrimitive glyph) {
        return glyph.polygon().stream()
                .mapToDouble(DungeonMapContentModel.MapCanvasPoint::x)
                .average()
                .orElseThrow();
    }

    private static double glyphCenterR(DungeonMapContentModel.GlyphPrimitive glyph) {
        return glyph.polygon().stream()
                .mapToDouble(DungeonMapContentModel.MapCanvasPoint::y)
                .average()
                .orElseThrow();
    }

    private static boolean renderHasVisualOnlyWallRunMarkerAt(
            DungeonMapContentModel mapContentModel,
            double q,
            double r
    ) {
        List<DungeonMapContentModel.GlyphPrimitive> glyphs = mapContentModel.canvasStateProperty()
                .get()
                .renderScene()
                .glyphs();
        return glyphs.stream()
                .filter(glyph -> glyphMatchesHandleKind(glyph, CLUSTER_WALL_RUN_KIND)
                        && Math.abs(glyphCenterQ(glyph) - q) < 0.000_001
                        && Math.abs(glyphCenterR(glyph) - r) < 0.000_001)
                .anyMatch(wallRun -> glyphs.stream()
                        .filter(glyph -> glyphMatchesHandleKind(glyph, CLUSTER_CORNER_KIND))
                        .anyMatch(corner -> lowerAffordanceThanInteractiveCorner(wallRun, corner)));
    }

    private static boolean lowerAffordanceThanInteractiveCorner(
            DungeonMapContentModel.GlyphPrimitive wallRun,
            DungeonMapContentModel.GlyphPrimitive corner
    ) {
        return wallRun.style().alpha() < corner.style().alpha()
                && glyphWidth(wallRun) < glyphWidth(corner)
                && !wallRun.style().equals(corner.style());
    }

    private static double glyphWidth(DungeonMapContentModel.GlyphPrimitive glyph) {
        double min = glyph.polygon().stream()
                .mapToDouble(DungeonMapContentModel.MapCanvasPoint::x)
                .min()
                .orElseThrow();
        double max = glyph.polygon().stream()
                .mapToDouble(DungeonMapContentModel.MapCanvasPoint::x)
                .max()
                .orElseThrow();
        return max - min;
    }
}
