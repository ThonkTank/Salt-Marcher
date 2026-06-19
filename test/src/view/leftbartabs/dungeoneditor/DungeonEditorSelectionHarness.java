package src.view.leftbartabs.dungeoneditor;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Direction;
import src.domain.dungeon.published.DungeonEdgeRef;
import src.domain.dungeon.published.DungeonEditorControlsModel;
import src.domain.dungeon.published.DungeonEditorControlsSnapshot;
import src.domain.dungeon.published.DungeonEditorMapSurfaceModel;
import src.domain.dungeon.published.DungeonEditorMapSurfaceSnapshot;
import src.domain.dungeon.published.DungeonEditorPreview;
import src.domain.dungeon.published.DungeonEditorStateSnapshot;
import src.domain.dungeon.published.DungeonEditorTopologyElementRef;
import src.domain.dungeon.published.DungeonEditorViewMode;
import src.domain.dungeon.published.DungeonInspectorSnapshot;
import src.domain.dungeon.published.DungeonEditorMapSnapshot;
import src.domain.dungeon.published.DungeonMapSummary;
import src.domain.dungeon.published.DungeonOverlaySettings;
import src.domain.dungeon.published.DungeonTopologyElementRef;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel;
import src.view.slotcontent.main.dungeonmap.DungeonMapView;
import javafx.event.ActionEvent;
import javafx.geometry.Bounds;
import javafx.geometry.Point2D;
import javafx.scene.Parent;
import javafx.scene.control.ButtonBase;
import javafx.scene.control.CheckBox;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.Slider;
import javafx.scene.control.Spinner;
import javafx.scene.control.TextArea;
import javafx.scene.control.TextField;
import javafx.scene.control.ToggleButton;
import javafx.scene.input.KeyCode;
import javafx.scene.input.MouseButton;
import javafx.scene.input.MouseEvent;
import javafx.scene.layout.HBox;
import javafx.stage.Window;
import static src.view.leftbartabs.dungeoneditor.DungeonEditorBehaviorHarnessSupport.*;

final class DungeonEditorSelectionHarness {

    private static final String OWNER = "DungeonEditorSelectionHarness";

    private DungeonEditorSelectionHarness() {
    }

    static void run(List<String> results) throws Exception {
        route(results, () -> verifySelectionThroughMapView(results));
        route(results, () -> verifyDoorSelectionThroughMapView(results));
        route(results, () -> verifyStairSelectionThroughMapView(results));
        route(results, () -> verifyCorridorSelectionThroughMapView(results));
    }

    private static void route(
            List<String> results,
            DungeonEditorBehaviorHarnessSupport.ThrowingRunnable action
    ) throws Exception {
        DungeonEditorBehaviorHarnessSupport.runRouteProof(results, OWNER, action);
    }

    private static void verifySelectionThroughMapView(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();

        long mapId = createMapThroughControls(controls, runtime, "Selection Map");
        runtime.database().seedF1SingleRoom(mapId, "R1", 0, 1, 1);
        long geometryRowsBefore = runtime.database().countAuthoredGeometryRows(mapId);
        createMapThroughControls(controls, runtime, "Selection Reload Hop");
        selectMap(controls, "Selection Map");
        List<String> authoredStateBefore = runtime.database().authoredGeometryState(mapId);
        click(button(controls, "Auswahl"));
        DungeonEditorMapSurfaceSnapshot loadedSurface = runtime.mapSurfaceModel().current();
        var roomArea = loadedSurface.surface().map().areas().stream()
                .filter(area -> "R1".equals(area.label()))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("F1_SINGLE_ROOM R1 area not loaded."));
        DungeonEditorTopologyElementRef roomRef = roomArea.topologyRef();
        long roomClusterId = roomArea.clusterId();
        double roomFloorQ = 1.5;
        double roomFloorR = 1.5;

        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();
        assertHoverHighlightsSurface(
                binding.mapContentModel(),
                mapView,
                viewport,
                roomRef,
                roomFloorQ,
                roomFloorR,
                "DE-SEL-006 room floor hover");
        assertHoverClearsOnEmptyMove(
                binding.mapContentModel(),
                mapView,
                viewport,
                roomRef,
                "DE-SEL-006 room floor hover clear");
        fireMapMousePressed(
                mapView,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(roomFloorQ),
                viewport.sceneToScreenY(roomFloorR),
                false);

