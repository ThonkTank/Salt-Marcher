package src.view.leftbartabs.dungeoneditor;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Direction;
import src.domain.dungeon.published.DungeonEdgeRef;
import src.domain.dungeon.published.DungeonEditorControlsModel;
import src.domain.dungeon.published.DungeonEditorControlsSnapshot;
import src.domain.dungeon.published.DungeonEditorHandleKind;
import src.domain.dungeon.published.DungeonEditorHandleSnapshot;
import src.domain.dungeon.published.DungeonEditorMapSurfaceModel;
import src.domain.dungeon.published.DungeonEditorMapSurfaceSnapshot;
import src.domain.dungeon.published.DungeonEditorPreview;
import src.domain.dungeon.published.DungeonEditorStateSnapshot;
import src.domain.dungeon.published.DungeonEditorTopologyElementRef;
import src.domain.dungeon.published.DungeonEditorViewMode;
import src.domain.dungeon.published.DungeonInspectorSnapshot;
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

final class DungeonEditorRoomWallDoorHarness {

    private static final String OWNER = "DungeonEditorRoomWallDoorHarness";

    private DungeonEditorRoomWallDoorHarness() {
    }

    static void run(List<String> results) throws Exception {
        runClusterMovement(results);
        runDoor(results);
        runRoom(results);
        runWall(results);
    }

    static void runClusterMovement(List<String> results) throws Exception {
        route(results, () -> verifySelectedStraightWallStretchThroughMapView(results));
        route(results, () -> verifySelectedStraightWallInwardStretchThroughMapView(results));
        route(results, () -> verifySelectedWallCornerMoveThroughMapView(results));
        route(results, () -> verifySelectedWallCornerInwardMoveThroughMapView(results));
        route(results, () -> verifyInvalidCornerShrinkRejectedThroughMapView(results));
        route(results, () -> verifyWholeClusterMoveThroughMapView(results));
        route(results, () -> verifyUiCreatedRoomCornerMoveAfterReloadThroughMapView(results));
    }

    static void runDoor(List<String> results) throws Exception {
        route(results, () -> verifyDoorCreateThroughMapView(results));
        route(results, () -> verifyDoorDeleteThroughMapView(results));
    }

    static void runRoom(List<String> results) throws Exception {
        route(results, () -> verifyRoomNarrationThroughStateView(results));
        route(results, () -> verifyRoomPreviewThroughMapView(results));
        route(results, () -> verifyIsolatedRoomPaintThroughMapView(results));
        route(results, () -> verifyOverlappingRoomPaintThroughMapView(results));
        route(results, () -> verifyPartitionedRoomPaintPreservesIdentityThroughMapView(results));
        route(results, () -> verifyAdjacentRoomPaintThroughMapView(results));
        route(results, () -> verifyRoomDeleteThroughMapView(results));
        route(results, () -> verifyCancelDraftThroughMapView(results));
    }

    static void runWall(List<String> results) throws Exception {
        route(results, () -> verifyWallStartDraftThroughMapView(results));
        route(results, () -> verifyWallPreviewMoveThroughMapView(results));
        route(results, () -> verifyWallPathSecondaryCompletionThroughMapView(results));
        route(results, () -> verifyWallIntermediateAndExistingWallCompletionThroughMapView(results));
        route(results, () -> verifyWallSingleClickModeThroughControls(results));
        route(results, () -> verifyWallDeleteSegmentRunThroughMapView(results));
        route(results, () -> verifyWallDeleteCornerRunsThroughMapView(results));
        route(results, () -> verifyExteriorWallDeleteRejectedThroughMapView(results));
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
        List<String> authoredStateBefore = runtime.database().authoredGeometryState(mapId);
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
        assertEquals(authoredStateBefore, runtime.database().authoredGeometryState(mapId),
                "DE-SEL-007 drag preview leaves all authored geometry stores unchanged");
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
                runtime.database().authoredClusterBoundaryCorners(roomIds.clusterId()),
                "DE-SEL-007 persisted boundary corners move the north wall to y=0");
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

    private static void verifySelectedStraightWallInwardStretchThroughMapView(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();

        long mapId = createMapThroughControls(controls, runtime, "Straight Wall Inward Stretch Map");
        runtime.database().seedF1SingleRoom(mapId, "R1", 0, 1, 1);
        createMapThroughControls(controls, runtime, "Straight Wall Inward Stretch Reload Hop");
        selectMap(controls, "Straight Wall Inward Stretch Map");
        RoomClusterIds roomIds = runtime.database().roomByName(mapId, "R1");
        long geometryRowsBefore = runtime.database().countAuthoredGeometryRows(mapId);
        List<String> authoredStateBefore = runtime.database().authoredGeometryState(mapId);
        List<String> boundaryRowsBefore = runtime.database().roomBoundaryEdgeState(mapId);
        var roomArea = roomAreaByLabel(runtime.mapSurfaceModel().current(), "R1", "DE-SEL-011");
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
                viewport.sceneToScreenY(northWallMidpoint.getY() + 1.0),
                false);

