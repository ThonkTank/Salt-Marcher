package src.view.leftbartabs.dungeoneditor;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import javafx.geometry.Bounds;
import javafx.event.ActionEvent;
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
import src.domain.dungeon.model.worldspace.model.DungeonCell;
import src.domain.dungeon.model.worldspace.model.DungeonEdgeDirection;
import src.domain.dungeon.published.DungeonEditorControlsModel;
import src.domain.dungeon.published.DungeonEditorControlsSnapshot;
import src.domain.dungeon.published.DungeonEditorMapSurfaceModel;
import src.domain.dungeon.published.DungeonEditorMapSurfaceSnapshot;
import src.domain.dungeon.published.DungeonEditorPreview;
import src.domain.dungeon.published.DungeonEditorStateSnapshot;
import src.domain.dungeon.published.DungeonEditorTopologyElementRef;
import src.domain.dungeon.published.DungeonEditorViewMode;
import src.domain.dungeon.published.DungeonEdgeRef;
import src.domain.dungeon.published.DungeonInspectorSnapshot;
import src.domain.dungeon.published.DungeonMapSummary;
import src.domain.dungeon.published.DungeonOverlaySettings;
import src.domain.dungeon.published.DungeonTopologyElementRef;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel;
import src.view.slotcontent.main.dungeonmap.DungeonMapView;

import static src.view.leftbartabs.dungeoneditor.DungeonEditorBehaviorHarnessSupport.*;

final class DungeonEditorRoomWallDoorHarness {

    private static final String OWNER = "DungeonEditorRoomWallDoorHarness";

    private DungeonEditorRoomWallDoorHarness() {
    }

    static void run(List<String> results) throws Exception {
        route(results, () -> verifySelectedStraightWallStretchThroughMapView(results));
        route(results, () -> verifySelectedWallCornerMoveThroughMapView(results));
        route(results, () -> verifyWholeClusterMoveThroughMapView(results));
        route(results, () -> verifyRoomNarrationThroughStateView(results));
        route(results, () -> verifyDoorCreateThroughMapView(results));
        route(results, () -> verifyDoorDeleteThroughMapView(results));
        route(results, () -> verifyRoomPreviewThroughMapView(results));
        route(results, () -> verifyIsolatedRoomPaintThroughMapView(results));
        route(results, () -> verifyOverlappingRoomPaintThroughMapView(results));
        route(results, () -> verifyAdjacentRoomPaintThroughMapView(results));
        route(results, () -> verifyRoomDeleteThroughMapView(results));
        route(results, () -> verifyWallStartDraftThroughMapView(results));
        route(results, () -> verifyWallPreviewMoveThroughMapView(results));
        route(results, () -> verifyWallFinalizeThroughMapView(results));
        route(results, () -> verifyWallAlternateFinalizeThroughMapView(results));
        route(results, () -> verifyWallDeletePathThroughMapView(results));
        route(results, () -> verifyWallDeleteSegmentThroughMapView(results));
        route(results, () -> verifyWallDeleteCornerThroughMapView(results));
        route(results, () -> verifyCancelDraftThroughMapView(results));
    }

    private static void route(
            List<String> results,
            DungeonEditorBehaviorHarnessSupport.ThrowingRunnable action
    ) throws Exception {
        DungeonEditorBehaviorHarnessSupport.runRouteProof(results, OWNER, action);
    }

    private static void verifyRoomNarrationThroughStateView(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();
        DungeonEditorStateView stateView = binding.stateView();

        long mapId = createMapThroughControls(controls, runtime, "Narration Map");
        runtime.database().seedNarrationRoomWithEastExitLink(mapId);
        long geometryRowsBefore = runtime.database().countAuthoredGeometryRows(mapId);
        createMapThroughControls(controls, runtime, "Narration Reload Hop");
        selectMap(controls, "Narration Map");
        click(button(controls, "Auswahl"));
        DungeonEditorMapSurfaceSnapshot loadedSurface = runtime.mapSurfaceModel().current();
        var roomArea = loadedSurface.surface().map().areas().stream()
                .filter(area -> "R1".equals(area.label()))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("Narration east-exit fixture R1 area not loaded."));
        long roomId = roomArea.id();
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();
        fireMapMousePressed(
                mapView,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(2.5),
                viewport.sceneToScreenY(2.5),
                false);

        DungeonEditorStateSnapshot selectedState = runtime.stateModel().current();
        assertTrue(selectedState.inspector() != null, "DE-STATE-001 inspector is published after room selection");
        assertTrue(!selectedState.inspector().roomNarrations().isEmpty(),
                "DE-STATE-001 inspector publishes a room narration card after room selection");
        List<TextArea> narrationAreas = textAreas(stateView);
        assertTrue(narrationAreas.size() >= 2, "DE-STATE-001 state panel exposes visual and exit text areas");
        narrationAreas.getFirst().setText("Wet stone walls.");
        TextArea eastExitArea = narrationAreas.get(1);
        eastExitArea.setText("Iron-banded door east.");
        click(buttonWithAccessibleText(stateView, "Narration fuer R1 speichern"));

        assertEquals(1L, runtime.database().countRoomVisualDescription(roomId, "Wet stone walls."),
                "DE-STATE-001 persists room visual description");
        assertEquals(1L, runtime.database().countRoomExitDescription(
                        roomId,
                        3,
                        2,
                        "EAST",
                        "Iron-banded door east."),
                "DE-STATE-001 persists east exit narration");
        assertEquals(geometryRowsBefore, runtime.database().countAuthoredGeometryRows(mapId),
                "DE-STATE-001 leaves authored geometry rows unchanged");

        selectMap(controls, "Narration Reload Hop");
        selectMap(controls, "Narration Map");
        click(button(controls, "Auswahl"));
        fireMapMousePressed(
                mapView,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(2.5),
                viewport.sceneToScreenY(2.5),
                false);

        DungeonEditorStateSnapshot reloadedState = runtime.stateModel().current();
        assertTrue(reloadedState.inspector() != null, "DE-STATE-001 inspector republishes after reload");
        assertTrue(reloadedState.inspector().roomNarrations().stream().anyMatch(card ->
                        card.roomId() == roomId
                                && "Wet stone walls.".equals(card.visualDescription())
                                && card.exits().stream().anyMatch(exit ->
                                        "EAST".equals(exit.direction())
                                                && "Iron-banded door east.".equals(exit.description()))),
                "DE-STATE-001 inspector/narration cards show saved strings after reload");
        assertTrue(textAreas(stateView).stream().anyMatch(area -> "Wet stone walls.".equals(area.getText())),
                "DE-STATE-001 state panel shows saved visual text");
        assertTrue(textAreas(stateView).stream().anyMatch(area -> "Iron-banded door east.".equals(area.getText())),
                "DE-STATE-001 state panel shows saved east-exit text");

