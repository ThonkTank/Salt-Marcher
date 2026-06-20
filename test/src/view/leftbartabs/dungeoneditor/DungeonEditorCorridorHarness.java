package src.view.leftbartabs.dungeoneditor;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Direction;
import src.domain.dungeon.published.DungeonEdgeRef;
import src.domain.dungeon.published.DungeonEditorControlsModel;
import src.domain.dungeon.published.DungeonEditorControlsSnapshot;
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

final class DungeonEditorCorridorHarness {

    private static final String OWNER = "DungeonEditorCorridorHarness";

    private DungeonEditorCorridorHarness() {
    }

    static void run(List<String> results) throws Exception {
        route(results, () -> verifyCorridorAnchorMoveThroughMapView(results));
        route(results, () -> verifyCorridorPointEditThroughStateView(results));
        route(results, () -> verifyDependentCorridorRouteUpdatesThroughHostAnchorMove(results));
        route(results, () -> verifyDependentCorridorRouteUpdatesThroughWholeClusterMove(results));
        route(results, () -> verifyDoorToDoorVerticalFallbackCorridorCreateThroughMapView(results));
        route(results, () -> verifyCorridorSplitAtCrossingThroughMapView(results));
        route(results, () -> verifyCorridorConnectionPointDeleteThroughMapView(results));
        route(results, () -> verifyCorridorDoorConnectionDeleteThroughMapView(results));
        route(results, () -> verifyInvalidCorridorRouteRejectedThroughMapView(results));
        route(results, () -> verifyGenericEndpointMaterializesOnlyAtFullCommitThroughMapView(results));
    }

    private static void route(
            List<String> results,
            DungeonEditorBehaviorHarnessSupport.ThrowingRunnable action
    ) throws Exception {
        DungeonEditorBehaviorHarnessSupport.runRouteProof(results, OWNER, action);
    }