        DungeonEditorStateSnapshot selectedState = runtime.stateModel().current();
        DungeonEditorMapSurfaceSnapshot selectedSurface = runtime.mapSurfaceModel().current();
        assertSelectionMatches(roomRef, roomClusterId, selectedState.selection(), "DE-SEL-001 state model");
        assertSelectionMatches(roomRef, roomClusterId, selectedSurface.selection(), "DE-SEL-001 map surface");
        assertTrue(!selectedState.selection().clusterSelection(),
                "DE-SEL-001 state model room floor click stays out of cluster selection mode");
        assertTrue(selectedState.selection().handleRef() == null,
                "DE-SEL-001 state model room floor click does not publish a cluster-label handle");
        assertTrue(!selectedSurface.selection().clusterSelection(),
                "DE-SEL-001 map surface room floor click stays out of cluster selection mode");
        assertTrue(selectedSurface.selection().handleRef() == null,
                "DE-SEL-001 map surface room floor click does not publish a cluster-label handle");
        assertEquals(DungeonEditorPreview.none(), selectedSurface.preview(),
                "DE-SEL-001 room floor click keeps preview empty");
        assertTrue(selectedState.inspector() != null, "DE-SEL-001 inspector is published for the selected room");
        assertTrue(
                selectedState.inspector().title().contains("R1") || selectedState.inspector().facts().stream()
                        .anyMatch(fact -> fact.contains("R1") || fact.contains(String.valueOf(roomRef.id()))),
                "DE-SEL-001 inspector identifies the selected room");
        assertTrue(renderHasSelectedSurfacePrimitive(binding.mapContentModel(), roomRef),
                "DE-SEL-001 render scene highlights the selected room surface");
        assertCanvasPaintedAtScene(mapView, roomFloorQ, roomFloorR,
                "DE-SEL-001 rendered canvas paints the selected room coordinates");
        assertEquals(geometryRowsBefore, runtime.database().countAuthoredGeometryRows(mapId),
                "DE-SEL-001 leaves authored DB rows unchanged");
        assertEquals(authoredStateBefore, runtime.database().authoredGeometryState(mapId),
                "DE-SEL-001 leaves authored DB state unchanged");
        results.add("DE-SEL-001 Ready: DungeonMapView primary click -> SQLite unchanged -> room selection");

        fireMapMousePressed(
                mapView,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(8.5),
                viewport.sceneToScreenY(8.5),
                false);