        results.add("DE-STATE-001 Ready: DungeonEditorStateView narration save -> SQLite -> state panel");
    }


    private static void verifySelectedStraightWallStretchThroughMapView(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();

        long mapId = createMapThroughControls(controls, runtime, "Straight Wall Stretch Map");
        runtime.database().seedF1SingleRoom(mapId, "R1", 0, 1, 1);
        createMapThroughControls(controls, runtime, "Straight Wall Stretch Reload Hop");
        selectMap(controls, "Straight Wall Stretch Map");
        RoomClusterIds roomIds = runtime.database().roomByName(mapId, "R1");
        long geometryRowsBefore = runtime.database().countAuthoredGeometryRows(mapId);
        List<String> boundaryRowsBefore = runtime.database().roomBoundaryEdgeState(mapId);
        var roomArea = roomAreaByLabel(runtime.mapSurfaceModel().current(), "R1", "DE-SEL-007");
        DungeonEditorTopologyElementRef roomRef = roomArea.topologyRef();
        click(button(controls, "Auswahl"));
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();
        Point2D northWallMidpoint = boundaryMidpointNear(binding.mapContentModel(), "WALL", 2.5, 1.0);

        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_PRESSED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(northWallMidpoint.getX()),
                viewport.sceneToScreenY(northWallMidpoint.getY()),
                false);
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_DRAGGED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(northWallMidpoint.getX()),
                viewport.sceneToScreenY(northWallMidpoint.getY() - 1.0),
                false);

        DungeonEditorMapSurfaceSnapshot previewSurface = runtime.mapSurfaceModel().current();
        assertEquals(geometryRowsBefore, runtime.database().countAuthoredGeometryRows(mapId),
                "DE-SEL-007 drag preview leaves authored DB row count unchanged");
        assertEquals(boundaryRowsBefore, runtime.database().roomBoundaryEdgeState(mapId),
                "DE-SEL-007 drag preview leaves persisted boundary rows unchanged");
        assertTrue(previewSurface.preview() instanceof DungeonEditorPreview.MoveBoundaryStretchPreview,
                "DE-SEL-007 publishes a boundary-stretch preview during wall drag");
        DungeonEditorPreview.MoveBoundaryStretchPreview preview =
                (DungeonEditorPreview.MoveBoundaryStretchPreview) previewSurface.preview();
        assertEquals(roomIds.clusterId(), preview.clusterId(), "DE-SEL-007 preview keeps cluster id");
        assertEquals(0L, preview.deltaQ(), "DE-SEL-007 preview delta q");
        assertEquals(-1L, preview.deltaR(), "DE-SEL-007 preview delta r");
        assertEquals(0L, preview.deltaLevel(), "DE-SEL-007 preview delta level");
        assertEquals(cellRect(1, 1, 3, 3, 0), surfaceCellSet(previewSurface),
                "DE-SEL-007 preview leaves committed map surface unchanged before release");
        assertTrue(previewSurface.surface().previewMap() != null,
                "DE-SEL-007 publishes a preview map during boundary stretch; sourceEdges="
                        + preview.sourceEdges());
        assertEquals(cellRect(1, 0, 3, 3, 0), mapSnapshotCellSet(previewSurface.surface().previewMap()),
                "DE-SEL-007 preview map expands the selected room north");
        assertTrue(renderPreviewSurfaceCellOriginsWithZ(binding.mapContentModel()).containsAll(cellRect(1, 0, 3, 3, 0)),
                "DE-SEL-007 render scene shows preview room cells at y=0");

        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_RELEASED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(northWallMidpoint.getX()),
                viewport.sceneToScreenY(northWallMidpoint.getY() - 1.0),
                false);

        assertTrue(runtime.database().countAuthoredGeometryRows(mapId) > geometryRowsBefore,
                "DE-SEL-007 release persists expanded authored geometry rows");
        assertEquals(roomIds, runtime.database().roomByName(mapId, "R1"),
                "DE-SEL-007 keeps room and cluster identity");
        assertEquals(cellRect(1, 0, 3, 3, 0), persistedClusterCellsThroughRepository(mapId, roomIds.clusterId(), 0),
                "DE-SEL-007 persisted readback expands room cells to y=0");
        assertEquals(Set.of("1,0,0", "4,0,0", "4,4,0", "1,4,0"),
                runtime.database().absoluteClusterVertices(roomIds.clusterId()),
                "DE-SEL-007 persisted absolute vertices move the north wall to y=0");
        assertTrue(!boundaryRowsBefore.equals(runtime.database().roomBoundaryEdgeState(mapId)),
                "DE-SEL-007 recomputes persisted boundary rows after release");
        assertEquals(3L, runtime.database().countWallBoundariesForDirection(mapId, "NORTH"),
                "DE-SEL-007 keeps one recomputed north wall row per stretched cell");
        assertEquals(
                Set.of(
                        "cell=1,0,0,direction=WEST,type=WALL",
                        "cell=1,1,0,direction=WEST,type=WALL",
                        "cell=1,2,0,direction=WEST,type=WALL",
                        "cell=1,3,0,direction=WEST,type=WALL"),
                runtime.database().wallBoundaryAbsoluteRowsForDirection(mapId, "WEST"),
                "DE-SEL-007 recomputes persisted west side-wall rows through y=0");
        assertEquals(
                Set.of(
                        "cell=3,0,0,direction=EAST,type=WALL",
                        "cell=3,1,0,direction=EAST,type=WALL",
                        "cell=3,2,0,direction=EAST,type=WALL",
                        "cell=3,3,0,direction=EAST,type=WALL"),
                runtime.database().wallBoundaryAbsoluteRowsForDirection(mapId, "EAST"),
                "DE-SEL-007 recomputes persisted east side-wall rows through y=0");
        assertEquals(runtime.database().countWallBoundaryRows(mapId),
                runtime.database().countDistinctWallBoundaryTopologyRefs(mapId),
                "DE-SEL-007 persists no duplicate wall topology refs on boundary rows");
        assertEquals(0L, runtime.database().countUnreferencedWallTopologyElements(mapId),
                "DE-SEL-007 leaves no independent wall topology delete-recreate churn");
        DungeonEditorMapSurfaceSnapshot committedSurface = runtime.mapSurfaceModel().current();
        assertEquals(DungeonEditorPreview.none(), committedSurface.preview(),
                "DE-SEL-007 clears boundary-stretch preview after release");
        assertSelectionMatches(roomRef, roomIds.clusterId(), committedSurface.selection(),
                "DE-SEL-007 map surface keeps selection on the stretched cluster");
        assertEquals(cellRect(1, 0, 3, 3, 0), surfaceCellSet(committedSurface),
                "DE-SEL-007 published map exposes expanded cluster cells");
        assertTrue(renderSurfaceCellOriginsWithZ(binding.mapContentModel()).containsAll(cellRect(1, 0, 3, 3, 0)),
                "DE-SEL-007 render-facing state shows the expanded room cells");
        assertTrue(renderHasBoundaryNear(binding.mapContentModel(), "WALL", 2.5, 0.0),
                "DE-SEL-007 render scene shows the committed north wall at y=0");
        assertTrue(renderHasBoundaryNear(binding.mapContentModel(), "WALL", 1.0, 0.5),
                "DE-SEL-007 render scene extends the west wall to the moved north wall");
        assertTrue(renderHasBoundaryNear(binding.mapContentModel(), "WALL", 4.0, 0.5),
                "DE-SEL-007 render scene extends the east wall to the moved north wall");
        selectMap(controls, "Straight Wall Stretch Reload Hop");
        selectMap(controls, "Straight Wall Stretch Map");
        assertEquals(cellRect(1, 0, 3, 3, 0), surfaceCellSet(runtime.mapSurfaceModel().current()),
                "DE-SEL-007 reload keeps expanded cluster cells");
        assertTrue(renderHasBoundaryNear(binding.mapContentModel(), "WALL", 2.5, 0.0),
                "DE-SEL-007 reload render keeps the north wall at y=0");
        assertTrue(renderHasBoundaryNear(binding.mapContentModel(), "WALL", 1.0, 0.5),
                "DE-SEL-007 reload render keeps the west wall extended to y=0");
        assertTrue(renderHasBoundaryNear(binding.mapContentModel(), "WALL", 4.0, 0.5),
                "DE-SEL-007 reload render keeps the east wall extended to y=0");

        results.add("DE-SEL-007 Ready: DungeonMapView straight wall drag -> SQLite stretch -> render readback");
    }


    private static void verifySelectedWallCornerMoveThroughMapView(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();

        long mapId = createMapThroughControls(controls, runtime, "Wall Corner Move Map");
        runtime.database().seedF1SingleRoom(mapId, "R1", 0, 1, 1);
        createMapThroughControls(controls, runtime, "Wall Corner Move Reload Hop");
        selectMap(controls, "Wall Corner Move Map");
        click(button(controls, "Auswahl"));
        RoomClusterIds roomIds = runtime.database().roomByName(mapId, "R1");
        var roomArea = roomAreaByLabel(runtime.mapSurfaceModel().current(), "R1", "DE-SEL-008");
        DungeonEditorTopologyElementRef roomRef = roomArea.topologyRef();
        var cornerHandle = firstClusterCornerHandleAt(runtime.mapSurfaceModel().current(), 4, 4, 0, "DE-SEL-008");
        long geometryRowsBefore = runtime.database().countAuthoredGeometryRows(mapId);
        List<String> boundaryRowsBefore = runtime.database().roomBoundaryEdgeState(mapId);
        assertEquals(Set.of("1,1,0", "4,1,0", "4,4,0", "1,4,0"),
                runtime.database().absoluteClusterVertices(roomIds.clusterId()),
                "DE-SEL-008 starts with absolute cluster vertices");
        assertEquals("HANDLE", binding.mapContentModel().resolvePointerTarget(4.0, 4.0).targetKind().name(),
                "DE-SEL-008 input route resolves the south-east corner as a handle");

        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_PRESSED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(4.0),
                viewport.sceneToScreenY(4.0),
                false);
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_DRAGGED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(5.0),
                viewport.sceneToScreenY(5.0),
                false);

        DungeonEditorMapSurfaceSnapshot previewSurface = runtime.mapSurfaceModel().current();
        assertEquals(geometryRowsBefore, runtime.database().countAuthoredGeometryRows(mapId),
                "DE-SEL-008 drag preview leaves authored DB row count unchanged");
        assertEquals(boundaryRowsBefore, runtime.database().roomBoundaryEdgeState(mapId),
                "DE-SEL-008 drag preview leaves persisted boundary rows unchanged");
        assertTrue(previewSurface.preview() instanceof DungeonEditorPreview.MoveHandlePreview,
                "DE-SEL-008 publishes a move-handle preview during corner drag");
        DungeonEditorPreview.MoveHandlePreview preview =
                (DungeonEditorPreview.MoveHandlePreview) previewSurface.preview();
        assertEquals(cornerHandle.ref().kind(), preview.handleRef().kind(),
                "DE-SEL-008 preview handle kind");
        assertEquals(1L, preview.deltaQ(), "DE-SEL-008 preview delta q");
        assertEquals(1L, preview.deltaR(), "DE-SEL-008 preview delta r");
        assertEquals(0L, preview.deltaLevel(), "DE-SEL-008 preview delta level");
        assertTrue(renderHasGlyphAt(binding.mapContentModel(), roomRef, 5.0, 5.0, true),
                "DE-SEL-008 render scene shows preview corner handle at (5,5,0)");

        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_RELEASED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(5.0),
                viewport.sceneToScreenY(5.0),
                false);

        assertEquals(roomIds, runtime.database().roomByName(mapId, "R1"),
                "DE-SEL-008 keeps room and cluster identity");
        assertEquals(cellRect(1, 1, 4, 4, 0), persistedClusterCellsThroughRepository(mapId, roomIds.clusterId(), 0),
                "DE-SEL-008 persisted readback expands the south-east corner");
        assertEquals(Set.of("1,1,0", "5,1,0", "5,5,0", "1,5,0"),
                runtime.database().absoluteClusterVertices(roomIds.clusterId()),
                "DE-SEL-008 persisted absolute vertices move the south-east corner to (5,5,0)");
        assertTrue(!boundaryRowsBefore.equals(runtime.database().roomBoundaryEdgeState(mapId)),
                "DE-SEL-008 recomputes persisted boundary rows after release");
        assertEquals(runtime.database().countWallBoundaryRows(mapId),
                runtime.database().countDistinctWallBoundaryTopologyRefs(mapId),
                "DE-SEL-008 persists no duplicate wall topology refs on boundary rows");
        assertEquals(0L, runtime.database().countUnreferencedWallTopologyElements(mapId),
                "DE-SEL-008 leaves no orphan wall topology rows");

        DungeonEditorMapSurfaceSnapshot committedSurface = runtime.mapSurfaceModel().current();
        assertEquals(DungeonEditorPreview.none(), committedSurface.preview(),
                "DE-SEL-008 clears corner move preview after release");
        assertSelectionMatches(roomRef, roomIds.clusterId(), committedSurface.selection(),
                "DE-SEL-008 map surface keeps selection on the moved cluster");
        assertEquals(cellRect(1, 1, 4, 4, 0), surfaceCellSet(committedSurface),
                "DE-SEL-008 published map exposes the expanded corner cells");
        assertClusterCornerHandleAt(committedSurface, 5, 5, 0, "DE-SEL-008");
        assertTrue(renderSurfaceCellOriginsWithZ(binding.mapContentModel()).containsAll(cellRect(1, 1, 4, 4, 0)),
                "DE-SEL-008 render-facing state shows expanded room cells");
        assertTrue(renderHasGlyphAt(binding.mapContentModel(), roomRef, 5.0, 5.0, false),
                "DE-SEL-008 render scene shows committed corner handle at (5,5,0)");
        assertTrue(renderHasBoundaryNear(binding.mapContentModel(), "WALL", 4.5, 5.0),
                "DE-SEL-008 render scene redraws the south wall to the moved corner");
        assertTrue(renderHasBoundaryNear(binding.mapContentModel(), "WALL", 5.0, 4.5),
                "DE-SEL-008 render scene redraws the east wall to the moved corner");

        selectMap(controls, "Wall Corner Move Reload Hop");
        selectMap(controls, "Wall Corner Move Map");
        assertEquals(cellRect(1, 1, 4, 4, 0), surfaceCellSet(runtime.mapSurfaceModel().current()),
                "DE-SEL-008 reload keeps expanded corner cells");
        assertClusterCornerHandleAt(runtime.mapSurfaceModel().current(), 5, 5, 0, "DE-SEL-008 reload");
        assertTrue(renderHasBoundaryNear(binding.mapContentModel(), "WALL", 4.5, 5.0),
                "DE-SEL-008 reload render keeps the moved south wall");
        assertTrue(renderHasBoundaryNear(binding.mapContentModel(), "WALL", 5.0, 4.5),
                "DE-SEL-008 reload render keeps the moved east wall");

        results.add("DE-SEL-008 Ready: DungeonMapView cluster-corner drag -> SQLite corner move -> render readback");
    }


    private static void verifyWholeClusterMoveThroughMapView(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();

        long mapId = createMapThroughControls(controls, runtime, "Whole Cluster Move Map");
        runtime.database().seedF1SingleRoom(mapId, "R1", 0, 1, 1);
        createMapThroughControls(controls, runtime, "Whole Cluster Move Reload Hop");
        selectMap(controls, "Whole Cluster Move Map");
        click(button(controls, "Auswahl"));
        RoomClusterIds roomIds = runtime.database().roomByName(mapId, "R1");
        long geometryRowsBefore = runtime.database().countAuthoredGeometryRows(mapId);
        assertEquals(roomIds.clusterId(), runtime.database().clusterIdByCenter(mapId, 2, 2, 0),
                "DE-SEL-009 starts with R1 cluster centered at (2,2,0)");
        assertEquals(roomIds, runtime.database().roomByComponent(mapId, 2, 2, 0),
                "DE-SEL-009 starts with R1 component at (2,2,0)");
        assertEquals(cellRect(1, 1, 3, 3, 0), persistedClusterCellsThroughRepository(mapId, roomIds.clusterId(), 0),
                "DE-SEL-009 starts with F1_SINGLE_ROOM cells");
        assertEquals(Set.of("1,1,0", "4,1,0", "4,4,0", "1,4,0"),
                runtime.database().absoluteClusterVertices(roomIds.clusterId()),
                "DE-SEL-009 starts with absolute cluster vertices");

        DungeonEditorMapSurfaceSnapshot loadedSurface = runtime.mapSurfaceModel().current();
        var roomArea = roomAreaByLabel(loadedSurface, "R1", "DE-SEL-009");
        DungeonEditorTopologyElementRef roomRef = roomArea.topologyRef();
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();
        Point2D labelCenter = labelCenterForRef(binding.mapContentModel(), roomRef);

        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_PRESSED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(labelCenter.getX()),
                viewport.sceneToScreenY(labelCenter.getY()),
                false);
        assertSelectionMatches(roomRef, roomIds.clusterId(), runtime.stateModel().current().selection(),
                "DE-SEL-009 state model selects the cluster label before drag");
        assertTrue(runtime.stateModel().current().selection().clusterSelection(),
                "DE-SEL-009 selection is cluster-wide before drag");

        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_DRAGGED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(labelCenter.getX() + 2.0),
                viewport.sceneToScreenY(labelCenter.getY() + 1.0),
                false);

        DungeonEditorMapSurfaceSnapshot previewSurface = runtime.mapSurfaceModel().current();
        assertEquals(geometryRowsBefore, runtime.database().countAuthoredGeometryRows(mapId),
                "DE-SEL-009 drag preview leaves authored DB row count unchanged");
        assertEquals(roomIds.clusterId(), runtime.database().clusterIdByCenter(mapId, 2, 2, 0),
                "DE-SEL-009 drag preview leaves persisted cluster center unchanged");
        assertTrue(previewSurface.preview() instanceof DungeonEditorPreview.MoveHandlePreview,
                "DE-SEL-009 publishes a move-handle preview during cluster-label drag");
        DungeonEditorPreview.MoveHandlePreview preview =
                (DungeonEditorPreview.MoveHandlePreview) previewSurface.preview();
        assertEquals(2L, preview.deltaQ(), "DE-SEL-009 preview delta q");
        assertEquals(1L, preview.deltaR(), "DE-SEL-009 preview delta r");
        assertEquals(0L, preview.deltaLevel(), "DE-SEL-009 preview delta level");
        assertEquals(roomIds.clusterId(), preview.handleRef().clusterId(),
                "DE-SEL-009 preview handle keeps cluster id");
        assertTrue(preview.handleRef().kind().isClusterLabel(),
                "DE-SEL-009 preview handle is the cluster-label handle");
        assertEquals(cellRect(1, 1, 3, 3, 0), surfaceCellSet(previewSurface),
                "DE-SEL-009 preview leaves committed map surface unchanged before release");
        assertTrue(previewSurface.surface().previewMap() != null,
                "DE-SEL-009 publishes a preview map during cluster-label drag");
        assertEquals(cellRect(3, 2, 5, 4, 0), mapSnapshotCellSet(previewSurface.surface().previewMap()),
                "DE-SEL-009 preview map translates the selected cluster cells");
        assertTrue(renderPreviewSurfaceCellOriginsWithZ(binding.mapContentModel()).containsAll(cellRect(3, 2, 5, 4, 0)),
                "DE-SEL-009 render scene shows preview cells at translated coordinates");
        assertTrue(renderHasTextAt(binding.mapContentModel(), roomRef, 4.5, 3.5, true),
                "DE-SEL-009 render scene shows preview label at translated coordinates");

        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_RELEASED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(labelCenter.getX() + 2.0),
                viewport.sceneToScreenY(labelCenter.getY() + 1.0),
                false);

        assertEquals(geometryRowsBefore, runtime.database().countAuthoredGeometryRows(mapId),
                "DE-SEL-009 release keeps authored DB row count stable");
        assertEquals(roomIds.clusterId(), runtime.database().clusterIdByCenter(mapId, 4, 3, 0),
                "DE-SEL-009 persists translated cluster center at (4,3,0)");
        assertEquals(roomIds, runtime.database().roomByComponent(mapId, 4, 3, 0),
                "DE-SEL-009 persists translated room component at (4,3,0)");
        assertEquals(0L, runtime.database().countClustersAtCenter(mapId, 2, 2, 0),
                "DE-SEL-009 removes old cluster-center coordinates");
        assertEquals(cellRect(3, 2, 5, 4, 0), persistedClusterCellsThroughRepository(mapId, roomIds.clusterId(), 0),
                "DE-SEL-009 persisted readback translates the whole cluster cells");
        assertEquals(Set.of("3,2,0", "6,2,0", "6,5,0", "3,5,0"),
                runtime.database().absoluteClusterVertices(roomIds.clusterId()),
                "DE-SEL-009 persisted absolute vertices translate by (+2,+1,0)");

        DungeonEditorMapSurfaceSnapshot committedSurface = runtime.mapSurfaceModel().current();
        assertEquals(DungeonEditorPreview.none(), committedSurface.preview(),
                "DE-SEL-009 clears move preview after release");
        assertSelectionMatches(roomRef, roomIds.clusterId(), committedSurface.selection(),
                "DE-SEL-009 map surface keeps selection on the moved cluster");
        assertTrue(committedSurface.selection().clusterSelection(),
                "DE-SEL-009 map surface keeps cluster-wide selection after move");
        assertEquals(cellRect(3, 2, 5, 4, 0), surfaceCellSet(committedSurface),
                "DE-SEL-009 published map exposes translated cluster cells");
        assertTrue(renderHasSelectedSurfacePrimitive(binding.mapContentModel(), roomRef),
                "DE-SEL-009 render scene keeps the moved cluster selected");
        assertTrue(renderHasTextAt(binding.mapContentModel(), roomRef, 4.5, 3.5, false),
                "DE-SEL-009 render scene shows committed label at translated coordinates");
        assertCanvasPaintedAtScene(mapView, 4.5, 3.5,
                "DE-SEL-009 rendered canvas paints the moved cluster coordinates");

        results.add("DE-SEL-009 Ready: DungeonMapView cluster-label drag -> SQLite cluster move -> render readback");
    }


    private static void verifyDoorCreateThroughMapView(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();

        long mapId = createMapThroughControls(controls, runtime, "Door Create Map");
        runtime.database().seedF1SingleRoom(mapId, "R1", 0, 1, 1);
        createMapThroughControls(controls, runtime, "Door Create Reload Hop");
        selectMap(controls, "Door Create Map");
        long doorRowsBefore = runtime.database().countDoorBoundariesAt(mapId, 1, 0, "EAST");
        assertEquals(0L, doorRowsBefore, "DE-DOOR-001 starts with an east wall, not a door");
        click(button(controls, "Tür"));
        assertEquals("DOOR_CREATE", runtime.controlsModel().current().selectedTool().name(),
                "DE-DOOR-001 door family selects door-create tool");
        Point2D wallMidpoint = boundaryMidpointNear(binding.mapContentModel(), "WALL", 4.0, 2.5);
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();

        clickMap(
                mapView,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(wallMidpoint.getX()),
                viewport.sceneToScreenY(wallMidpoint.getY()),
                false);

        assertEquals(1L, runtime.database().countDoorBoundariesAt(mapId, 1, 0, "EAST"),
                "DE-DOOR-001 persists east boundary as a door midpoint=" + wallMidpoint
                        + " boundaries=" + surfaceBoundarySummary(runtime.mapSurfaceModel().current())
                        + " dbDoors=" + runtime.database().doorBoundaryState(mapId));
        DungeonEditorMapSurfaceSnapshot liveSurface = runtime.mapSurfaceModel().current();
        var liveDoorBoundary = liveSurface.surface().map().boundaries().stream()
                .filter(boundary -> "door".equalsIgnoreCase(boundary.kind()))
                .filter(boundary -> boundary.edge().from().q() == 4 && boundary.edge().from().r() == 2)
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("DE-DOOR-001 live door boundary not published."));
        assertEquals("DOOR", liveDoorBoundary.topologyRef().kind(),
                "DE-DOOR-001 live published door topology kind");
        assertTrue(renderHasBoundaryPrimitive(binding.mapContentModel(), liveDoorBoundary.topologyRef()),
                "DE-DOOR-001 live render scene contains the door boundary primitive");
        assertCanvasPaintedAtScene(mapView, wallMidpoint.getX(), wallMidpoint.getY(),
                "DE-DOOR-001 live rendered canvas paints the door boundary coordinates");
        selectMap(controls, "Door Create Reload Hop");
        selectMap(controls, "Door Create Map");
        var doorBoundary = runtime.mapSurfaceModel().current().surface().map().boundaries().stream()
                .filter(boundary -> "door".equalsIgnoreCase(boundary.kind()))
                .filter(boundary -> boundary.edge().from().q() == 4 && boundary.edge().from().r() == 2)
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("DE-DOOR-001 reloaded door boundary not published."));
        assertEquals("DOOR", doorBoundary.topologyRef().kind(),
                "DE-DOOR-001 reloaded published door topology kind");
        assertTrue(renderHasBoundaryPrimitive(binding.mapContentModel(), doorBoundary.topologyRef()),
                "DE-DOOR-001 reloaded render scene contains the door boundary primitive");
        assertCanvasPaintedAtScene(mapView, wallMidpoint.getX(), wallMidpoint.getY(),
                "DE-DOOR-001 reloaded rendered canvas paints the door boundary coordinates");

        results.add("DE-DOOR-001 Ready: DungeonMapView door click -> SQLite -> live door boundary -> reload");
    }


    private static void verifyDoorDeleteThroughMapView(List<String> results) {
        verifyUnboundDoorDeleteThroughMapView(results);
        verifyCorridorBoundDoorDeleteRejectionThroughMapView(results);
    }


    private static void verifyUnboundDoorDeleteThroughMapView(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();

        long mapId = createMapThroughControls(controls, runtime, "Door Delete Map");
        runtime.database().seedF4WalledRoomWithDoor(mapId);
        createMapThroughControls(controls, runtime, "Door Delete Reload Hop");
        selectMap(controls, "Door Delete Map");
        List<String> corridorRowsBefore = runtime.database().corridorStableConnectionState(mapId);
        assertEquals(1L, runtime.database().countDoorBoundariesAt(mapId, 1, 0, "EAST"),
                "DE-DOOR-002 unbound fixture contains one east door boundary");
        assertTrue(surfaceHasBoundaryKindAt(
                        runtime.mapSurfaceModel().current(),
                        "door",
                        new DungeonCell(4, 2, 0),
                        new DungeonCell(4, 3, 0)),
                "DE-DOOR-002 unbound fixture publishes the east door boundary");
        click(button(controls, "Tür"));
        assertEquals("DOOR_CREATE", runtime.controlsModel().current().selectedTool().name(),
                "DE-DOOR-002 door family selects the door family tool");
        Point2D doorMidpoint = boundaryMidpointNear(binding.mapContentModel(), "DOOR", 4.0, 2.5);
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();

        clickMap(
                mapView,
                MouseButton.SECONDARY,
                viewport.sceneToScreenX(doorMidpoint.getX()),
                viewport.sceneToScreenY(doorMidpoint.getY()),
                false);

        assertEquals(0L, runtime.database().countDoorBoundariesAt(mapId, 1, 0, "EAST"),
                "DE-DOOR-002 unbound delete removes the authored door edge");
        assertEquals(corridorRowsBefore, runtime.database().corridorStableConnectionState(mapId),
                "DE-DOOR-002 unbound delete leaves corridor rows unchanged");
        DungeonEditorMapSurfaceSnapshot deletedSurface = runtime.mapSurfaceModel().current();
        assertEquals(DungeonEditorPreview.none(), deletedSurface.preview(),
                "DE-DOOR-002 unbound delete clears the boundary preview");
        assertEmptySelection(deletedSurface.selection(), "DE-DOOR-002 unbound map surface after delete");
        assertEmptySelection(runtime.stateModel().current().selection(), "DE-DOOR-002 unbound state after delete");
        assertTrue(!surfaceHasBoundaryKindAt(
                        deletedSurface,
                        "door",
                        new DungeonCell(4, 2, 0),
                        new DungeonCell(4, 3, 0)),
                "DE-DOOR-002 unbound delete removes the published door boundary");
        assertTrue(surfaceHasBoundaryKindAt(
                        deletedSurface,
                        "wall",
                        new DungeonCell(4, 2, 0),
                        new DungeonCell(4, 3, 0)),
                "DE-DOOR-002 unbound delete restores the published wall boundary");
        assertTrue(!renderHasBoundaryNear(binding.mapContentModel(), "DOOR", 4.0, 2.5),
                "DE-DOOR-002 unbound render removes the door marker");
        assertTrue(renderHasBoundaryNear(binding.mapContentModel(), "WALL", 4.0, 2.5),
                "DE-DOOR-002 unbound render restores a wall at the former door");
        assertCanvasPaintedAtScene(mapView, 4.0, 2.5,
                "DE-DOOR-002 unbound rendered canvas paints the restored wall");
    }


    private static void verifyCorridorBoundDoorDeleteRejectionThroughMapView(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();

        long mapId = createMapThroughControls(controls, runtime, "Bound Door Delete Map");
        runtime.database().seedCorridorWithAnchor(mapId);
        createMapThroughControls(controls, runtime, "Bound Door Delete Reload Hop");
        selectMap(controls, "Bound Door Delete Map");
        long geometryRowsBefore = runtime.database().countAuthoredGeometryRows(mapId);
        List<String> roomBoundaryRowsBefore = runtime.database().roomBoundaryEdgeState(mapId);
        List<String> doorRowsBefore = runtime.database().doorBoundaryState(mapId);
        List<String> corridorRowsBefore = runtime.database().corridorStableConnectionState(mapId);
        assertEquals(1L, runtime.database().countDoorBoundariesAt(mapId, 1, 0, "EAST"),
                "DE-DOOR-002 bound fixture contains one east D1 door boundary");
        assertTrue(surfaceHasBoundaryKindAt(
                        runtime.mapSurfaceModel().current(),
                        "door",
                        new DungeonCell(4, 2, 0),
                        new DungeonCell(4, 3, 0)),
                "DE-DOOR-002 bound fixture publishes D1 door boundary");
        click(button(controls, "Tür"));
        Point2D doorMidpoint = boundaryMidpointNear(binding.mapContentModel(), "DOOR", 4.0, 2.5);
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();

        clickMap(
                mapView,
                MouseButton.SECONDARY,
                viewport.sceneToScreenX(doorMidpoint.getX()),
                viewport.sceneToScreenY(doorMidpoint.getY()),
                false);

        assertEquals(geometryRowsBefore, runtime.database().countAuthoredGeometryRows(mapId),
                "DE-DOOR-002 corridor-bound delete leaves authored geometry row count unchanged");
        assertEquals(roomBoundaryRowsBefore, runtime.database().roomBoundaryEdgeState(mapId),
                "DE-DOOR-002 corridor-bound delete keeps room boundary edge rows unchanged");
        assertEquals(doorRowsBefore, runtime.database().doorBoundaryState(mapId),
                "DE-DOOR-002 corridor-bound delete keeps door boundary rows unchanged");
        assertEquals(corridorRowsBefore, runtime.database().corridorStableConnectionState(mapId),
                "DE-DOOR-002 corridor-bound delete keeps corridor bindings and route rows unchanged");
        DungeonEditorMapSurfaceSnapshot rejectedSurface = runtime.mapSurfaceModel().current();
        assertEquals(DungeonEditorPreview.none(), rejectedSurface.preview(),
                "DE-DOOR-002 corridor-bound delete leaves no preview");
        assertTrue(surfaceHasBoundaryKindAt(
                        rejectedSurface,
                        "door",
                        new DungeonCell(4, 2, 0),
                        new DungeonCell(4, 3, 0)),
                "DE-DOOR-002 corridor-bound delete keeps the published door boundary");
        assertTrue(renderHasBoundaryNear(binding.mapContentModel(), "DOOR", 4.0, 2.5),
                "DE-DOOR-002 corridor-bound render keeps the door marker");

        results.add("DE-DOOR-002 Ready: DungeonEditorControlsView Tür -> DungeonMapView secondary door delete"
                + " -> SQLite delete/reject -> render readback");
    }


    private static void verifyRoomPreviewThroughMapView(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();

        long mapId = createMapThroughControls(controls, runtime, "Room Preview Map");
        List<String> authoredStateBefore = runtime.database().authoredGeometryState(mapId);
        click(button(controls, "Raum"));
        assertEquals("ROOM_PAINT", runtime.controlsModel().current().selectedTool().name(),
                "DE-PREVIEW-001 room family selects room paint tool");
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();

        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_PRESSED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(1.5),
                viewport.sceneToScreenY(1.5),
                false);
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_DRAGGED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(3.5),
                viewport.sceneToScreenY(3.5),
                false);

        assertEquals(0L, runtime.database().countAuthoredGeometryRows(mapId),
                "DE-PREVIEW-001 does not persist authored geometry before release");
        assertEquals(authoredStateBefore, runtime.database().authoredGeometryState(mapId),
                "DE-PREVIEW-001 leaves authored DB state unchanged before release");
        DungeonEditorMapSurfaceSnapshot previewSurface = runtime.mapSurfaceModel().current();
        assertTrue(previewSurface.preview() instanceof DungeonEditorPreview.RoomRectanglePreview,
                "DE-PREVIEW-001 publishes a room rectangle preview");
        DungeonEditorPreview.RoomRectanglePreview preview =
                (DungeonEditorPreview.RoomRectanglePreview) previewSurface.preview();
        assertEquals("1,1,0", cellKey(preview.start()), "DE-PREVIEW-001 preview starts at drag origin cell");
        assertEquals("3,3,0", cellKey(preview.end()), "DE-PREVIEW-001 preview ends at dragged cell");
        assertTrue(!preview.deleteMode(), "DE-PREVIEW-001 room paint preview is not in delete mode");
        assertTrue(previewSurface.surface().map().areas().isEmpty(),
                "DE-PREVIEW-001 committed published map remains empty before release");
        assertTrue(renderSurfaceCellOriginsWithZ(binding.mapContentModel()).containsAll(cellRect(1, 1, 3, 3, 0)),
                "DE-PREVIEW-001 render scene contains preview cells at expected coordinates");
        assertCanvasPaintedAtScene(mapView, 2.0, 2.0, "DE-PREVIEW-001 rendered canvas paints preview area");

        results.add("DE-PREVIEW-001 Ready: DungeonMapView room drag -> SQLite unchanged -> live room preview");
    }


    private static void verifyIsolatedRoomPaintThroughMapView(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();

        long mapId = createMapThroughControls(controls, runtime, "Isolated Room Map");
        List<String> authoredStateBefore = runtime.database().authoredGeometryState(mapId);
        Set<String> expectedCells = cellRect(1, 1, 3, 3, 0);

        click(button(controls, "Raum"));
        assertEquals("ROOM_PAINT", runtime.controlsModel().current().selectedTool().name(),
                "DE-ROOM-001 room family selects room paint tool");
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();
        double startX = viewport.sceneToScreenX(1.5);
        double startY = viewport.sceneToScreenY(1.5);
        double endX = viewport.sceneToScreenX(3.5);
        double endY = viewport.sceneToScreenY(3.5);

        fireMapMouse(mapView, MouseEvent.MOUSE_PRESSED, MouseButton.PRIMARY, startX, startY, false);
        fireMapMouse(mapView, MouseEvent.MOUSE_DRAGGED, MouseButton.PRIMARY, endX, endY, false);
        fireMapMouse(mapView, MouseEvent.MOUSE_RELEASED, MouseButton.PRIMARY, endX, endY, false);

        assertTrue(!authoredStateBefore.equals(runtime.database().authoredGeometryState(mapId)),
                "DE-ROOM-001 room paint changes authored DB state");
        assertEquals(1L, runtime.database().countRoomsForMap(mapId),
                "DE-ROOM-001 DB has one room row after isolated paint");
        assertEquals(1L, runtime.database().countRoomClustersForMap(mapId),
                "DE-ROOM-001 DB has one room cluster row after isolated paint");
        RoomClusterIds roomIds = runtime.database().roomByComponent(mapId, 1, 1, 0);
        assertEquals(roomIds.clusterId(), runtime.database().clusterIdByCenter(mapId, 1, 1, 0),
                "DE-ROOM-001 cluster center uses the painted minimum cell");
        assertTrue(runtime.database().roomFloorCells(roomIds.roomId()).isEmpty(),
                "DE-ROOM-001 DB room floors store no extra same-level anchors");
        Set<String> persistedVertices = runtime.database().absoluteClusterVertices(roomIds.clusterId());
        assertTrue(persistedVertices.containsAll(Set.of("1,1,0", "4,1,0", "4,4,0", "1,4,0")),
                "DE-ROOM-001 DB cluster vertices include isolated room perimeter corners: "
                        + persistedVertices);
        assertEquals(expectedCells, persistedClusterCellsThroughRepository(mapId, roomIds.clusterId(), 0),
                "DE-ROOM-001 product repository readback rasterizes persisted vertices to exactly painted cells");
        assertEquals(0L, runtime.database().countClusterEdges(roomIds.clusterId()),
                "DE-ROOM-001 isolated room does not require persisted perimeter edge rows");

        DungeonEditorMapSurfaceSnapshot committedSurface = runtime.mapSurfaceModel().current();
        assertEquals(DungeonEditorPreview.none(), committedSurface.preview(),
                "DE-ROOM-001 release clears room preview");
        assertNoOverlappingSurfaceCellOwnership(committedSurface, "DE-ROOM-001");
        var roomArea = roomAreaByCells(committedSurface, expectedCells, "DE-ROOM-001 committed room");
        assertEquals(expectedCells, areaCellSet(roomArea),
                "DE-ROOM-001 published room covers the isolated rectangle");
        assertTrue(committedSurface.surface().map().boundaries().size() >= 4,
                "DE-ROOM-001 published map exposes derived perimeter boundaries: "
                        + surfaceBoundarySummary(committedSurface));

        Set<String> renderCells = renderSurfaceCellOriginsWithZ(binding.mapContentModel());
        assertTrue(renderCells.containsAll(expectedCells),
                "DE-ROOM-001 render-facing state shows every isolated room cell");
        assertTrue(renderHasBoundaryNear(binding.mapContentModel(), "WALL", 2.5, 1.0),
                "DE-ROOM-001 render scene includes north perimeter wall");
        assertTrue(renderHasBoundaryNear(binding.mapContentModel(), "WALL", 4.0, 2.5),
                "DE-ROOM-001 render scene includes east perimeter wall");
        assertTrue(renderHasBoundaryNear(binding.mapContentModel(), "WALL", 2.5, 4.0),
                "DE-ROOM-001 render scene includes south perimeter wall");
        assertTrue(renderHasBoundaryNear(binding.mapContentModel(), "WALL", 1.0, 2.5),
                "DE-ROOM-001 render scene includes west perimeter wall");
        assertCanvasPaintedAtScene(mapView, 2.5, 2.5,
                "DE-ROOM-001 rendered canvas paints isolated room coordinates");

        results.add("DE-ROOM-001 Ready: DungeonEditorControlsView Raum -> DungeonMapView drag/release -> SQLite room -> live rendered perimeter");
    }


    private static void verifyOverlappingRoomPaintThroughMapView(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();

        long mapId = createMapThroughControls(controls, runtime, "Overlapping Room Map");
        runtime.database().seedF1SingleRoom(mapId, "R1", 0, 1, 1);
        createMapThroughControls(controls, runtime, "Overlapping Room Reload Hop");
        selectMap(controls, "Overlapping Room Map");
        RoomClusterIds initialIds = runtime.database().roomByName(mapId, "R1");
        Set<String> expectedUnionCells = new LinkedHashSet<>(cellRect(1, 1, 3, 3, 0));
        expectedUnionCells.addAll(cellRect(3, 2, 5, 4, 0));
        Set<String> boundingBoxOnlyCells = new LinkedHashSet<>(cellRect(1, 1, 5, 4, 0));
        boundingBoxOnlyCells.removeAll(expectedUnionCells);

        click(button(controls, "Raum"));
        assertEquals("ROOM_PAINT", runtime.controlsModel().current().selectedTool().name(),
                "DE-ROOM-002 room family selects room paint tool");
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();
        fireMapMouse(mapView, MouseEvent.MOUSE_PRESSED, MouseButton.PRIMARY,
                viewport.sceneToScreenX(3.5), viewport.sceneToScreenY(2.5), false);
        fireMapMouse(mapView, MouseEvent.MOUSE_DRAGGED, MouseButton.PRIMARY,
                viewport.sceneToScreenX(5.5), viewport.sceneToScreenY(4.5), false);
        fireMapMouse(mapView, MouseEvent.MOUSE_RELEASED, MouseButton.PRIMARY,
                viewport.sceneToScreenX(5.5), viewport.sceneToScreenY(4.5), false);

        assertEquals(1L, runtime.database().countRoomsForMap(mapId),
                "DE-ROOM-002 merge keeps a single room row");
        assertEquals(1L, runtime.database().countRoomClustersForMap(mapId),
                "DE-ROOM-002 merge keeps a single cluster row");
        RoomClusterIds mergedIds = runtime.database().roomByName(mapId, "R1");
        assertEquals(initialIds, mergedIds,
                "DE-ROOM-002 merge preserves R1/C1 identity");
        assertEquals(expectedUnionCells, persistedClusterCellsThroughRepository(mapId, mergedIds.clusterId(), 0),
                "DE-ROOM-002 product repository readback rasterizes persisted vertices to the set union");
        assertDisjoint(persistedClusterCellsThroughRepository(mapId, mergedIds.clusterId(), 0), boundingBoxOnlyCells,
                "DE-ROOM-002 merge does not fill unpainted bounding-box cells: " + boundingBoxOnlyCells);

        DungeonEditorMapSurfaceSnapshot committedSurface = runtime.mapSurfaceModel().current();
        assertEquals(DungeonEditorPreview.none(), committedSurface.preview(),
                "DE-ROOM-002 release clears overlap paint preview");
        assertNoOverlappingSurfaceCellOwnership(committedSurface, "DE-ROOM-002");
        var mergedArea = roomAreaByCells(committedSurface, expectedUnionCells, "DE-ROOM-002 committed merged room");
        assertEquals(initialIds.clusterId(), mergedArea.clusterId(),
                "DE-ROOM-002 published merged area keeps original cluster id");
        assertNoPublishedBoundaryBetween(committedSurface, 3, 2, 0, DungeonEdgeDirection.EAST,
                "DE-ROOM-002 omits old east wall inside merged union at y=2");
        assertNoPublishedBoundaryBetween(committedSurface, 3, 3, 0, DungeonEdgeDirection.EAST,
                "DE-ROOM-002 omits old east wall inside merged union at y=3");
        assertNoPublishedBoundaryBetween(committedSurface, 3, 3, 0, DungeonEdgeDirection.SOUTH,
                "DE-ROOM-002 omits old south wall inside merged union");

        Set<String> renderCells = renderSurfaceCellOriginsWithZ(binding.mapContentModel());
        assertTrue(renderCells.containsAll(expectedUnionCells),
                "DE-ROOM-002 render-facing state shows every merged union cell");
        assertDisjoint(renderCells, boundingBoxOnlyCells,
                "DE-ROOM-002 render-facing state does not fill unpainted bounding-box cells: "
                        + boundingBoxOnlyCells);
        assertTrue(!renderHasAnyBoundaryNear(binding.mapContentModel(), 4.0, 2.5),
                "DE-ROOM-002 render scene omits old internal east wall at y=2");
        assertTrue(!renderHasAnyBoundaryNear(binding.mapContentModel(), 4.0, 3.5),
                "DE-ROOM-002 render scene omits old internal east wall at y=3");
        assertTrue(!renderHasAnyBoundaryNear(binding.mapContentModel(), 3.5, 4.0),
                "DE-ROOM-002 render scene omits old internal south wall");

        results.add("DE-ROOM-002 Ready: DungeonEditorControlsView Raum -> DungeonMapView overlap drag/release -> SQLite merge -> no internal walls");
    }


    private static void verifyAdjacentRoomPaintThroughMapView(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();

        long mapId = createMapThroughControls(controls, runtime, "Adjacent Room Map");
        runtime.database().seedF1SingleRoom(mapId, "R1", 0, 1, 1);
        createMapThroughControls(controls, runtime, "Adjacent Room Reload Hop");
        selectMap(controls, "Adjacent Room Map");
        RoomClusterIds r1IdsBefore = runtime.database().roomByName(mapId, "R1");
        Set<String> r1ExpectedCells = cellRect(1, 1, 3, 3, 0);
        Set<String> newRoomExpectedCells = cellRect(4, 1, 6, 3, 0);
        var initialR1Area = roomAreaByLabel(runtime.mapSurfaceModel().current(), "R1", "DE-ROOM-003 initial R1");
        assertEquals(r1ExpectedCells, areaCellSet(initialR1Area),
                "DE-ROOM-003 initial published R1 cells match F1_SINGLE_ROOM");

        click(button(controls, "Raum"));
        assertEquals("ROOM_PAINT", runtime.controlsModel().current().selectedTool().name(),
                "DE-ROOM-003 room family selects room paint tool");
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();
        double startX = viewport.sceneToScreenX(4.5);
        double startY = viewport.sceneToScreenY(1.5);
        double endX = viewport.sceneToScreenX(6.5);
        double endY = viewport.sceneToScreenY(3.5);

        fireMapMouse(mapView, MouseEvent.MOUSE_PRESSED, MouseButton.PRIMARY, startX, startY, false);
        fireMapMouse(mapView, MouseEvent.MOUSE_DRAGGED, MouseButton.PRIMARY, endX, endY, false);
        fireMapMouse(mapView, MouseEvent.MOUSE_RELEASED, MouseButton.PRIMARY, endX, endY, false);

        assertEquals(r1IdsBefore, runtime.database().roomByName(mapId, "R1"),
                "DE-ROOM-003 existing R1/C1 DB identity remains stable");
        assertEquals(2L, runtime.database().countRoomsForMap(mapId),
                "DE-ROOM-003 DB has two room rows after adjacent paint");
        assertEquals(2L, runtime.database().countRoomClustersForMap(mapId),
                "DE-ROOM-003 DB has two room cluster rows after adjacent paint");
        RoomClusterIds newRoomIds = runtime.database().roomByComponent(mapId, 4, 1, 0);
        assertEquals(newRoomIds.clusterId(), runtime.database().clusterIdByCenter(mapId, 4, 1, 0),
                "DE-ROOM-003 new cluster center uses the painted minimum cell");
        assertTrue(runtime.database().absoluteClusterVertices(newRoomIds.clusterId())
                        .containsAll(Set.of("4,1,0", "7,1,0", "7,4,0", "4,4,0")),
                "DE-ROOM-003 new cluster vertices include the painted rectangle corners");
        assertEquals(0L, runtime.database().countClusterEdges(newRoomIds.clusterId()),
                "DE-ROOM-003 new room does not require persisted perimeter edge rows");

        DungeonEditorMapSurfaceSnapshot committedSurface = runtime.mapSurfaceModel().current();
        assertEquals(DungeonEditorPreview.none(), committedSurface.preview(),
                "DE-ROOM-003 release clears room preview");
        assertNoOverlappingSurfaceCellOwnership(committedSurface, "DE-ROOM-003");
        var r1Area = roomAreaByLabel(committedSurface, "R1", "DE-ROOM-003 committed R1");
        var newRoomArea = roomAreaByCells(committedSurface, newRoomExpectedCells, "DE-ROOM-003 committed new room");
        assertEquals(r1ExpectedCells, areaCellSet(r1Area),
                "DE-ROOM-003 published R1 cells remain unchanged");
        assertEquals(newRoomExpectedCells, areaCellSet(newRoomArea),
                "DE-ROOM-003 published new room covers the adjacent rectangle");
        assertTrue(r1Area.clusterId() != newRoomArea.clusterId(),
                "DE-ROOM-003 published rooms use separate clusters");
        assertTrue(!r1Area.topologyRef().equals(newRoomArea.topologyRef()),
                "DE-ROOM-003 published rooms use separate topology refs");
        assertTrue(committedSurface.surface().map().areas().stream()
                        .filter(area -> "ROOM".equalsIgnoreCase(area.kind()))
                        .count() == 2L,
                "DE-ROOM-003 published map has exactly two room areas");

        Set<String> renderCells = renderSurfaceCellOriginsWithZ(binding.mapContentModel());
        assertTrue(renderCells.containsAll(r1ExpectedCells),
                "DE-ROOM-003 render-facing state keeps original R1 cells");
        assertTrue(renderCells.containsAll(newRoomExpectedCells),
                "DE-ROOM-003 render-facing state shows the adjacent new room cells");
        assertTrue(!renderSelectionRefAtCell(binding.mapContentModel(), 3, 2, 0)
                        .equals(renderSelectionRefAtCell(binding.mapContentModel(), 4, 2, 0)),
                "DE-ROOM-003 side-by-side rooms render with separate selectable targets");
        assertCanvasPaintedAtScene(mapView, 2.5, 2.5,
                "DE-ROOM-003 rendered canvas paints original R1 coordinates");
        assertCanvasPaintedAtScene(mapView, 5.5, 2.5,
                "DE-ROOM-003 rendered canvas paints adjacent new room coordinates");

        results.add("DE-ROOM-003 Ready: DungeonEditorControlsView Raum -> DungeonMapView adjacent drag -> SQLite/readback separate rooms");
    }


    private static void verifyRoomDeleteThroughMapView(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();

        long mapId = createMapThroughControls(controls, runtime, "Delete Room Map");
        runtime.database().seedF1SingleRoom(mapId, "R1", 0, 1, 1);
        long hopMapId = createMapThroughControls(controls, runtime, "Delete Room Reload Hop");
        selectMap(controls, "Delete Room Map");
        Set<String> deletedRoomCells = cellRect(1, 1, 3, 3, 0);
        List<String> authoredStateBefore = runtime.database().authoredGeometryState(mapId);
        long hopGeometryRowsBefore = runtime.database().countAuthoredGeometryRows(hopMapId);
        List<String> hopAuthoredStateBefore = runtime.database().authoredGeometryState(hopMapId);
        assertTrue(runtime.database().countAuthoredGeometryRows(mapId) > 0L,
                "DE-ROOM-004 fixture starts with authored room rows");

        click(button(controls, "Auswahl"));
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();
        fireMapMousePressed(
                mapView,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(2.5),
                viewport.sceneToScreenY(2.5),
                false);
        DungeonEditorMapSurfaceSnapshot selectedSurface = runtime.mapSurfaceModel().current();
        assertTrue(selectedSurface.selection().clusterSelection(),
                "DE-ROOM-004 starts with selected R1 cluster before delete");

        click(button(controls, "Raum"));
        assertEquals("ROOM_PAINT", runtime.controlsModel().current().selectedTool().name(),
                "DE-ROOM-004 room family keeps paint as primary selected tool");
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_PRESSED,
                MouseButton.SECONDARY,
                viewport.sceneToScreenX(1.5),
                viewport.sceneToScreenY(1.5),
                false);
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_DRAGGED,
                MouseButton.SECONDARY,
                viewport.sceneToScreenX(3.5),
                viewport.sceneToScreenY(3.5),
                false);
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_RELEASED,
                MouseButton.SECONDARY,
                viewport.sceneToScreenX(3.5),
                viewport.sceneToScreenY(3.5),
                false);

        List<String> authoredStateAfter = runtime.database().authoredGeometryState(mapId);
        assertTrue(!authoredStateBefore.equals(authoredStateAfter),
                "DE-ROOM-004 delete changes authored DB state");
        assertEquals(0L, runtime.database().countAuthoredGeometryRows(mapId),
                "DE-ROOM-004 deletes all authored R1 geometry rows");
        assertEquals(1L, runtime.database().countMapIdWithName(hopMapId, "Delete Room Reload Hop"),
                "DE-ROOM-004 unrelated reload-hop dungeon_maps row remains");
        assertEquals(hopGeometryRowsBefore, runtime.database().countAuthoredGeometryRows(hopMapId),
                "DE-ROOM-004 unrelated reload-hop authored geometry count is unchanged");
        assertEquals(hopAuthoredStateBefore, runtime.database().authoredGeometryState(hopMapId),
                "DE-ROOM-004 unrelated reload-hop authored geometry state is unchanged");
        DungeonEditorMapSurfaceSnapshot deletedSurface = runtime.mapSurfaceModel().current();
        assertEquals(DungeonEditorPreview.none(), deletedSurface.preview(),
                "DE-ROOM-004 clears room delete preview after release");
        assertEmptySelection(deletedSurface.selection(), "DE-ROOM-004 map surface after delete");
        assertEmptySelection(runtime.stateModel().current().selection(), "DE-ROOM-004 state model after delete");
        assertTrue(deletedSurface.surface().map().areas().isEmpty(),
                "DE-ROOM-004 published map has no room areas after delete");
        assertTrue(deletedSurface.surface().map().boundaries().isEmpty(),
                "DE-ROOM-004 published map has no room boundaries after delete");
        assertTrue(deletedSurface.surface().map().editorHandles().isEmpty(),
                "DE-ROOM-004 published map has no editor handles after delete");
        Set<String> remainingDeletedRoomRenderCells = new LinkedHashSet<>(
                renderSurfaceCellOriginsWithZ(binding.mapContentModel()));
        remainingDeletedRoomRenderCells.retainAll(deletedRoomCells);
        assertTrue(remainingDeletedRoomRenderCells.isEmpty(),
                "DE-ROOM-004 render-facing state omits every deleted room cell: "
                        + remainingDeletedRoomRenderCells);
        assertVisiblePlaceholder(mapView, "DE-ROOM-004");

        results.add("DE-ROOM-004 Ready: DungeonEditorControlsView Raum + secondary drag -> SQLite delete -> empty render");
    }


    private static void verifyWallStartDraftThroughMapView(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();

        long mapId = createWallFixture(controls, runtime, "Wall Start Draft Map");
        RoomClusterIds roomIds = runtime.database().roomByName(mapId, "R1");
        List<String> boundaryStateBefore = runtime.database().roomBoundaryEdgeState(mapId);

        click(button(controls, "Wand"));
        assertEquals("WALL_CREATE", runtime.controlsModel().current().selectedTool().name(),
                "DE-WALL-001 wall family selects the create tool through DungeonEditorControlsView");
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_PRESSED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(2.0),
                viewport.sceneToScreenY(1.0),
                false);
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_RELEASED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(2.0),
                viewport.sceneToScreenY(1.0),
                false);

        assertEquals(boundaryStateBefore, runtime.database().roomBoundaryEdgeState(mapId),
                "DE-WALL-001 vertex click does not mutate persisted boundary rows");
        assertEquals(0L, runtime.database().countInternalWallBoundaries(roomIds.clusterId()),
                "DE-WALL-001 keeps the internal wall absent before a candidate exists");
        DungeonEditorMapSurfaceSnapshot startedSurface = runtime.mapSurfaceModel().current();
        assertEquals(DungeonEditorPreview.none(), startedSurface.preview(),
                "DE-WALL-001 published snapshot has no wall preview until a candidate path exists");
        assertTrue(!surfaceHasBoundaryKindAt(
                        startedSurface,
                        "wall",
                        new DungeonCell(2, 1, 0),
                        new DungeonCell(2, 2, 0)),
                "DE-WALL-001 published map has no internal wall before candidate movement");
        assertTrue(!renderHasBoundaryNear(binding.mapContentModel(), "WALL", 2.0, 1.5),
                "DE-WALL-001 render-facing state has no internal wall before candidate movement");

        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_MOVED,
                MouseButton.NONE,
                viewport.sceneToScreenX(2.0),
                viewport.sceneToScreenY(4.0),
                false);
        assertWallPreview(runtime.mapSurfaceModel().current(), 3, false, "DE-WALL-001 follow-up movement");

        results.add("DE-WALL-001 Ready: DungeonEditorControlsView Wand -> DungeonMapView vertex click"
                + " -> armed draft without DB mutation");
    }


    private static void verifyWallPreviewMoveThroughMapView(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();

        long mapId = createWallFixture(controls, runtime, "Wall Preview Move Map");
        List<String> boundaryStateBefore = runtime.database().roomBoundaryEdgeState(mapId);

        click(button(controls, "Wand"));
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_PRESSED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(2.0),
                viewport.sceneToScreenY(1.0),
                false);
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_RELEASED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(2.0),
                viewport.sceneToScreenY(1.0),
                false);
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_MOVED,
                MouseButton.NONE,
                viewport.sceneToScreenX(2.0),
                viewport.sceneToScreenY(4.0),
                false);
        DungeonEditorMapSurfaceSnapshot firstPreviewSurface = runtime.mapSurfaceModel().current();
        DungeonEditorPreview.ClusterBoundariesPreview firstPreview =
                assertWallPreview(firstPreviewSurface, 3, false, "DE-WALL-003 first endpoint");
        assertTrue(previewHasEdge(firstPreview, 2, 3, 0, 2, 4, 0),
                "DE-WALL-003 first preview reaches the internal south endpoint");

        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_MOVED,
                MouseButton.NONE,
                viewport.sceneToScreenX(3.0),
                viewport.sceneToScreenY(4.0),
                false);

        assertEquals(boundaryStateBefore, runtime.database().roomBoundaryEdgeState(mapId),
                "DE-WALL-003 moving the preview endpoint leaves persisted boundary rows unchanged");
        DungeonEditorPreview.ClusterBoundariesPreview movedPreview =
                assertWallPreview(runtime.mapSurfaceModel().current(), 4, false, "DE-WALL-003 moved endpoint");
        assertTrue(previewHasEdge(movedPreview, 3, 3, 0, 3, 4, 0),
                "DE-WALL-003 moved preview reaches the new endpoint at (3,4,0)");
        assertTrue(renderHasAnyBoundaryNear(binding.mapContentModel(), 3.0, 3.5),
                "DE-WALL-003 render-facing preview follows the moved endpoint");

        results.add("DE-WALL-003 Ready: DungeonEditorControlsView Wand -> DungeonMapView move"
                + " -> preview endpoint moves without SQLite mutation");
    }


    private static void verifyWallFinalizeThroughMapView(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();

        long mapId = createWallFixture(controls, runtime, "Wall Finalize Map");
        RoomClusterIds roomIds = runtime.database().roomByName(mapId, "R1");
        List<String> boundaryStateBefore = runtime.database().roomBoundaryEdgeState(mapId);
        assertEquals(0L, runtime.database().countInternalWallBoundaries(roomIds.clusterId()),
                "DE-WALL-002 fixture starts without the internal wall path");

        click(button(controls, "Wand"));
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();
        startAndPreviewInternalWall(mapView, viewport);
        assertWallPreview(runtime.mapSurfaceModel().current(), 3, false, "DE-WALL-002 preview before release");
        assertEquals(boundaryStateBefore, runtime.database().roomBoundaryEdgeState(mapId),
                "DE-WALL-002 preview does not persist internal wall rows before release");

        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_RELEASED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(2.0),
                viewport.sceneToScreenY(4.0),
                false);

        assertEquals(3L, runtime.database().countInternalWallBoundaries(roomIds.clusterId()),
                "DE-WALL-002 persists exactly three internal wall rows: "
                        + runtime.database().roomBoundaryEdgeState(mapId));
        assertEquals(3L, runtime.database().countInternalWallTopologyElements(mapId),
                "DE-WALL-002 persists exactly three internal wall topology rows");
        assertTrue(!boundaryStateBefore.equals(runtime.database().roomBoundaryEdgeState(mapId)),
                "DE-WALL-002 changes persisted boundary rows on finalize");
        assertEquals(roomIds, runtime.database().roomByName(mapId, "R1"),
                "DE-WALL-002 keeps room and cluster identity");
        DungeonEditorMapSurfaceSnapshot committedSurface = runtime.mapSurfaceModel().current();
        assertEquals(DungeonEditorPreview.none(), committedSurface.preview(),
                "DE-WALL-002 clears wall preview after release");
        assertInternalWallPublishedAndRendered(committedSurface, binding.mapContentModel(), "DE-WALL-002");

        results.add("DE-WALL-002 Ready: DungeonEditorControlsView Wand -> DungeonMapView release"
                + " -> SQLite wall rows -> render readback");
    }


    private static void verifyWallAlternateFinalizeThroughMapView(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();

        long mapId = createWallFixture(controls, runtime, "Wall Alternate Finalize Map");
        RoomClusterIds roomIds = runtime.database().roomByName(mapId, "R1");
        List<String> boundaryStateBefore = runtime.database().roomBoundaryEdgeState(mapId);

        click(button(controls, "Wand"));
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();
        startAndPreviewInternalWall(mapView, viewport);
        assertWallPreview(runtime.mapSurfaceModel().current(), 3, false, "DE-WALL-007 preview before alternate edit");

        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_RELEASED,
                MouseButton.SECONDARY,
                viewport.sceneToScreenX(2.0),
                viewport.sceneToScreenY(4.0),
                true);

        assertEquals(3L, runtime.database().countInternalWallBoundaries(roomIds.clusterId()),
                "DE-WALL-007 alternate edit persists exactly three internal wall rows");
        assertEquals(3L, runtime.database().countInternalWallTopologyElements(mapId),
                "DE-WALL-007 alternate edit persists exactly three internal wall topology rows");
        assertTrue(!boundaryStateBefore.equals(runtime.database().roomBoundaryEdgeState(mapId)),
                "DE-WALL-007 alternate edit changes persisted boundary rows on finalize");
        assertEquals(roomIds, runtime.database().roomByName(mapId, "R1"),
                "DE-WALL-007 alternate edit keeps room and cluster identity");
        DungeonEditorMapSurfaceSnapshot committedSurface = runtime.mapSurfaceModel().current();
        assertEquals(DungeonEditorPreview.none(), committedSurface.preview(),
                "DE-WALL-007 alternate edit clears wall preview after finalization");
        assertInternalWallPublishedAndRendered(committedSurface, binding.mapContentModel(), "DE-WALL-007");

        results.add("DE-WALL-007 Ready: DungeonEditorControlsView Wand -> DungeonMapView Shift+secondary release"
                + " -> SQLite wall rows -> render readback");
    }


    private static void verifyWallDeletePathThroughMapView(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();

        long mapId = createMapThroughControls(controls, runtime, "Wall Delete Map");
        runtime.database().seedF1SingleRoom(mapId, "R1", 0, 1, 1);
        createMapThroughControls(controls, runtime, "Wall Delete Reload Hop");
        selectMap(controls, "Wall Delete Map");
        RoomClusterIds roomIds = runtime.database().roomByName(mapId, "R1");
        List<String> boundaryStateBefore = runtime.database().roomBoundaryEdgeState(mapId);
        assertEquals(3L, runtime.database().countWallBoundariesForDirection(mapId, "NORTH"),
                "DE-WALL-004 fixture starts with three north wall rows");
        assertTrue(renderHasBoundaryNear(binding.mapContentModel(), "WALL", 2.5, 1.0),
                "DE-WALL-004 fixture renders the north wall before delete");

        click(button(controls, "Wand"));
        assertEquals("WALL_CREATE", runtime.controlsModel().current().selectedTool().name(),
                "DE-WALL-004 wall family selects the wall family tool");
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_PRESSED,
                MouseButton.SECONDARY,
                viewport.sceneToScreenX(1.0),
                viewport.sceneToScreenY(1.0),
                false);
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_DRAGGED,
                MouseButton.SECONDARY,
                viewport.sceneToScreenX(4.0),
                viewport.sceneToScreenY(1.0),
                false);
        DungeonEditorMapSurfaceSnapshot previewSurface = runtime.mapSurfaceModel().current();
        assertTrue(previewSurface.preview() instanceof DungeonEditorPreview.ClusterBoundariesPreview,
                "DE-WALL-004 secondary drag publishes a wall delete preview");
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_RELEASED,
                MouseButton.SECONDARY,
                viewport.sceneToScreenX(4.0),
                viewport.sceneToScreenY(1.0),
                false);

        List<String> boundaryStateAfter = runtime.database().roomBoundaryEdgeState(mapId);
        assertTrue(!boundaryStateBefore.equals(boundaryStateAfter),
                "DE-WALL-004 wall delete changes persisted boundary rows");
        assertEquals(0L, runtime.database().countWallBoundariesForDirection(mapId, "NORTH"),
                "DE-WALL-004 removes the persisted north wall rows");
        assertEquals(3L, runtime.database().countOpenBoundariesForDirection(mapId, "NORTH"),
                "DE-WALL-004 persists authored open rows for the north wall path");
        assertEquals(
                List.of(
                        "level_z=0,cell_x=-1,cell_y=-1,edge_direction=NORTH,edge_type=OPEN,topology_element_id=<null>",
                        "level_z=0,cell_x=0,cell_y=-1,edge_direction=NORTH,edge_type=OPEN,topology_element_id=<null>",
                        "level_z=0,cell_x=1,cell_y=-1,edge_direction=NORTH,edge_type=OPEN,topology_element_id=<null>"),
                runtime.database().openBoundaryRowsForDirection(roomIds.clusterId(), "NORTH"),
                "DE-WALL-004 persists exact authored open coordinates for the north wall path");
        assertEquals(0L, runtime.database().countWallTopologyElementsForDirection(mapId, "NORTH"),
                "DE-WALL-004 removes old north wall topology rows");
        assertEquals(3L, runtime.database().countWallBoundariesForDirection(mapId, "SOUTH"),
                "DE-WALL-004 keeps the persisted south wall rows");
        assertEquals(3L, runtime.database().countWallBoundariesForDirection(mapId, "WEST"),
                "DE-WALL-004 keeps the persisted west wall rows");
        assertEquals(3L, runtime.database().countWallBoundariesForDirection(mapId, "EAST"),
                "DE-WALL-004 keeps the persisted east wall rows");
        assertEquals(roomIds, runtime.database().roomByName(mapId, "R1"),
                "DE-WALL-004 keeps the room and cluster identity");

        DungeonEditorMapSurfaceSnapshot committedSurface = runtime.mapSurfaceModel().current();
        assertEquals(DungeonEditorPreview.none(), committedSurface.preview(),
                "DE-WALL-004 clears wall delete preview after release");
        assertTrue(!surfaceHasBoundaryKindAt(
                        committedSurface,
                        "wall",
                        new DungeonCell(1, 1, 0),
                        new DungeonCell(1, 0, 0)),
                "DE-WALL-004 published map omits first north wall edge");
        assertTrue(!surfaceHasBoundaryKindAt(
                        committedSurface,
                        "wall",
                        new DungeonCell(2, 1, 0),
                        new DungeonCell(2, 0, 0)),
                "DE-WALL-004 published map omits second north wall edge");
        assertTrue(!surfaceHasBoundaryKindAt(
                        committedSurface,
                        "wall",
                        new DungeonCell(3, 1, 0),
                        new DungeonCell(3, 0, 0)),
                "DE-WALL-004 published map omits third north wall edge");
        assertTrue(!renderHasBoundaryNear(binding.mapContentModel(), "WALL", 1.5, 1.0),
                "DE-WALL-004 render-facing state omits the west part of the north wall");
        assertTrue(!renderHasBoundaryNear(binding.mapContentModel(), "WALL", 2.5, 1.0),
                "DE-WALL-004 render-facing state omits the center part of the north wall");
        assertTrue(!renderHasBoundaryNear(binding.mapContentModel(), "WALL", 3.5, 1.0),
                "DE-WALL-004 render-facing state omits the east part of the north wall");
        assertTrue(renderHasBoundaryNear(binding.mapContentModel(), "WALL", 2.5, 4.0),
                "DE-WALL-004 render-facing state keeps the south wall");
        assertTrue(renderHasBoundaryNear(binding.mapContentModel(), "WALL", 1.0, 2.5),
                "DE-WALL-004 render-facing state keeps the west wall");
        assertTrue(renderHasBoundaryNear(binding.mapContentModel(), "WALL", 4.0, 2.5),
                "DE-WALL-004 render-facing state keeps the east wall");

        results.add("DE-WALL-004 Ready: DungeonEditorControlsView Wand -> DungeonMapView secondary boundary path"
                + " -> SQLite wall delete -> render readback");
    }


    private static void verifyWallDeleteSegmentThroughMapView(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();

        long mapId = createMapThroughControls(controls, runtime, "Wall Segment Delete Map");
        runtime.database().seedF1SingleRoom(mapId, "R1", 0, 1, 1);
        createMapThroughControls(controls, runtime, "Wall Segment Delete Reload Hop");
        selectMap(controls, "Wall Segment Delete Map");
        RoomClusterIds roomIds = runtime.database().roomByName(mapId, "R1");
        List<String> boundaryStateBefore = runtime.database().roomBoundaryEdgeState(mapId);
        assertEquals(3L, runtime.database().countWallBoundariesForDirection(mapId, "NORTH"),
                "DE-WALL-005 fixture starts with three north wall rows");
        assertTrue(renderHasBoundaryNear(binding.mapContentModel(), "WALL", 2.5, 1.0),
                "DE-WALL-005 fixture renders the middle north wall before delete");

        click(button(controls, "Wand"));
        assertEquals("WALL_CREATE", runtime.controlsModel().current().selectedTool().name(),
                "DE-WALL-005 wall family selects the wall family tool");
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();
        double segmentScreenX = viewport.sceneToScreenX(2.5);
        double segmentScreenY = viewport.sceneToScreenY(1.0);
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_PRESSED,
                MouseButton.SECONDARY,
                segmentScreenX,
                segmentScreenY,
                false);
        DungeonEditorMapSurfaceSnapshot previewSurface = runtime.mapSurfaceModel().current();
        assertTrue(previewSurface.preview() instanceof DungeonEditorPreview.ClusterBoundariesPreview,
                "DE-WALL-005 secondary wall-segment press publishes a wall delete preview");
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_RELEASED,
                MouseButton.SECONDARY,
                segmentScreenX,
                segmentScreenY,
                false);

        List<String> boundaryStateAfter = runtime.database().roomBoundaryEdgeState(mapId);
        assertTrue(!boundaryStateBefore.equals(boundaryStateAfter),
                "DE-WALL-005 direct segment delete changes persisted boundary rows");
        assertEquals(2L, runtime.database().countWallBoundariesForDirection(mapId, "NORTH"),
                "DE-WALL-005 removes exactly one persisted north wall row");
        assertEquals(1L, runtime.database().countOpenBoundariesForDirection(mapId, "NORTH"),
                "DE-WALL-005 persists one authored open row for the deleted segment");
        assertEquals(
                List.of("level_z=0,cell_x=0,cell_y=-1,edge_direction=NORTH,edge_type=OPEN,topology_element_id=<null>"),
                runtime.database().openBoundaryRowsForDirection(roomIds.clusterId(), "NORTH"),
                "DE-WALL-005 persists the exact middle north open boundary coordinate");
        assertEquals(2L, runtime.database().countWallTopologyElementsForDirection(mapId, "NORTH"),
                "DE-WALL-005 removes only the deleted north wall topology row");
        assertEquals(3L, runtime.database().countWallBoundariesForDirection(mapId, "SOUTH"),
                "DE-WALL-005 keeps the persisted south wall rows");
        assertEquals(3L, runtime.database().countWallBoundariesForDirection(mapId, "WEST"),
                "DE-WALL-005 keeps the persisted west wall rows");
        assertEquals(3L, runtime.database().countWallBoundariesForDirection(mapId, "EAST"),
                "DE-WALL-005 keeps the persisted east wall rows");
        assertEquals(roomIds, runtime.database().roomByName(mapId, "R1"),
                "DE-WALL-005 keeps the room and cluster identity");

        DungeonEditorMapSurfaceSnapshot committedSurface = runtime.mapSurfaceModel().current();
        assertEquals(DungeonEditorPreview.none(), committedSurface.preview(),
                "DE-WALL-005 clears wall delete preview after release");
        assertTrue(surfaceHasBoundaryKindAt(
                        committedSurface,
                        "wall",
                        new DungeonCell(1, 1, 0),
                        new DungeonCell(2, 1, 0)),
                "DE-WALL-005 published map keeps the west north wall edge: "
                        + surfaceBoundarySummary(committedSurface));
        assertTrue(!surfaceHasBoundaryKindAt(
                        committedSurface,
                        "wall",
                        new DungeonCell(2, 1, 0),
                        new DungeonCell(3, 1, 0)),
                "DE-WALL-005 published map omits the deleted middle north wall edge");
        assertTrue(surfaceHasBoundaryKindAt(
                        committedSurface,
                        "wall",
                        new DungeonCell(3, 1, 0),
                        new DungeonCell(4, 1, 0)),
                "DE-WALL-005 published map keeps the east north wall edge");
        assertTrue(renderHasBoundaryNear(binding.mapContentModel(), "WALL", 1.5, 1.0),
                "DE-WALL-005 render-facing state keeps the west part of the north wall");
        assertTrue(!renderHasBoundaryNear(binding.mapContentModel(), "WALL", 2.5, 1.0),
                "DE-WALL-005 render-facing state omits the deleted middle north wall");
        assertTrue(renderHasBoundaryNear(binding.mapContentModel(), "WALL", 3.5, 1.0),
                "DE-WALL-005 render-facing state keeps the east part of the north wall");

        results.add("DE-WALL-005 Ready: DungeonEditorControlsView Wand -> DungeonMapView secondary wall segment"
                + " -> SQLite wall delete -> render readback");
    }


    private static void verifyWallDeleteCornerThroughMapView(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();

        long mapId = createMapThroughControls(controls, runtime, "Wall Corner Delete Map");
        runtime.database().seedF1SingleRoom(mapId, "R1", 0, 1, 1);
        createMapThroughControls(controls, runtime, "Wall Corner Delete Reload Hop");
        selectMap(controls, "Wall Corner Delete Map");
        RoomClusterIds roomIds = runtime.database().roomByName(mapId, "R1");
        List<String> boundaryStateBefore = runtime.database().roomBoundaryEdgeState(mapId);
        assertEquals(3L, runtime.database().countWallBoundariesForDirection(mapId, "NORTH"),
                "DE-WALL-006 fixture starts with three north wall rows");
        assertEquals(3L, runtime.database().countWallBoundariesForDirection(mapId, "WEST"),
                "DE-WALL-006 fixture starts with three west wall rows");
        assertTrue(renderHasBoundaryNear(binding.mapContentModel(), "WALL", 1.5, 1.0),
                "DE-WALL-006 fixture renders the north edge adjacent to the corner");
        assertTrue(renderHasBoundaryNear(binding.mapContentModel(), "WALL", 1.0, 1.5),
                "DE-WALL-006 fixture renders the west edge adjacent to the corner");

        click(button(controls, "Wand"));
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();
        double cornerScreenX = viewport.sceneToScreenX(1.0);
        double cornerScreenY = viewport.sceneToScreenY(1.0);
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_PRESSED,
                MouseButton.SECONDARY,
                cornerScreenX,
                cornerScreenY,
                false);
        assertEquals(boundaryStateBefore, runtime.database().roomBoundaryEdgeState(mapId),
                "DE-WALL-006 secondary corner press does not mutate persisted boundary rows");
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_RELEASED,
                MouseButton.SECONDARY,
                cornerScreenX,
                cornerScreenY,
                false);

        List<String> boundaryStateAfter = runtime.database().roomBoundaryEdgeState(mapId);
        assertTrue(!boundaryStateBefore.equals(boundaryStateAfter),
                "DE-WALL-006 direct corner delete changes persisted boundary rows");
        assertEquals(2L, runtime.database().countWallBoundariesForDirection(mapId, "NORTH"),
                "DE-WALL-006 removes the north wall row adjacent to the corner");
        assertEquals(2L, runtime.database().countWallBoundariesForDirection(mapId, "WEST"),
                "DE-WALL-006 removes the west wall row adjacent to the corner");
        assertEquals(1L, runtime.database().countOpenBoundariesForDirection(mapId, "NORTH"),
                "DE-WALL-006 persists one authored open north row for the corner delete");
        assertEquals(1L, runtime.database().countOpenBoundariesForDirection(mapId, "WEST"),
                "DE-WALL-006 persists one authored open west row for the corner delete");
        assertEquals(
                List.of("level_z=0,cell_x=-1,cell_y=-1,edge_direction=NORTH,edge_type=OPEN,topology_element_id=<null>"),
                runtime.database().openBoundaryRowsForDirection(roomIds.clusterId(), "NORTH"),
                "DE-WALL-006 persists the exact north open boundary coordinate");
        assertEquals(
                List.of("level_z=0,cell_x=-1,cell_y=-1,edge_direction=WEST,edge_type=OPEN,topology_element_id=<null>"),
                runtime.database().openBoundaryRowsForDirection(roomIds.clusterId(), "WEST"),
                "DE-WALL-006 persists the exact west open boundary coordinate");
        assertEquals(2L, runtime.database().countWallTopologyElementsForDirection(mapId, "NORTH"),
                "DE-WALL-006 removes only the corner-adjacent north wall topology row");
        assertEquals(2L, runtime.database().countWallTopologyElementsForDirection(mapId, "WEST"),
                "DE-WALL-006 removes only the corner-adjacent west wall topology row");
        assertEquals(roomIds, runtime.database().roomByName(mapId, "R1"),
                "DE-WALL-006 keeps the room and cluster identity");

        DungeonEditorMapSurfaceSnapshot committedSurface = runtime.mapSurfaceModel().current();
        assertEquals(DungeonEditorPreview.none(), committedSurface.preview(),
                "DE-WALL-006 clears wall delete preview after release");
        assertTrue(!surfaceHasBoundaryKindAt(
                        committedSurface,
                        "wall",
                        new DungeonCell(1, 1, 0),
                        new DungeonCell(2, 1, 0)),
                "DE-WALL-006 published map omits the north edge adjacent to the corner");
        assertTrue(!surfaceHasBoundaryKindAt(
                        committedSurface,
                        "wall",
                        new DungeonCell(1, 1, 0),
                        new DungeonCell(1, 2, 0)),
                "DE-WALL-006 published map omits the west edge adjacent to the corner");
        assertTrue(surfaceHasBoundaryKindAt(
                        committedSurface,
                        "wall",
                        new DungeonCell(2, 1, 0),
                        new DungeonCell(3, 1, 0)),
                "DE-WALL-006 published map keeps the next north wall edge");
        assertTrue(surfaceHasBoundaryKindAt(
                        committedSurface,
                        "wall",
                        new DungeonCell(1, 2, 0),
                        new DungeonCell(1, 3, 0)),
                "DE-WALL-006 published map keeps the next west wall edge");
        assertTrue(!renderHasBoundaryNear(binding.mapContentModel(), "WALL", 1.5, 1.0),
                "DE-WALL-006 render-facing state omits the north edge adjacent to the corner");
        assertTrue(!renderHasBoundaryNear(binding.mapContentModel(), "WALL", 1.0, 1.5),
                "DE-WALL-006 render-facing state omits the west edge adjacent to the corner");
        assertTrue(renderHasBoundaryNear(binding.mapContentModel(), "WALL", 2.5, 1.0),
                "DE-WALL-006 render-facing state keeps the next north wall edge");
        assertTrue(renderHasBoundaryNear(binding.mapContentModel(), "WALL", 1.0, 2.5),
                "DE-WALL-006 render-facing state keeps the next west wall edge");

        results.add("DE-WALL-006 Ready: DungeonEditorControlsView Wand -> DungeonMapView secondary wall corner"
                + " -> SQLite wall delete -> render readback");
    }


    private static void verifyCancelDraftThroughMapView(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();

        long mapId = createMapThroughControls(controls, runtime, "Cancel Draft Map");
        List<String> authoredStateBefore = runtime.database().authoredGeometryState(mapId);
        click(button(controls, "Raum"));
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();
        double dragEndX = viewport.sceneToScreenX(3.5);
        double dragEndY = viewport.sceneToScreenY(3.5);

        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_PRESSED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(1.5),
                viewport.sceneToScreenY(1.5),
                false);
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_DRAGGED,
                MouseButton.PRIMARY,
                dragEndX,
                dragEndY,
                false);

        assertTrue(runtime.mapSurfaceModel().current().preview() instanceof DungeonEditorPreview.RoomRectanglePreview,
                "DE-PREVIEW-002 starts from a live room preview before Esc");
        assertTrue(renderSurfaceCellOriginsWithZ(binding.mapContentModel()).containsAll(cellRect(1, 1, 3, 3, 0)),
                "DE-PREVIEW-002 preview cells render before Esc");

        fireMapShortcut(mapView, KeyCode.ESCAPE);

        assertEquals(0L, runtime.database().countAuthoredGeometryRows(mapId),
                "DE-PREVIEW-002 Esc cancel writes no authored geometry");
        assertEquals(authoredStateBefore, runtime.database().authoredGeometryState(mapId),
                "DE-PREVIEW-002 Esc cancel leaves authored DB state unchanged");
        DungeonEditorMapSurfaceSnapshot canceledSurface = runtime.mapSurfaceModel().current();
        assertEquals(DungeonEditorPreview.none(), canceledSurface.preview(),
                "DE-PREVIEW-002 Esc cancel clears the preview");
        assertEquals("SELECT", canceledSurface.selectedTool().name(),
                "DE-PREVIEW-002 Esc cancel returns selected tool to Auswahl");
        assertTrue(canceledSurface.surface().map().areas().isEmpty(),
                "DE-PREVIEW-002 committed published map remains empty after cancel");
        assertTrue(!renderSurfaceCellOriginsWithZ(binding.mapContentModel()).contains("2,2,0"),
                "DE-PREVIEW-002 preview render disappears after Esc");
        assertVisiblePlaceholder(mapView, "DE-PREVIEW-002");

        fireMapMouse(mapView, MouseEvent.MOUSE_RELEASED, MouseButton.PRIMARY, dragEndX, dragEndY, false);

        assertEquals(0L, runtime.database().countAuthoredGeometryRows(mapId),
                "DE-PREVIEW-002 post-Esc release writes no authored geometry");
        assertEquals(authoredStateBefore, runtime.database().authoredGeometryState(mapId),
                "DE-PREVIEW-002 post-Esc release leaves authored DB state unchanged");
        DungeonEditorMapSurfaceSnapshot releasedSurface = runtime.mapSurfaceModel().current();
        assertEquals(DungeonEditorPreview.none(), releasedSurface.preview(),
                "DE-PREVIEW-002 post-Esc release keeps preview cleared");
        assertEquals("SELECT", releasedSurface.selectedTool().name(),
                "DE-PREVIEW-002 post-Esc release keeps selected tool on Auswahl");
        assertTrue(releasedSurface.surface().map().areas().isEmpty(),
                "DE-PREVIEW-002 committed published map remains empty after post-Esc release");
        assertTrue(!renderSurfaceCellOriginsWithZ(binding.mapContentModel()).contains("2,2,0"),
                "DE-PREVIEW-002 preview render stays cleared after post-Esc release");
        assertVisiblePlaceholder(mapView, "DE-PREVIEW-002");

        results.add("DE-PREVIEW-002 Ready: DungeonMapView room preview + Esc -> SQLite unchanged -> preview cleared");
    }

}
