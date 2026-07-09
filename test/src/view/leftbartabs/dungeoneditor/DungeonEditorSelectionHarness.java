package src.view.leftbartabs.dungeoneditor;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Direction;
import src.domain.dungeon.published.DungeonCellRef;
import src.domain.dungeon.published.DungeonEdgeRef;
import src.domain.dungeon.published.DungeonEditorMapSurfaceSnapshot;
import src.domain.dungeon.published.DungeonEditorPreview;
import src.domain.dungeon.published.DungeonEditorStateSnapshot;
import src.domain.dungeon.published.DungeonEditorSurface;
import src.domain.dungeon.published.DungeonEditorTool;
import src.domain.dungeon.published.DungeonEditorTopologyElementRef;
import src.domain.dungeon.published.DungeonEditorViewMode;
import src.domain.dungeon.published.DungeonEditorMapSnapshot;
import src.domain.dungeon.published.DungeonOverlaySettings;
import src.features.dungeon.runtime.DungeonEditorPreparedFrameFacts;
import src.features.dungeon.runtime.DungeonEditorRuntimePointerTarget;
import src.features.dungeon.runtime.DungeonEditorRenderFrame;
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
        route(results, () -> verifyToolSwitchClearsSelectionThroughMapView(results));
        route(results, () -> verifyToolSpecificHoverPolicyThroughMapView(results));
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
        assertHoverStylesOnlySurfaceAt(
                binding.mapContentModel(),
                mapView,
                viewport,
                roomRef,
                roomFloorQ,
                roomFloorR,
                "DE-SEL-006 room floor hover stays on the exact rendered cell");
        assertRuntimeCellTargetPreservesExactCell(
                binding.mapContentModel(),
                roomFloorQ,
                roomFloorR,
                0,
                "DE-SEL-006 room floor runtime pointer target preserves exact cell coordinates");
        assertHoverStylesOnlySyntheticBoundaryEdge(
                "DE-SEL-006 boundary hover stays on the exact rendered edge");
        assertSelectHoverIgnoresWallBoundary(
                binding.mapContentModel(),
                mapView,
                viewport,
                "DE-SEL-006 select hover ignores plain wall boundaries");
        assertSelectHoverPublishesNoSyntheticOverlay(
                binding.mapContentModel(),
                mapView,
                viewport,
                10.12,
                10.02,
                "DE-SEL-006 select hover ignores tool-only off-grid hover points");
        assertRoomLabelHoverStaysPassive(
                binding.mapContentModel(),
                mapView,
                viewport,
                roomRef,
                "DE-SEL-006 room label hover stays passive");
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
        var doorMidpointTarget = runtimePointerTarget(binding.mapContentModel(), doorMidpoint.getX(), doorMidpoint.getY());
        assertEquals(DungeonEditorRuntimePointerTarget.TargetKind.HANDLE,
                doorMidpointTarget.targetKind(),
                "DE-SEL-002 render hit index resolves the centered door drag affordance at the door midpoint: "
                        + doorMidpointTarget);
        Point2D doorSelectionPoint = new Point2D(doorMidpoint.getX(), doorMidpoint.getY() - 0.42);
        var doorPointerTarget = runtimePointerTarget(binding.mapContentModel(), doorSelectionPoint.getX(), doorSelectionPoint.getY());
        assertEquals(DungeonEditorRuntimePointerTarget.TargetKind.BOUNDARY,
                doorPointerTarget.targetKind(),
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
        assertEquals(DungeonEditorRuntimePointerTarget.TargetKind.HANDLE, runtimePointerTarget(binding.mapContentModel(),
                                glyphCenterForRef(binding.mapContentModel(), stairRef).getX(),
                                glyphCenterForRef(binding.mapContentModel(), stairRef).getY())
                        .targetKind(),
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
                        || selectedState.inspector().statePanelFacts().stairGeometry().stairId() == stairRef.id(),
                "DE-SEL-003 inspector typed state-panel facts identify selected stair");
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
        assertEquals(DungeonEditorRuntimePointerTarget.TargetKind.CELL,
                runtimePointerTarget(binding.mapContentModel(), corridorBody.getX(), corridorBody.getY())
                        .targetKind(),
                "DE-SEL-004 corridor body resolves as a body cell instead of an anchor handle");
        assertEquals(DungeonEditorRuntimePointerTarget.ElementKind.CORRIDOR,
                runtimePointerTarget(binding.mapContentModel(), corridorBody.getX(), corridorBody.getY())
                        .elementKind(),
                "DE-SEL-004 corridor body keeps corridor element identity");
        assertHoverStylesOnlySurfaceAt(
                binding.mapContentModel(),
                mapView,
                viewport,
                corridorRef,
                corridorBody.getX(),
                corridorBody.getY(),
                "DE-SEL-006 corridor body hover stays on the exact rendered cell");

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
        DungeonMapContentModel.MapCanvasPolygonPrimitive selectedCorridorSurface =
                surfacePrimitiveAt(binding.mapContentModel(), selectionRef(corridorRef), 6.5, 3.5);
        assertCanvasPaintedWithPrimitiveStrokeNearScene(mapView, selectedCorridorSurface, 6.5, 3.5, 18,
                "DE-SEL-004 rendered canvas paints the selected anchor corridor route");
        assertEquals(geometryRowsBefore, runtime.database().countAuthoredGeometryRows(mapId),
                "DE-SEL-004 leaves authored DB row count unchanged");
        assertEquals(authoredStateBefore, runtime.database().authoredGeometryState(mapId),
                "DE-SEL-004 leaves authored DB state unchanged");

        results.add("DE-SEL-006 Ready: DungeonMapView hover route keeps selectable targets visually distinct and exact"
                + " while ignoring non-selectable wall, tool-only, and room-label targets");
        results.add("DE-SEL-004 Ready: DungeonMapView corridor body click -> SQLite unchanged -> corridor selection");
    }

    private static void verifyToolSpecificHoverPolicyThroughMapView(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();

        long mapId = createMapThroughControls(controls, runtime, "Tool Hover Policy Map");
        runtime.database().seedCorridorWithAnchor(mapId);
        createMapThroughControls(controls, runtime, "Tool Hover Policy Reload Hop");
        selectMap(controls, "Tool Hover Policy Map");
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();

        click(button(controls, "Auswahl"));
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_MOVED,
                MouseButton.NONE,
                viewport.sceneToScreenX(10.12),
                viewport.sceneToScreenY(10.02),
                false);
        DungeonMapStateProbe.Snapshot emptyHoverSnapshot =
                DungeonMapStateProbe.snapshot(binding.mapContentModel());
        AtomicInteger statePublications = new AtomicInteger();
        Runnable unsubscribeStateCounter = runtime.stateModel().subscribe(ignored -> statePublications.incrementAndGet());
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_MOVED,
                MouseButton.NONE,
                viewport.sceneToScreenX(10.12),
                viewport.sceneToScreenY(10.02),
                false);
        unsubscribeStateCounter.run();
        assertEquals(0L, statePublications.get(),
                "DE-HOVER-002 repeated empty selection hover does not publish a full editor snapshot");
        assertProjectionAndDraftUnchanged(
                emptyHoverSnapshot,
                DungeonMapStateProbe.snapshot(binding.mapContentModel()),
                "DE-HOVER-002 repeated empty selection hover does not publish a runtime frame");
        assertCanvasAndHoverStateUnchanged(
                emptyHoverSnapshot,
                DungeonMapStateProbe.snapshot(binding.mapContentModel()),
                "DE-HOVER-002 repeated empty selection hover does not publish canvas or hover state");
        assertNoSyntheticHoverOverlay(binding.mapContentModel(),
                "DE-HOVER-002 empty selection hover remains view-local");

        DungeonMapStateProbe.Snapshot beforeToolSwitchMeasurement =
                DungeonMapStateProbe.snapshot(binding.mapContentModel());
        AtomicInteger toolSwitchStatePublications = new AtomicInteger();
        AtomicInteger toolSwitchSurfacePublications = new AtomicInteger();
        Runnable unsubscribeToolSwitchState =
                runtime.stateModel().subscribe(ignored -> toolSwitchStatePublications.incrementAndGet());
        Runnable unsubscribeToolSwitchSurface =
                runtime.mapSurfaceModel().subscribe(ignored -> toolSwitchSurfacePublications.incrementAndGet());
        click(button(controls, "Wand"));
        unsubscribeToolSwitchState.run();
        unsubscribeToolSwitchSurface.run();
        assertEquals("Wand setzen", DungeonMapStateProbe.renderStatusLabel(binding.mapContentModel()),
                "DE-TOOL-007 tool-only switch updates the canvas status label");
        assertEquals(0L, toolSwitchStatePublications.get(),
                "DE-TOOL-007 tool-only switch does not publish state");
        assertEquals(0L, toolSwitchSurfacePublications.get(),
                "DE-TOOL-007 tool-only switch does not publish map surface");
        assertRenderAndHitSignaturesUnchanged(
                beforeToolSwitchMeasurement,
                DungeonMapStateProbe.snapshot(binding.mapContentModel()),
                "DE-TOOL-007 tool-only switch from Auswahl to Wand keeps render and hit signatures stable");
        DungeonMapStateProbe.Snapshot beforeRepeatedToolClickMeasurement =
                DungeonMapStateProbe.snapshot(binding.mapContentModel());
        click(button(controls, "Wand"));
        assertEquals("Wand setzen", DungeonMapStateProbe.renderStatusLabel(binding.mapContentModel()),
                "DE-TOOL-007 repeated tool-only selection keeps the canvas status label coherent");
        assertRenderAndHitSignaturesUnchanged(
                beforeRepeatedToolClickMeasurement,
                DungeonMapStateProbe.snapshot(binding.mapContentModel()),
                "DE-TOOL-007 repeated tool-only selection keeps render and hit signatures stable");
        results.add("DE-TOOL-007 Ready: tool-only switch suppresses state and map-surface publication");
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_MOVED,
                MouseButton.NONE,
                viewport.sceneToScreenX(10.12),
                viewport.sceneToScreenY(10.02),
                false);
        assertSyntheticVertexHoverAt(binding.mapContentModel(), 10, 10,
                "DE-HOVER-001 wall path hover highlights a vertex");

        fireMapMouseWithControl(
                mapView,
                MouseEvent.MOUSE_MOVED,
                MouseButton.NONE,
                viewport.sceneToScreenX(10.12),
                viewport.sceneToScreenY(10.02));
        assertSyntheticBoundaryHoverAt(binding.mapContentModel(), 10.0, 10.0, 11.0, 10.0,
                "DE-HOVER-001 wall single-click hover highlights an edge");

        click(button(controls, "Raum"));
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_MOVED,
                MouseButton.NONE,
                viewport.sceneToScreenX(10.5),
                viewport.sceneToScreenY(10.5),
                false);
        assertSyntheticCellHoverAt(binding.mapContentModel(), 10, 10,
                "DE-HOVER-001 room hover highlights a cell");

        click(button(controls, "Korridor"));
        assertNoSyntheticHoverOverlay(binding.mapContentModel(),
                "DE-HOVER-001 tool switch clears stale synthetic hover before the next mouse move");
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_MOVED,
                MouseButton.NONE,
                viewport.sceneToScreenX(1.5),
                viewport.sceneToScreenY(2.5),
                false);
        assertNoSyntheticHoverOverlay(binding.mapContentModel(),
                "DE-HOVER-001 corridor hover ignores generic room cells");

        var corridorAnchor = runtime.mapSurfaceModel().current().surface().map().editorHandles().stream()
                .filter(handle -> "CORRIDOR_ANCHOR".equals(handle.ref().kind().name()))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("F5_CORRIDOR_WITH_ANCHOR anchor not loaded."));
        DungeonEditorTopologyElementRef corridorRef = runtime.mapSurfaceModel().current().surface().map().areas().stream()
                .filter(area -> "CORRIDOR".equals(area.kind()))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("F5_CORRIDOR_WITH_ANCHOR corridor area not loaded."))
                .topologyRef();
        Point2D corridorBody = new Point2D(corridorAnchor.markerQ() + 0.05, corridorAnchor.markerR() + 0.05);
        assertHoverStylesOnlySurfaceAt(
                binding.mapContentModel(),
                mapView,
                viewport,
                corridorRef,
                corridorBody.getX(),
                corridorBody.getY(),
                "DE-HOVER-001 corridor hover keeps corridor cells eligible");

        Point2D doorMidpoint = boundaryMidpointNear(binding.mapContentModel(), "DOOR", 4.0, 2.5);
        assertHoverHighlightsBoundary(
                binding.mapContentModel(),
                mapView,
                viewport,
                doorMidpoint.getX(),
                doorMidpoint.getY(),
                "DE-HOVER-001 corridor hover keeps wall and door edges eligible");

        results.add("DE-HOVER-001 Ready: DungeonMapView hover policy follows active editor tool geometry");
        results.add("DE-HOVER-002 Ready: empty selection hover stays off the state publication path");
    }

    private static void verifyToolSwitchClearsSelectionThroughMapView(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();
        DungeonEditorStateView stateView = binding.stateView();

        long mapId = createMapThroughControls(controls, runtime, "Tool Switch Selection Clear Map");
        runtime.database().seedTransitionDescriptionFixture(mapId);
        createMapThroughControls(controls, runtime, "Tool Switch Selection Clear Reload Hop");
        selectMap(controls, "Tool Switch Selection Clear Map");
        long transitionId = runtime.database().transitionIdByDescription(mapId, "Initial transition.");
        DungeonEditorTopologyElementRef transitionRef = new DungeonEditorTopologyElementRef("TRANSITION", transitionId);

        click(button(controls, "Auswahl"));
        Point2D transitionCenter = glyphCenterForRef(binding.mapContentModel(), transitionRef);
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();
        fireMapMousePressed(
                mapView,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(transitionCenter.getX()),
                viewport.sceneToScreenY(transitionCenter.getY()),
                false);

        assertEquals(transitionRef, runtime.stateModel().current().selection().topologyRef(),
                "DE-SEL-014 precondition selects transition in state model");
        assertEquals(transitionRef, runtime.mapSurfaceModel().current().selection().topologyRef(),
                "DE-SEL-014 precondition selects transition on map surface");
        assertTrue(renderHasSelectedGlyphPrimitive(binding.mapContentModel(), transitionRef),
                "DE-SEL-014 precondition renders selected transition highlight");
        assertTrue(textArea(stateView, "Übergang Beschreibung").isVisible(),
                "DE-SEL-014 precondition shows transition description card");
        assertTrue(comboBox(stateView, "Eingangslink Zieltyp").isVisible(),
                "DE-SEL-014 precondition shows selected-transition destination card");

        click(button(controls, "Tür"));

        DungeonEditorStateSnapshot clearedState = runtime.stateModel().current();
        DungeonEditorMapSurfaceSnapshot clearedSurface = runtime.mapSurfaceModel().current();
        assertEquals("DOOR_CREATE", runtime.controlsModel().current().selectedTool().name(),
                "DE-SEL-014 tool switch applies the requested non-selection tool");
        assertEmptySelection(clearedState.selection(), "DE-SEL-014 state model after non-selection tool switch");
        assertEmptySelection(clearedSurface.selection(), "DE-SEL-014 map surface after non-selection tool switch");
        assertTrue(clearedState.inspector() == null, "DE-SEL-014 inspector clears after non-selection tool switch");
        assertTrue(!renderHasSelectedGlyphPrimitive(binding.mapContentModel(), transitionRef),
                "DE-SEL-014 render scene removes selected transition highlight");
        assertVisibleAccessibleTextAbsent(stateView, "Übergang Beschreibung",
                "DE-SEL-014 transition description card hides after non-selection tool switch");
        assertVisibleAccessibleTextAbsent(stateView, "Eingangslink Zieltyp",
                "DE-SEL-014 selected-transition destination card hides after non-selection tool switch");

        click(button(controls, "Auswahl"));
        assertEmptySelection(runtime.stateModel().current().selection(),
                "DE-SEL-014 switching back to selection does not invent a selection");

        results.add("DE-SEL-014 Ready: non-selection tool switch clears selection, inspector,"
                + " map highlight, and selected-transition state cards");
    }

    private static void assertVisibleAccessibleTextAbsent(
            Parent parent,
            String accessibleText,
            String message
    ) {
        boolean found = descendants(parent).stream()
                .filter(node -> accessibleText.equals(node.getAccessibleText()))
                .anyMatch(javafx.scene.Node::isVisible);
        assertTrue(!found, message);
    }

    private static void assertProjectionAndDraftUnchanged(
            DungeonMapStateProbe.Snapshot before,
            DungeonMapStateProbe.Snapshot after,
            String message
    ) {
        assertEquals(before.projectionLevel(), after.projectionLevel(), message + " projectionLevel");
        assertEquals(before.inlineLabelDraftLength(), after.inlineLabelDraftLength(),
                message + " inlineLabelDraftLength");
    }

    private static void assertCanvasAndHoverStateUnchanged(
            DungeonMapStateProbe.Snapshot before,
            DungeonMapStateProbe.Snapshot after,
            String message
    ) {
        assertRenderAndHitSignaturesUnchanged(before, after, message);
        assertEquals(before.canvasStateIdentity(), after.canvasStateIdentity(),
                message + " canvasStateIdentity");
        assertEquals(before.hoverOverlayPrimitiveCount(), after.hoverOverlayPrimitiveCount(),
                message + " hoverOverlayPrimitiveCount");
    }

    private static void assertRenderAndHitSignaturesUnchanged(
            DungeonMapStateProbe.Snapshot before,
            DungeonMapStateProbe.Snapshot after,
            String message
    ) {
        assertEquals(before.renderGeometrySignature(), after.renderGeometrySignature(),
                message + " renderGeometrySignature");
        assertEquals(before.hitTargetSignature(), after.hitTargetSignature(),
                message + " hitTargetSignature");
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
        assertTrue(hoverStroke > normalStroke,
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
        assertEquals(normalSurfaceStrokeWidth(mapContentModel, selectionRef), surfaceStrokeWidth(mapContentModel, selectionRef),
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
        var target = runtimePointerTarget(mapContentModel, sceneX, sceneY, true);
        assertEquals(DungeonEditorRuntimePointerTarget.TargetKind.BOUNDARY, target.targetKind(),
                message + " resolves a boundary target");
        String selectionRef = target.topologyRefText() + ":" + target.topologyId();
        double normalStroke = boundaryStrokeWidth(mapContentModel, selectionRef);
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_MOVED,
                MouseButton.NONE,
                viewport.sceneToScreenX(sceneX),
                viewport.sceneToScreenY(sceneY),
                false);
        double hoverStroke = boundaryStrokeWidth(mapContentModel, selectionRef);
        assertTrue(hoverStroke > normalStroke,
                message + " uses a boundary hover stroke distinct from normal and selected styling"
                        + " (normal=" + normalStroke + ", hover=" + hoverStroke + ")");
    }

    private static void assertRuntimeCellTargetPreservesExactCell(
            DungeonMapContentModel mapContentModel,
            double sceneX,
            double sceneY,
            int projectionLevel,
            String message
    ) {
        var runtimeTarget = runtimePointerTarget(mapContentModel, sceneX, sceneY, false, projectionLevel);
        assertTrue(runtimeTarget.cellRef().exact(), message + " publishes an exact runtime cell target");
        assertEquals((int) Math.floor(sceneX), runtimeTarget.cellRef().q(), message + " preserves q");
        assertEquals((int) Math.floor(sceneY), runtimeTarget.cellRef().r(), message + " preserves r");
        assertEquals(projectionLevel, runtimeTarget.cellRef().level(), message + " preserves level");
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
        assertTrue(hoverStroke > normalStroke,
                message + " uses a glyph hover stroke distinct from normal and selected styling");
    }

    private static void assertHoverStylesOnlySurfaceAt(
            DungeonMapContentModel mapContentModel,
            DungeonMapView mapView,
            DungeonMapContentModel.Viewport viewport,
            DungeonEditorTopologyElementRef ref,
            double sceneX,
            double sceneY,
            String message
    ) {
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_MOVED,
                MouseButton.NONE,
                viewport.sceneToScreenX(8.5),
                viewport.sceneToScreenY(8.5),
                false);
        var target = runtimePointerTarget(mapContentModel, sceneX, sceneY);
        assertEquals(DungeonEditorRuntimePointerTarget.TargetKind.CELL, target.targetKind(),
                message + " resolves a cell target");
        String selectionRef = selectionRef(ref);
        DungeonMapContentModel.MapCanvasPolygonPrimitive hoveredBefore =
                surfacePrimitiveAt(mapContentModel, selectionRef, sceneX, sceneY);
        DungeonMapContentModel.MapCanvasPolygonPrimitive siblingBefore =
                siblingSurfacePrimitive(mapContentModel, selectionRef, hoveredBefore);
        double normalHoverCellStroke = hoveredBefore.style().strokeWidth();
        double normalSiblingStroke = siblingBefore.style().strokeWidth();

        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_MOVED,
                MouseButton.NONE,
                viewport.sceneToScreenX(sceneX),
                viewport.sceneToScreenY(sceneY),
                false);

        DungeonMapContentModel.MapCanvasPolygonPrimitive hoveredAfter =
                surfacePrimitiveAt(mapContentModel, selectionRef, sceneX, sceneY);
        DungeonMapContentModel.MapCanvasPolygonPrimitive siblingAfter =
                surfacePrimitiveWithOrigin(mapContentModel, selectionRef, siblingBefore);
        assertTrue(hoveredAfter.style().strokeWidth() > normalHoverCellStroke,
                message + " increases the hovered cell stroke");
        assertEquals(normalSiblingStroke, siblingAfter.style().strokeWidth(),
                message + " leaves sibling cell stroke unchanged");
    }

    private static void assertSelectHoverIgnoresWallBoundary(
            DungeonMapContentModel mapContentModel,
            DungeonMapView mapView,
            DungeonMapContentModel.Viewport viewport,
            String message
    ) {
        DungeonMapContentModel.BoundaryPrimitive plainWall = mapContentModel.canvasStateProperty()
                .get()
                .renderScene()
                .boundaries()
                .stream()
                .filter(boundary -> boundary.selectionRef().startsWith("WALL:"))
                .filter(boundary -> !boundary.hitRef().isBlank())
                .findFirst()
                .orElseThrow(() -> new AssertionError(message + " fixture has no rendered wall boundary"));
        Point2D midpoint = boundaryMidpoint(plainWall);
        var rawTarget =
                runtimePointerTarget(mapContentModel, midpoint.getX(), midpoint.getY(), true);
        assertEquals(DungeonEditorRuntimePointerTarget.TargetKind.BOUNDARY, rawTarget.targetKind(),
                message + " raw hit index still exposes boundary");
        assertEquals(DungeonEditorRuntimePointerTarget.BoundaryKind.WALL, rawTarget.boundaryRef().boundaryKind(),
                message + " raw boundary is a wall");

        double normalStroke = plainWall.style().strokeWidth();
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_MOVED,
                MouseButton.NONE,
                viewport.sceneToScreenX(midpoint.getX()),
                viewport.sceneToScreenY(midpoint.getY()),
                false);

        DungeonMapContentModel.BoundaryPrimitive afterHover =
                boundaryPrimitiveWithEndpoints(mapContentModel, plainWall.selectionRef(), plainWall);
        assertEquals(normalStroke, afterHover.style().strokeWidth(),
                message + " leaves the non-selectable wall edge unhighlighted");
        assertNoSyntheticHoverOverlay(mapContentModel, message);
    }

    private static void assertSelectHoverPublishesNoSyntheticOverlay(
            DungeonMapContentModel mapContentModel,
            DungeonMapView mapView,
            DungeonMapContentModel.Viewport viewport,
            double sceneX,
            double sceneY,
            String message
    ) {
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_MOVED,
                MouseButton.NONE,
                viewport.sceneToScreenX(sceneX),
                viewport.sceneToScreenY(sceneY),
                false);
        assertNoSyntheticHoverOverlay(mapContentModel, message);
    }

    private static void assertRoomLabelHoverStaysPassive(
            DungeonMapContentModel mapContentModel,
            DungeonMapView mapView,
            DungeonMapContentModel.Viewport viewport,
            DungeonEditorTopologyElementRef roomRef,
            String message
    ) {
        Point2D labelCenter = labelCenterForRef(mapContentModel, roomRef);
        DungeonMapContentModel.TextPrimitive labelBefore = textPrimitiveForRef(mapContentModel, roomRef);
        assertTrue(runtimePointerTarget(mapContentModel, labelCenter.getX(), labelCenter.getY())
                        .targetKind() != DungeonEditorRuntimePointerTarget.TargetKind.LABEL,
                message + " room label is not a runtime label target");

        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_MOVED,
                MouseButton.NONE,
                viewport.sceneToScreenX(labelCenter.getX()),
                viewport.sceneToScreenY(labelCenter.getY()),
                false);

        DungeonMapContentModel.TextPrimitive labelAfter = textPrimitiveForRef(mapContentModel, roomRef);
        assertEquals(labelBefore.style(), labelAfter.style(), message + " leaves room label text styling unchanged");
        assertEquals(labelBefore.textColor(), labelAfter.textColor(), message + " leaves room label text color unchanged");
    }

    private static void assertHoverStylesOnlySyntheticBoundaryEdge(String message) {
        DungeonMapContentModel mapContentModel = new DungeonMapContentModel("Boundary Exactness", true);
        DungeonEditorTopologyElementRef wallRef = new DungeonEditorTopologyElementRef("WALL", 7001L);
        DungeonEdgeRef firstEdge = new DungeonEdgeRef(
                new DungeonCellRef(0, 0, 0),
                new DungeonCellRef(1, 0, 0));
        DungeonEdgeRef secondEdge = new DungeonEdgeRef(
                new DungeonCellRef(0, 1, 0),
                new DungeonCellRef(1, 1, 0));
        long sharedOwnerId = 77L;
        DungeonEditorMapSnapshot.Boundary firstBoundary = new DungeonEditorMapSnapshot.Boundary(
                "wall",
                sharedOwnerId,
                "Wall",
                firstEdge,
                wallRef);
        DungeonEditorMapSnapshot.Boundary secondBoundary = new DungeonEditorMapSnapshot.Boundary(
                "wall",
                sharedOwnerId,
                "Wall",
                secondEdge,
                wallRef);
        DungeonEditorMapSurfaceSnapshot snapshot = syntheticBoundarySnapshot(firstBoundary, secondBoundary);
        mapContentModel.applyEditorRenderFrame(syntheticBoundaryRenderFrame(snapshot));
        double sceneX = 0.5;
        double sceneY = 0.0;
        var target = runtimePointerTarget(mapContentModel, sceneX, sceneY, true);
        assertEquals(DungeonEditorRuntimePointerTarget.TargetKind.BOUNDARY, target.targetKind(),
                message + " resolves a boundary target");
        String selectionRef = target.topologyRefText() + ":" + target.topologyId();
        DungeonMapContentModel.BoundaryPrimitive hoveredBefore =
                boundaryPrimitiveAt(mapContentModel, selectionRef, sceneX, sceneY);
        DungeonMapContentModel.BoundaryPrimitive siblingBefore =
                siblingBoundaryPrimitive(mapContentModel, selectionRef, hoveredBefore);
        double normalHoverEdgeStroke = hoveredBefore.style().strokeWidth();
        double normalSiblingStroke = siblingBefore.style().strokeWidth();

        updateHoverTarget(mapContentModel, target);

        DungeonMapContentModel.BoundaryPrimitive hoveredAfter =
                boundaryPrimitiveAt(mapContentModel, selectionRef, sceneX, sceneY);
        DungeonMapContentModel.BoundaryPrimitive siblingAfter =
                boundaryPrimitiveWithEndpoints(mapContentModel, selectionRef, siblingBefore);
        assertTrue(hoveredAfter.style().strokeWidth() > normalHoverEdgeStroke,
                message + " increases the hovered edge stroke");
        assertEquals(normalSiblingStroke, siblingAfter.style().strokeWidth(),
                message + " leaves sibling edge stroke unchanged");
    }

    private static DungeonEditorRenderFrame syntheticBoundaryRenderFrame(
            DungeonEditorMapSurfaceSnapshot snapshot
    ) {
        DungeonEditorMapSurfaceSnapshot safeSnapshot = snapshot == null
                ? DungeonEditorMapSurfaceSnapshot.empty()
                : snapshot;
        DungeonEditorPreparedFrameFacts facts = new DungeonEditorPreparedFrameFacts(
                List.of(),
                "",
                0L,
                List.of(safeSnapshot.projectionLevel()),
                false,
                "",
                safeSnapshot.viewMode().name(),
                DungeonEditorPreparedFrameFacts.labelForViewMode(safeSnapshot.viewMode().name()),
                safeSnapshot.overlaySettings(),
                DungeonEditorPreparedFrameFacts.OverlayFrame.from(safeSnapshot.overlaySettings()),
                safeSnapshot.projectionLevel(),
                safeSnapshot.selectedTool().name(),
                safeSnapshot.selectedTool().displayLabel(),
                new DungeonEditorPreparedFrameFacts.MapSurfaceFrame(
                        safeSnapshot.surface(),
                        safeSnapshot.selection(),
                        safeSnapshot.preview(),
                        DungeonEditorPreparedFrameFacts.PreviewRenderFrame.from(safeSnapshot),
                        DungeonEditorPreparedFrameFacts.PreviewRenderDiffFrame.from(safeSnapshot),
                        safeSnapshot.viewMode(),
                        safeSnapshot.overlaySettings(),
                        safeSnapshot.projectionLevel(),
                        safeSnapshot.selectedTool()),
                DungeonEditorPreparedFrameFacts.MapInteractionFrame.from(safeSnapshot),
                DungeonEditorPreparedFrameFacts.StatePanelFrame.empty());
        return new DungeonEditorRenderFrame(facts, null, null);
    }

    private static DungeonEditorMapSurfaceSnapshot syntheticBoundarySnapshot(
            DungeonEditorMapSnapshot.Boundary firstBoundary,
            DungeonEditorMapSnapshot.Boundary secondBoundary
    ) {
        DungeonEditorMapSnapshot map = new DungeonEditorMapSnapshot(
                "SQUARE",
                3,
                3,
                List.of(),
                List.of(firstBoundary, secondBoundary),
                List.of(),
                List.of());
        return new DungeonEditorMapSurfaceSnapshot(
                new DungeonEditorSurface(
                        "Boundary Exactness",
                        1,
                        map,
                        null,
                        null),
                DungeonEditorStateSnapshot.Selection.empty(),
                DungeonEditorPreview.none(),
                DungeonEditorViewMode.GRID,
                DungeonOverlaySettings.defaults(),
                0,
                DungeonEditorTool.SELECT);
    }

    private static String selectionRef(DungeonEditorTopologyElementRef ref) {
        return ref.kind() + ":" + ref.id();
    }

    private static DungeonMapContentModel.TextPrimitive textPrimitiveForRef(
            DungeonMapContentModel mapContentModel,
            DungeonEditorTopologyElementRef ref
    ) {
        String selectionRef = selectionRef(ref);
        return mapContentModel.canvasStateProperty().get().renderScene().texts().stream()
                .filter(text -> selectionRef.equals(text.selectionRef()))
                .max(java.util.Comparator.comparingDouble(text -> text.style().strokeWidth()))
                .orElseThrow(() -> new AssertionError("Text primitive not found for " + selectionRef));
    }

    private static DungeonMapContentModel.MapCanvasPolygonPrimitive surfacePrimitiveAt(
            DungeonMapContentModel mapContentModel,
            String selectionRef,
            double sceneX,
            double sceneY
    ) {
        return mapContentModel.canvasStateProperty().get().renderScene().surfaces().stream()
                .filter(surface -> selectionRef.equals(surface.selectionRef()))
                .filter(surface -> surfaceOriginQ(surface) <= sceneX && sceneX <= surfaceOriginQ(surface) + 1.0)
                .filter(surface -> surfaceOriginR(surface) <= sceneY && sceneY <= surfaceOriginR(surface) + 1.0)
                .max(java.util.Comparator.comparingDouble(surface -> surface.style().strokeWidth()))
                .orElseThrow(() -> new AssertionError("Surface primitive not found at "
                        + sceneX + "," + sceneY + " for " + selectionRef));
    }

    private static DungeonMapContentModel.MapCanvasPolygonPrimitive siblingSurfacePrimitive(
            DungeonMapContentModel mapContentModel,
            String selectionRef,
            DungeonMapContentModel.MapCanvasPolygonPrimitive hovered
    ) {
        return mapContentModel.canvasStateProperty().get().renderScene().surfaces().stream()
                .filter(surface -> selectionRef.equals(surface.selectionRef()))
                .filter(surface -> surfaceOriginQ(surface) != surfaceOriginQ(hovered)
                        || surfaceOriginR(surface) != surfaceOriginR(hovered))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Sibling surface primitive not found for " + selectionRef));
    }

    private static DungeonMapContentModel.MapCanvasPolygonPrimitive surfacePrimitiveWithOrigin(
            DungeonMapContentModel mapContentModel,
            String selectionRef,
            DungeonMapContentModel.MapCanvasPolygonPrimitive expected
    ) {
        return mapContentModel.canvasStateProperty().get().renderScene().surfaces().stream()
                .filter(surface -> selectionRef.equals(surface.selectionRef()))
                .filter(surface -> surfaceOriginQ(surface) == surfaceOriginQ(expected))
                .filter(surface -> surfaceOriginR(surface) == surfaceOriginR(expected))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Surface primitive origin not found for " + selectionRef));
    }

    private static DungeonMapContentModel.BoundaryPrimitive boundaryPrimitiveAt(
            DungeonMapContentModel mapContentModel,
            String selectionRef,
            double sceneX,
            double sceneY
    ) {
        return mapContentModel.canvasStateProperty().get().renderScene().boundaries().stream()
                .filter(boundary -> selectionRef.equals(boundary.selectionRef()))
                .filter(boundary -> boundaryDistance(boundary, sceneX, sceneY) < 0.000_001)
                .max(java.util.Comparator.comparingDouble(boundary -> boundary.style().strokeWidth()))
                .orElseThrow(() -> new AssertionError("Boundary primitive not found at "
                        + sceneX + "," + sceneY + " for " + selectionRef));
    }

    private static DungeonMapContentModel.BoundaryPrimitive siblingBoundaryPrimitive(
            DungeonMapContentModel mapContentModel,
            String selectionRef,
            DungeonMapContentModel.BoundaryPrimitive hovered
    ) {
        return mapContentModel.canvasStateProperty().get().renderScene().boundaries().stream()
                .filter(boundary -> selectionRef.equals(boundary.selectionRef()))
                .filter(boundary -> !sameBoundaryEndpoints(boundary, hovered))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Sibling boundary primitive not found for " + selectionRef));
    }

    private static DungeonMapContentModel.BoundaryPrimitive boundaryPrimitiveWithEndpoints(
            DungeonMapContentModel mapContentModel,
            String selectionRef,
            DungeonMapContentModel.BoundaryPrimitive expected
    ) {
        return mapContentModel.canvasStateProperty().get().renderScene().boundaries().stream()
                .filter(boundary -> selectionRef.equals(boundary.selectionRef()))
                .filter(boundary -> sameBoundaryEndpoints(boundary, expected))
                .findFirst()
                .orElseThrow(() -> new AssertionError("Boundary primitive endpoints not found for " + selectionRef));
    }

    private static double surfaceOriginQ(DungeonMapContentModel.MapCanvasPolygonPrimitive surface) {
        return surface.polygon().getFirst().x();
    }

    private static double surfaceOriginR(DungeonMapContentModel.MapCanvasPolygonPrimitive surface) {
        return surface.polygon().getFirst().y();
    }

    private static boolean sameBoundaryEndpoints(
            DungeonMapContentModel.BoundaryPrimitive first,
            DungeonMapContentModel.BoundaryPrimitive second
    ) {
        return first.polyline().getFirst().x() == second.polyline().getFirst().x()
                && first.polyline().getFirst().y() == second.polyline().getFirst().y()
                && first.polyline().get(1).x() == second.polyline().get(1).x()
                && first.polyline().get(1).y() == second.polyline().get(1).y();
    }

    private static void assertSyntheticCellHoverAt(
            DungeonMapContentModel mapContentModel,
            int q,
            int r,
            String message
    ) {
        boolean found = mapContentModel.canvasStateProperty().get().renderScene().surfaces().stream()
                .filter(surface -> surface.hitRef().isBlank() && surface.selectionRef().isBlank())
                .anyMatch(surface -> surfaceOriginQ(surface) == q && surfaceOriginR(surface) == r);
        assertTrue(found, message + " publishes a transient cell hover overlay");
    }

    private static void assertSyntheticBoundaryHoverAt(
            DungeonMapContentModel mapContentModel,
            double startX,
            double startY,
            double endX,
            double endY,
            String message
    ) {
        boolean found = mapContentModel.canvasStateProperty().get().renderScene().boundaries().stream()
                .filter(boundary -> boundary.hitRef().isBlank() && boundary.selectionRef().isBlank())
                .anyMatch(boundary -> sameBoundaryEndpoints(
                        boundary,
                        new DungeonMapContentModel.BoundaryPrimitive(
                                "",
                                "",
                                0,
                                List.of(
                                        new DungeonMapContentModel.MapCanvasPoint(startX, startY),
                                        new DungeonMapContentModel.MapCanvasPoint(endX, endY)),
                                null)));
        assertTrue(found, message + " publishes a transient boundary hover overlay");
    }

    private static void assertSyntheticVertexHoverAt(
            DungeonMapContentModel mapContentModel,
            int q,
            int r,
            String message
    ) {
        boolean found = mapContentModel.canvasStateProperty().get().renderScene().glyphs().stream()
                .filter(glyph -> glyph.hitRef().isBlank() && glyph.selectionRef().isBlank())
                .anyMatch(glyph -> vertexGlyphCenteredAt(glyph, q, r));
        assertTrue(found, message + " publishes a transient vertex hover overlay");
    }

    private static boolean vertexGlyphCenteredAt(
            DungeonMapContentModel.GlyphPrimitive glyph,
            int q,
            int r
    ) {
        double centerX = glyph.polygon().stream()
                .mapToDouble(DungeonMapContentModel.MapCanvasPoint::x)
                .average()
                .orElse(Double.NaN);
        double centerY = glyph.polygon().stream()
                .mapToDouble(DungeonMapContentModel.MapCanvasPoint::y)
                .average()
                .orElse(Double.NaN);
        double tolerance = 0.001;
        return Math.abs(centerX - q) <= tolerance && Math.abs(centerY - r) <= tolerance;
    }

    private static void assertNoSyntheticHoverOverlay(
            DungeonMapContentModel mapContentModel,
            String message
    ) {
        boolean foundSyntheticSurface = mapContentModel.canvasStateProperty().get().renderScene().surfaces().stream()
                .anyMatch(surface -> surface.hitRef().isBlank()
                        && surface.selectionRef().isBlank());
        boolean foundSyntheticBoundary = mapContentModel.canvasStateProperty().get().renderScene().boundaries().stream()
                .anyMatch(boundary -> boundary.hitRef().isBlank()
                        && boundary.selectionRef().isBlank());
        boolean foundSyntheticVertex = mapContentModel.canvasStateProperty().get().renderScene().glyphs().stream()
                .anyMatch(glyph -> glyph.hitRef().isBlank()
                        && glyph.selectionRef().isBlank());
        assertTrue(!foundSyntheticSurface && !foundSyntheticBoundary && !foundSyntheticVertex,
                message + " does not publish a transient hover overlay");
    }

    private static double boundaryDistance(
            DungeonMapContentModel.BoundaryPrimitive boundary,
            double sceneX,
            double sceneY
    ) {
        DungeonMapContentModel.MapCanvasPoint start = boundary.polyline().getFirst();
        DungeonMapContentModel.MapCanvasPoint end = boundary.polyline().get(1);
        double dx = end.x() - start.x();
        double dy = end.y() - start.y();
        double lengthSquared = dx * dx + dy * dy;
        if (lengthSquared == 0.0) {
            return Math.hypot(sceneX - start.x(), sceneY - start.y());
        }
        double t = ((sceneX - start.x()) * dx + (sceneY - start.y()) * dy) / lengthSquared;
        double clamped = Math.max(0.0, Math.min(1.0, t));
        return Math.hypot(sceneX - (start.x() + clamped * dx), sceneY - (start.y() + clamped * dy));
    }

    private static double surfaceStrokeWidth(DungeonMapContentModel mapContentModel, String selectionRef) {
        return mapContentModel.canvasStateProperty().get().renderScene().surfaces().stream()
                .filter(surface -> selectionRef.equals(surface.selectionRef()))
                .map(DungeonMapContentModel.MapCanvasPolygonPrimitive::style)
                .mapToDouble(DungeonMapContentModel.PaintStyle::strokeWidth)
                .max()
                .orElseThrow(() -> new AssertionError("Surface primitive not found for " + selectionRef));
    }

    private static double normalSurfaceStrokeWidth(DungeonMapContentModel mapContentModel, String selectionRef) {
        return mapContentModel.canvasStateProperty().get().renderScene().surfaces().stream()
                .filter(surface -> selectionRef.equals(surface.selectionRef()))
                .map(DungeonMapContentModel.MapCanvasPolygonPrimitive::style)
                .mapToDouble(DungeonMapContentModel.PaintStyle::strokeWidth)
                .min()
                .orElseThrow(() -> new AssertionError("Surface primitive not found for " + selectionRef));
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
                .map(DungeonMapContentModel.GlyphPrimitive::style)
                .mapToDouble(DungeonMapContentModel.PaintStyle::strokeWidth)
                .max()
                .orElseThrow(() -> new AssertionError("Glyph primitive not found for " + selectionRef));
    }

}