        DungeonEditorStateSnapshot clearedState = runtime.stateModel().current();
        DungeonEditorMapSurfaceSnapshot clearedSurface = runtime.mapSurfaceModel().current();
        assertEmptySelection(clearedState.selection(), "DE-SEL-005 state model");
        assertEmptySelection(clearedSurface.selection(), "DE-SEL-005 map surface");
        assertTrue(clearedState.inspector() == null, "DE-SEL-005 inspector clears after empty-grid click");
        assertTrue(!renderHasSelectedSurfacePrimitive(binding.mapContentModel(), roomRef),
                "DE-SEL-005 render scene removes the room highlight");
        assertTrue(!surfaceCellSet(clearedSurface).contains("8,8,0"),
                "DE-SEL-005 clicked empty grid coordinate remains empty");
        assertEquals(geometryRowsBefore, runtime.database().countAuthoredGeometryRows(mapId),
                "DE-SEL-005 leaves authored DB rows unchanged");
        assertEquals(authoredStateBefore, runtime.database().authoredGeometryState(mapId),
                "DE-SEL-005 leaves authored DB state unchanged");
        results.add("DE-SEL-005 Ready: DungeonMapView empty primary click -> SQLite unchanged -> selection cleared");
    }


    private static void verifyDoorSelectionThroughMapView(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();

        long mapId = createMapThroughControls(controls, runtime, "Door Selection Map");
        runtime.database().seedF4WalledRoomWithDoor(mapId);
        long geometryRowsBefore = runtime.database().countAuthoredGeometryRows(mapId);
        createMapThroughControls(controls, runtime, "Door Selection Reload Hop");
        selectMap(controls, "Door Selection Map");
        List<String> authoredStateBefore = runtime.database().authoredGeometryState(mapId);
        click(button(controls, "Auswahl"));
        assertEquals(1L, runtime.database().countDoorBoundariesAt(mapId, 1, 0, "EAST"),
                "DE-SEL-002 fixture contains one east door boundary");
        var doorBoundary = runtime.mapSurfaceModel().current().surface().map().boundaries().stream()
                .filter(boundary -> "door".equalsIgnoreCase(boundary.kind()))
                .filter(boundary -> boundary.edge().from().q() == 4 && boundary.edge().from().r() == 2)
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("DE-SEL-002 door boundary not loaded."));
        Point2D doorMidpoint = boundaryMidpointNear(binding.mapContentModel(), "DOOR", 4.0, 2.5);
        var doorMidpointTarget = binding.mapContentModel()
                .resolvePointerTarget(doorMidpoint.getX(), doorMidpoint.getY());
        assertEquals("HANDLE",
                doorMidpointTarget.targetKind().name(),
                "DE-SEL-002 render hit index resolves the centered door drag affordance at the door midpoint: "
                        + doorMidpointTarget);
        Point2D doorSelectionPoint = new Point2D(doorMidpoint.getX(), doorMidpoint.getY() - 0.42);
        var doorPointerTarget = binding.mapContentModel()
                .resolvePointerTarget(doorSelectionPoint.getX(), doorSelectionPoint.getY());
        assertEquals("BOUNDARY",
                doorPointerTarget.targetKind().name(),
                "DE-SEL-002 render hit index resolves the free door segment as a boundary: "
                        + doorPointerTarget);
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();
        assertHoverHighlightsBoundary(
                binding.mapContentModel(),
                mapView,
                viewport,
                doorSelectionPoint.getX(),
                doorSelectionPoint.getY(),
                "DE-SEL-006 door boundary hover");

        fireMapMousePressed(
                mapView,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(doorMidpoint.getX()),
                viewport.sceneToScreenY(doorMidpoint.getY()),
                false);

        DungeonEditorStateSnapshot selectedState = runtime.stateModel().current();
        DungeonEditorMapSurfaceSnapshot selectedSurface = runtime.mapSurfaceModel().current();
        assertEquals(doorBoundary.topologyRef(), selectedState.selection().topologyRef(),
                "DE-SEL-002 state model selected door topology ref");
        assertEquals(doorBoundary.topologyRef(), selectedSurface.selection().topologyRef(),
                "DE-SEL-002 map surface selected door topology ref");
        assertDoorInspector(selectedState.inspector(), doorBoundary.topologyRef(), doorBoundary.label());
        assertDoorOwningRoomFacts(selectedSurface, doorBoundary);
        assertTrue(renderHasBoundaryPrimitive(binding.mapContentModel(), doorBoundary.topologyRef()),
                "DE-SEL-002 render scene contains the selected door boundary primitive");
        assertTrue(renderHasSelectedDoorBoundaryPrimitive(binding.mapContentModel(), doorBoundary.topologyRef()),
                "DE-SEL-002 render scene styles the selected door boundary distinctly");
        assertTrue(selectedDoorBoundaryDiffersFromNormalDoorStyle(binding.mapContentModel(), doorBoundary.topologyRef()),
                "DE-SEL-002 selected door boundary differs from normal door styling");
        assertCanvasPaintedAtScene(mapView, doorMidpoint.getX(), doorMidpoint.getY(),
                "DE-SEL-002 rendered canvas paints the selected door edge");
        assertEquals(geometryRowsBefore, runtime.database().countAuthoredGeometryRows(mapId),
                "DE-SEL-002 leaves authored DB row count unchanged");
        assertEquals(authoredStateBefore, runtime.database().authoredGeometryState(mapId),
                "DE-SEL-002 leaves authored DB state unchanged");

        results.add("DE-SEL-002 Ready: DungeonMapView door click -> SQLite unchanged -> door selection");
    }


    private static void verifyStairSelectionThroughMapView(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();

        long mapId = createMapThroughControls(controls, runtime, "Stair Selection Map");
        createMapThroughControls(controls, runtime, "Stair Selection Reload Hop");
        runtime.database().seedF7StairAnchor(mapId);
        selectMap(controls, "Stair Selection Map");
        long geometryRowsBefore = runtime.database().countAuthoredGeometryRows(mapId);
        List<String> authoredStateBefore = runtime.database().authoredGeometryState(mapId);
        click(button(controls, "Auswahl"));

        var stairFeature = runtime.mapSurfaceModel().current().surface().map().features().stream()
                .filter(feature -> "STAIR".equals(feature.kind()))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("F7_STAIR_ANCHOR stair feature not loaded."));
        var stairHandle = runtime.mapSurfaceModel().current().surface().map().editorHandles().stream()
                .filter(handle -> "STAIR_ANCHOR".equals(handle.ref().kind().name()))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("F7_STAIR_ANCHOR stair handle not loaded."));
        DungeonEditorTopologyElementRef stairRef = stairFeature.topologyRef();
        assertEquals(stairRef, editorTopologyRef(stairHandle.ref().topologyRef()),
                "DE-SEL-003 stair feature and handle share topology ref");
        assertTrue(runtime.mapSurfaceModel().current().surface().map().features().stream()
                        .anyMatch(feature -> feature.cells().stream()
                                .anyMatch(cell -> cell.q() == 2 && cell.r() == 2 && cell.level() == 0)),
                "DE-SEL-003 published stair feature includes anchor coordinate");
        assertTrue(stairFeature.cells().stream()
                        .anyMatch(cell -> cell.q() == 2 && cell.r() == 0 && cell.level() == 1),
                "DE-SEL-003 published stair feature includes upper exit coordinate");
        assertEquals("HANDLE", binding.mapContentModel()
                        .resolvePointerTarget(
                                glyphCenterForRef(binding.mapContentModel(), stairRef).getX(),
                                glyphCenterForRef(binding.mapContentModel(), stairRef).getY())
                        .targetKind()
                        .name(),
                "DE-SEL-003 render hit index resolves the stair marker as a handle");

        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();
        Point2D stairCenter = glyphCenterForRef(binding.mapContentModel(), stairRef);
        assertHoverHighlightsGlyph(
                binding.mapContentModel(),
                mapView,
                viewport,
                stairRef,
                stairCenter.getX(),
                stairCenter.getY(),
                "DE-SEL-006 stair marker hover");
        fireMapMousePressed(
                mapView,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(stairCenter.getX()),
                viewport.sceneToScreenY(stairCenter.getY()),
                false);

        DungeonEditorStateSnapshot selectedState = runtime.stateModel().current();
        DungeonEditorMapSurfaceSnapshot selectedSurface = runtime.mapSurfaceModel().current();
        assertEquals(stairRef, selectedState.selection().topologyRef(),
                "DE-SEL-003 state model selected stair topology ref");
        assertEquals(stairRef, selectedSurface.selection().topologyRef(),
                "DE-SEL-003 map surface selected stair topology ref");
        assertTrue(selectedState.selection().handleRef() != null,
                "DE-SEL-003 state model selected stair handle ref is present");
        assertEquals(stairHandle.ref().kind(), selectedState.selection().handleRef().kind(),
                "DE-SEL-003 state model selected stair handle kind");
        assertEquals(stairHandle.ref().topologyRef(), selectedState.selection().handleRef().topologyRef(),
                "DE-SEL-003 state model selected stair handle topology ref");
        assertTrue(selectedState.inspector() != null, "DE-SEL-003 inspector is published for selected stair");
        assertTrue(selectedState.inspector().title().contains("S1")
                        || selectedState.inspector().facts().stream()
                        .anyMatch(fact -> fact.contains("STAIR") || fact.contains(String.valueOf(stairRef.id()))),
                "DE-SEL-003 inspector identifies selected stair");
        assertTrue(renderHasSelectedGlyphPrimitive(binding.mapContentModel(), stairRef),
                "DE-SEL-003 render scene highlights the selected stair marker");
        assertTrue(renderHasSelectedSurfacePrimitive(binding.mapContentModel(), stairRef),
                "DE-SEL-003 render scene highlights the selected active-level stair path cell");
        assertCanvasPaintedAtScene(mapView, stairCenter.getX(), stairCenter.getY(),
                "DE-SEL-003 rendered canvas paints the selected stair marker");
        assertEquals(geometryRowsBefore, runtime.database().countAuthoredGeometryRows(mapId),
                "DE-SEL-003 leaves authored DB row count unchanged");
        assertEquals(authoredStateBefore, runtime.database().authoredGeometryState(mapId),
                "DE-SEL-003 leaves authored DB state unchanged");

        results.add("DE-SEL-003 Ready: DungeonMapView stair handle click -> SQLite unchanged -> stair selection");
    }


    private static void verifyCorridorSelectionThroughMapView(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();

        long mapId = createMapThroughControls(controls, runtime, "Corridor Selection Map");
        runtime.database().seedCorridorWithAnchor(mapId);
        long geometryRowsBefore = runtime.database().countAuthoredGeometryRows(mapId);
        createMapThroughControls(controls, runtime, "Corridor Selection Reload Hop");
        selectMap(controls, "Corridor Selection Map");
        List<String> authoredStateBefore = runtime.database().authoredGeometryState(mapId);
        click(button(controls, "Auswahl"));
        var corridorAnchor = runtime.mapSurfaceModel().current().surface().map().editorHandles().stream()
                .filter(handle -> "CORRIDOR_ANCHOR".equals(handle.ref().kind().name()))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("F5_CORRIDOR_WITH_ANCHOR anchor handle not loaded."));
        DungeonEditorTopologyElementRef corridorRef = runtime.mapSurfaceModel().current().surface().map().areas().stream()
                .filter(area -> "CORRIDOR".equals(area.kind()))
                .map(DungeonEditorMapSnapshot.Area::topologyRef)
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("F5_CORRIDOR_WITH_ANCHOR corridor area not loaded."));
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();
        Point2D corridorBody = new Point2D(corridorAnchor.markerQ() + 0.05, corridorAnchor.markerR() + 0.05);
        assertEquals("CELL", binding.mapContentModel()
                        .resolvePointerTarget(corridorBody.getX(), corridorBody.getY())
                        .targetKind()
                        .name(),
                "DE-SEL-004 corridor body resolves as a body cell instead of an anchor handle");
        assertEquals("CORRIDOR", binding.mapContentModel()
                        .resolvePointerTarget(corridorBody.getX(), corridorBody.getY())
                        .elementKind(),
                "DE-SEL-004 corridor body keeps corridor element identity");

        fireMapMousePressed(
                mapView,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(corridorBody.getX()),
                viewport.sceneToScreenY(corridorBody.getY()),
                false);

        DungeonEditorStateSnapshot selectedState = runtime.stateModel().current();
        DungeonEditorMapSurfaceSnapshot selectedSurface = runtime.mapSurfaceModel().current();
        assertEquals(corridorRef, selectedState.selection().topologyRef(),
                "DE-SEL-004 state model selected corridor topology ref");
        assertEquals(corridorRef, selectedSurface.selection().topologyRef(),
                "DE-SEL-004 map surface selected corridor topology ref");
        assertEquals(corridorAnchor.ref(), selectedState.selection().handleRef(),
                "DE-SEL-004 corridor body selection publishes only the focused state-edit anchor ref");
        assertTrue(selectedState.inspector() != null, "DE-SEL-004 inspector is published for selected corridor");
        assertTrue(renderHasSelectedSurfacePrimitive(binding.mapContentModel(), corridorRef),
                "DE-SEL-004 render scene highlights the selected corridor route");
        assertCanvasPaintedAtScene(mapView, 6.5, 3.5,
                "DE-SEL-004 rendered canvas paints the selected anchor corridor route");
        assertEquals(geometryRowsBefore, runtime.database().countAuthoredGeometryRows(mapId),
                "DE-SEL-004 leaves authored DB row count unchanged");
        assertEquals(authoredStateBefore, runtime.database().authoredGeometryState(mapId),
                "DE-SEL-004 leaves authored DB state unchanged");

        results.add("DE-SEL-004 Ready: DungeonMapView corridor body click -> SQLite unchanged -> corridor selection");
    }

    private static void assertHoverHighlightsSurface(
            DungeonMapContentModel mapContentModel,
            DungeonMapView mapView,
            DungeonMapContentModel.Viewport viewport,
            DungeonEditorTopologyElementRef ref,
            double sceneX,
            double sceneY,
            String message
    ) {
        String selectionRef = selectionRef(ref);
        double normalStroke = surfaceStrokeWidth(mapContentModel, selectionRef);
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_MOVED,
                MouseButton.NONE,
                viewport.sceneToScreenX(sceneX),
                viewport.sceneToScreenY(sceneY),
                false);
        double hoverStroke = surfaceStrokeWidth(mapContentModel, selectionRef);
        assertTrue(hoverStroke > normalStroke && hoverStroke < 2.0 / DEFAULT_GRID_SIZE,
                message + " uses a hover stroke distinct from normal and selected styling");
    }

    private static void assertHoverClearsOnEmptyMove(
            DungeonMapContentModel mapContentModel,
            DungeonMapView mapView,
            DungeonMapContentModel.Viewport viewport,
            DungeonEditorTopologyElementRef ref,
            String message
    ) {
        String selectionRef = selectionRef(ref);
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_MOVED,
                MouseButton.NONE,
                viewport.sceneToScreenX(8.5),
                viewport.sceneToScreenY(8.5),
                false);
        assertTrue(surfaceStrokeWidth(mapContentModel, selectionRef) < 1.5 / DEFAULT_GRID_SIZE,
                message + " removes hover styling after an empty target move");
    }

    private static void assertHoverHighlightsBoundary(
            DungeonMapContentModel mapContentModel,
            DungeonMapView mapView,
            DungeonMapContentModel.Viewport viewport,
            double sceneX,
            double sceneY,
            String message
    ) {
        DungeonMapContentModel.PointerTarget target = mapContentModel.resolvePointerTarget(sceneX, sceneY);
        assertEquals("BOUNDARY", target.targetKind().name(), message + " resolves a boundary target");
        String selectionRef = target.topologyKind() + ":" + target.topologyId();
        double normalStroke = boundaryStrokeWidth(mapContentModel, selectionRef);
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_MOVED,
                MouseButton.NONE,
                viewport.sceneToScreenX(sceneX),
                viewport.sceneToScreenY(sceneY),
                false);
        double hoverStroke = boundaryStrokeWidth(mapContentModel, selectionRef);
        assertTrue(hoverStroke > normalStroke && hoverStroke < 4.2 / DEFAULT_GRID_SIZE,
                message + " uses a boundary hover stroke distinct from normal and selected styling"
                        + " (normal=" + normalStroke + ", hover=" + hoverStroke + ")");
    }

    private static void assertHoverHighlightsGlyph(
            DungeonMapContentModel mapContentModel,
            DungeonMapView mapView,
            DungeonMapContentModel.Viewport viewport,
            DungeonEditorTopologyElementRef ref,
            double sceneX,
            double sceneY,
            String message
    ) {
        String selectionRef = selectionRef(ref);
        double normalStroke = glyphStrokeWidth(mapContentModel, selectionRef);
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_MOVED,
                MouseButton.NONE,
                viewport.sceneToScreenX(sceneX),
                viewport.sceneToScreenY(sceneY),
                false);
        double hoverStroke = glyphStrokeWidth(mapContentModel, selectionRef);
        assertTrue(hoverStroke > normalStroke && hoverStroke < 2.2 / DEFAULT_GRID_SIZE,
                message + " uses a glyph hover stroke distinct from normal and selected styling");
    }

    private static String selectionRef(DungeonEditorTopologyElementRef ref) {
        return ref.kind() + ":" + ref.id();
    }

    private static double surfaceStrokeWidth(DungeonMapContentModel mapContentModel, String selectionRef) {
        return mapContentModel.canvasStateProperty().get().renderScene().surfaces().stream()
                .filter(surface -> selectionRef.equals(surface.selectionRef()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Surface primitive not found for " + selectionRef))
                .style()
                .strokeWidth();
    }

    private static double boundaryStrokeWidth(DungeonMapContentModel mapContentModel, String selectionRef) {
        return mapContentModel.canvasStateProperty().get().renderScene().boundaries().stream()
                .filter(boundary -> selectionRef.equals(boundary.selectionRef()))
                .map(DungeonMapContentModel.BoundaryPrimitive::style)
                .mapToDouble(DungeonMapContentModel.PaintStyle::strokeWidth)
                .max()
                .orElseThrow(() -> new AssertionError("Boundary primitive not found for " + selectionRef));
    }

    private static double glyphStrokeWidth(DungeonMapContentModel mapContentModel, String selectionRef) {
        return mapContentModel.canvasStateProperty().get().renderScene().glyphs().stream()
                .filter(glyph -> selectionRef.equals(glyph.selectionRef()))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Glyph primitive not found for " + selectionRef))
                .style()
                .strokeWidth();
    }

}