    private static void verifyCorridorAnchorMoveThroughMapView(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();

        long mapId = createMapThroughControls(controls, runtime, "Corridor Anchor Move Map");
        runtime.database().seedCorridorWithAnchor(mapId);
        createMapThroughControls(controls, runtime, "Corridor Anchor Move Reload Hop");
        selectMap(controls, "Corridor Anchor Move Map");
        click(button(controls, "Auswahl"));
        var corridorAnchor = runtime.mapSurfaceModel().current().surface().map().editorHandles().stream()
                .filter(handle -> "CORRIDOR_ANCHOR".equals(handle.ref().kind().name()))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("F5_CORRIDOR_WITH_ANCHOR anchor handle not loaded."));
        List<String> anchorRowsBefore = runtime.database().corridorAnchorState(mapId);
        List<String> stableRowsBefore = runtime.database().corridorStableConnectionState(mapId);
        List<String> authoredStateBefore = runtime.database().authoredGeometryState(mapId);
        long geometryRowsBefore = runtime.database().countAuthoredGeometryRows(mapId);
        String a1AnchorRow = anchorRowsBefore.stream()
                .filter(row -> row.contains("anchor_id=1")
                        && row.contains("cell_x=6")
                        && row.contains("cell_y=5")
                        && row.contains("cell_z=0"))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException(
                        "DE-COR-005 starts with A1 anchored at (6,5,0): " + anchorRowsBefore));
        assertTrue(a1AnchorRow.contains("|cell_y=5|"),
                "DE-COR-005 captures exact A1 anchor row at (6,5,0): " + a1AnchorRow);
        assertTrue(!"HANDLE".equals(binding.mapContentModel()
                        .resolvePointerTarget(corridorAnchor.markerQ(), corridorAnchor.markerR())
                        .targetKind()
                        .name()),
                "DE-SEL-006 corridor anchor marker does not resolve as a draggable handle");
        Point2D corridorBody = new Point2D(corridorAnchor.markerQ() + 0.05, corridorAnchor.markerR() + 0.05);
        assertEquals("CELL", binding.mapContentModel()
                        .resolvePointerTarget(corridorBody.getX(), corridorBody.getY())
                        .targetKind()
                        .name(),
                "DE-SEL-006 corridor anchor body resolves as a generic corridor cell");
        assertEquals("CORRIDOR", binding.mapContentModel()
                        .resolvePointerTarget(corridorBody.getX(), corridorBody.getY())
                        .elementKind(),
                "DE-SEL-006 corridor anchor body keeps corridor element identity");
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();

        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_PRESSED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(corridorAnchor.markerQ()),
                viewport.sceneToScreenY(corridorAnchor.markerR()),
                false);
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_DRAGGED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(6.5),
                viewport.sceneToScreenY(4.5),
                false);

        DungeonEditorMapSurfaceSnapshot previewSurface = runtime.mapSurfaceModel().current();
        assertEquals(anchorRowsBefore, runtime.database().corridorAnchorState(mapId),
                "DE-SEL-006 suppressed anchor drag leaves corridor anchor DB rows unchanged before release");
        assertEquals(stableRowsBefore, runtime.database().corridorStableConnectionState(mapId),
                "DE-SEL-006 suppressed anchor drag leaves stable corridor connection DB rows unchanged before release");
        assertEquals(DungeonEditorPreview.none(), previewSurface.preview(),
                "DE-SEL-006 suppressed anchor drag does not publish a move preview");

        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_RELEASED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(6.5),
                viewport.sceneToScreenY(4.5),
                false);

        List<String> anchorRowsAfter = runtime.database().corridorAnchorState(mapId);
        assertEquals(anchorRowsBefore, anchorRowsAfter,
                "DE-COR-005 suppressed anchor drag keeps existing A1 anchor coordinates: " + anchorRowsAfter);
        assertEquals(stableRowsBefore, runtime.database().corridorStableConnectionState(mapId),
                "DE-COR-005 keeps stable corridor rows, endpoint refs, waypoints, and topology refs");
        DungeonEditorMapSurfaceSnapshot committedSurface = runtime.mapSurfaceModel().current();
        assertEquals(DungeonEditorPreview.none(), committedSurface.preview(),
                "DE-COR-005 keeps move preview absent after release");
        assertEquals(geometryRowsBefore, runtime.database().countAuthoredGeometryRows(mapId),
                "DE-COR-005 suppressed anchor drag leaves authored DB row count unchanged");
        assertEquals(authoredStateBefore, runtime.database().authoredGeometryState(mapId),
                "DE-COR-005 suppressed anchor drag leaves authored geometry state unchanged");
        assertTrue(committedSurface.surface().map().editorHandles().stream().anyMatch(handle ->
                        handle.ref().topologyRef().equals(corridorAnchor.ref().topologyRef())
                                && handle.cell().q() == 6
                                && handle.cell().r() == 5
                                && handle.cell().level() == 0),
                "DE-COR-005 published passive anchor readback keeps A1 at (6,5,0)");

        results.add("DE-SEL-006 Ready: DungeonMapView corridor anchor ref is not a draggable canvas handle");
        results.add("DE-COR-005 Ready: DungeonMapView suppressed anchor drag leaves SQLite and render unchanged");
    }


    private static void verifyCorridorPointEditThroughStateView(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();
        DungeonEditorStateView stateView = binding.stateView();

        long mapId = createMapThroughControls(controls, runtime, "Corridor State Point Map");
        runtime.database().seedCorridorWithAnchor(mapId);
        createMapThroughControls(controls, runtime, "Corridor State Point Reload Hop");
        selectMap(controls, "Corridor State Point Map");
        click(button(controls, "Auswahl"));
        var corridorAnchor = firstCorridorAnchorHandle(runtime.mapSurfaceModel().current(), "DE-STATE-004");
        Set<Long> existingCorridorIds = runtime.database().corridorIdsForMap(mapId);
        assertEquals(1L, existingCorridorIds.size(), "DE-STATE-004 fixture starts with one authored corridor");
        long existingCorridorId = existingCorridorIds.iterator().next();
        DungeonEditorTopologyElementRef corridorRef =
                corridorAreaById(runtime.mapSurfaceModel().current(), existingCorridorId, "DE-STATE-004")
                        .topologyRef();
        List<String> anchorRowsBefore = runtime.database().corridorAnchorState(mapId);
        List<String> stableRowsBefore = runtime.database().corridorStableConnectionState(mapId);
        String a1AnchorRowBefore = anchorRowsBefore.stream()
                .filter(row -> row.contains("anchor_id=1")
                        && row.contains("cell_x=6")
                        && row.contains("cell_y=5")
                        && row.contains("cell_z=0"))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException(
                        "DE-STATE-004 starts with A1 anchored at (6,5,0): " + anchorRowsBefore));
        String a1AnchorRowAfter = a1AnchorRowBefore.replace("|cell_y=5|", "|cell_y=4|");
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();
        Point2D corridorBody = new Point2D(corridorAnchor.markerQ() + 0.05, corridorAnchor.markerR() + 0.05);

        fireMapMousePressed(
                mapView,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(corridorBody.getX()),
                viewport.sceneToScreenY(corridorBody.getY()),
                false);

        assertEquals(corridorRef, runtime.stateModel().current().selection().topologyRef(),
                "DE-STATE-004 state model selects the corridor body");
        assertEquals(corridorAnchor.ref(), runtime.stateModel().current().selection().handleRef(),
                "DE-STATE-004 state model publishes the focused corridor anchor edit ref");
        TextField qField = textField(stateView, "Korridorpunkt q");
        TextField rField = textField(stateView, "Korridorpunkt r");
        Label levelLabel = label(stateView, "Korridorpunkt z");
        assertEquals("6", qField.getText(), "DE-STATE-004 state panel exposes anchor q");
        assertEquals("5", rField.getText(), "DE-STATE-004 state panel exposes anchor r");
        assertEquals("0", levelLabel.getText(), "DE-STATE-004 state panel displays anchor z");
        assertTrue(!textFieldPresent(stateView, "Korridorpunkt z"),
                "DE-STATE-004 state panel does not expose z as a freeform coordinate field");

        TextField originalQField = qField;
        TextField originalRField = rField;
        qField.setText("");
        rField.setText("");
        qField = textField(stateView, "Korridorpunkt q");
        rField = textField(stateView, "Korridorpunkt r");
        assertTrue(qField != originalQField,
                "DE-STATE-004 projection refresh publishes blank q draft through a fresh field");
        assertTrue(rField != originalRField,
                "DE-STATE-004 projection refresh publishes blank r draft through a fresh field");
        assertEquals("", qField.getText(), "DE-STATE-004 runtime projection publishes blank q draft");
        assertEquals("", rField.getText(), "DE-STATE-004 runtime projection publishes blank r draft");
        ButtonBase moveButton = buttonWithAccessibleText(stateView, "Korridor-Anker verschieben");
        assertTrue(moveButton.isDisabled(), "DE-STATE-004 incomplete blank q/r draft keeps move disabled");
        fireMapMousePressed(
                mapView,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(corridorBody.getX()),
                viewport.sceneToScreenY(corridorBody.getY()),
                false);
        qField = textField(stateView, "Korridorpunkt q");
        rField = textField(stateView, "Korridorpunkt r");
        assertEquals("", qField.getText(), "DE-STATE-004 projection refresh preserves blank q draft");
        assertEquals("", rField.getText(), "DE-STATE-004 projection refresh preserves blank r draft");
        qField.requestFocus();
        qField.replaceSelection("1");
        qField = textField(stateView, "Korridorpunkt q");
        assertTrue(qField.isFocused(), "DE-STATE-004 keeps focus on q after first runtime draft publish");
        assertEquals("1", qField.getText(), "DE-STATE-004 keyboard q draft keeps first typed digit");
        assertEquals(1, qField.getCaretPosition(), "DE-STATE-004 keeps q caret after first typed digit");
        qField.replaceSelection("2");
        qField = textField(stateView, "Korridorpunkt q");
        assertTrue(qField.isFocused(), "DE-STATE-004 keeps focus on q after second runtime draft publish");
        assertEquals("12", qField.getText(), "DE-STATE-004 keyboard q draft keeps multi-digit input");
        assertEquals(2, qField.getCaretPosition(), "DE-STATE-004 keeps q caret after multi-digit input");
        qField.positionCaret(1);
        qField.replaceSelection("3");
        qField = textField(stateView, "Korridorpunkt q");
        assertTrue(qField.isFocused(), "DE-STATE-004 keeps focus on q after middle runtime draft publish");
        assertEquals("132", qField.getText(), "DE-STATE-004 keyboard q draft keeps middle insertion");
        assertEquals(2, qField.getCaretPosition(), "DE-STATE-004 keeps q caret after middle insertion");
        qField.setText("6");
        qField = textField(stateView, "Korridorpunkt q");
        assertTrue(qField.isFocused(), "DE-STATE-004 keeps q focus after correcting draft");
        rField = textField(stateView, "Korridorpunkt r");
        rField.setText("4");
        click(buttonWithAccessibleText(stateView, "Korridor-Anker verschieben"));

        List<String> anchorRowsAfter = runtime.database().corridorAnchorState(mapId);
        assertTrue(anchorRowsAfter.contains(a1AnchorRowAfter),
                "DE-STATE-004 persists existing A1 anchor at (6,4,0): " + anchorRowsAfter);
        assertTrue(!anchorRowsAfter.contains(a1AnchorRowBefore),
                "DE-STATE-004 removes old A1 anchor coordinates after submit: " + anchorRowsAfter);
        assertEquals(anchorRowsBefore.size(), anchorRowsAfter.size(),
                "DE-STATE-004 does not create duplicate corridor anchor rows");
        assertEquals(stableRowsBefore, runtime.database().corridorStableConnectionState(mapId),
                "DE-STATE-004 keeps corridor rows, endpoint refs, waypoints, and topology refs stable");
        DungeonEditorMapSurfaceSnapshot committedSurface = runtime.mapSurfaceModel().current();
        assertEquals(DungeonEditorPreview.none(), committedSurface.preview(),
                "DE-STATE-004 clears move preview after state-panel submit");
        assertEquals(corridorRef, committedSurface.selection().topologyRef(),
                "DE-STATE-004 keeps selection on the corridor topology ref");
        assertTrue(committedSurface.surface().map().editorHandles().stream().anyMatch(handle ->
                        handle.ref().topologyRef().equals(corridorAnchor.ref().topologyRef())
                                && handle.cell().q() == 6
                                && handle.cell().r() == 4
                                && handle.cell().level() == 0),
                "DE-STATE-004 published handle readback moves A1 to (6,4,0)");
        assertTrue(areaCellSet(corridorAreaById(committedSurface, existingCorridorId, "DE-STATE-004"))
                        .contains("6,4,0"),
                "DE-STATE-004 published corridor area includes the edited connection point cell");
        assertTrue(renderSurfaceCellOriginsWithZ(binding.mapContentModel()).contains("6,4,0"),
                "DE-STATE-004 render-facing corridor state includes the edited connection point cell");
        selectMap(controls, "Corridor State Point Reload Hop");
        selectMap(controls, "Corridor State Point Map");
        assertTrue(areaCellSet(corridorAreaById(
                        runtime.mapSurfaceModel().current(),
                        existingCorridorId,
                        "DE-STATE-004 reload")).contains("6,4,0"),
                "DE-STATE-004 reload published corridor area keeps the edited connection point cell");

        results.add("DE-STATE-004 Ready: DungeonEditorStateView corridor point edit -> SQLite anchor move -> render");
    }


    private static void verifyDependentCorridorRouteUpdatesThroughHostAnchorMove(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();
        DungeonEditorStateView stateView = binding.stateView();

        long mapId = createMapThroughControls(controls, runtime, "Corridor Network Host Move Map");
        runtime.database().seedCorridorWithAnchor(mapId);
        createMapThroughControls(controls, runtime, "Corridor Network Host Move Reload Hop");
        selectMap(controls, "Corridor Network Host Move Map");
        long dependentCorridorId = createDependentCorridorFromExistingAnchor(runtime, binding, controls, mapView, mapId);
        DungeonEditorTopologyElementRef anchorRef =
                editorTopologyRef(firstCorridorAnchorHandle(
                        runtime.mapSurfaceModel().current(),
                        "DE-COR-NET dependent").ref().topologyRef());
        assertCorridorAnchorRef(
                runtime.database().corridorStableConnectionState(mapId),
                dependentCorridorId,
                anchorRef.id(),
                "DE-COR-NET dependent corridor starts anchored to host A1");

        click(button(controls, "Auswahl"));
        DungeonEditorHandleSnapshot hostAnchor =
                firstCorridorAnchorHandle(runtime.mapSurfaceModel().current(), "DE-COR-NET host");
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();
        Point2D hostAnchorBody = new Point2D(hostAnchor.markerQ() + 0.05, hostAnchor.markerR() + 0.05);
        fireMapMousePressed(
                mapView,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(hostAnchorBody.getX()),
                viewport.sceneToScreenY(hostAnchorBody.getY()),
                false);

        List<String> stableRowsBeforeMove = runtime.database().corridorStableConnectionState(mapId);
        List<String> anchorRowsBeforeMove = runtime.database().corridorAnchorState(mapId);
        assertTrue(anchorRowsBeforeMove.stream().anyMatch(row ->
                        row.contains("anchor_id=1")
                                && row.contains("cell_x=6")
                                && row.contains("cell_y=5")
                                && row.contains("cell_z=0")),
                "DE-COR-NET starts with host A1 at (6,5,0): " + anchorRowsBeforeMove);
        textField(stateView, "Korridorpunkt q").setText("6");
        textField(stateView, "Korridorpunkt r").setText("4");
        click(buttonWithAccessibleText(stateView, "Korridor-Anker verschieben"));

        List<String> anchorRowsAfterMove = runtime.database().corridorAnchorState(mapId);
        assertTrue(anchorRowsAfterMove.stream().anyMatch(row ->
                        row.contains("anchor_id=1")
                                && row.contains("cell_x=6")
                                && row.contains("cell_y=4")
                                && row.contains("cell_z=0")),
                "DE-COR-NET moves host A1 to (6,4,0): " + anchorRowsAfterMove);
        assertTrue(!anchorRowsAfterMove.equals(anchorRowsBeforeMove),
                "DE-COR-NET host move changes anchor DB rows");
        List<String> stableRowsAfterMove = runtime.database().corridorStableConnectionState(mapId);
        assertCorridorAnchorRef(
                stableRowsAfterMove,
                dependentCorridorId,
                anchorRef.id(),
                "DE-COR-NET preserves dependent anchor ref after host move");
        assertEquals(stableRowsBeforeMove, stableRowsAfterMove,
                "DE-COR-NET keeps stable endpoint refs while the host anchor row carries the movement");
        Set<String> expectedDependentCells = Set.of("4,2,0", "5,2,0", "6,2,0", "6,3,0", "6,4,0");
        DungeonEditorMapSurfaceSnapshot committedSurface = runtime.mapSurfaceModel().current();
        assertCorridorCreatedInSnapshot(
                committedSurface,
                binding.mapContentModel(),
                dependentCorridorId,
                expectedDependentCells,
                "DE-COR-NET moved dependent corridor");
        assertTrue(!areaCellSet(corridorAreaById(committedSurface, dependentCorridorId, "DE-COR-NET moved"))
                        .contains("6,5,0"),
                "DE-COR-NET moved dependent corridor omits stale former anchor cell");
        selectMap(controls, "Corridor Network Host Move Reload Hop");
        selectMap(controls, "Corridor Network Host Move Map");
        assertCorridorCreatedInSnapshot(
                runtime.mapSurfaceModel().current(),
                binding.mapContentModel(),
                dependentCorridorId,
                expectedDependentCells,
                "DE-COR-NET moved dependent corridor reload");
        assertCorridorAnchorRef(
                runtime.database().corridorStableConnectionState(mapId),
                dependentCorridorId,
                anchorRef.id(),
                "DE-COR-NET reload preserves dependent anchor ref");

        results.add("DE-COR-015 Ready: host corridor anchor move updates dependent corridor route, SQLite, render, reload");
    }


    private static long createDependentCorridorFromExistingAnchor(
            HarnessRuntime runtime,
            HarnessBinding binding,
            DungeonEditorControlsView controls,
            DungeonMapView mapView,
            long mapId
    ) {
        Set<Long> corridorIdsBefore = runtime.database().corridorIdsForMap(mapId);
        Point2D genericCorridorPoint = new Point2D(6.05, 5.05);
        Point2D doorOne = boundaryMidpointNear(binding.mapContentModel(), "DOOR", 4.0, 2.5);
        AuthoredCorridorState beforeFirstClick = AuthoredCorridorState.capture(runtime, binding, mapId);
        click(button(controls, "Korridor"));
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();

        fireMapMousePressed(mapView, MouseButton.PRIMARY,
                viewport.sceneToScreenX(genericCorridorPoint.getX()),
                viewport.sceneToScreenY(genericCorridorPoint.getY()),
                false);
        assertFirstClickDraftOnly(
                beforeFirstClick,
                runtime,
                binding,
                mapId,
                "DE-COR-NET dependent first click");
        fireMapMouse(mapView, MouseEvent.MOUSE_MOVED, MouseButton.NONE,
                viewport.sceneToScreenX(doorOne.getX()), viewport.sceneToScreenY(doorOne.getY()), false);
        assertVisibleCorridorPreview(
                runtime,
                binding,
                Set.of("4,2,0", "5,2,0", "6,2,0", "6,3,0", "6,4,0", "6,5,0"),
                "DE-COR-NET dependent hover");
        fireMapMousePressed(mapView, MouseButton.PRIMARY,
                viewport.sceneToScreenX(doorOne.getX()), viewport.sceneToScreenY(doorOne.getY()), false);

        long dependentCorridorId = singleNewCorridorId(
                corridorIdsBefore,
                runtime.database().corridorIdsForMap(mapId),
                "DE-COR-NET dependent");
        assertCorridorCreatedInSnapshot(
                runtime.mapSurfaceModel().current(),
                binding.mapContentModel(),
                dependentCorridorId,
                Set.of("4,2,0", "5,2,0", "6,2,0", "6,3,0", "6,4,0", "6,5,0"),
                "DE-COR-NET dependent created");
        return dependentCorridorId;
    }

    private static void verifyDependentCorridorRouteUpdatesThroughWholeClusterMove(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();

        long mapId = createMapThroughControls(controls, runtime, "Cluster Corridor Move Map");
        runtime.database().seedCorridorWithAnchor(mapId);
        createMapThroughControls(controls, runtime, "Cluster Corridor Move Reload Hop");
        selectMap(controls, "Cluster Corridor Move Map");
        long dependentCorridorId = createDependentCorridorFromExistingAnchor(runtime, binding, controls, mapView, mapId);
        RoomClusterIds movedRoomIds = runtime.database().roomByName(mapId, "R1");
        List<String> anchorRowsBeforeMove = runtime.database().corridorAnchorState(mapId);
        List<String> stableRowsBeforeMove = runtime.database().corridorStableConnectionState(mapId);
        List<String> authoredStateBeforeMove = runtime.database().authoredGeometryState(mapId);
        long geometryRowsBeforeMove = runtime.database().countAuthoredGeometryRows(mapId);
        click(button(controls, "Auswahl"));
        DungeonEditorHandleSnapshot clusterLabel = runtime.mapSurfaceModel().current().surface().map().editorHandles().stream()
                .filter(handle -> "CLUSTER_LABEL".equals(handle.ref().kind().name()))
                .filter(handle -> handle.ref().clusterId() == movedRoomIds.clusterId())
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("DE-CLUSTER-COR-001 cluster label not loaded."));
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();
        double clusterLabelQ = clusterLabel.cell().q() + 0.5;
        double clusterLabelR = clusterLabel.cell().r() + 0.5;

        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_PRESSED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(clusterLabelQ),
                viewport.sceneToScreenY(clusterLabelR),
                false);
        assertTrue(runtime.stateModel().current().selection().clusterSelection(),
                "DE-CLUSTER-COR-001 cluster label drag starts from cluster selection");
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_DRAGGED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(clusterLabelQ + 2.0),
                viewport.sceneToScreenY(clusterLabelR),
                false);

        assertEquals(anchorRowsBeforeMove, runtime.database().corridorAnchorState(mapId),
                "DE-CLUSTER-COR-001 cluster drag preview leaves corridor anchor rows unchanged");
        assertEquals(stableRowsBeforeMove, runtime.database().corridorStableConnectionState(mapId),
                "DE-CLUSTER-COR-001 cluster drag preview leaves stable corridor rows unchanged");
        assertEquals(authoredStateBeforeMove, runtime.database().authoredGeometryState(mapId),
                "DE-CLUSTER-COR-001 cluster drag preview leaves authored geometry unchanged");

        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_RELEASED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(clusterLabelQ + 2.0),
                viewport.sceneToScreenY(clusterLabelR),
                false);

        assertEquals(movedRoomIds.clusterId(), runtime.database().clusterIdByCenter(mapId, 4, 2, 0),
                "DE-CLUSTER-COR-001 cluster move persists translated cluster center at (4,2,0)");
        List<String> anchorRowsAfterMove = runtime.database().corridorAnchorState(mapId);
        assertTrue(anchorRowsAfterMove.stream().anyMatch(row ->
                        row.contains("anchor_id=1")
                                && row.contains("cell_x=6")
                                && row.contains("cell_y=4")
                                && row.contains("cell_z=0")),
                "DE-CLUSTER-COR-001 cluster move updates host A1 to (6,4,0): " + anchorRowsAfterMove);
        assertTrue(!anchorRowsAfterMove.stream().anyMatch(row ->
                        row.contains("anchor_id=1")
                                && row.contains("cell_x=6")
                                && row.contains("cell_y=5")
                                && row.contains("cell_z=0")),
                "DE-CLUSTER-COR-001 cluster move removes stale host A1 at (6,5,0): " + anchorRowsAfterMove);
        assertEquals(geometryRowsBeforeMove, runtime.database().countAuthoredGeometryRows(mapId),
                "DE-CLUSTER-COR-001 cluster move keeps authored DB row count stable");
        List<String> stableRowsAfterMove = runtime.database().corridorStableConnectionState(mapId);
        DungeonEditorMapSurfaceSnapshot committedSurface = runtime.mapSurfaceModel().current();
        assertCorridorCreatedInSnapshot(
                committedSurface,
                binding.mapContentModel(),
                dependentCorridorId,
                Set.of("6,2,0", "6,3,0", "6,4,0"),
                "DE-CLUSTER-COR-001 moved dependent corridor");
        assertTrue(!areaCellSet(corridorAreaById(committedSurface, dependentCorridorId, "DE-CLUSTER-COR-001 moved"))
                        .contains("6,5,0"),
                "DE-CLUSTER-COR-001 moved dependent corridor omits stale former anchor cell");
        assertTrue(stableRowsAfterMove.equals(stableRowsBeforeMove),
                "DE-CLUSTER-COR-001 keeps stable endpoint refs after cluster move");
        selectMap(controls, "Cluster Corridor Move Reload Hop");
        selectMap(controls, "Cluster Corridor Move Map");
        assertCorridorCreatedInSnapshot(
                runtime.mapSurfaceModel().current(),
                binding.mapContentModel(),
                dependentCorridorId,
                Set.of("6,2,0", "6,3,0", "6,4,0"),
                "DE-CLUSTER-COR-001 moved dependent corridor reload");

        results.add("DE-COR-016 Ready: whole-cluster move updates dependent corridor route, SQLite, render, reload");
    }


    private static void verifyDoorToDoorVerticalFallbackCorridorCreateThroughMapView(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();

        long mapId = createMapThroughControls(controls, runtime, "Corridor Vertical Fallback Map");
        runtime.database().seedVerticalFallbackCorridorRouteTarget(mapId);
        createMapThroughControls(controls, runtime, "Corridor Vertical Fallback Reload Hop");
        selectMap(controls, "Corridor Vertical Fallback Map");
        Set<Long> corridorIdsBefore = runtime.database().corridorIdsForMap(mapId);
        List<String> doorRowsBefore = runtime.database().doorBoundaryState(mapId);
        click(button(controls, "Korridor"));
        Point2D doorOne = boundaryMidpointNear(binding.mapContentModel(), "DOOR", 4.0, 2.5);
        Point2D doorTwo = boundaryMidpointNear(binding.mapContentModel(), "DOOR", 10.0, 7.5);
        assertPointerTarget(binding.mapContentModel(), doorOne, "HANDLE", "DE-COR-014 first door");
        assertPointerTarget(binding.mapContentModel(), doorTwo, "HANDLE", "DE-COR-014 second door");
        AuthoredCorridorState beforeFirstClick = AuthoredCorridorState.capture(runtime, binding, mapId);
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();

        clickMap(mapView, MouseButton.PRIMARY,
                viewport.sceneToScreenX(doorOne.getX()), viewport.sceneToScreenY(doorOne.getY()), false);
        assertFirstClickDraftOnly(beforeFirstClick, runtime, binding, mapId, "DE-COR-014 first explicit door click");
        fireMapMouse(mapView, MouseEvent.MOUSE_MOVED, MouseButton.NONE,
                viewport.sceneToScreenX(doorTwo.getX()), viewport.sceneToScreenY(doorTwo.getY()), false);
        Set<String> expectedCells = Set.of(
                "4,2,0",
                "4,3,0",
                "4,4,0",
                "4,5,0",
                "4,6,0",
                "4,7,0",
                "5,7,0",
                "6,7,0",
                "7,7,0",
                "8,7,0",
                "9,7,0");
        assertVisibleCorridorPreview(runtime, binding, expectedCells, "DE-COR-014 hover");
        assertPointerTarget(binding.mapContentModel(), doorTwo, "HANDLE",
                "DE-COR-014 hover keeps committed second door target authoritative");
        clickMap(mapView, MouseButton.PRIMARY,
                viewport.sceneToScreenX(doorTwo.getX()), viewport.sceneToScreenY(doorTwo.getY()), false);

        long newCorridorId = singleNewCorridorId(corridorIdsBefore, runtime.database().corridorIdsForMap(mapId),
                "DE-COR-014");
        assertCorridorDoorBindingCount(runtime.database().corridorStableConnectionState(mapId), newCorridorId, 2,
                "DE-COR-014");
        assertEquals(doorRowsBefore, runtime.database().doorBoundaryState(mapId),
                "DE-COR-014 reuses explicit door endpoint identities without creating boundary rows");
        assertCorridorCreatedInSnapshot(
                runtime.mapSurfaceModel().current(),
                binding.mapContentModel(),
                newCorridorId,
                expectedCells,
                "DE-COR-014");
        Point2D fallbackCorridorBody = new Point2D(4.05, 5.05);
        assertPointerTarget(binding.mapContentModel(), fallbackCorridorBody, "CELL", "DE-COR-014 fallback body");
        assertEquals("CORRIDOR", binding.mapContentModel()
                        .resolvePointerTarget(fallbackCorridorBody.getX(), fallbackCorridorBody.getY())
                        .elementKind(),
                "DE-COR-014 fallback body remains a semantic corridor target");
        selectMap(controls, "Corridor Vertical Fallback Reload Hop");
        selectMap(controls, "Corridor Vertical Fallback Map");
        assertCorridorCreatedInSnapshot(
                runtime.mapSurfaceModel().current(),
                binding.mapContentModel(),
                newCorridorId,
                expectedCells,
                "DE-COR-014 reload");
        assertPointerTarget(binding.mapContentModel(), fallbackCorridorBody, "CELL",
                "DE-COR-014 reload fallback body");
        assertEquals("CORRIDOR", binding.mapContentModel()
                        .resolvePointerTarget(fallbackCorridorBody.getX(), fallbackCorridorBody.getY())
                        .elementKind(),
                "DE-COR-014 reload fallback body remains a semantic corridor target");

        results.add("DE-COR-014 Ready: horizontal-blocked door corridor uses vertical fallback -> SQLite -> render");
    }

    private static void verifyCorridorSplitAtCrossingThroughMapView(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();

        long mapId = createMapThroughControls(controls, runtime, "Corridor Crossing Split Map");
        runtime.database().seedCorridorSplitRouteTarget(mapId);
        createMapThroughControls(controls, runtime, "Corridor Crossing Split Reload Hop");
        selectMap(controls, "Corridor Crossing Split Map");
        Set<Long> corridorIdsBefore = runtime.database().corridorIdsForMap(mapId);
        List<String> anchorRowsBefore = runtime.database().corridorAnchorState(mapId);
        long crossingAnchorTopologyId = singleAnchorTopologyIdAt(anchorRowsBefore, 6, 5, 0, "DE-COR-004");
        Point2D doorOne = boundaryMidpointNear(binding.mapContentModel(), "DOOR", 4.0, 2.5);
        Point2D doorThree = boundaryMidpointNear(binding.mapContentModel(), "DOOR", 6.5, 9.0);
        click(button(controls, "Korridor"));
        assertEquals("CORRIDOR_CREATE", runtime.controlsModel().current().selectedTool().name(),
                "DE-COR-004 corridor family selects corridor-create tool");
        assertPointerTarget(binding.mapContentModel(), doorOne, "HANDLE", "DE-COR-004 D1");
        assertPointerTarget(binding.mapContentModel(), doorThree, "HANDLE", "DE-COR-004 D3");
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();

        fireMapMousePressed(mapView, MouseButton.PRIMARY,
                viewport.sceneToScreenX(doorOne.getX()), viewport.sceneToScreenY(doorOne.getY()), false);
        fireMapMouse(mapView, MouseEvent.MOUSE_MOVED, MouseButton.NONE,
                viewport.sceneToScreenX(doorThree.getX()), viewport.sceneToScreenY(doorThree.getY()), false);
        Set<String> expectedCells = Set.of(
                "4,2,0",
                "5,2,0",
                "6,2,0",
                "6,3,0",
                "6,4,0",
                "6,5,0",
                "6,6,0",
                "6,7,0",
                "6,8,0");
        assertVisibleCorridorPreview(runtime, binding, expectedCells, "DE-COR-004 hover");
        fireMapMousePressed(mapView, MouseButton.PRIMARY,
                viewport.sceneToScreenX(doorThree.getX()), viewport.sceneToScreenY(doorThree.getY()), false);

        long newCorridorId = singleNewCorridorId(corridorIdsBefore, runtime.database().corridorIdsForMap(mapId),
                "DE-COR-004");
        List<String> anchorRowsAfter = runtime.database().corridorAnchorState(mapId);
        assertEquals(anchorRowsBefore, anchorRowsAfter,
                "DE-COR-004 reuses A1 and creates no extra authored anchors inside straight spans");
        assertEquals(1L, runtime.database().countCorridorAnchorsAt(mapId, 6, 5, 0),
                "DE-COR-004 keeps exactly one authored anchor at the crossing split");
        List<String> stableState = runtime.database().corridorStableConnectionState(mapId);
        assertCorridorDoorBindingCount(stableState, newCorridorId, 2, "DE-COR-004");
        assertCorridorAnchorRef(stableState, newCorridorId, crossingAnchorTopologyId, "DE-COR-004");
        assertOnlyCorridorWaypointAt(runtime.database().corridorWaypointAbsoluteState(mapId), newCorridorId, 6, 5, 0,
                "DE-COR-004");
        assertCorridorCreatedInSnapshot(
                runtime.mapSurfaceModel().current(),
                binding.mapContentModel(),
                newCorridorId,
                expectedCells,
                "DE-COR-004");
        assertCorridorAnchorHandleAt(runtime.mapSurfaceModel().current(), 6, 5, 0, "DE-COR-004");
        assertOnlyCorridorWaypointHandleAt(runtime.mapSurfaceModel().current(), newCorridorId, 6, 5, 0, "DE-COR-004");
        selectMap(controls, "Corridor Crossing Split Reload Hop");
        selectMap(controls, "Corridor Crossing Split Map");
        assertCorridorCreatedInSnapshot(
                runtime.mapSurfaceModel().current(),
                binding.mapContentModel(),
                newCorridorId,
                expectedCells,
                "DE-COR-004 reload");
        assertOnlyCorridorWaypointAt(runtime.database().corridorWaypointAbsoluteState(mapId), newCorridorId, 6, 5, 0,
                "DE-COR-004 reload");

        results.add("DE-COR-004 Ready: deterministic corridor crossing split reuses A1 through SQLite/readback/render");
    }


    private static void verifyCorridorConnectionPointDeleteThroughMapView(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();

        long mapId = createMapThroughControls(controls, runtime, "Corridor Point Delete Map");
        runtime.database().seedCorridorWithAnchor(mapId);
        createMapThroughControls(controls, runtime, "Corridor Point Delete Reload Hop");
        selectMap(controls, "Corridor Point Delete Map");
        var anchorHandle = firstCorridorAnchorHandle(runtime.mapSurfaceModel().current(), "DE-COR-006");
        long corridorId = anchorHandle.ref().corridorId();
        DungeonEditorTopologyElementRef anchorRef = editorTopologyRef(anchorHandle.ref().topologyRef());
        Point2D anchorCenter = new Point2D(anchorHandle.markerQ() + 0.05, anchorHandle.markerR() + 0.05);
        assertEquals("CELL", binding.mapContentModel()
                        .resolvePointerTarget(anchorCenter.getX(), anchorCenter.getY())
                        .targetKind()
                        .name(),
                "DE-COR-006 existing anchor delete uses a corridor body point, not a rendered anchor handle");
        assertEquals(1L, runtime.database().countCorridorAnchorsAt(mapId, 6, 5, 0),
                "DE-COR-006 fixture starts with authored A1 at (6,5,0)");
        click(button(controls, "Korridor"));
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();

        clickMap(
                mapView,
                MouseButton.SECONDARY,
                viewport.sceneToScreenX(anchorCenter.getX()),
                viewport.sceneToScreenY(anchorCenter.getY()),
                false);

        assertCorridorDoorBindingCount(runtime.database().corridorStableConnectionState(mapId), corridorId, 2,
                "DE-COR-006 keeps both surviving door endpoints");
        assertNoCorridorAnchorRef(runtime.database().corridorStableConnectionState(mapId), corridorId, anchorRef.id(),
                "DE-COR-006 removes stale A1 anchor ref");
        assertNoCorridorWaypoints(runtime.database().corridorWaypointAbsoluteState(mapId), corridorId,
                "DE-COR-006 removes authored waypoints for deterministic reroute");
        assertEquals(0L, runtime.database().countCorridorAnchorsAt(mapId, 6, 5, 0),
                "DE-COR-006 prunes unreferenced authored A1");
        Set<String> expectedCells = Set.of("4,2,0", "5,2,0", "6,2,0", "7,2,0");
        DungeonEditorMapSurfaceSnapshot committedSurface = runtime.mapSurfaceModel().current();
        assertEmptySelection(committedSurface.selection(), "DE-COR-006 committed surface");
        assertCorridorCreatedInSnapshot(committedSurface, binding.mapContentModel(), corridorId, expectedCells,
                "DE-COR-006");
        assertTrue(committedSurface.surface().map().editorHandles().stream().noneMatch(handle ->
                        handle.ref().topologyRef().equals(anchorHandle.ref().topologyRef())),
                "DE-COR-006 published snapshot omits stale A1 handle");
        assertTrue(!renderHasGlyphAt(binding.mapContentModel(), anchorRef, 6.5, 5.5, false),
                "DE-COR-006 render omits stale A1 marker");

        selectMap(controls, "Corridor Point Delete Reload Hop");
        selectMap(controls, "Corridor Point Delete Map");
        assertCorridorCreatedInSnapshot(runtime.mapSurfaceModel().current(), binding.mapContentModel(), corridorId,
                expectedCells, "DE-COR-006 reload");
        assertNoCorridorWaypoints(runtime.database().corridorWaypointAbsoluteState(mapId), corridorId,
                "DE-COR-006 reload");

        results.add("DE-COR-006 Ready: DungeonEditorControlsView Korridor -> DungeonMapView secondary A1 delete"
                + " -> SQLite reroute -> snapshot/render");
    }


    private static void verifyCorridorDoorConnectionDeleteThroughMapView(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();

        long mapId = createMapThroughControls(controls, runtime, "Corridor Door Delete Map");
        runtime.database().seedCorridorWithAnchor(mapId);
        createMapThroughControls(controls, runtime, "Corridor Door Delete Reload Hop");
        selectMap(controls, "Corridor Door Delete Map");
        var doorHandle = firstDoorHandleAt(runtime.mapSurfaceModel().current(), 4, 2, 0, "DE-COR-007 D1");
        long corridorId = doorHandle.ref().corridorId();
        DungeonEditorTopologyElementRef doorRef = editorTopologyRef(doorHandle.ref().topologyRef());
        DungeonEditorTopologyElementRef anchorRef =
                editorTopologyRef(firstCorridorAnchorHandle(runtime.mapSurfaceModel().current(), "DE-COR-007")
                        .ref().topologyRef());
        Point2D doorCenter = boundaryMidpointNear(binding.mapContentModel(), "DOOR", 4.0, 2.5);
        click(button(controls, "Korridor"));
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();

        clickMap(
                mapView,
                MouseButton.SECONDARY,
                viewport.sceneToScreenX(doorCenter.getX()),
                viewport.sceneToScreenY(doorCenter.getY()),
                false);

        List<String> stableState = runtime.database().corridorStableConnectionState(mapId);
        assertCorridorDoorBindingCount(stableState, corridorId, 1, "DE-COR-007 keeps one surviving door endpoint");
        assertNoCorridorDoorBinding(stableState, corridorId, doorRef.id(), "DE-COR-007 removes D1 door binding");
        assertCorridorAnchorRef(stableState, corridorId, anchorRef.id(), "DE-COR-007 preserves A1 anchor ref");
        assertEquals(1L, runtime.database().countCorridorAnchorsAt(mapId, 6, 5, 0),
                "DE-COR-007 preserves authored A1");
        Set<String> expectedCells = Set.of("6,5,0", "7,2,0", "7,3,0", "7,4,0", "7,5,0");
        DungeonEditorMapSurfaceSnapshot committedSurface = runtime.mapSurfaceModel().current();
        assertEmptySelection(committedSurface.selection(), "DE-COR-007 committed surface");
        assertCorridorCreatedInSnapshot(committedSurface, binding.mapContentModel(), corridorId, expectedCells,
                "DE-COR-007");
        assertDisjoint(areaCellSet(corridorAreaById(committedSurface, corridorId, "DE-COR-007")),
                Set.of("4,2,0", "5,2,0", "6,2,0"),
                "DE-COR-007 committed corridor omits removed D1 branch");

        selectMap(controls, "Corridor Door Delete Reload Hop");
        selectMap(controls, "Corridor Door Delete Map");
        assertCorridorCreatedInSnapshot(runtime.mapSurfaceModel().current(), binding.mapContentModel(), corridorId,
                expectedCells, "DE-COR-007 reload");
        assertNoCorridorDoorBinding(runtime.database().corridorStableConnectionState(mapId), corridorId, doorRef.id(),
                "DE-COR-007 reload");

        results.add("DE-COR-007 Ready: DungeonEditorControlsView Korridor -> DungeonMapView secondary D1 delete"
                + " -> SQLite branch removal -> snapshot/render");
    }


    private static void verifyGenericCorridorHitReusesAnchorEndpointThroughMapView() {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();

        long mapId = createMapThroughControls(controls, runtime, "Corridor Generic Anchor Map");
        runtime.database().seedCorridorWithAnchor(mapId);
        createMapThroughControls(controls, runtime, "Corridor Generic Anchor Reload Hop");
        selectMap(controls, "Corridor Generic Anchor Map");
        Set<Long> corridorIdsBefore = runtime.database().corridorIdsForMap(mapId);
        List<String> anchorRowsBefore = runtime.database().corridorAnchorState(mapId);
        DungeonEditorTopologyElementRef anchorRef =
                editorTopologyRef(firstCorridorAnchorHandle(
                        runtime.mapSurfaceModel().current(),
                        "DE-COR-013 existing-anchor").ref().topologyRef());
        Point2D genericCorridorPoint = new Point2D(6.05, 5.05);
        Point2D doorOne = boundaryMidpointNear(binding.mapContentModel(), "DOOR", 4.0, 2.5);
        click(button(controls, "Korridor"));
        assertEquals("CORRIDOR_CREATE", runtime.controlsModel().current().selectedTool().name(),
                "DE-COR-013 existing-anchor corridor family selects corridor-create tool");
        assertPointerTarget(
                binding.mapContentModel(),
                genericCorridorPoint,
                "CELL",
                "DE-COR-013 existing-anchor corridor body");
        assertEquals("CORRIDOR", binding.mapContentModel()
                        .resolvePointerTarget(genericCorridorPoint.getX(), genericCorridorPoint.getY())
                        .elementKind(),
                "DE-COR-013 existing-anchor body hit resolves as a generic corridor cell instead of the anchor handle");
        AuthoredCorridorState beforeFirstClick = AuthoredCorridorState.capture(runtime, binding, mapId);
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();

        fireMapMousePressed(mapView, MouseButton.PRIMARY,
                viewport.sceneToScreenX(genericCorridorPoint.getX()),
                viewport.sceneToScreenY(genericCorridorPoint.getY()),
                false);
        assertFirstClickDraftOnly(
                beforeFirstClick,
                runtime,
                binding,
                mapId,
                "DE-COR-013 generic corridor existing-anchor first click");
        fireMapMouse(mapView, MouseEvent.MOUSE_MOVED, MouseButton.NONE,
                viewport.sceneToScreenX(doorOne.getX()), viewport.sceneToScreenY(doorOne.getY()), false);
        assertVisibleCorridorPreview(
                runtime,
                binding,
                Set.of("4,2,0", "5,2,0", "6,2,0", "6,3,0", "6,4,0", "6,5,0"),
                "DE-COR-013 existing-anchor hover");
        assertHoverKeepsCommittedCorridorState(
                beforeFirstClick,
                runtime,
                binding,
                mapId,
                "DE-COR-013 existing-anchor hover");
        fireMapMousePressed(mapView, MouseButton.PRIMARY,
                viewport.sceneToScreenX(doorOne.getX()), viewport.sceneToScreenY(doorOne.getY()), false);

        long newCorridorId = singleNewCorridorId(corridorIdsBefore, runtime.database().corridorIdsForMap(mapId),
                "DE-COR-013 existing-anchor");
        List<String> stableState = runtime.database().corridorStableConnectionState(mapId);
        assertCorridorDoorBindingCount(stableState, newCorridorId, 1, "DE-COR-013 existing-anchor");
        assertCorridorAnchorRef(stableState, newCorridorId, anchorRef.id(), "DE-COR-013 existing-anchor");
        assertEquals(anchorRowsBefore, runtime.database().corridorAnchorState(mapId),
                "DE-COR-013 existing-anchor generic body hit reuses exact A1 and creates no duplicate anchor row");
        assertCorridorCreatedInSnapshot(
                runtime.mapSurfaceModel().current(),
                binding.mapContentModel(),
                newCorridorId,
                Set.of("4,2,0", "5,2,0", "6,2,0", "6,3,0", "6,4,0", "6,5,0"),
                "DE-COR-013 existing-anchor");
        selectMap(controls, "Corridor Generic Anchor Reload Hop");
        selectMap(controls, "Corridor Generic Anchor Map");
        assertCorridorCreatedInSnapshot(
                runtime.mapSurfaceModel().current(),
                binding.mapContentModel(),
                newCorridorId,
                Set.of("4,2,0", "5,2,0", "6,2,0", "6,3,0", "6,4,0", "6,5,0"),
                "DE-COR-013 existing-anchor reload");

    }


    private static void verifyGenericCorridorHitMaterializesAbsentAnchorEndpointThroughMapView() {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();

        long mapId = createMapThroughControls(controls, runtime, "Corridor Absent Anchor Map");
        runtime.database().seedCorridorWithAnchor(mapId);
        createMapThroughControls(controls, runtime, "Corridor Absent Anchor Reload Hop");
        selectMap(controls, "Corridor Absent Anchor Map");
        Set<Long> corridorIdsBefore = runtime.database().corridorIdsForMap(mapId);
        List<String> anchorRowsBefore = runtime.database().corridorAnchorState(mapId);
        Point2D genericCorridorPoint = new Point2D(6.05, 4.05);
        Point2D doorOne = boundaryMidpointNear(binding.mapContentModel(), "DOOR", 4.0, 2.5);
        click(button(controls, "Korridor"));
        assertEquals("CORRIDOR_CREATE", runtime.controlsModel().current().selectedTool().name(),
                "DE-COR-013 new-anchor corridor family selects corridor-create tool");
        assertPointerTarget(
                binding.mapContentModel(),
                genericCorridorPoint,
                "CELL",
                "DE-COR-013 new-anchor corridor body");
        assertEquals("CORRIDOR", binding.mapContentModel()
                        .resolvePointerTarget(genericCorridorPoint.getX(), genericCorridorPoint.getY())
                        .elementKind(),
                "DE-COR-013 new-anchor body hit resolves as a generic corridor cell instead of an anchor handle");
        AuthoredCorridorState beforeFirstClick = AuthoredCorridorState.capture(runtime, binding, mapId);
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();

        fireMapMousePressed(mapView, MouseButton.PRIMARY,
                viewport.sceneToScreenX(genericCorridorPoint.getX()),
                viewport.sceneToScreenY(genericCorridorPoint.getY()),
                false);
        assertFirstClickDraftOnly(
                beforeFirstClick,
                runtime,
                binding,
                mapId,
                "DE-COR-013 generic corridor absent-anchor first click");
        fireMapMouse(mapView, MouseEvent.MOUSE_MOVED, MouseButton.NONE,
                viewport.sceneToScreenX(doorOne.getX()), viewport.sceneToScreenY(doorOne.getY()), false);
        assertVisibleCorridorPreview(
                runtime,
                binding,
                Set.of("4,2,0", "5,2,0", "6,2,0", "6,3,0", "6,4,0"),
                "DE-COR-013 new-anchor hover");
        assertHoverKeepsCommittedCorridorState(
                beforeFirstClick,
                runtime,
                binding,
                mapId,
                "DE-COR-013 new-anchor hover");
        fireMapMousePressed(mapView, MouseButton.PRIMARY,
                viewport.sceneToScreenX(doorOne.getX()), viewport.sceneToScreenY(doorOne.getY()), false);

        long newCorridorId = singleNewCorridorId(corridorIdsBefore, runtime.database().corridorIdsForMap(mapId),
                "DE-COR-013 new-anchor");
        List<String> anchorRowsAfter = runtime.database().corridorAnchorState(mapId);
        assertEquals(anchorRowsBefore.size() + 1L, anchorRowsAfter.size(),
                "DE-COR-013 new-anchor materializes exactly one additional corridor anchor row");
        long materializedAnchorRef = singleNewAnchorTopologyId(
                anchorRowsBefore,
                anchorRowsAfter,
                "DE-COR-013 new-anchor");
        assertTrue(anchorRowsAfter.stream().anyMatch(row ->
                        row.contains("host_corridor_id=1")
                                && row.contains("cell_x=6")
                                && row.contains("cell_y=4")
                                && row.contains("cell_z=0")
                                && row.contains("topology_element_id=" + materializedAnchorRef)),
                "DE-COR-013 new-anchor materialized anchor is owned by K1 at (6,4,0): " + anchorRowsAfter);
        List<String> stableState = runtime.database().corridorStableConnectionState(mapId);
        assertCorridorDoorBindingCount(stableState, newCorridorId, 1, "DE-COR-013 new-anchor");
        assertCorridorAnchorRef(stableState, newCorridorId, materializedAnchorRef, "DE-COR-013 new-anchor");
        assertCorridorCreatedInSnapshot(
                runtime.mapSurfaceModel().current(),
                binding.mapContentModel(),
                newCorridorId,
                Set.of("4,2,0", "5,2,0", "6,2,0", "6,3,0", "6,4,0"),
                "DE-COR-013 new-anchor");
        assertTrue(runtime.mapSurfaceModel().current().surface().map().editorHandles().stream()
                        .anyMatch(handle -> "CORRIDOR_ANCHOR".equals(handle.ref().kind().name())
                                && handle.ref().topologyRef().id() == materializedAnchorRef
                                && handle.cell().q() == 6
                                && handle.cell().r() == 4
                                && handle.cell().level() == 0),
                "DE-COR-013 new-anchor published snapshot exposes the new anchor handle at (6,4,0)");
        selectMap(controls, "Corridor Absent Anchor Reload Hop");
        selectMap(controls, "Corridor Absent Anchor Map");
        assertCorridorCreatedInSnapshot(
                runtime.mapSurfaceModel().current(),
                binding.mapContentModel(),
                newCorridorId,
                Set.of("4,2,0", "5,2,0", "6,2,0", "6,3,0", "6,4,0"),
                "DE-COR-013 new-anchor reload");
        assertTrue(runtime.mapSurfaceModel().current().surface().map().editorHandles().stream()
                        .anyMatch(handle -> "CORRIDOR_ANCHOR".equals(handle.ref().kind().name())
                                && handle.ref().topologyRef().id() == materializedAnchorRef
                                && handle.cell().q() == 6
                                && handle.cell().r() == 4
                                && handle.cell().level() == 0),
                "DE-COR-013 new-anchor reload published snapshot preserves the materialized anchor topology identity");

    }


    private static void verifyInvalidCorridorRouteRejectedThroughMapView(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();

        long mapId = createMapThroughControls(controls, runtime, "Corridor Blocked Route Map");
        runtime.database().seedBlockedCorridorRouteTarget(mapId);
        createMapThroughControls(controls, runtime, "Corridor Blocked Route Reload Hop");
        selectMap(controls, "Corridor Blocked Route Map");
        List<String> authoredStateBefore = runtime.database().authoredGeometryState(mapId);
        Set<Long> corridorIdsBefore = runtime.database().corridorIdsForMap(mapId);
        Set<String> renderCellsBefore = renderSurfaceCellOriginsWithZ(binding.mapContentModel());
        click(button(controls, "Korridor"));
        Point2D westWall = boundaryMidpointNear(binding.mapContentModel(), "WALL", 0.0, 2.5);
        Point2D eastWall = boundaryMidpointNear(binding.mapContentModel(), "WALL", 5.0, 2.5);
        assertPointerTarget(binding.mapContentModel(), westWall, "BOUNDARY", "DE-COR-008 west endpoint");
        assertPointerTarget(binding.mapContentModel(), eastWall, "BOUNDARY", "DE-COR-008 east endpoint");
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();

        fireMapMousePressed(mapView, MouseButton.PRIMARY,
                viewport.sceneToScreenX(westWall.getX()), viewport.sceneToScreenY(westWall.getY()), false);
        fireMapMouse(mapView, MouseEvent.MOUSE_MOVED, MouseButton.NONE,
                viewport.sceneToScreenX(eastWall.getX()), viewport.sceneToScreenY(eastWall.getY()), false);
        assertEquals(DungeonEditorPreview.none(), runtime.mapSurfaceModel().current().preview(),
                "DE-COR-008 invalid candidate does not publish a corridor preview");
        fireMapMousePressed(mapView, MouseButton.PRIMARY,
                viewport.sceneToScreenX(eastWall.getX()), viewport.sceneToScreenY(eastWall.getY()), false);

        assertEquals(corridorIdsBefore, runtime.database().corridorIdsForMap(mapId),
                "DE-COR-008 invalid route creates no corridor row");
        assertEquals(authoredStateBefore, runtime.database().authoredGeometryState(mapId),
                "DE-COR-008 invalid route leaves authored DB state unchanged");
        assertEquals(DungeonEditorPreview.none(), runtime.mapSurfaceModel().current().preview(),
                "DE-COR-008 invalid route clears published preview state");
        assertTrue(runtime.controlsModel().current().statusText().contains("blockiert"),
                "DE-COR-008 status reports route rejection");
        assertEquals(0L, runtime.mapSurfaceModel().current().surface().map().areas().stream()
                        .filter(area -> "CORRIDOR".equalsIgnoreCase(area.kind()))
                        .count(),
                "DE-COR-008 publishes no committed corridor area");
        assertEquals(renderCellsBefore, renderSurfaceCellOriginsWithZ(binding.mapContentModel()),
                "DE-COR-008 render-facing cell state remains unchanged");

        results.add("DE-COR-008 Ready: DungeonMapView blocked corridor route -> rejected without side effects");
    }


    private static void verifyGenericEndpointMaterializesOnlyAtFullCommitThroughMapView(List<String> results) {
        verifyGenericRoomHitMaterializesFacingDoorThroughMapView();
        verifyGenericCorridorHitReusesAnchorEndpointThroughMapView();
        verifyGenericCorridorHitMaterializesAbsentAnchorEndpointThroughMapView();
        results.add("DE-COR-013 Ready: DungeonMapView generic room/corridor endpoints -> no first-click"
                + " materialization, atomic successful commit, SQLite readback, topology identity, and render");
    }

    private static void verifyGenericRoomHitMaterializesFacingDoorThroughMapView() {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();

        long mapId = createMapThroughControls(controls, runtime, "Corridor Generic Room Door Map");
        runtime.database().seedRoomToDoorRouteTarget(mapId);
        createMapThroughControls(controls, runtime, "Corridor Generic Room Door Reload Hop");
        selectMap(controls, "Corridor Generic Room Door Map");
        RoomClusterIds roomIds = runtime.database().roomByName(mapId, "R1");
        Set<Long> corridorIdsBefore = runtime.database().corridorIdsForMap(mapId);
        List<String> doorRowsBefore = runtime.database().doorBoundaryState(mapId);
        click(button(controls, "Korridor"));
        Point2D roomInterior = new Point2D(1.5, 2.5);
        Point2D doorTwo = boundaryMidpointNear(binding.mapContentModel(), "DOOR", 8.0, 2.5);
        assertPointerTarget(binding.mapContentModel(), roomInterior, "LABEL", "DE-COR-013 generic-room start");
        assertEquals("ROOM", binding.mapContentModel()
                        .resolvePointerTarget(roomInterior.getX(), roomInterior.getY())
                        .elementKind(),
                "DE-COR-013 generic-room start resolves as a room target rather than a door target");
        assertPointerTarget(binding.mapContentModel(), doorTwo, "HANDLE", "DE-COR-013 generic-room second door");
        AuthoredCorridorState beforeFirstClick = AuthoredCorridorState.capture(runtime, binding, mapId);
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();

        fireMapMousePressed(mapView, MouseButton.PRIMARY,
                viewport.sceneToScreenX(roomInterior.getX()), viewport.sceneToScreenY(roomInterior.getY()), false);
        assertTrue(runtime.controlsModel().current().statusText().contains("Start:"),
                "DE-COR-013 generic-room first click arms a corridor draft");
        assertFirstClickDraftOnly(
                beforeFirstClick,
                runtime,
                binding,
                mapId,
                "DE-COR-013 generic room first click");
        long previewStartNanos = System.nanoTime();
        fireMapMouse(mapView, MouseEvent.MOUSE_MOVED, MouseButton.NONE,
                viewport.sceneToScreenX(doorTwo.getX()), viewport.sceneToScreenY(doorTwo.getY()), false);
        assertPreviewLatencyWithinBudget(previewStartNanos, "DE-COR-013 generic-room hover preview");
        assertVisibleCorridorPreview(
                runtime,
                binding,
                cellRect(4, 2, 7, 2, 0),
                "DE-COR-013 generic-room hover");
        assertHoverKeepsCommittedCorridorState(
                beforeFirstClick,
                runtime,
                binding,
                mapId,
                "DE-COR-013 generic-room hover");
        fireMapMousePressed(mapView, MouseButton.PRIMARY,
                viewport.sceneToScreenX(doorTwo.getX()), viewport.sceneToScreenY(doorTwo.getY()), false);

        long newCorridorId = singleNewCorridorId(corridorIdsBefore, runtime.database().corridorIdsForMap(mapId),
                "DE-COR-013 generic-room");
        List<String> doorRowsAfter = runtime.database().doorBoundaryState(mapId);
        long materializedDoorRef = singleNewDoorTopologyId(doorRowsBefore, doorRowsAfter, "DE-COR-013 generic-room");
        List<String> stableState = runtime.database().corridorStableConnectionState(mapId);
        assertCorridorDoorBindingCount(stableState, newCorridorId, 2, "DE-COR-013 generic-room");
        assertEquals(1L, runtime.database().countDoorBoundariesAt(mapId, 1, 0, "EAST"),
                "DE-COR-013 generic-room materializes exactly one east-facing door on R1");
        assertTrue(doorRowsAfter.stream().anyMatch(row ->
                        row.startsWith("door_edges|cluster_id=" + roomIds.clusterId() + "|")
                                && row.contains("|cell_x=1|")
                                && row.contains("|cell_y=0|")
                                && row.contains("|edge_direction=EAST|")
                                && row.contains("|edge_type=DOOR|")
                                && row.contains("|topology_element_id=" + materializedDoorRef)),
                "DE-COR-013 generic-room materialized door row is the R1 east edge: " + doorRowsAfter);
        assertTrue(stableState.stream().anyMatch(row ->
                        row.startsWith("dungeon_corridor_door_overrides|corridor_id=" + newCorridorId + "|")
                                && row.contains("|relative_cell_x=1|")
                                && row.contains("|relative_cell_y=0|")
                                && row.contains("|edge_direction=EAST|")
                                && row.contains("|topology_element_id=" + materializedDoorRef)),
                "DE-COR-013 generic-room endpoint binds the materialized east-facing door edge");
        assertCorridorCreatedInSnapshot(
                runtime.mapSurfaceModel().current(),
                binding.mapContentModel(),
                newCorridorId,
                cellRect(4, 2, 7, 2, 0),
                "DE-COR-013 generic-room");
        DungeonEditorTopologyElementRef materializedDoor =
                new DungeonEditorTopologyElementRef("DOOR", materializedDoorRef);
        assertTrue(runtime.mapSurfaceModel().current().surface().map().boundaries().stream()
                        .anyMatch(boundary -> "door".equalsIgnoreCase(boundary.kind())
                                && boundary.topologyRef().equals(materializedDoor)),
                "DE-COR-013 generic-room published snapshot exposes the materialized door boundary");
        assertTrue(renderHasBoundaryNear(binding.mapContentModel(), "DOOR", 4.0, 2.5),
                "DE-COR-013 generic-room render scene shows the materialized door boundary");
        selectMap(controls, "Corridor Generic Room Door Reload Hop");
        selectMap(controls, "Corridor Generic Room Door Map");
        assertCorridorCreatedInSnapshot(
                runtime.mapSurfaceModel().current(),
                binding.mapContentModel(),
                newCorridorId,
                cellRect(4, 2, 7, 2, 0),
                "DE-COR-013 generic-room reload");
        assertTrue(runtime.mapSurfaceModel().current().surface().map().boundaries().stream()
                        .anyMatch(boundary -> "door".equalsIgnoreCase(boundary.kind())
                                && boundary.topologyRef().equals(materializedDoor)),
                "DE-COR-013 generic-room reload published snapshot preserves the materialized door topology identity");

    }

    private static void assertFirstClickDraftOnly(
            AuthoredCorridorState before,
            HarnessRuntime runtime,
            HarnessBinding binding,
            long mapId,
            String message
    ) {
        assertTrue(runtime.controlsModel().current().statusText().contains("Start:"),
                message + " arms a transient start-endpoint session");
        assertEquals(before.corridorIds(), runtime.database().corridorIdsForMap(mapId),
                message + " creates no new corridor id");
        assertEquals(before.doorRows(), runtime.database().doorBoundaryState(mapId),
                message + " creates no door binding or boundary row");
        assertEquals(before.anchorRows(), runtime.database().corridorAnchorState(mapId),
                message + " creates no corridor anchor row");
        assertEquals(before.stableConnectionRows(), runtime.database().corridorStableConnectionState(mapId),
                message + " creates no stable corridor connection, endpoint, or topology row");
        assertEquals(before.waypointRows(), runtime.database().corridorWaypointAbsoluteState(mapId),
                message + " creates no waypoint or route row");
        assertEquals(before.authoredGeometryRows(), runtime.database().authoredGeometryState(mapId),
                message + " leaves authored SQLite geometry state unchanged");
        assertEquals(before.surfaceCorridorCount(), surfaceCorridorCount(runtime.mapSurfaceModel().current()),
                message + " publishes no additional committed corridor surface");
        assertEquals(before.renderCells(), renderSurfaceCellOriginsWithZ(binding.mapContentModel()),
                message + " leaves rendered committed geometry unchanged");
        assertEquals(DungeonEditorPreview.none(), runtime.mapSurfaceModel().current().preview(),
                message + " keeps the published preview surface clear until a valid completion candidate exists");
    }

    private static void assertHoverKeepsCommittedCorridorState(
            AuthoredCorridorState before,
            HarnessRuntime runtime,
            HarnessBinding binding,
            long mapId,
            String message
    ) {
        assertEquals(before.corridorIds(), runtime.database().corridorIdsForMap(mapId),
                message + " creates no corridor id before commit");
        assertEquals(before.doorRows(), runtime.database().doorBoundaryState(mapId),
                message + " materializes no generic room door before commit");
        assertEquals(before.anchorRows(), runtime.database().corridorAnchorState(mapId),
                message + " materializes no corridor anchor before commit");
        assertEquals(before.stableConnectionRows(), runtime.database().corridorStableConnectionState(mapId),
                message + " creates no endpoint binding, route, or topology row before commit");
        assertEquals(before.waypointRows(), runtime.database().corridorWaypointAbsoluteState(mapId),
                message + " creates no waypoint row before commit");
        assertEquals(before.authoredGeometryRows(), runtime.database().authoredGeometryState(mapId),
                message + " leaves authored SQLite geometry unchanged before commit");
        assertEquals(before.surfaceCorridorCount(), surfaceCorridorCount(runtime.mapSurfaceModel().current()),
                message + " publishes no additional committed corridor surface before commit");
        assertEquals(before.surfaceMapCells(), mapSnapshotCellSet(runtime.mapSurfaceModel().current().surface().map()),
                message + " leaves committed surface map cells unchanged before commit");
    }

    private static void assertVisibleCorridorPreview(
            HarnessRuntime runtime,
            HarnessBinding binding,
            Set<String> expectedCells,
            String message
    ) {
        DungeonEditorMapSurfaceSnapshot snapshot = runtime.mapSurfaceModel().current();
        assertEquals(DungeonEditorPreview.none(), snapshot.preview(),
                message + " keeps corridor preview out of the public typed preview channel");
        assertTrue(snapshot.surface().previewMap() != null,
                message + " publishes a visible preview map");
        Set<String> committedCells = mapSnapshotCellSet(snapshot.surface().map());
        Set<String> expectedAddedPreviewCells = new LinkedHashSet<>(expectedCells);
        expectedAddedPreviewCells.removeAll(committedCells);
        Set<String> addedPreviewCells = new LinkedHashSet<>(mapSnapshotCellSet(snapshot.surface().previewMap()));
        addedPreviewCells.removeAll(committedCells);
        assertEquals(expectedAddedPreviewCells, addedPreviewCells,
                message + " preview map adds exactly the candidate corridor route cells");
        boolean structuredRoutePublished = snapshot.surface().previewDiff().changedAreas().stream()
                .filter(area -> "CORRIDOR".equalsIgnoreCase(area.kind()))
                .map(DungeonEditorBehaviorHarnessSupport::areaCellSet)
                .anyMatch(expectedCells::equals);
        boolean structuredFeaturePublished = snapshot.surface().previewDiff().changedFeatures().stream()
                .map(feature -> feature.cells().stream()
                        .map(cell -> cell.q() + "," + cell.r() + "," + cell.level())
                        .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new)))
                .anyMatch(expectedCells::equals);
        assertTrue(structuredRoutePublished || structuredFeaturePublished,
                message + " structured preview diff publishes the candidate corridor route");
        assertEquals(expectedCells, renderPreviewSurfaceCellOriginsWithZ(binding.mapContentModel()),
                message + " render scene paints exactly the candidate corridor route cells");
    }

    private static void assertRejectedCompletionLeavesAuthoredState(
            AuthoredCorridorState before,
            HarnessRuntime runtime,
            HarnessBinding binding,
            long mapId,
            String message
    ) {
        assertTrue(runtime.controlsModel().current().statusText().contains("blockiert"),
                message + " reports blocked route rejection");
        assertEquals(before.corridorIds(), runtime.database().corridorIdsForMap(mapId),
                message + " creates no corridor id");
        assertEquals(before.doorRows(), runtime.database().doorBoundaryState(mapId),
                message + " materializes no generic room door");
        assertEquals(before.anchorRows(), runtime.database().corridorAnchorState(mapId),
                message + " materializes no corridor anchor");
        assertEquals(before.stableConnectionRows(), runtime.database().corridorStableConnectionState(mapId),
                message + " creates no endpoint binding, route, or topology row");
        assertEquals(before.waypointRows(), runtime.database().corridorWaypointAbsoluteState(mapId),
                message + " creates no waypoint row");
        assertEquals(before.authoredGeometryRows(), runtime.database().authoredGeometryState(mapId),
                message + " leaves authored SQLite geometry state unchanged");
        assertEquals(before.surfaceCorridorCount(), surfaceCorridorCount(runtime.mapSurfaceModel().current()),
                message + " publishes no committed corridor surface");
        assertEquals(before.renderCells(), renderSurfaceCellOriginsWithZ(binding.mapContentModel()),
                message + " leaves rendered committed geometry unchanged");
        assertEquals(DungeonEditorPreview.none(), runtime.mapSurfaceModel().current().preview(),
                message + " clears preview after rejection");
    }

    private static long surfaceCorridorCount(DungeonEditorMapSurfaceSnapshot snapshot) {
        return snapshot.surface().map().areas().stream()
                .filter(area -> "CORRIDOR".equalsIgnoreCase(area.kind()))
                .count();
    }

    private record AuthoredCorridorState(
            Set<Long> corridorIds,
            List<String> anchorRows,
            List<String> doorRows,
            List<String> stableConnectionRows,
            List<String> waypointRows,
            List<String> authoredGeometryRows,
            Set<String> surfaceMapCells,
            Set<String> renderCells,
            long surfaceCorridorCount
    ) {
        private static AuthoredCorridorState capture(
                HarnessRuntime runtime,
                HarnessBinding binding,
                long mapId
        ) {
            return new AuthoredCorridorState(
                    runtime.database().corridorIdsForMap(mapId),
                    runtime.database().corridorAnchorState(mapId),
                    runtime.database().doorBoundaryState(mapId),
                    runtime.database().corridorStableConnectionState(mapId),
                    runtime.database().corridorWaypointAbsoluteState(mapId),
                    runtime.database().authoredGeometryState(mapId),
                    mapSnapshotCellSet(runtime.mapSurfaceModel().current().surface().map()),
                    renderSurfaceCellOriginsWithZ(binding.mapContentModel()),
                    DungeonEditorCorridorHarness.surfaceCorridorCount(runtime.mapSurfaceModel().current()));
        }
    }

}