        DungeonEditorMapSurfaceSnapshot previewSurface = runtime.mapSurfaceModel().current();
        assertEquals(geometryRowsBefore, runtime.database().countAuthoredGeometryRows(mapId),
                "DE-SEL-011 drag preview leaves authored DB row count unchanged");
        assertEquals(authoredStateBefore, runtime.database().authoredGeometryState(mapId),
                "DE-SEL-011 drag preview leaves all authored geometry stores unchanged");
        assertEquals(boundaryRowsBefore, runtime.database().roomBoundaryEdgeState(mapId),
                "DE-SEL-011 drag preview leaves persisted boundary rows unchanged");
        assertTrue(previewSurface.preview() instanceof DungeonEditorPreview.MoveBoundaryStretchPreview,
                "DE-SEL-011 publishes a boundary-stretch preview during inward wall drag");
        DungeonEditorPreview.MoveBoundaryStretchPreview preview =
                (DungeonEditorPreview.MoveBoundaryStretchPreview) previewSurface.preview();
        assertEquals(roomIds.clusterId(), preview.clusterId(), "DE-SEL-011 preview keeps cluster id");
        assertEquals(0L, preview.deltaQ(), "DE-SEL-011 preview delta q");
        assertEquals(1L, preview.deltaR(), "DE-SEL-011 preview delta r");
        assertEquals(0L, preview.deltaLevel(), "DE-SEL-011 preview delta level");
        assertEquals(cellRect(1, 1, 3, 3, 0), surfaceCellSet(previewSurface),
                "DE-SEL-011 preview leaves committed map surface unchanged before release");
        assertTrue(previewSurface.surface().previewMap() != null,
                "DE-SEL-011 publishes a preview map during inward boundary stretch");
        assertEquals(cellRect(1, 2, 3, 3, 0), mapSnapshotCellSet(previewSurface.surface().previewMap()),
                "DE-SEL-011 preview map shrinks the selected room north edge inward");
        assertTrue(renderPreviewSurfaceCellOriginsWithZ(binding.mapContentModel()).containsAll(cellRect(1, 2, 3, 3, 0)),
                "DE-SEL-011 render scene shows inward preview room cells");

        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_RELEASED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(northWallMidpoint.getX()),
                viewport.sceneToScreenY(northWallMidpoint.getY() + 1.0),
                false);

        assertEquals(roomIds, runtime.database().roomByName(mapId, "R1"),
                "DE-SEL-011 keeps room and cluster identity");
        assertEquals(cellRect(1, 2, 3, 3, 0), persistedClusterCellsThroughRepository(mapId, roomIds.clusterId(), 0),
                "DE-SEL-011 persisted readback shrinks room cells to y=2..3");
        assertEquals(Set.of("1,2,0", "4,2,0", "4,4,0", "1,4,0"),
                runtime.database().authoredClusterBoundaryCorners(roomIds.clusterId()),
                "DE-SEL-011 persisted boundary corners move the north wall inward to y=2");
        assertTrue(!boundaryRowsBefore.equals(runtime.database().roomBoundaryEdgeState(mapId)),
                "DE-SEL-011 recomputes persisted boundary rows after release");
        assertEquals(
                Set.of(
                        "cell=1,2,0,direction=NORTH,type=WALL",
                        "cell=2,2,0,direction=NORTH,type=WALL",
                        "cell=3,2,0,direction=NORTH,type=WALL"),
                runtime.database().wallBoundaryAbsoluteRowsForDirection(mapId, "NORTH"),
                "DE-SEL-011 recomputes persisted north wall rows at y=2");
        assertEquals(runtime.database().countWallBoundaryRows(mapId),
                runtime.database().countDistinctWallBoundaryTopologyRefs(mapId),
                "DE-SEL-011 persists no duplicate wall topology refs on boundary rows");
        assertEquals(0L, runtime.database().countUnreferencedWallTopologyElements(mapId),
                "DE-SEL-011 leaves no orphan wall topology rows");

        DungeonEditorMapSurfaceSnapshot committedSurface = runtime.mapSurfaceModel().current();
        assertEquals(DungeonEditorPreview.none(), committedSurface.preview(),
                "DE-SEL-011 clears boundary-stretch preview after release");
        assertSelectionMatches(roomRef, roomIds.clusterId(), committedSurface.selection(),
                "DE-SEL-011 map surface keeps selection on the shrunk cluster");
        assertEquals(cellRect(1, 2, 3, 3, 0), surfaceCellSet(committedSurface),
                "DE-SEL-011 published map exposes inward-shrunk cluster cells");
        assertTrue(renderSurfaceCellOriginsWithZ(binding.mapContentModel()).containsAll(cellRect(1, 2, 3, 3, 0)),
                "DE-SEL-011 render-facing state shows inward-shrunk room cells");
        assertTrue(renderHasBoundaryNear(binding.mapContentModel(), "WALL", 2.5, 2.0),
                "DE-SEL-011 render scene shows committed north wall at y=2");

        selectMap(controls, "Straight Wall Inward Stretch Reload Hop");
        selectMap(controls, "Straight Wall Inward Stretch Map");
        assertEquals(cellRect(1, 2, 3, 3, 0), surfaceCellSet(runtime.mapSurfaceModel().current()),
                "DE-SEL-011 reload keeps inward-shrunk cluster cells");
        assertTrue(renderHasBoundaryNear(binding.mapContentModel(), "WALL", 2.5, 2.0),
                "DE-SEL-011 reload render keeps the inward-moved north wall");

        results.add("DE-SEL-011 Ready: DungeonMapView inward straight wall drag -> SQLite stretch -> reload");
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
        selectClusterForHandles(binding, runtime.mapSurfaceModel().current(), roomIds.clusterId(), "DE-SEL-008");
        var cornerHandle = firstClusterCornerHandleAt(runtime.mapSurfaceModel().current(), 4, 4, 0, "DE-SEL-008");
        long geometryRowsBefore = runtime.database().countAuthoredGeometryRows(mapId);
        List<String> authoredStateBefore = runtime.database().authoredGeometryState(mapId);
        List<String> boundaryRowsBefore = runtime.database().roomBoundaryEdgeState(mapId);
        assertEquals(Set.of("1,1,0", "4,1,0", "4,4,0", "1,4,0"),
                runtime.database().authoredClusterBoundaryCorners(roomIds.clusterId()),
                "DE-SEL-008 starts with authored boundary corners");
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
        assertEquals(authoredStateBefore, runtime.database().authoredGeometryState(mapId),
                "DE-SEL-008 drag preview leaves all authored geometry stores unchanged");
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
                runtime.database().authoredClusterBoundaryCorners(roomIds.clusterId()),
                "DE-SEL-008 persisted boundary corners move the south-east corner to (5,5,0)");
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

    private static void verifySelectedWallCornerInwardMoveThroughMapView(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();

        long mapId = createMapThroughControls(controls, runtime, "Wall Corner Inward Move Map");
        runtime.database().seedF1SingleRoom(mapId, "R1", 0, 1, 1);
        createMapThroughControls(controls, runtime, "Wall Corner Inward Move Reload Hop");
        selectMap(controls, "Wall Corner Inward Move Map");
        click(button(controls, "Auswahl"));
        RoomClusterIds roomIds = runtime.database().roomByName(mapId, "R1");
        var roomArea = roomAreaByLabel(runtime.mapSurfaceModel().current(), "R1", "DE-SEL-012");
        DungeonEditorTopologyElementRef roomRef = roomArea.topologyRef();
        selectClusterForHandles(binding, runtime.mapSurfaceModel().current(), roomIds.clusterId(), "DE-SEL-012");
        var cornerHandle = firstClusterCornerHandleAt(runtime.mapSurfaceModel().current(), 4, 4, 0, "DE-SEL-012");
        long geometryRowsBefore = runtime.database().countAuthoredGeometryRows(mapId);
        List<String> authoredStateBefore = runtime.database().authoredGeometryState(mapId);
        List<String> boundaryRowsBefore = runtime.database().roomBoundaryEdgeState(mapId);
        assertEquals(Set.of("1,1,0", "4,1,0", "4,4,0", "1,4,0"),
                runtime.database().authoredClusterBoundaryCorners(roomIds.clusterId()),
                "DE-SEL-012 starts with authored boundary corners");

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
                viewport.sceneToScreenX(3.0),
                viewport.sceneToScreenY(3.0),
                false);

        DungeonEditorMapSurfaceSnapshot previewSurface = runtime.mapSurfaceModel().current();
        assertEquals(geometryRowsBefore, runtime.database().countAuthoredGeometryRows(mapId),
                "DE-SEL-012 drag preview leaves authored DB row count unchanged");
        assertEquals(authoredStateBefore, runtime.database().authoredGeometryState(mapId),
                "DE-SEL-012 drag preview leaves all authored geometry stores unchanged");
        assertEquals(boundaryRowsBefore, runtime.database().roomBoundaryEdgeState(mapId),
                "DE-SEL-012 drag preview leaves persisted boundary rows unchanged");
        assertTrue(previewSurface.preview() instanceof DungeonEditorPreview.MoveHandlePreview,
                "DE-SEL-012 publishes a move-handle preview during inward corner drag");
        DungeonEditorPreview.MoveHandlePreview preview =
                (DungeonEditorPreview.MoveHandlePreview) previewSurface.preview();
        assertEquals(cornerHandle.ref().kind(), preview.handleRef().kind(),
                "DE-SEL-012 preview handle kind");
        assertEquals(-1L, preview.deltaQ(), "DE-SEL-012 preview delta q");
        assertEquals(-1L, preview.deltaR(), "DE-SEL-012 preview delta r");
        assertEquals(0L, preview.deltaLevel(), "DE-SEL-012 preview delta level");
        assertTrue(renderHasGlyphAt(binding.mapContentModel(), roomRef, 3.0, 3.0, true),
                "DE-SEL-012 render scene shows preview corner handle at (3,3,0)");

        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_RELEASED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(3.0),
                viewport.sceneToScreenY(3.0),
                false);

        assertEquals(roomIds, runtime.database().roomByName(mapId, "R1"),
                "DE-SEL-012 keeps room and cluster identity");
        assertEquals(cellRect(1, 1, 2, 2, 0), persistedClusterCellsThroughRepository(mapId, roomIds.clusterId(), 0),
                "DE-SEL-012 persisted readback shrinks the south-east corner");
        assertEquals(Set.of("1,1,0", "3,1,0", "3,3,0", "1,3,0"),
                runtime.database().authoredClusterBoundaryCorners(roomIds.clusterId()),
                "DE-SEL-012 persisted boundary corners move the south-east corner inward to (3,3,0)");
        assertTrue(!boundaryRowsBefore.equals(runtime.database().roomBoundaryEdgeState(mapId)),
                "DE-SEL-012 recomputes persisted boundary rows after release");
        assertEquals(runtime.database().countWallBoundaryRows(mapId),
                runtime.database().countDistinctWallBoundaryTopologyRefs(mapId),
                "DE-SEL-012 persists no duplicate wall topology refs on boundary rows");
        assertEquals(0L, runtime.database().countUnreferencedWallTopologyElements(mapId),
                "DE-SEL-012 leaves no orphan wall topology rows");

        DungeonEditorMapSurfaceSnapshot committedSurface = runtime.mapSurfaceModel().current();
        assertEquals(DungeonEditorPreview.none(), committedSurface.preview(),
                "DE-SEL-012 clears corner move preview after release");
        assertSelectionMatches(roomRef, roomIds.clusterId(), committedSurface.selection(),
                "DE-SEL-012 map surface keeps selection on the moved cluster");
        assertEquals(cellRect(1, 1, 2, 2, 0), surfaceCellSet(committedSurface),
                "DE-SEL-012 published map exposes the inward-shrunk corner cells");
        assertClusterCornerHandleAt(committedSurface, 3, 3, 0, "DE-SEL-012");
        assertTrue(renderSurfaceCellOriginsWithZ(binding.mapContentModel()).containsAll(cellRect(1, 1, 2, 2, 0)),
                "DE-SEL-012 render-facing state shows inward-shrunk room cells");
        assertTrue(renderHasGlyphAt(binding.mapContentModel(), roomRef, 3.0, 3.0, false),
                "DE-SEL-012 render scene shows committed corner handle at (3,3,0)");
        assertTrue(renderHasBoundaryNear(binding.mapContentModel(), "WALL", 2.5, 3.0),
                "DE-SEL-012 render scene redraws the south wall inward");
        assertTrue(renderHasBoundaryNear(binding.mapContentModel(), "WALL", 3.0, 2.5),
                "DE-SEL-012 render scene redraws the east wall inward");

        selectMap(controls, "Wall Corner Inward Move Reload Hop");
        selectMap(controls, "Wall Corner Inward Move Map");
        assertEquals(cellRect(1, 1, 2, 2, 0), surfaceCellSet(runtime.mapSurfaceModel().current()),
                "DE-SEL-012 reload keeps inward corner cells");
        assertClusterCornerHandleAt(runtime.mapSurfaceModel().current(), 3, 3, 0, "DE-SEL-012 reload");
        assertTrue(renderHasBoundaryNear(binding.mapContentModel(), "WALL", 2.5, 3.0),
                "DE-SEL-012 reload render keeps the inward south wall");
        assertTrue(renderHasBoundaryNear(binding.mapContentModel(), "WALL", 3.0, 2.5),
                "DE-SEL-012 reload render keeps the inward east wall");

        results.add("DE-SEL-012 Ready: DungeonMapView inward cluster-corner drag -> SQLite corner move -> reload");
    }

    private static void verifyInvalidCornerShrinkRejectedThroughMapView(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();

        long mapId = createMapThroughControls(controls, runtime, "Invalid Corner Shrink Reject Map");
        runtime.database().seedF1SingleRoom(mapId, "R1", 0, 1, 1);
        createMapThroughControls(controls, runtime, "Invalid Corner Shrink Reject Reload Hop");
        selectMap(controls, "Invalid Corner Shrink Reject Map");
        click(button(controls, "Auswahl"));
        RoomClusterIds roomIds = runtime.database().roomByName(mapId, "R1");
        selectClusterForHandles(binding, runtime.mapSurfaceModel().current(), roomIds.clusterId(), "DE-SEL-013");
        DungeonEditorMapSurfaceSnapshot surfaceBefore = runtime.mapSurfaceModel().current();
        DungeonEditorStateSnapshot stateBefore = runtime.stateModel().current();
        List<String> authoredStateBefore = runtime.database().authoredGeometryState(mapId);
        List<String> boundaryRowsBefore = runtime.database().roomBoundaryEdgeState(mapId);
        Set<String> renderCellsBefore = renderSurfaceCellOriginsWithZ(binding.mapContentModel());
        long wallTopologyRefsBefore = runtime.database().countDistinctWallBoundaryTopologyRefs(mapId);
        DungeonEditorHandleSnapshot cornerHandle =
                firstClusterCornerHandleAt(surfaceBefore, 4, 4, 0, "DE-SEL-013");

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
                viewport.sceneToScreenX(1.0),
                viewport.sceneToScreenY(1.0),
                false);
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_RELEASED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(1.0),
                viewport.sceneToScreenY(1.0),
                false);

        assertEquals(authoredStateBefore, runtime.database().authoredGeometryState(mapId),
                "DE-SEL-013 invalid shrink rejection leaves authored DB state unchanged");
        assertEquals(boundaryRowsBefore, runtime.database().roomBoundaryEdgeState(mapId),
                "DE-SEL-013 invalid shrink rejection leaves persisted boundary rows unchanged");
        assertEquals(wallTopologyRefsBefore, runtime.database().countDistinctWallBoundaryTopologyRefs(mapId),
                "DE-SEL-013 invalid shrink rejection leaves wall topology refs unchanged");
        DungeonEditorMapSurfaceSnapshot surfaceAfter = runtime.mapSurfaceModel().current();
        assertEquals(surfaceBefore.surface().map(), surfaceAfter.surface().map(),
                "DE-SEL-013 invalid shrink rejection leaves published map unchanged");
        assertHandleSelectionMatches(cornerHandle.ref(), surfaceAfter.selection().handleRef(),
                "DE-SEL-013 invalid shrink rejection keeps map selection on dragged corner");
        assertHandleSelectionMatches(cornerHandle.ref(), runtime.stateModel().current().selection().handleRef(),
                "DE-SEL-013 invalid shrink rejection keeps state selection on dragged corner");
        assertEquals(DungeonEditorPreview.none(), surfaceAfter.preview(),
                "DE-SEL-013 invalid shrink rejection clears preview");
        assertEquals(renderCellsBefore, renderSurfaceCellOriginsWithZ(binding.mapContentModel()),
                "DE-SEL-013 invalid shrink rejection leaves rendered cells unchanged");
        assertEquals(cellRect(1, 1, 3, 3, 0), persistedClusterCellsThroughRepository(mapId, roomIds.clusterId(), 0),
                "DE-SEL-013 invalid shrink rejection keeps persisted room cells unchanged");
        assertClusterCornerHandleAt(surfaceAfter, 4, 4, 0, "DE-SEL-013 after rejection");

        selectMap(controls, "Invalid Corner Shrink Reject Reload Hop");
        selectMap(controls, "Invalid Corner Shrink Reject Map");
        assertEquals(cellRect(1, 1, 3, 3, 0), surfaceCellSet(runtime.mapSurfaceModel().current()),
                "DE-SEL-013 reload keeps rejected-shrink room cells unchanged");

        results.add("DE-SEL-013 Ready: invalid inward corner shrink rejects without DB, topology, preview, or selection mutation");
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
        List<String> authoredStateBefore = runtime.database().authoredGeometryState(mapId);
        assertEquals(roomIds.clusterId(), runtime.database().clusterIdByCenter(mapId, 2, 2, 0),
                "DE-SEL-009 starts with R1 cluster centered at (2,2,0)");
        assertEquals(roomIds, runtime.database().roomByComponent(mapId, 2, 2, 0),
                "DE-SEL-009 starts with R1 component at (2,2,0)");
        assertEquals(cellRect(1, 1, 3, 3, 0), persistedClusterCellsThroughRepository(mapId, roomIds.clusterId(), 0),
                "DE-SEL-009 starts with F1_SINGLE_ROOM cells");
        assertEquals(Set.of("1,1,0", "4,1,0", "4,4,0", "1,4,0"),
                runtime.database().authoredClusterBoundaryCorners(roomIds.clusterId()),
                "DE-SEL-009 starts with authored boundary corners");

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
        assertEquals(authoredStateBefore, runtime.database().authoredGeometryState(mapId),
                "DE-SEL-009 drag preview leaves all authored geometry stores unchanged");
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
                runtime.database().authoredClusterBoundaryCorners(roomIds.clusterId()),
                "DE-SEL-009 persisted boundary corners translate by (+2,+1,0)");

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

    private static void verifyUiCreatedRoomCornerMoveAfterReloadThroughMapView(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();

        long mapId = createMapThroughControls(controls, runtime, "UI Created Corner Move Map");
        List<String> authoredStateBefore = runtime.database().authoredGeometryState(mapId);
        Set<String> initialCells = cellRect(1, 1, 3, 3, 0);
        Set<String> expandedCells = cellRect(1, 1, 4, 4, 0);

        click(button(controls, "Raum"));
        assertEquals("ROOM_PAINT", runtime.controlsModel().current().selectedTool().name(),
                "DE-SEL-010 room family selects room paint tool");
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();
        double startX = viewport.sceneToScreenX(1.5);
        double startY = viewport.sceneToScreenY(1.5);
        double endX = viewport.sceneToScreenX(3.5);
        double endY = viewport.sceneToScreenY(3.5);

        fireMapMouse(mapView, MouseEvent.MOUSE_PRESSED, MouseButton.PRIMARY, startX, startY, false);
        fireMapMouse(mapView, MouseEvent.MOUSE_DRAGGED, MouseButton.PRIMARY, endX, endY, false);
        fireMapMouse(mapView, MouseEvent.MOUSE_RELEASED, MouseButton.PRIMARY, endX, endY, false);

        assertTrue(!authoredStateBefore.equals(runtime.database().authoredGeometryState(mapId)),
                "DE-SEL-010 room paint changes authored DB state");
        assertEquals(1L, runtime.database().countRoomsForMap(mapId),
                "DE-SEL-010 DB has one room row after UI room paint");
        assertEquals(1L, runtime.database().countRoomClustersForMap(mapId),
                "DE-SEL-010 DB has one room cluster row after UI room paint");
        RoomClusterIds roomIds = runtime.database().roomByComponent(mapId, 1, 1, 0);
        assertEquals(roomIds.clusterId(), runtime.database().clusterIdByCenter(mapId, 1, 1, 0),
                "DE-SEL-010 cluster center uses the painted minimum cell");
        assertTrue(runtime.database().roomFloorAnchors(roomIds.roomId()).isEmpty(),
                "DE-SEL-010 DB room floors store no extra same-level anchors");
        assertEquals(initialCells, runtime.database().clusterFloorCells(roomIds.clusterId()),
                "DE-SEL-010 direct cluster floor-cell rows equal the painted rectangle");
        assertEquals(0L, runtime.database().countClusterVertexRows(mapId),
                "DE-SEL-010 fresh UI-created room writes no legacy vertex rows");
        assertEquals(Set.of("1,1,0", "4,1,0", "4,4,0", "1,4,0"),
                runtime.database().authoredClusterBoundaryCorners(roomIds.clusterId()),
                "DE-SEL-010 boundary-derived corners match the fresh painted rectangle");
        assertEquals(
                Set.of(
                        "cell=1,1,0,direction=NORTH,type=WALL",
                        "cell=2,1,0,direction=NORTH,type=WALL",
                        "cell=3,1,0,direction=NORTH,type=WALL"),
                runtime.database().wallBoundaryAbsoluteRowsForDirection(mapId, "NORTH"),
                "DE-SEL-010 direct north wall rows close the painted rectangle");
        assertEquals(
                Set.of(
                        "cell=1,3,0,direction=SOUTH,type=WALL",
                        "cell=2,3,0,direction=SOUTH,type=WALL",
                        "cell=3,3,0,direction=SOUTH,type=WALL"),
                runtime.database().wallBoundaryAbsoluteRowsForDirection(mapId, "SOUTH"),
                "DE-SEL-010 direct south wall rows close the painted rectangle");
        assertEquals(
                Set.of(
                        "cell=1,1,0,direction=WEST,type=WALL",
                        "cell=1,2,0,direction=WEST,type=WALL",
                        "cell=1,3,0,direction=WEST,type=WALL"),
                runtime.database().wallBoundaryAbsoluteRowsForDirection(mapId, "WEST"),
                "DE-SEL-010 direct west wall rows close the painted rectangle");
        assertEquals(
                Set.of(
                        "cell=3,1,0,direction=EAST,type=WALL",
                        "cell=3,2,0,direction=EAST,type=WALL",
                        "cell=3,3,0,direction=EAST,type=WALL"),
                runtime.database().wallBoundaryAbsoluteRowsForDirection(mapId, "EAST"),
                "DE-SEL-010 direct east wall rows close the painted rectangle");
        assertEquals(12L, runtime.database().countClusterWallEdges(roomIds.clusterId()),
                "DE-SEL-010 direct perimeter wall rows match the fresh rectangle");
        assertEquals(runtime.database().countWallBoundaryRows(mapId),
                runtime.database().countDistinctWallBoundaryTopologyRefs(mapId),
                "DE-SEL-010 fresh room writes no duplicate wall topology refs");
        assertEquals(0L, runtime.database().countUnreferencedWallTopologyElements(mapId),
                "DE-SEL-010 fresh room leaves no unreferenced wall topology rows");

        long reloadHopMapId = createMapThroughControls(controls, runtime, "UI Created Corner Move Reload Hop");
        assertTrue(reloadHopMapId > 0L, "DE-SEL-010 creates a reload-hop map");
        selectMap(controls, "UI Created Corner Move Reload Hop");
        selectMap(controls, "UI Created Corner Move Map");
        click(button(controls, "Auswahl"));

        DungeonEditorMapSurfaceSnapshot loadedSurface = runtime.mapSurfaceModel().current();
        assertEquals(initialCells, surfaceCellSet(loadedSurface),
                "DE-SEL-010 reload keeps the UI-created room cells");
        var roomArea = roomAreaByCells(loadedSurface, initialCells, "DE-SEL-010 reloaded room");
        DungeonEditorTopologyElementRef roomRef = roomArea.topologyRef();
        assertTrue(renderSurfaceCellOriginsWithZ(binding.mapContentModel()).containsAll(initialCells),
                "DE-SEL-010 reload render shows the UI-created room cells");
        assertTrue(renderHasBoundaryNear(binding.mapContentModel(), "WALL", 2.5, 1.0),
                "DE-SEL-010 reload render shows the north perimeter wall");
        assertTrue(renderHasBoundaryNear(binding.mapContentModel(), "WALL", 4.0, 2.5),
                "DE-SEL-010 reload render shows the east perimeter wall");
        assertTrue(renderHasBoundaryNear(binding.mapContentModel(), "WALL", 2.5, 4.0),
                "DE-SEL-010 reload render shows the south perimeter wall");
        assertTrue(renderHasBoundaryNear(binding.mapContentModel(), "WALL", 1.0, 2.5),
                "DE-SEL-010 reload render shows the west perimeter wall");
        var cornerHandle = firstClusterCornerHandleAt(loadedSurface, 4, 4, 0, "DE-SEL-010");
        selectClusterForHandles(binding, loadedSurface, roomIds.clusterId(), "DE-SEL-010");
        assertEquals("CLUSTER_CORNER", cornerHandle.ref().kind().name(),
                "DE-SEL-010 reload publishes a cluster-corner handle at the boundary-derived corner");
        assertTrue(renderHasGlyphAt(binding.mapContentModel(), roomRef, 4.0, 4.0, false),
                "DE-SEL-010 reload render shows the corner handle glyph");
        assertEquals("HANDLE", binding.mapContentModel().resolvePointerTarget(4.0, 4.0).targetKind().name(),
                "DE-SEL-010 reload pointer route resolves the corner as a handle");

        long geometryRowsBefore = runtime.database().countAuthoredGeometryRows(mapId);
        List<String> authoredStateBeforeAfterReload = runtime.database().authoredGeometryState(mapId);
        List<String> boundaryRowsBefore = runtime.database().roomBoundaryEdgeState(mapId);
        Set<String> floorCellsBefore = runtime.database().clusterFloorCells(roomIds.clusterId());
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
                "DE-SEL-010 drag preview leaves authored DB row count unchanged");
        assertEquals(authoredStateBeforeAfterReload, runtime.database().authoredGeometryState(mapId),
                "DE-SEL-010 drag preview leaves all authored geometry stores unchanged");
        assertEquals(boundaryRowsBefore, runtime.database().roomBoundaryEdgeState(mapId),
                "DE-SEL-010 drag preview leaves persisted boundary rows unchanged");
        assertEquals(floorCellsBefore, runtime.database().clusterFloorCells(roomIds.clusterId()),
                "DE-SEL-010 drag preview leaves direct floor-cell rows unchanged");
        assertTrue(previewSurface.preview() instanceof DungeonEditorPreview.MoveHandlePreview,
                "DE-SEL-010 drag publishes a move-handle preview");
        DungeonEditorPreview.MoveHandlePreview preview =
                (DungeonEditorPreview.MoveHandlePreview) previewSurface.preview();
        assertEquals(cornerHandle.ref().kind(), preview.handleRef().kind(),
                "DE-SEL-010 preview keeps the corner-handle kind");
        assertEquals(1L, preview.deltaQ(), "DE-SEL-010 preview delta q");
        assertEquals(1L, preview.deltaR(), "DE-SEL-010 preview delta r");
        assertEquals(0L, preview.deltaLevel(), "DE-SEL-010 preview delta level");
        assertTrue(renderHasGlyphAt(binding.mapContentModel(), roomRef, 5.0, 5.0, true),
                "DE-SEL-010 preview render shows the moved corner glyph");

        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_RELEASED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(5.0),
                viewport.sceneToScreenY(5.0),
                false);

        assertEquals(roomIds, runtime.database().roomByComponent(mapId, 1, 1, 0),
                "DE-SEL-010 corner release keeps room and cluster identity");
        assertEquals(expandedCells, runtime.database().clusterFloorCells(roomIds.clusterId()),
                "DE-SEL-010 direct floor-cell rows expand after corner release");
        assertEquals(0L, runtime.database().countClusterVertexRows(mapId),
                "DE-SEL-010 corner release still writes no legacy vertex rows");
        assertEquals(Set.of("1,1,0", "5,1,0", "5,5,0", "1,5,0"),
                runtime.database().authoredClusterBoundaryCorners(roomIds.clusterId()),
                "DE-SEL-010 boundary-derived corners move to the released corner");
        assertEquals(
                Set.of(
                        "cell=1,1,0,direction=NORTH,type=WALL",
                        "cell=2,1,0,direction=NORTH,type=WALL",
                        "cell=3,1,0,direction=NORTH,type=WALL",
                        "cell=4,1,0,direction=NORTH,type=WALL"),
                runtime.database().wallBoundaryAbsoluteRowsForDirection(mapId, "NORTH"),
                "DE-SEL-010 direct north wall rows recompute after corner release");
        assertEquals(
                Set.of(
                        "cell=1,4,0,direction=SOUTH,type=WALL",
                        "cell=2,4,0,direction=SOUTH,type=WALL",
                        "cell=3,4,0,direction=SOUTH,type=WALL",
                        "cell=4,4,0,direction=SOUTH,type=WALL"),
                runtime.database().wallBoundaryAbsoluteRowsForDirection(mapId, "SOUTH"),
                "DE-SEL-010 direct south wall rows recompute after corner release");
        assertEquals(
                Set.of(
                        "cell=1,1,0,direction=WEST,type=WALL",
                        "cell=1,2,0,direction=WEST,type=WALL",
                        "cell=1,3,0,direction=WEST,type=WALL",
                        "cell=1,4,0,direction=WEST,type=WALL"),
                runtime.database().wallBoundaryAbsoluteRowsForDirection(mapId, "WEST"),
                "DE-SEL-010 direct west wall rows recompute after corner release");
        assertEquals(
                Set.of(
                        "cell=4,1,0,direction=EAST,type=WALL",
                        "cell=4,2,0,direction=EAST,type=WALL",
                        "cell=4,3,0,direction=EAST,type=WALL",
                        "cell=4,4,0,direction=EAST,type=WALL"),
                runtime.database().wallBoundaryAbsoluteRowsForDirection(mapId, "EAST"),
                "DE-SEL-010 direct east wall rows recompute after corner release");
        assertTrue(!boundaryRowsBefore.equals(runtime.database().roomBoundaryEdgeState(mapId)),
                "DE-SEL-010 corner release changes persisted wall boundary rows");
        assertEquals(runtime.database().countWallBoundaryRows(mapId),
                runtime.database().countDistinctWallBoundaryTopologyRefs(mapId),
                "DE-SEL-010 corner release persists no duplicate wall topology refs");
        assertEquals(0L, runtime.database().countUnreferencedWallTopologyElements(mapId),
                "DE-SEL-010 corner release leaves no orphan wall topology rows");

        DungeonEditorMapSurfaceSnapshot committedSurface = runtime.mapSurfaceModel().current();
        assertEquals(DungeonEditorPreview.none(), committedSurface.preview(),
                "DE-SEL-010 corner release clears the move preview");
        assertSelectionMatches(roomRef, roomIds.clusterId(), committedSurface.selection(),
                "DE-SEL-010 map surface keeps selection on the moved cluster");
        assertEquals(expandedCells, surfaceCellSet(committedSurface),
                "DE-SEL-010 published map exposes the moved room cells");
        assertClusterCornerHandleAt(committedSurface, 5, 5, 0, "DE-SEL-010");
        assertTrue(renderSurfaceCellOriginsWithZ(binding.mapContentModel()).containsAll(expandedCells),
                "DE-SEL-010 render-facing state shows the moved room cells");
        assertTrue(renderHasGlyphAt(binding.mapContentModel(), roomRef, 5.0, 5.0, false),
                "DE-SEL-010 render scene shows the moved corner handle glyph");
        assertTrue(renderHasBoundaryNear(binding.mapContentModel(), "WALL", 4.5, 5.0),
                "DE-SEL-010 render scene redraws the south wall to the moved corner");
        assertTrue(renderHasBoundaryNear(binding.mapContentModel(), "WALL", 5.0, 4.5),
                "DE-SEL-010 render scene redraws the east wall to the moved corner");

        selectMap(controls, "UI Created Corner Move Reload Hop");
        selectMap(controls, "UI Created Corner Move Map");
        DungeonEditorMapSurfaceSnapshot reloadedSurface = runtime.mapSurfaceModel().current();
        assertEquals(expandedCells, surfaceCellSet(reloadedSurface),
                "DE-SEL-010 second reload keeps the moved room cells");
        assertClusterCornerHandleAt(reloadedSurface, 5, 5, 0, "DE-SEL-010 second reload");
        assertTrue(renderSurfaceCellOriginsWithZ(binding.mapContentModel()).containsAll(expandedCells),
                "DE-SEL-010 second reload render shows the moved room cells");
        assertTrue(renderHasBoundaryNear(binding.mapContentModel(), "WALL", 4.5, 5.0),
                "DE-SEL-010 second reload render keeps the moved south wall");
        assertTrue(renderHasBoundaryNear(binding.mapContentModel(), "WALL", 5.0, 4.5),
                "DE-SEL-010 second reload render keeps the moved east wall");

        results.add("DE-SEL-010 Ready: UI room paint -> reload -> corner handle drag -> SQLite floor/wall rewrite -> reload");
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

    private static void selectClusterForHandles(
            HarnessBinding binding,
            DungeonEditorMapSurfaceSnapshot snapshot,
            long clusterId,
            String message
    ) {
        DungeonEditorHandleSnapshot label = snapshot.surface().map().editorHandles().stream()
                .filter(handle -> handle.ref().kind() == DungeonEditorHandleKind.CLUSTER_LABEL)
                .filter(handle -> handle.ref().clusterId() == clusterId)
                .findFirst()
                .orElseThrow(() -> new AssertionError(message + " cluster label not published for " + clusterId));
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();
        fireMapMouse(
                binding.mapView(),
                MouseEvent.MOUSE_PRESSED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(label.cell().q() + 0.5),
                viewport.sceneToScreenY(label.cell().r() + 0.5),
                false);
        fireMapMouse(
                binding.mapView(),
                MouseEvent.MOUSE_RELEASED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(label.cell().q() + 0.5),
                viewport.sceneToScreenY(label.cell().r() + 0.5),
                false);
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
                        new Cell(4, 2, 0),
                        new Cell(4, 3, 0)),
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
                        new Cell(4, 2, 0),
                        new Cell(4, 3, 0)),
                "DE-DOOR-002 unbound delete removes the published door boundary");
        assertTrue(surfaceHasBoundaryKindAt(
                        deletedSurface,
                        "wall",
                        new Cell(4, 2, 0),
                        new Cell(4, 3, 0)),
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
        List<String> authoredStateBefore = runtime.database().authoredGeometryState(mapId);
        long geometryRowsBefore = runtime.database().countAuthoredGeometryRows(mapId);
        List<String> roomBoundaryRowsBefore = runtime.database().roomBoundaryEdgeState(mapId);
        List<String> doorRowsBefore = runtime.database().doorBoundaryState(mapId);
        List<String> corridorRowsBefore = runtime.database().corridorStableConnectionState(mapId);
        DungeonEditorMapSurfaceSnapshot surfaceBefore = runtime.mapSurfaceModel().current();
        DungeonEditorStateSnapshot stateBefore = runtime.stateModel().current();
        assertEquals(1L, runtime.database().countDoorBoundariesAt(mapId, 1, 0, "EAST"),
                "DE-DOOR-002 bound fixture contains one east D1 door boundary");
        assertTrue(surfaceHasBoundaryKindAt(
                        runtime.mapSurfaceModel().current(),
                        "door",
                        new Cell(4, 2, 0),
                        new Cell(4, 3, 0)),
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

        assertEquals(authoredStateBefore, runtime.database().authoredGeometryState(mapId),
                "DE-DOOR-003 corridor-bound protected delete keeps authored topology state unchanged");
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
        assertEquals(surfaceBefore.surface().map(), rejectedSurface.surface().map(),
                "DE-DOOR-003 corridor-bound protected delete keeps the published map unchanged");
        assertEquals(surfaceBefore.selection(), rejectedSurface.selection(),
                "DE-DOOR-003 corridor-bound protected delete keeps map selection unchanged");
        assertEquals(stateBefore.selection(), runtime.stateModel().current().selection(),
                "DE-DOOR-003 corridor-bound protected delete keeps state selection unchanged");
        assertTrue(surfaceHasBoundaryKindAt(
                        rejectedSurface,
                        "door",
                        new Cell(4, 2, 0),
                        new Cell(4, 3, 0)),
                "DE-DOOR-002 corridor-bound delete keeps the published door boundary");
        assertTrue(renderHasBoundaryNear(binding.mapContentModel(), "DOOR", 4.0, 2.5),
                "DE-DOOR-002 corridor-bound render keeps the door marker");

        results.add("DE-DOOR-002 Ready: DungeonEditorControlsView Tür -> DungeonMapView secondary door delete"
                + " -> SQLite delete/reject -> render readback");
        results.add("DE-DOOR-003 Ready: DungeonMapView corridor-bound door secondary delete ->"
                + " door, corridor, room boundary, topology, preview, selection, published map, and render unchanged");
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
        long previewStartNanos = System.nanoTime();
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_DRAGGED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(3.5),
                viewport.sceneToScreenY(3.5),
                false);
        assertPreviewLatencyWithinBudget(previewStartNanos, "DE-PREVIEW-001 room drag preview");

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
        assertTrue(previewSurface.surface().previewMap() != null,
                "DE-PREVIEW-001 publishes a preview map before release");
        assertEquals(cellRect(1, 1, 3, 3, 0), mapSnapshotCellSet(previewSurface.surface().previewMap()),
                "DE-PREVIEW-001 preview map contains the painted room cells");
        assertEquals(1L, (long) previewSurface.surface().previewDiff().changedAreas().size(),
                "DE-PREVIEW-001 structured preview diff publishes one changed room area");
        assertEquals(cellRect(1, 1, 3, 3, 0),
                areaCellSet(previewSurface.surface().previewDiff().changedAreas().getFirst()),
                "DE-PREVIEW-001 structured preview diff carries the painted room cells");
        assertTrue(renderSurfaceCellOriginsWithZ(binding.mapContentModel()).containsAll(cellRect(1, 1, 3, 3, 0)),
                "DE-PREVIEW-001 render scene contains preview cells at expected coordinates");
        assertEquals(cellRect(1, 1, 3, 3, 0), renderPreviewSurfaceCellOriginsWithZ(binding.mapContentModel()),
                "DE-PREVIEW-001 preview render layer contains only the painted room cells");
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
        assertTrue(runtime.database().roomFloorAnchors(roomIds.roomId()).isEmpty(),
                "DE-ROOM-001 DB room floors store no extra same-level anchors");
        Set<String> persistedCorners = runtime.database().authoredClusterBoundaryCorners(roomIds.clusterId());
        assertTrue(persistedCorners.containsAll(Set.of("1,1,0", "4,1,0", "4,4,0", "1,4,0")),
                "DE-ROOM-001 DB boundary corners include isolated room perimeter corners: "
                        + persistedCorners);
        assertEquals(expectedCells, persistedClusterCellsThroughRepository(mapId, roomIds.clusterId(), 0),
                "DE-ROOM-001 product repository readback keeps exactly painted floor cells");
        assertEquals(12L, runtime.database().countClusterWallEdges(roomIds.clusterId()),
                "DE-ROOM-001 isolated room persists one wall boundary row per perimeter edge");

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
        assertNoPublishedBoundaryBetween(committedSurface, 3, 2, 0, Direction.EAST,
                "DE-ROOM-002 omits old east wall inside merged union at y=2");
        assertNoPublishedBoundaryBetween(committedSurface, 3, 3, 0, Direction.EAST,
                "DE-ROOM-002 omits old east wall inside merged union at y=3");
        assertNoPublishedBoundaryBetween(committedSurface, 3, 3, 0, Direction.SOUTH,
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

    private static void verifyPartitionedRoomPaintPreservesIdentityThroughMapView(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();

        long mapId = createMapThroughControls(controls, runtime, "Partitioned Room Paint Map");
        runtime.database().seedF15ComplexCluster(mapId);
        RoomClusterIds r1Ids = runtime.database().roomByName(mapId, "R1");
        RoomClusterIds r2Ids = runtime.database().roomByName(mapId, "R2");
        runtime.database().saveRoomVisualDescription(r2Ids.roomId(), "Partitioned room narration.");
        createMapThroughControls(controls, runtime, "Partitioned Room Paint Reload Hop");
        selectMap(controls, "Partitioned Room Paint Map");
        List<String> boundaryRowsBefore = runtime.database().roomBoundaryEdgeState(mapId);
        Set<String> expectedCells = new LinkedHashSet<>(Set.of(
                "10,10,0",
                "11,10,0",
                "12,10,0",
                "13,10,0",
                "10,11,0",
                "10,12,0"));
        assertEquals(2L, runtime.database().countRoomsForMap(mapId),
                "DE-ROOM-005 fixture starts with two room rows in one partitioned cluster");
        assertEquals(r1Ids.clusterId(), r2Ids.clusterId(),
                "DE-ROOM-005 fixture starts with R1 and R2 in the same cluster");
        assertEquals(1L, runtime.database().countRoomVisualDescription(r2Ids.roomId(), "Partitioned room narration."),
                "DE-ROOM-005 fixture starts with persisted R2 narration");

        click(button(controls, "Raum"));
        assertEquals("ROOM_PAINT", runtime.controlsModel().current().selectedTool().name(),
                "DE-ROOM-005 room family selects room paint tool");
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_PRESSED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(11.5),
                viewport.sceneToScreenY(10.5),
                false);
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_DRAGGED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(13.5),
                viewport.sceneToScreenY(10.5),
                false);

        DungeonEditorMapSurfaceSnapshot previewSurface = runtime.mapSurfaceModel().current();
        assertEquals(boundaryRowsBefore, runtime.database().roomBoundaryEdgeState(mapId),
                "DE-ROOM-005 partitioned paint preview leaves persisted boundary rows unchanged");
        assertTrue(previewSurface.preview() instanceof DungeonEditorPreview.RoomRectanglePreview,
                "DE-ROOM-005 publishes room paint preview before partitioned commit");
        assertTrue(previewSurface.surface().previewMap() != null,
                "DE-ROOM-005 publishes a preview map for partitioned paint");

        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_RELEASED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(13.5),
                viewport.sceneToScreenY(10.5),
                false);

        assertEquals(2L, runtime.database().countRoomsForMap(mapId),
                "DE-ROOM-005 partitioned paint keeps two room rows");
        assertEquals(r1Ids, runtime.database().roomByName(mapId, "R1"),
                "DE-ROOM-005 partitioned paint keeps R1 identity");
        assertEquals(r2Ids, runtime.database().roomByName(mapId, "R2"),
                "DE-ROOM-005 partitioned paint keeps R2 identity");
        assertEquals(1L, runtime.database().countRoomVisualDescription(r2Ids.roomId(), "Partitioned room narration."),
                "DE-ROOM-005 partitioned paint keeps R2 narration");
        assertEquals(expectedCells, runtime.database().clusterFloorCells(r2Ids.clusterId()),
                "DE-ROOM-005 direct cluster floor cells preserve partitioned union without template collapse");
        assertTrue(!boundaryRowsBefore.equals(runtime.database().roomBoundaryEdgeState(mapId)),
                "DE-ROOM-005 partitioned paint recomputes boundary rows after release");
        assertEquals(runtime.database().countWallBoundaryRows(mapId),
                runtime.database().countDistinctWallBoundaryTopologyRefs(mapId),
                "DE-ROOM-005 partitioned paint persists no duplicate wall topology refs");
        assertEquals(0L, runtime.database().countUnreferencedWallTopologyElements(mapId),
                "DE-ROOM-005 partitioned paint leaves no orphan wall topology rows");

        DungeonEditorMapSurfaceSnapshot committedSurface = runtime.mapSurfaceModel().current();
        assertEquals(DungeonEditorPreview.none(), committedSurface.preview(),
                "DE-ROOM-005 release clears room preview");
        assertNoOverlappingSurfaceCellOwnership(committedSurface, "DE-ROOM-005");
        var r2Area = roomAreaByLabel(committedSurface, "R2", "DE-ROOM-005 committed R2");
        assertTrue(areaCellSet(r2Area).contains("13,10,0"),
                "DE-ROOM-005 published R2 area includes the newly painted partition cell");
        assertTrue(renderSurfaceCellOriginsWithZ(binding.mapContentModel()).contains("13,10,0"),
                "DE-ROOM-005 render-facing state shows the newly painted partition cell");
        assertCanvasHasPaintedContent(mapView,
                "DE-ROOM-005 rendered canvas paints the committed partitioned map");

        selectMap(controls, "Partitioned Room Paint Reload Hop");
        selectMap(controls, "Partitioned Room Paint Map");
        assertEquals(r2Ids, runtime.database().roomByName(mapId, "R2"),
                "DE-ROOM-005 reload keeps R2 identity");
        assertEquals(1L, runtime.database().countRoomVisualDescription(r2Ids.roomId(), "Partitioned room narration."),
                "DE-ROOM-005 reload keeps R2 narration");
        assertEquals(expectedCells, runtime.database().clusterFloorCells(r2Ids.clusterId()),
                "DE-ROOM-005 reload keeps partitioned cluster cells");
        assertTrue(roomAreaByLabel(runtime.mapSurfaceModel().current(), "R2", "DE-ROOM-005 reloaded R2")
                        .cells().stream().anyMatch(cell -> cell.q() == 13 && cell.r() == 10 && cell.level() == 0),
                "DE-ROOM-005 reload publishes R2 extension cell");

        results.add("DE-ROOM-005 Ready: partitioned room paint -> SQLite identity/narration -> render/readback -> reload");
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
        assertTrue(runtime.database().authoredClusterBoundaryCorners(newRoomIds.clusterId())
                        .containsAll(Set.of("4,1,0", "7,1,0", "7,4,0", "4,4,0")),
                "DE-ROOM-003 new boundary corners include the painted rectangle corners");
        assertEquals(12L, runtime.database().countClusterWallEdges(newRoomIds.clusterId()),
                "DE-ROOM-003 new room persists one wall boundary row per perimeter edge");

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
                        new Cell(2, 1, 0),
                        new Cell(2, 2, 0)),
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


    private static void verifyWallPathSecondaryCompletionThroughMapView(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();

        long mapId = createWallFixture(controls, runtime, "Wall Secondary Completion Map");
        RoomClusterIds roomIds = runtime.database().roomByName(mapId, "R1");
        List<String> boundaryStateBefore = runtime.database().roomBoundaryEdgeState(mapId);
        assertEquals(0L, runtime.database().countInternalWallBoundaries(roomIds.clusterId()),
                "DE-WALL-009 fixture starts without the internal wall path");

        click(button(controls, "Wand"));
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();
        startAndPreviewInternalWall(mapView, viewport);
        assertWallPreview(runtime.mapSurfaceModel().current(), 3, false, "DE-WALL-009 preview before completion");
        assertEquals(boundaryStateBefore, runtime.database().roomBoundaryEdgeState(mapId),
                "DE-WALL-009 preview does not persist internal wall rows before secondary completion");

        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_PRESSED,
                MouseButton.SECONDARY,
                viewport.sceneToScreenX(2.0),
                viewport.sceneToScreenY(4.0),
                false);
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_RELEASED,
                MouseButton.SECONDARY,
                viewport.sceneToScreenX(2.0),
                viewport.sceneToScreenY(4.0),
                false);

        assertEquals(3L, runtime.database().countInternalWallBoundaries(roomIds.clusterId()),
                "DE-WALL-009 persists exactly three internal wall rows: "
                        + runtime.database().roomBoundaryEdgeState(mapId));
        assertEquals(3L, runtime.database().countInternalWallTopologyElements(mapId),
                "DE-WALL-009 persists exactly three internal wall topology rows");
        assertTrue(!boundaryStateBefore.equals(runtime.database().roomBoundaryEdgeState(mapId)),
                "DE-WALL-009 changes persisted boundary rows on completion");
        assertEquals(roomIds, runtime.database().roomByName(mapId, "R1"),
                "DE-WALL-009 keeps room and cluster identity");
        DungeonEditorMapSurfaceSnapshot committedSurface = runtime.mapSurfaceModel().current();
        assertEquals(DungeonEditorPreview.none(), committedSurface.preview(),
                "DE-WALL-009 clears wall preview after completion");
        assertInternalWallPublishedAndRendered(committedSurface, binding.mapContentModel(), "DE-WALL-009");

        results.add("DE-WALL-009 Ready: active wall-create path + secondary input"
                + " -> atomic SQLite wall path -> render readback");
    }


    private static void verifyWallIntermediateAndExistingWallCompletionThroughMapView(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();

        long mapId = createWallFixture(controls, runtime, "Wall Intermediate Completion Map");
        RoomClusterIds roomIds = runtime.database().roomByName(mapId, "R1");
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
                MouseEvent.MOUSE_PRESSED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(2.0),
                viewport.sceneToScreenY(2.0),
                false);
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_RELEASED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(2.0),
                viewport.sceneToScreenY(2.0),
                false);
        assertEquals(boundaryStateBefore, runtime.database().roomBoundaryEdgeState(mapId),
                "DE-WALL-008 intermediate primary point does not persist authored rows");
        DungeonEditorPreview.ClusterBoundariesPreview intermediatePreview =
                assertWallPreview(runtime.mapSurfaceModel().current(), 1, false, "DE-WALL-008 intermediate point");
        assertTrue(previewHasEdge(intermediatePreview, 2, 1, 0, 2, 2, 0),
                "DE-WALL-008 intermediate preview contains the first draft segment");

        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_PRESSED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(2.0),
                viewport.sceneToScreenY(4.0),
                false);
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_RELEASED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(2.0),
                viewport.sceneToScreenY(4.0),
                false);

        assertEquals(3L, runtime.database().countInternalWallBoundaries(roomIds.clusterId()),
                "DE-WALL-010 existing-wall click persists exactly three internal wall rows");
        assertEquals(3L, runtime.database().countInternalWallTopologyElements(mapId),
                "DE-WALL-010 existing-wall click persists exactly three internal wall topology rows");
        assertTrue(!boundaryStateBefore.equals(runtime.database().roomBoundaryEdgeState(mapId)),
                "DE-WALL-010 existing-wall click changes persisted boundary rows on completion");
        assertEquals(roomIds, runtime.database().roomByName(mapId, "R1"),
                "DE-WALL-010 existing-wall click keeps room and cluster identity");
        DungeonEditorMapSurfaceSnapshot committedSurface = runtime.mapSurfaceModel().current();
        assertEquals(DungeonEditorPreview.none(), committedSurface.preview(),
                "DE-WALL-010 existing-wall click clears wall preview after completion");
        assertInternalWallPublishedAndRendered(committedSurface, binding.mapContentModel(), "DE-WALL-010");

        results.add("DE-WALL-008 Ready: active wall-create path + primary intermediate point"
                + " -> draft segment preview without persistence");
        results.add("DE-WALL-010 Ready: active wall-create path + primary existing-wall hit"
                + " -> atomic SQLite wall path -> render readback");
    }


    private static void verifyWallSingleClickModeThroughControls(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();

        long mapId = createWallFixture(controls, runtime, "Wall Single Click Mode Map");
        RoomClusterIds roomIds = runtime.database().roomByName(mapId, "R1");
        List<String> boundaryStateBefore = runtime.database().roomBoundaryEdgeState(mapId);

        click(button(controls, "Wand"));
        assertEquals("WALL_CREATE", runtime.controlsModel().current().selectedTool().name(),
                "DE-WALL-011 wall family keeps path mode as the default wall-create tool");
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();
        startAndPreviewInternalWall(mapView, viewport);
        fireMapMouseWithControl(
                mapView,
                MouseEvent.MOUSE_RELEASED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(2.0),
                viewport.sceneToScreenY(4.0));

        assertEquals(3L, runtime.database().countInternalWallBoundaries(roomIds.clusterId()),
                "DE-WALL-011 single-click mode lets primary release complete the wall path");
        assertTrue(!boundaryStateBefore.equals(runtime.database().roomBoundaryEdgeState(mapId)),
                "DE-WALL-011 single-click mode changes persisted boundary rows on primary release");
        assertInternalWallPublishedAndRendered(runtime.mapSurfaceModel().current(), binding.mapContentModel(), "DE-WALL-011");

        results.add("DE-WALL-011 Ready: Ctrl-modified optional single-click mode completes on primary release"
                + " while path mode remains the default");
    }


    private static void verifyWallDeleteSegmentRunThroughMapView(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();

        long mapId = createInteriorWallRun(controls, runtime, binding, "Wall Segment Run Delete Map");
        RoomClusterIds roomIds = runtime.database().roomByName(mapId, "R1");
        List<String> boundaryStateBefore = runtime.database().roomBoundaryEdgeState(mapId);
        assertEquals(3L, runtime.database().countInternalWallBoundaries(roomIds.clusterId()),
                "DE-WALL-012 fixture starts with one three-segment internal wall run");

        click(button(controls, "Wand"));
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();
        Point2D segmentMidpoint = boundaryMidpointNear(binding.mapContentModel(), "WALL", 2.0, 2.5);
        double segmentScreenX = viewport.sceneToScreenX(segmentMidpoint.getX());
        double segmentScreenY = viewport.sceneToScreenY(segmentMidpoint.getY());
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_PRESSED,
                MouseButton.SECONDARY,
                segmentScreenX,
                segmentScreenY,
                false);
        assertWallPreview(runtime.mapSurfaceModel().current(), 3, true, "DE-WALL-012 straight-run delete preview");
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_RELEASED,
                MouseButton.SECONDARY,
                segmentScreenX,
                segmentScreenY,
                false);

        assertTrue(!boundaryStateBefore.equals(runtime.database().roomBoundaryEdgeState(mapId)),
                "DE-WALL-012 straight-run delete changes persisted boundary rows");
        assertEquals(0L, runtime.database().countInternalWallBoundaries(roomIds.clusterId()),
                "DE-WALL-012 removes the whole contiguous internal wall run");
        assertEquals(roomIds, runtime.database().roomByName(mapId, "R1"),
                "DE-WALL-012 keeps room and cluster identity");

        DungeonEditorMapSurfaceSnapshot committedSurface = runtime.mapSurfaceModel().current();
        assertEquals(DungeonEditorPreview.none(), committedSurface.preview(),
                "DE-WALL-012 clears wall delete preview after release");
        assertTrue(!renderHasBoundaryNear(binding.mapContentModel(), "WALL", 2.0, 1.5),
                "DE-WALL-012 render-facing state omits the north internal segment");
        assertTrue(!renderHasBoundaryNear(binding.mapContentModel(), "WALL", 2.0, 2.5),
                "DE-WALL-012 render-facing state omits the middle internal segment");
        assertTrue(!renderHasBoundaryNear(binding.mapContentModel(), "WALL", 2.0, 3.5),
                "DE-WALL-012 render-facing state omits the south internal segment");

        results.add("DE-WALL-012 Ready: wall secondary segment delete expands to the whole straight run");
    }


    private static void verifyWallDeleteCornerRunsThroughMapView(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();

        long mapId = createInteriorCornerWallRuns(controls, runtime, binding, "Wall Corner Runs Delete Map");
        RoomClusterIds roomIds = runtime.database().roomByName(mapId, "R1");
        List<String> boundaryStateBefore = runtime.database().roomBoundaryEdgeState(mapId);
        assertTrue(runtime.database().countInternalWallBoundaries(roomIds.clusterId()) >= 3L,
                "DE-WALL-013 fixture starts with at least the vertical internal wall run; internalCount="
                        + runtime.database().countInternalWallBoundaries(roomIds.clusterId())
                        + " rows=" + runtime.database().roomBoundaryEdgeState(mapId));

        click(button(controls, "Wand"));
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();
        double cornerScreenX = viewport.sceneToScreenX(2.0);
        double cornerScreenY = viewport.sceneToScreenY(2.0);
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_PRESSED,
                MouseButton.SECONDARY,
                cornerScreenX,
                cornerScreenY,
                false);
        assertEquals(boundaryStateBefore, runtime.database().roomBoundaryEdgeState(mapId),
                "DE-WALL-013 secondary corner press does not mutate persisted boundary rows");
        assertWallPreview(runtime.mapSurfaceModel().current(), 5, true, "DE-WALL-013 corner run delete preview");
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_RELEASED,
                MouseButton.SECONDARY,
                cornerScreenX,
                cornerScreenY,
                false);

        List<String> boundaryStateAfter = runtime.database().roomBoundaryEdgeState(mapId);
        assertTrue(!boundaryStateBefore.equals(boundaryStateAfter),
                "DE-WALL-013 direct corner delete changes persisted boundary rows");
        assertEquals(0L, runtime.database().countInternalWallBoundaries(roomIds.clusterId()),
                "DE-WALL-013 removes every contiguous straight run meeting the corner");
        assertEquals(roomIds, runtime.database().roomByName(mapId, "R1"),
                "DE-WALL-013 keeps the room and cluster identity");

        DungeonEditorMapSurfaceSnapshot committedSurface = runtime.mapSurfaceModel().current();
        assertEquals(DungeonEditorPreview.none(), committedSurface.preview(),
                "DE-WALL-013 clears wall delete preview after release");
        assertTrue(!renderHasBoundaryNear(binding.mapContentModel(), "WALL", 2.0, 1.5),
                "DE-WALL-013 render-facing state omits vertical run segment north of corner");
        assertTrue(!renderHasBoundaryNear(binding.mapContentModel(), "WALL", 2.0, 2.5),
                "DE-WALL-013 render-facing state omits vertical run segment south of corner");
        assertTrue(!renderHasBoundaryNear(binding.mapContentModel(), "WALL", 3.0, 2.0),
                "DE-WALL-013 render-facing state omits horizontal run segment east of corner");

        results.add("DE-WALL-013 Ready: wall secondary corner delete expands to all touching straight runs");
    }


    private static void verifyExteriorWallDeleteRejectedThroughMapView(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();

        long mapId = createWallFixture(controls, runtime, "Exterior Wall Delete Reject Map");
        List<String> authoredStateBefore = runtime.database().authoredGeometryState(mapId);
        DungeonEditorMapSurfaceSnapshot surfaceBefore = runtime.mapSurfaceModel().current();
        Set<String> renderCellsBefore = renderSurfaceCellOriginsWithZ(binding.mapContentModel());

        click(button(controls, "Wand"));
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_PRESSED,
                MouseButton.SECONDARY,
                viewport.sceneToScreenX(2.5),
                viewport.sceneToScreenY(1.0),
                false);
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_RELEASED,
                MouseButton.SECONDARY,
                viewport.sceneToScreenX(2.5),
                viewport.sceneToScreenY(1.0),
                false);

        assertEquals(authoredStateBefore, runtime.database().authoredGeometryState(mapId),
                "DE-WALL-014 exterior delete rejection leaves authored DB state unchanged");
        DungeonEditorMapSurfaceSnapshot surfaceAfter = runtime.mapSurfaceModel().current();
        assertEquals(surfaceBefore.surface().map(), surfaceAfter.surface().map(),
                "DE-WALL-014 exterior delete rejection leaves published map unchanged");
        assertEquals(surfaceBefore.selection(), surfaceAfter.selection(),
                "DE-WALL-014 exterior delete rejection leaves selection unchanged");
        assertEquals(DungeonEditorPreview.none(), surfaceAfter.preview(),
                "DE-WALL-014 exterior delete rejection leaves preview empty");
        assertEquals(renderCellsBefore, renderSurfaceCellOriginsWithZ(binding.mapContentModel()),
                "DE-WALL-014 exterior delete rejection leaves rendered geometry unchanged");
        assertTrue(runtime.controlsModel().current().statusText().contains("Aussenwand"),
                "DE-WALL-014 exterior delete rejection publishes a concrete status");

        results.add("DE-WALL-014 Ready: wall secondary exterior delete rejects without geometry, preview, or selection mutation");
        results.add("DE-CLUSTER-004 Ready: cluster exterior wall delete publishes rejection status"
                + " and leaves authored geometry, topology, preview, and selection unchanged");
    }


    private static long createInteriorWallRun(
            DungeonEditorControlsView controls,
            HarnessRuntime runtime,
            HarnessBinding binding,
            String mapName
    ) {
        long mapId = createWallFixture(controls, runtime, mapName);
        DungeonMapView mapView = binding.mapView();
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();
        click(button(controls, "Wand"));
        startAndPreviewInternalWall(mapView, viewport);
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_PRESSED,
                MouseButton.SECONDARY,
                viewport.sceneToScreenX(2.0),
                viewport.sceneToScreenY(4.0),
                false);
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_RELEASED,
                MouseButton.SECONDARY,
                viewport.sceneToScreenX(2.0),
                viewport.sceneToScreenY(4.0),
                false);
        return mapId;
    }


    private static long createInteriorCornerWallRuns(
            DungeonEditorControlsView controls,
            HarnessRuntime runtime,
            HarnessBinding binding,
            String mapName
    ) {
        long mapId = createInteriorWallRun(controls, runtime, binding, mapName);
        DungeonMapView mapView = binding.mapView();
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();
        click(button(controls, "Wand"));
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_PRESSED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(2.0),
                viewport.sceneToScreenY(2.0),
                false);
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_RELEASED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(2.0),
                viewport.sceneToScreenY(2.0),
                false);
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_MOVED,
                MouseButton.NONE,
                viewport.sceneToScreenX(4.0),
                viewport.sceneToScreenY(2.0),
                false);
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_PRESSED,
                MouseButton.SECONDARY,
                viewport.sceneToScreenX(4.0),
                viewport.sceneToScreenY(2.0),
                false);
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_RELEASED,
                MouseButton.SECONDARY,
                viewport.sceneToScreenX(4.0),
                viewport.sceneToScreenY(2.0),
                false);
        return mapId;
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
