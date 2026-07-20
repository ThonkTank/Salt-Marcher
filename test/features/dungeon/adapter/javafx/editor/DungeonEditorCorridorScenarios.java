package features.dungeon.adapter.javafx.editor;

import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Direction;
import features.dungeon.api.DungeonEdgeRef;
import features.dungeon.api.editor.DungeonEditorState;
import features.dungeon.api.DungeonEditorHandleSnapshot;
import features.dungeon.api.DungeonEditorPreview;
import features.dungeon.api.editor.DungeonEditorIntent;
import features.dungeon.api.editor.DungeonEditorPointerGesture;
import features.dungeon.api.editor.DungeonEditorPointerInput;
import features.dungeon.api.editor.DungeonEditorToolFamily;
import features.dungeon.api.editor.DungeonEditorToolSelection;
import features.dungeon.api.DungeonEditorViewMode;
import features.dungeon.api.DungeonInspectorSnapshot;
import features.dungeon.api.DungeonMapSummary;
import features.dungeon.api.DungeonOverlaySettings;
import features.dungeon.api.DungeonTopologyElementRef;
import features.dungeon.api.editor.DungeonEditorPointerInput.Target;
import features.dungeon.adapter.javafx.map.DungeonMapContentModel;
import features.dungeon.adapter.javafx.map.DungeonMapView;
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
import static features.dungeon.adapter.javafx.editor.DungeonEditorTestSupport.*;

final class DungeonEditorCorridorScenarios {


    private DungeonEditorCorridorScenarios() {
    }

    static void run() throws Exception {
        route(() -> verifyCorridorAnchorMoveThroughMapView());
        route(() -> verifyCorridorPointEditThroughStateView());
        route(() -> verifyDependentCorridorRouteUpdatesThroughHostAnchorMove());
        route(() -> verifyDependentCorridorRouteUpdatesThroughWholeClusterMove());
        route(() -> verifyDoorToDoorVerticalFallbackCorridorCreateThroughMapView());
        route(() -> verifyCorridorSplitAtCrossingThroughMapView());
        route(() -> verifyCorridorConnectionPointDeleteThroughMapView());
        route(() -> verifyCorridorDoorConnectionDeleteThroughMapView());
        route(() -> verifyInvalidCorridorRouteRejectedThroughMapView());
        route(() -> verifyGenericEndpointMaterializesOnlyAtFullCommitThroughMapView());
    }

    private static void route(
            DungeonEditorTestSupport.ThrowingRunnable action
    ) throws Exception {
        DungeonEditorTestSupport.runRoute(action);
    }

    private static void verifyCorridorAnchorMoveThroughMapView() {
        TestRuntime runtime = TestRuntime.create();
        TestBinding binding = bindTest(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();

        long mapId = createMapThroughControls(controls, runtime, "Corridor Anchor Move Map");
        runtime.database().seedCorridorWithAnchor(mapId);
        createMapThroughControls(controls, runtime, "Corridor Anchor Move Reload Hop");
        selectMap(controls, "Corridor Anchor Move Map");
        click(button(controls, "Auswahl"));
        var corridorAnchor = runtime.editorApi().current().selectedWindow().map().editorHandles().stream()
                .filter(handle -> "CORRIDOR_ANCHOR".equals(handle.ref().kind().name()))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("F5_CORRIDOR_WITH_ANCHOR anchor handle not loaded."));
        long anchorId = editorTopologyRef(corridorAnchor.ref().topologyRef()).id();
        List<String> anchorRowsBefore = runtime.database().corridorAnchorState(mapId);
        List<String> stableRowsBefore = runtime.database().corridorStableConnectionState(mapId);
        List<String> authoredStateBefore = runtime.database().authoredGeometryState(mapId);
        long geometryRowsBefore = runtime.database().countAuthoredGeometryRows(mapId);
        String a1AnchorRow = anchorRowsBefore.stream()
                .filter(row -> row.contains("anchor_id=" + anchorId)
                        && row.contains("cell_x=6")
                        && row.contains("cell_y=5")
                        && row.contains("cell_z=0"))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException(
                        "DE-COR-005 starts with A1 anchored at (6,5,0): " + anchorRowsBefore));
        assertTrue(a1AnchorRow.contains("|cell_y=5|"),
                "DE-COR-005 captures exact A1 anchor row at (6,5,0): " + a1AnchorRow);
        assertTrue(runtimePointerTarget(binding.mapContentModel(), corridorAnchor.markerQ(), corridorAnchor.markerR())
                        .targetKind() != features.dungeon.api.editor.DungeonEditorPointerInput.TargetKind.HANDLE,
                "DE-SEL-006 corridor anchor marker does not resolve as a draggable handle");
        Point2D corridorBody = corridorBodyCenter(
                runtime.editorApi().current(),
                corridorAnchor.ref().corridorId(),
                "DE-SEL-006");
        assertEquals(features.dungeon.api.editor.DungeonEditorPointerInput.TargetKind.CELL,
                runtimePointerTarget(binding.mapContentModel(), corridorBody.getX(), corridorBody.getY())
                        .targetKind(),
                "DE-SEL-006 corridor anchor body resolves as a generic corridor cell");
        assertEquals(features.dungeon.api.editor.DungeonEditorPointerInput.ElementKind.CORRIDOR,
                runtimePointerTarget(binding.mapContentModel(), corridorBody.getX(), corridorBody.getY())
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

        DungeonEditorState previewSurface = runtime.editorApi().current();
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
        DungeonEditorState committedSurface = runtime.editorApi().current();
        assertEquals(DungeonEditorPreview.none(), committedSurface.preview(),
                "DE-COR-005 keeps move preview absent after release");
        assertEquals(geometryRowsBefore, runtime.database().countAuthoredGeometryRows(mapId),
                "DE-COR-005 suppressed anchor drag leaves authored DB row count unchanged");
        assertEquals(authoredStateBefore, runtime.database().authoredGeometryState(mapId),
                "DE-COR-005 suppressed anchor drag leaves authored geometry state unchanged");
        assertTrue(committedSurface.selectedWindow().map().editorHandles().stream().anyMatch(handle ->
                        handle.ref().topologyRef().equals(corridorAnchor.ref().topologyRef())
                                && handle.cell().q() == 6
                                && handle.cell().r() == 5
                                && handle.cell().level() == 0),
                "DE-COR-005 published passive anchor readback keeps A1 at (6,5,0)");



    }


    private static void verifyCorridorPointEditThroughStateView() {
        TestRuntime runtime = TestRuntime.create();
        TestBinding binding = bindTest(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonEditorStateView stateView = binding.stateView();

        long mapId = createMapThroughControls(controls, runtime, "Corridor State Point Map");
        runtime.database().seedCorridorWithAnchor(mapId);
        createMapThroughControls(controls, runtime, "Corridor State Point Reload Hop");
        selectMap(controls, "Corridor State Point Map");
        click(button(controls, "Auswahl"));
        var corridorAnchor = firstCorridorAnchorHandle(runtime.editorApi().current(), "DE-STATE-004");
        Set<Long> existingCorridorIds = runtime.database().corridorIdsForMap(mapId);
        assertEquals(1L, existingCorridorIds.size(), "DE-STATE-004 fixture starts with one authored corridor");
        long existingCorridorId = existingCorridorIds.iterator().next();
        List<String> anchorRowsBefore = runtime.database().corridorAnchorState(mapId);
        List<String> stableRowsBefore = runtime.database().corridorStableConnectionState(mapId);
        String a1AnchorRowBefore = anchorRowsBefore.stream()
                .filter(row -> row.contains("cell_x=6")
                        && row.contains("cell_y=5")
                        && row.contains("cell_z=0"))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException(
                        "DE-STATE-004 starts with A1 anchored at (6,5,0): " + anchorRowsBefore));
        String a1AnchorRowAfter = a1AnchorRowBefore.replace("|cell_y=5|", "|cell_y=4|");
        selectPublishedCorridorAnchor(runtime, corridorAnchor);

        assertEquals(corridorAnchor.ref().topologyRef(), runtime.editorApi().current().selection().topologyRef(),
                "DE-STATE-004 atomic editor state selects the explicit published corridor anchor");
        assertEquals(corridorAnchor.ref(), runtime.editorApi().current().selection().handleRef(),
                "DE-STATE-004 atomic editor state publishes the focused corridor anchor edit ref");
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
        selectPublishedCorridorAnchor(runtime, corridorAnchor);
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
        DungeonEditorState committedSurface = runtime.editorApi().current();
        assertEquals(DungeonEditorPreview.none(), committedSurface.preview(),
                "DE-STATE-004 clears move preview after state-panel submit");
        assertEquals(corridorAnchor.ref().topologyRef(), committedSurface.selection().topologyRef(),
                "DE-STATE-004 keeps selection on the edited corridor anchor topology ref");
        assertTrue(committedSurface.selectedWindow().map().editorHandles().stream().anyMatch(handle ->
                        handle.ref().topologyRef().equals(corridorAnchor.ref().topologyRef())
                                && handle.cell().q() == 6
                                && handle.cell().r() == 4
                                && handle.cell().level() == 0),
                "DE-STATE-004 publishes the moved explicit A1 handle at (6,4,0)");
        assertTrue(!areaCellSet(corridorAreaById(committedSurface, existingCorridorId, "DE-STATE-004"))
                        .contains("6,4,0"),
                "DE-STATE-004 keeps the explicit anchor outside the host route area");
        assertTrue(!renderSurfaceCellOriginsWithZ(binding.mapContentModel()).contains("6,4,0"),
                "DE-STATE-004 rendered host route excludes the explicit anchor cell");
        selectMap(controls, "Corridor State Point Reload Hop");
        selectMap(controls, "Corridor State Point Map");
        assertTrue(!areaCellSet(corridorAreaById(
                        runtime.editorApi().current(),
                        existingCorridorId,
                        "DE-STATE-004 reload")).contains("6,4,0"),
                "DE-STATE-004 reload keeps the explicit anchor outside the host route area");


    }

    private static void selectPublishedCorridorAnchor(
            TestRuntime runtime,
            DungeonEditorHandleSnapshot anchor
    ) {
        dispatchPublishedCorridorAnchor(
                runtime,
                anchor,
                DungeonEditorPointerInput.Action.PRESSED,
                DungeonEditorToolSelection.select(),
                DungeonEditorPointerGesture.Button.PRIMARY);
    }

    private static void createFromPublishedCorridorAnchor(
            TestRuntime runtime,
            DungeonEditorHandleSnapshot anchor
    ) {
        dispatchPublishedCorridorAnchor(
                runtime,
                anchor,
                DungeonEditorPointerInput.Action.PRESSED,
                runtime.editorApi().current().toolSelection(),
                DungeonEditorPointerGesture.Button.PRIMARY);
    }

    private static void deletePublishedCorridorAnchor(
            TestRuntime runtime,
            DungeonEditorHandleSnapshot anchor
    ) {
        dispatchPublishedCorridorAnchor(
                runtime,
                anchor,
                DungeonEditorPointerInput.Action.PRESSED,
                runtime.editorApi().current().toolSelection(),
                DungeonEditorPointerGesture.Button.SECONDARY);
    }

    private static void dispatchPublishedCorridorAnchor(
            TestRuntime runtime,
            DungeonEditorHandleSnapshot anchor,
            DungeonEditorPointerInput.Action action,
            DungeonEditorToolSelection toolSelection,
            DungeonEditorPointerGesture.Button button
    ) {
        DungeonEditorState state = runtime.editorApi().current();
        runtime.editorApi().dispatch(new DungeonEditorIntent.Pointer(new DungeonEditorPointerInput(
                state.publicationRevision(),
                action,
                toolSelection,
                new DungeonEditorPointerGesture(button, false, false),
                anchor.markerQ(),
                anchor.markerR(),
                List.of(Target.handle(anchor.ref())),
                state.projectionLevel(),
                DungeonEditorIntent.TransitionDestinationInput.empty())));
    }


    private static void verifyDependentCorridorRouteUpdatesThroughHostAnchorMove() {
        TestRuntime runtime = TestRuntime.create();
        TestBinding binding = bindTest(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();
        DungeonEditorStateView stateView = binding.stateView();

        long mapId = createMapThroughControls(controls, runtime, "Corridor Network Host Move Map");
        runtime.database().seedCorridorWithAnchor(mapId);
        createMapThroughControls(controls, runtime, "Corridor Network Host Move Reload Hop");
        selectMap(controls, "Corridor Network Host Move Map");
        long dependentCorridorId = createDependentCorridorFromExistingAnchor(runtime, binding, controls, mapView, mapId);
        DungeonTopologyElementRef anchorRef = dependentHostAnchorRef(
                runtime.database().corridorStableConnectionState(mapId), dependentCorridorId, "DE-COR-NET dependent");
        assertCorridorAnchorRef(
                runtime.database().corridorStableConnectionState(mapId),
                dependentCorridorId,
                anchorRef.id(),
                "DE-COR-NET dependent corridor retains its referenced host anchor");

        click(button(controls, "Auswahl"));
        DungeonEditorHandleSnapshot hostAnchor = corridorAnchorHandle(
                runtime.editorApi().current(), anchorRef, "DE-COR-NET dependent host");
        Point2D doorOne = boundaryMidpointNear(binding.mapContentModel(), "DOOR", 4.0, 2.5);
        selectPublishedCorridorAnchor(runtime, hostAnchor);
        assertEquals(hostAnchor.ref(), runtime.editorApi().current().selection().handleRef(),
                "DE-COR-NET typed published-anchor selection resolves the dependent corridor's host anchor");

        List<String> stableRowsBeforeMove = runtime.database().corridorStableConnectionState(mapId);
        List<String> anchorRowsBeforeMove = runtime.database().corridorAnchorState(mapId);
        assertTrue(anchorRowsBeforeMove.stream().anyMatch(row ->
                        row.contains("anchor_id=" + anchorRef.id())
                                && row.contains("cell_x=" + hostAnchor.cell().q())
                                && row.contains("cell_y=" + hostAnchor.cell().r())
                                && row.contains("cell_z=" + hostAnchor.cell().level())),
                "DE-COR-NET starts at the dependent corridor's published host anchor: " + anchorRowsBeforeMove);
        int movedAnchorQ = hostAnchor.cell().q();
        int movedAnchorR = hostAnchor.cell().r() - 1;
        TextField qField = textField(stateView, "Korridorpunkt q");
        TextField rField = textField(stateView, "Korridorpunkt r");
        assertEquals(Integer.toString(hostAnchor.cell().q()), qField.getText(),
                "DE-COR-NET state panel targets the selected dependent host anchor q");
        assertEquals(Integer.toString(hostAnchor.cell().r()), rField.getText(),
                "DE-COR-NET state panel targets the selected dependent host anchor r");
        qField.setText(Integer.toString(movedAnchorQ));
        rField = textField(stateView, "Korridorpunkt r");
        rField.setText(Integer.toString(movedAnchorR));
        ButtonBase moveButton = buttonWithAccessibleText(stateView, "Korridor-Anker verschieben");
        assertTrue(!moveButton.isDisabled(), "DE-COR-NET distinct one-cell anchor edit enables submit");
        click(moveButton);

        List<String> anchorRowsAfterMove = runtime.database().corridorAnchorState(mapId);
        assertTrue(anchorRowsAfterMove.stream().anyMatch(row ->
                        row.contains("anchor_id=" + anchorRef.id())
                                && row.contains("cell_x=" + movedAnchorQ)
                                && row.contains("cell_y=" + movedAnchorR)
                                && row.contains("cell_z=" + hostAnchor.cell().level())),
                "DE-COR-NET moves the dependent corridor's host anchor: " + anchorRowsAfterMove);
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
        Set<String> expectedDependentCells = manhattanCorridorCells(
                new Point2D(movedAnchorQ + 0.5, movedAnchorR + 0.5), doorOne);
        DungeonEditorState committedSurface = runtime.editorApi().current();
        assertCorridorCreatedInSnapshot(
                committedSurface,
                binding.mapContentModel(),
                dependentCorridorId,
                expectedDependentCells,
                "DE-COR-NET moved dependent corridor");
        assertTrue(!areaCellSet(corridorAreaById(committedSurface, dependentCorridorId, "DE-COR-NET moved"))
                        .contains(cellKeyAt(hostAnchor.cell().q(), hostAnchor.cell().r(), hostAnchor.cell().level())),
                "DE-COR-NET moved dependent corridor omits stale former anchor cell");
        selectMap(controls, "Corridor Network Host Move Reload Hop");
        selectMap(controls, "Corridor Network Host Move Map");
        assertCorridorCreatedInSnapshot(
                runtime.editorApi().current(),
                binding.mapContentModel(),
                dependentCorridorId,
                expectedDependentCells,
                "DE-COR-NET moved dependent corridor reload");
        assertCorridorAnchorRef(
                runtime.database().corridorStableConnectionState(mapId),
                dependentCorridorId,
                anchorRef.id(),
                "DE-COR-NET reload preserves dependent anchor ref");


    }


    private static long createDependentCorridorFromExistingAnchor(
            TestRuntime runtime,
            TestBinding binding,
            DungeonEditorControlsView controls,
            DungeonMapView mapView,
            long mapId
    ) {
        Set<Long> corridorIdsBefore = runtime.database().corridorIdsForMap(mapId);
        DungeonEditorHandleSnapshot hostAnchor = firstCorridorAnchorHandle(
                runtime.editorApi().current(), "DE-COR-NET dependent host");
        Point2D genericCorridorPoint = selectableGenericCorridorPoint(
                runtime.editorApi().current(), binding.mapContentModel(), hostAnchor, "DE-COR-NET dependent host");
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
        Set<String> expectedCanonicalCells = manhattanCorridorCells(genericCorridorPoint, doorOne);
        assertVisibleCorridorPreview(
                runtime,
                binding,
                expectedCanonicalCells,
                "DE-COR-NET dependent hover");
        fireMapMousePressed(mapView, MouseButton.PRIMARY,
                viewport.sceneToScreenX(doorOne.getX()), viewport.sceneToScreenY(doorOne.getY()), false);

        long dependentCorridorId = singleNewCorridorId(
                corridorIdsBefore,
                runtime.database().corridorIdsForMap(mapId),
                "DE-COR-NET dependent");
        assertCorridorCreatedInSnapshot(
                runtime.editorApi().current(),
                binding.mapContentModel(),
                dependentCorridorId,
                expectedCanonicalCells,
                "DE-COR-NET dependent created");
        return dependentCorridorId;
    }

    private static void verifyDependentCorridorRouteUpdatesThroughWholeClusterMove() {
        TestRuntime runtime = TestRuntime.create();
        TestBinding binding = bindTest(runtime);
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
        DungeonTopologyElementRef dependentAnchorRef = dependentHostAnchorRef(
                stableRowsBeforeMove, dependentCorridorId, "DE-CLUSTER-COR-001 dependent");
        long dependentDoorTopologyId = stableRowsBeforeMove.stream()
                .filter(row -> row.startsWith("dungeon_corridor_door_overrides|corridor_id=" + dependentCorridorId + "|"))
                .filter(row -> row.contains("|room_id=" + movedRoomIds.roomId() + "|"))
                .map(row -> stableRowLong(row, "topology_element_id="))
                .findFirst()
                .orElseThrow(() -> new AssertionError(
                        "DE-CLUSTER-COR-001 dependent door binding missing: " + stableRowsBeforeMove));
        List<String> authoredStateBeforeMove = runtime.database().authoredGeometryState(mapId);
        long geometryRowsBeforeMove = runtime.database().countAuthoredGeometryRows(mapId);
        Set<String> clusterCellsBeforeMove = persistedClusterCellsThroughRepository(
                mapId, movedRoomIds.clusterId(), 0);
        Set<String> expectedMovedClusterCells = translatedCellKeys(clusterCellsBeforeMove, 2, 0, 0);
        Set<String> expectedMovedDependentCells = Set.of(
                "6,2,0", "6,3,0", "6,4,0", "6,5,0", "5,5,0");
        long anchorId = editorTopologyRef(firstCorridorAnchorHandle(
                runtime.editorApi().current(),
                "DE-CLUSTER-COR-001 host").ref().topologyRef()).id();
        click(button(controls, "Auswahl"));
        DungeonEditorHandleSnapshot clusterLabel = runtime.editorApi().current().selectedWindow().map().editorHandles().stream()
                .filter(handle -> "CLUSTER_LABEL".equals(handle.ref().kind().name()))
                .filter(handle -> handle.ref().clusterId() == movedRoomIds.clusterId())
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("DE-CLUSTER-COR-001 cluster label not loaded."));
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();
        Point2D clusterLabelCenter = clusterLabelCenterForRef(
                binding.mapContentModel(), clusterLabel.ref().topologyRef());
        assertEquals(DungeonEditorPointerInput.TargetKind.LABEL,
                runtimePointerTarget(binding.mapContentModel(), clusterLabelCenter.getX(), clusterLabelCenter.getY())
                        .targetKind(),
                "DE-CLUSTER-COR-001 uses the rendered cluster-label target rather than a wall boundary");
        assertEquals(DungeonEditorPointerInput.LabelKind.CLUSTER_LABEL,
                runtimePointerTarget(binding.mapContentModel(), clusterLabelCenter.getX(), clusterLabelCenter.getY())
                        .labelKind(),
                "DE-CLUSTER-COR-001 rendered label hit keeps cluster-label semantics");

        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_PRESSED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(clusterLabelCenter.getX()),
                viewport.sceneToScreenY(clusterLabelCenter.getY()),
                false);
        assertTrue(runtime.editorApi().current().selection().clusterSelection(),
                "DE-CLUSTER-COR-001 cluster label drag starts from cluster selection");
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_DRAGGED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(clusterLabelCenter.getX() + 2.0),
                viewport.sceneToScreenY(clusterLabelCenter.getY()),
                false);

        assertEquals(anchorRowsBeforeMove, runtime.database().corridorAnchorState(mapId),
                "DE-CLUSTER-COR-001 cluster drag preview leaves corridor anchor rows unchanged");
        assertEquals(stableRowsBeforeMove, runtime.database().corridorStableConnectionState(mapId),
                "DE-CLUSTER-COR-001 cluster drag preview leaves stable corridor rows unchanged");
        assertEquals(authoredStateBeforeMove, runtime.database().authoredGeometryState(mapId),
                "DE-CLUSTER-COR-001 cluster drag preview leaves authored geometry unchanged");
        DungeonEditorState previewSurface = runtime.editorApi().current();
        assertTrue(previewSurface.preview() instanceof DungeonEditorPreview.MoveHandlePreview,
                "DE-CLUSTER-COR-001 cluster label drag publishes a move preview");
        DungeonEditorPreview.MoveHandlePreview preview =
                (DungeonEditorPreview.MoveHandlePreview) previewSurface.preview();
        assertEquals(2L, preview.deltaQ(), "DE-CLUSTER-COR-001 cluster label preview delta q");
        assertEquals(0L, preview.deltaR(), "DE-CLUSTER-COR-001 cluster label preview delta r");
        assertTrue(previewSurface.selectedWindow().previewMap() != null,
                "DE-CLUSTER-COR-001 cluster label drag publishes a preview map");
        assertEquals(expectedMovedClusterCells,
                clusterSurfaceCells(previewSurface.selectedWindow().previewMap(), movedRoomIds.clusterId()),
                "DE-CLUSTER-COR-001 preview map translates the selected cluster cells");

        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_RELEASED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(clusterLabelCenter.getX() + 2.0),
                viewport.sceneToScreenY(clusterLabelCenter.getY()),
                false);

        assertEquals(expectedMovedClusterCells,
                persistedClusterCellsThroughRepository(mapId, movedRoomIds.clusterId(), 0),
                "DE-CLUSTER-COR-001 release persists the exact translated cluster cells");
        Cell translatedPrimary = primaryCell(expectedMovedClusterCells);
        assertEquals(movedRoomIds, runtime.database().roomByComponent(
                        mapId, translatedPrimary.q(), translatedPrimary.r(), translatedPrimary.level()),
                "DE-CLUSTER-COR-001 translated cluster cells retain the room and cluster identities");
        List<String> anchorRowsAfterMove = runtime.database().corridorAnchorState(mapId);
        assertTrue(anchorRowsAfterMove.stream().anyMatch(row ->
                        row.contains("anchor_id=" + anchorId)
                                && row.contains("cell_x=6")
                                && row.contains("cell_y=5")
                                && row.contains("cell_z=0")),
                "DE-CLUSTER-COR-001 keeps independent host A1 at (6,5,0): " + anchorRowsAfterMove);
        assertTrue(!anchorRowsAfterMove.stream().anyMatch(row ->
                        row.contains("anchor_id=" + anchorId)
                                && row.contains("cell_x=6")
                                && row.contains("cell_y=4")
                                && row.contains("cell_z=0")),
                "DE-CLUSTER-COR-001 does not rebind independent host A1 to the moved endpoint: "
                        + anchorRowsAfterMove);
        assertEquals(geometryRowsBeforeMove, runtime.database().countAuthoredGeometryRows(mapId),
                "DE-CLUSTER-COR-001 cluster move keeps authored DB row count stable");
        List<String> stableRowsAfterMove = runtime.database().corridorStableConnectionState(mapId);
        DungeonEditorState committedSurface = runtime.editorApi().current();
        assertCorridorCreatedInSnapshot(
                committedSurface,
                binding.mapContentModel(),
                dependentCorridorId,
                expectedMovedDependentCells,
                "DE-CLUSTER-COR-001 moved dependent corridor");
        assertTrue(areaCellSet(corridorAreaById(committedSurface, dependentCorridorId, "DE-CLUSTER-COR-001 moved"))
                        .contains("6,5,0"),
                "DE-CLUSTER-COR-001 moved dependent corridor retains the independent host-anchor tail");
        assertCorridorAnchorRef(
                stableRowsAfterMove,
                dependentCorridorId,
                dependentAnchorRef.id(),
                "DE-CLUSTER-COR-001 keeps the dependent anchor reference after cluster move");
        assertTrue(stableRowsAfterMove.stream().anyMatch(row ->
                        row.startsWith("dungeon_corridor_door_overrides|corridor_id=" + dependentCorridorId + "|")
                                && row.contains("|room_id=" + movedRoomIds.roomId() + "|")
                                && row.contains("|cluster_id=" + movedRoomIds.clusterId() + "|")
                                && row.contains("|relative_cell_x=5|")
                                && row.contains("|relative_cell_y=2|")
                                && row.contains("|topology_element_id=" + dependentDoorTopologyId)),
                "DE-CLUSTER-COR-001 translates the dependent door endpoint while preserving its topology ref: "
                        + stableRowsAfterMove);
        selectMap(controls, "Cluster Corridor Move Reload Hop");
        selectMap(controls, "Cluster Corridor Move Map");
        assertCorridorCreatedInSnapshot(
                runtime.editorApi().current(),
                binding.mapContentModel(),
                dependentCorridorId,
                expectedMovedDependentCells,
                "DE-CLUSTER-COR-001 moved dependent corridor reload");


    }


    private static void verifyDoorToDoorVerticalFallbackCorridorCreateThroughMapView() {
        TestRuntime runtime = TestRuntime.create();
        TestBinding binding = bindTest(runtime);
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
        assertCorridorToolDoorBoundaryTarget(binding.mapContentModel(), doorOne, "DE-COR-014 first door");
        assertCorridorToolDoorBoundaryTarget(binding.mapContentModel(), doorTwo, "DE-COR-014 second door");
        AuthoredCorridorState beforeFirstClick = AuthoredCorridorState.capture(runtime, binding, mapId);
        long revisionBeforeCreate = runtime.database().mapRevision(mapId);
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
        assertCorridorToolDoorBoundaryTarget(binding.mapContentModel(), doorTwo,
                "DE-COR-014 hover keeps the second door boundary target authoritative");
        clickMap(mapView, MouseButton.PRIMARY,
                viewport.sceneToScreenX(doorTwo.getX()), viewport.sceneToScreenY(doorTwo.getY()), false);

        long newCorridorId = singleNewCorridorId(corridorIdsBefore, runtime.database().corridorIdsForMap(mapId),
                "DE-COR-014");
        assertEquals(revisionBeforeCreate + 1L, runtime.database().mapRevision(mapId),
                "DE-COR-014 corridor create commits exactly one aggregate revision");
        assertCorridorDoorBindingCount(runtime.database().corridorStableConnectionState(mapId), newCorridorId, 2,
                "DE-COR-014");
        assertEquals(doorRowsBefore, runtime.database().doorBoundaryState(mapId),
                "DE-COR-014 reuses explicit door endpoint identities without creating boundary rows");
        assertCorridorCreatedInSnapshot(
                runtime.editorApi().current(),
                binding.mapContentModel(),
                newCorridorId,
                expectedCells,
                "DE-COR-014");
        Point2D fallbackCorridorBody = new Point2D(4.05, 5.05);
        assertPointerTarget(binding.mapContentModel(), fallbackCorridorBody,
                features.dungeon.api.editor.DungeonEditorPointerInput.TargetKind.CELL, "DE-COR-014 fallback body");
        assertEquals(features.dungeon.api.editor.DungeonEditorPointerInput.ElementKind.CORRIDOR,
                runtimePointerTarget(binding.mapContentModel(), fallbackCorridorBody.getX(), fallbackCorridorBody.getY())
                        .elementKind(),
                "DE-COR-014 fallback body remains a semantic corridor target");

        fireMapShortcut(mapView, KeyCode.Z, true, false);
        assertEquals(corridorIdsBefore, runtime.database().corridorIdsForMap(mapId),
                "DE-COR-014 patch undo removes the created corridor");
        assertEquals(revisionBeforeCreate + 2L, runtime.database().mapRevision(mapId),
                "DE-COR-014 patch undo restores content as one new revision");
        assertEquals(doorRowsBefore, runtime.database().doorBoundaryState(mapId),
                "DE-COR-014 patch undo preserves reused door identities");

        fireMapShortcut(mapView, KeyCode.Y, true, false);
        assertTrue(runtime.database().corridorIdsForMap(mapId).contains(newCorridorId),
                "DE-COR-014 patch redo restores the created corridor identity");
        assertEquals(revisionBeforeCreate + 3L, runtime.database().mapRevision(mapId),
                "DE-COR-014 patch redo restores content as one new revision");
        assertCorridorCreatedInSnapshot(
                runtime.editorApi().current(),
                binding.mapContentModel(),
                newCorridorId,
                expectedCells,
                "DE-COR-014 redo");
        selectMap(controls, "Corridor Vertical Fallback Reload Hop");
        selectMap(controls, "Corridor Vertical Fallback Map");
        assertCorridorCreatedInSnapshot(
                runtime.editorApi().current(),
                binding.mapContentModel(),
                newCorridorId,
                expectedCells,
                "DE-COR-014 reload");
        assertPointerTarget(binding.mapContentModel(), fallbackCorridorBody,
                features.dungeon.api.editor.DungeonEditorPointerInput.TargetKind.CELL,
                "DE-COR-014 reload fallback body");
        assertEquals(features.dungeon.api.editor.DungeonEditorPointerInput.ElementKind.CORRIDOR,
                runtimePointerTarget(binding.mapContentModel(), fallbackCorridorBody.getX(), fallbackCorridorBody.getY())
                        .elementKind(),
                "DE-COR-014 reload fallback body remains a semantic corridor target");


    }

    private static void verifyCorridorSplitAtCrossingThroughMapView() {
        TestRuntime runtime = TestRuntime.create();
        TestBinding binding = bindTest(runtime);
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
        assertEquals(DungeonEditorToolSelection.family(DungeonEditorToolFamily.CORRIDOR),
                runtime.editorApi().current().toolSelection(),
                "DE-COR-004 corridor family selects corridor-create tool");
        assertCorridorToolDoorBoundaryTarget(binding.mapContentModel(), doorOne, "DE-COR-004 D1");
        assertCorridorToolDoorBoundaryTarget(binding.mapContentModel(), doorThree, "DE-COR-004 D3");
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
                runtime.editorApi().current(),
                binding.mapContentModel(),
                newCorridorId,
                expectedCells,
                "DE-COR-004");
        assertCorridorAnchorHandleAt(runtime.editorApi().current(), 6, 5, 0, "DE-COR-004");
        assertOnlyCorridorWaypointHandleAt(runtime.editorApi().current(), newCorridorId, 6, 5, 0, "DE-COR-004");
        selectMap(controls, "Corridor Crossing Split Reload Hop");
        selectMap(controls, "Corridor Crossing Split Map");
        assertCorridorCreatedInSnapshot(
                runtime.editorApi().current(),
                binding.mapContentModel(),
                newCorridorId,
                expectedCells,
                "DE-COR-004 reload");
        assertOnlyCorridorWaypointAt(runtime.database().corridorWaypointAbsoluteState(mapId), newCorridorId, 6, 5, 0,
                "DE-COR-004 reload");


    }


    private static void verifyCorridorConnectionPointDeleteThroughMapView() {
        TestRuntime runtime = TestRuntime.create();
        TestBinding binding = bindTest(runtime);
        DungeonEditorControlsView controls = binding.controls();

        long mapId = createMapThroughControls(controls, runtime, "Corridor Point Delete Map");
        runtime.database().seedCorridorWithAnchor(mapId);
        createMapThroughControls(controls, runtime, "Corridor Point Delete Reload Hop");
        selectMap(controls, "Corridor Point Delete Map");
        var anchorHandle = firstCorridorAnchorHandle(runtime.editorApi().current(), "DE-COR-006");
        long corridorId = anchorHandle.ref().corridorId();
        DungeonTopologyElementRef anchorRef = editorTopologyRef(anchorHandle.ref().topologyRef());
        assertEquals(1L, runtime.database().countCorridorAnchorsAt(mapId, 6, 5, 0),
                "DE-COR-006 fixture starts with authored A1 at (6,5,0)");
        click(button(controls, "Korridor"));
        long revisionBeforeDelete = runtime.database().mapRevision(mapId);

        deletePublishedCorridorAnchor(runtime, anchorHandle);

        assertEquals(revisionBeforeDelete + 1L, runtime.database().mapRevision(mapId),
                "DE-COR-006 corridor branch delete commits exactly one aggregate revision");
        assertCorridorDoorBindingCount(runtime.database().corridorStableConnectionState(mapId), corridorId, 2,
                "DE-COR-006 keeps both surviving door endpoints");
        assertNoCorridorAnchorRef(runtime.database().corridorStableConnectionState(mapId), corridorId, anchorRef.id(),
                "DE-COR-006 removes stale A1 anchor ref");
        assertNoCorridorWaypoints(runtime.database().corridorWaypointAbsoluteState(mapId), corridorId,
                "DE-COR-006 removes authored waypoints for deterministic reroute");
        assertEquals(0L, runtime.database().countCorridorAnchorsAt(mapId, 6, 5, 0),
                "DE-COR-006 prunes unreferenced authored A1");
        Set<String> expectedCells = Set.of("4,2,0", "5,2,0", "6,2,0", "7,2,0");
        DungeonEditorState committedSurface = runtime.editorApi().current();
        assertEmptySelection(committedSurface.selection(), "DE-COR-006 committed surface");
        assertCorridorCreatedInSnapshot(committedSurface, binding.mapContentModel(), corridorId, expectedCells,
                "DE-COR-006");
        assertTrue(committedSurface.selectedWindow().map().editorHandles().stream().noneMatch(handle ->
                        handle.ref().topologyRef().equals(anchorHandle.ref().topologyRef())),
                "DE-COR-006 published snapshot omits stale A1 handle");
        assertTrue(!renderHasGlyphAt(binding.mapContentModel(), anchorRef, 6.5, 5.5, false),
                "DE-COR-006 render omits stale A1 marker");

        selectMap(controls, "Corridor Point Delete Reload Hop");
        selectMap(controls, "Corridor Point Delete Map");
        assertCorridorCreatedInSnapshot(runtime.editorApi().current(), binding.mapContentModel(), corridorId,
                expectedCells, "DE-COR-006 reload");
        assertNoCorridorWaypoints(runtime.database().corridorWaypointAbsoluteState(mapId), corridorId,
                "DE-COR-006 reload");


    }


    private static void verifyCorridorDoorConnectionDeleteThroughMapView() {
        TestRuntime runtime = TestRuntime.create();
        TestBinding binding = bindTest(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();

        long mapId = createMapThroughControls(controls, runtime, "Corridor Door Delete Map");
        runtime.database().seedCorridorWithAnchor(mapId);
        createMapThroughControls(controls, runtime, "Corridor Door Delete Reload Hop");
        selectMap(controls, "Corridor Door Delete Map");
        var doorHandle = firstDoorHandleAt(runtime.editorApi().current(), 4, 2, 0, "DE-COR-007 D1");
        long corridorId = doorHandle.ref().corridorId();
        DungeonTopologyElementRef doorRef = editorTopologyRef(doorHandle.ref().topologyRef());
        DungeonTopologyElementRef anchorRef =
                editorTopologyRef(firstCorridorAnchorHandle(runtime.editorApi().current(), "DE-COR-007")
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
        Set<String> expectedCells = Set.of("6,2,0", "6,3,0", "6,4,0", "6,5,0", "7,2,0");
        DungeonEditorState committedSurface = runtime.editorApi().current();
        assertEmptySelection(committedSurface.selection(), "DE-COR-007 committed surface");
        assertCorridorCreatedInSnapshot(committedSurface, binding.mapContentModel(), corridorId, expectedCells,
                "DE-COR-007");
        assertDisjoint(areaCellSet(corridorAreaById(committedSurface, corridorId, "DE-COR-007")),
                Set.of("4,2,0", "5,2,0"),
                "DE-COR-007 committed corridor omits the removed D1-only branch");

        selectMap(controls, "Corridor Door Delete Reload Hop");
        selectMap(controls, "Corridor Door Delete Map");
        assertCorridorCreatedInSnapshot(runtime.editorApi().current(), binding.mapContentModel(), corridorId,
                expectedCells, "DE-COR-007 reload");
        assertNoCorridorDoorBinding(runtime.database().corridorStableConnectionState(mapId), corridorId, doorRef.id(),
                "DE-COR-007 reload");


    }


    private static void verifyGenericCorridorHitReusesAnchorEndpointThroughMapView() {
        TestRuntime runtime = TestRuntime.create();
        TestBinding binding = bindTest(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();

        long mapId = createMapThroughControls(controls, runtime, "Corridor Generic Anchor Map");
        runtime.database().seedCorridorWithAnchor(mapId);
        createMapThroughControls(controls, runtime, "Corridor Generic Anchor Reload Hop");
        selectMap(controls, "Corridor Generic Anchor Map");
        Set<Long> corridorIdsBefore = runtime.database().corridorIdsForMap(mapId);
        List<String> anchorRowsBefore = runtime.database().corridorAnchorState(mapId);
        DungeonEditorHandleSnapshot existingAnchor = firstCorridorAnchorHandle(
                runtime.editorApi().current(), "DE-COR-013 existing-anchor");
        DungeonTopologyElementRef anchorRef = editorTopologyRef(existingAnchor.ref().topologyRef());
        Point2D doorOne = boundaryMidpointNear(binding.mapContentModel(), "DOOR", 4.0, 2.5);
        click(button(controls, "Korridor"));
        assertEquals(DungeonEditorToolSelection.family(DungeonEditorToolFamily.CORRIDOR),
                runtime.editorApi().current().toolSelection(),
                "DE-COR-013 existing-anchor corridor family selects corridor-create tool");
        AuthoredCorridorState beforeFirstClick = AuthoredCorridorState.capture(runtime, binding, mapId);
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();

        createFromPublishedCorridorAnchor(runtime, existingAnchor);
        assertFirstClickDraftOnly(
                beforeFirstClick,
                runtime,
                binding,
                mapId,
                "DE-COR-013 existing published-anchor first click");
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
                runtime.editorApi().current(),
                binding.mapContentModel(),
                newCorridorId,
                Set.of("4,2,0", "5,2,0", "6,2,0", "6,3,0", "6,4,0", "6,5,0"),
                "DE-COR-013 existing-anchor");
        selectMap(controls, "Corridor Generic Anchor Reload Hop");
        selectMap(controls, "Corridor Generic Anchor Map");
        assertCorridorCreatedInSnapshot(
                runtime.editorApi().current(),
                binding.mapContentModel(),
                newCorridorId,
                Set.of("4,2,0", "5,2,0", "6,2,0", "6,3,0", "6,4,0", "6,5,0"),
                "DE-COR-013 existing-anchor reload");

    }


    private static void verifyGenericCorridorHitMaterializesAbsentAnchorEndpointThroughMapView() {
        TestRuntime runtime = TestRuntime.create();
        TestBinding binding = bindTest(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();

        long mapId = createMapThroughControls(controls, runtime, "Corridor Absent Anchor Map");
        runtime.database().seedCorridorWithAnchor(mapId);
        createMapThroughControls(controls, runtime, "Corridor Absent Anchor Reload Hop");
        selectMap(controls, "Corridor Absent Anchor Map");
        Set<Long> corridorIdsBefore = runtime.database().corridorIdsForMap(mapId);
        List<String> anchorRowsBefore = runtime.database().corridorAnchorState(mapId);
        DungeonEditorHandleSnapshot hostAnchor = firstCorridorAnchorHandle(
                runtime.editorApi().current(), "DE-COR-013 new-anchor host");
        Point2D genericCorridorPoint = selectableGenericCorridorPoint(
                runtime.editorApi().current(),
                binding.mapContentModel(),
                hostAnchor,
                "DE-COR-013 new-anchor");
        Cell materializedAnchorCell = new Cell(
                (int) Math.floor(genericCorridorPoint.getX()),
                (int) Math.floor(genericCorridorPoint.getY()),
                hostAnchor.cell().level());
        Point2D doorOne = boundaryMidpointNear(binding.mapContentModel(), "DOOR", 4.0, 2.5);
        Set<String> expectedCells = manhattanCorridorCells(genericCorridorPoint, doorOne);
        click(button(controls, "Korridor"));
        assertEquals(DungeonEditorToolSelection.family(DungeonEditorToolFamily.CORRIDOR),
                runtime.editorApi().current().toolSelection(),
                "DE-COR-013 new-anchor corridor family selects corridor-create tool");
        assertPointerTarget(
                binding.mapContentModel(),
                genericCorridorPoint,
                features.dungeon.api.editor.DungeonEditorPointerInput.TargetKind.CELL,
                "DE-COR-013 new-anchor corridor body");
        assertEquals(features.dungeon.api.editor.DungeonEditorPointerInput.ElementKind.CORRIDOR,
                runtimePointerTarget(binding.mapContentModel(), genericCorridorPoint.getX(), genericCorridorPoint.getY())
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
                expectedCells,
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
                        row.contains("host_corridor_id=" + hostAnchor.ref().corridorId())
                                && row.contains("cell_x=" + materializedAnchorCell.q())
                                && row.contains("cell_y=" + materializedAnchorCell.r())
                                && row.contains("cell_z=" + materializedAnchorCell.level())
                                && row.contains("topology_element_id=" + materializedAnchorRef)),
                "DE-COR-013 new-anchor materializes an anchor at the selected generic corridor cell: "
                        + anchorRowsAfter);
        List<String> stableState = runtime.database().corridorStableConnectionState(mapId);
        assertCorridorDoorBindingCount(stableState, newCorridorId, 1, "DE-COR-013 new-anchor");
        assertCorridorAnchorRef(stableState, newCorridorId, materializedAnchorRef, "DE-COR-013 new-anchor");
        assertCorridorCreatedInSnapshot(
                runtime.editorApi().current(),
                binding.mapContentModel(),
                newCorridorId,
                expectedCells,
                "DE-COR-013 new-anchor");
        assertTrue(runtime.editorApi().current().selectedWindow().map().editorHandles().stream()
                        .anyMatch(handle -> "CORRIDOR_ANCHOR".equals(handle.ref().kind().name())
                                && handle.ref().topologyRef().id() == materializedAnchorRef
                                && handle.cell().q() == materializedAnchorCell.q()
                                && handle.cell().r() == materializedAnchorCell.r()
                                && handle.cell().level() == materializedAnchorCell.level()),
                "DE-COR-013 new-anchor published snapshot exposes the materialized anchor handle");
        selectMap(controls, "Corridor Absent Anchor Reload Hop");
        selectMap(controls, "Corridor Absent Anchor Map");
        assertCorridorCreatedInSnapshot(
                runtime.editorApi().current(),
                binding.mapContentModel(),
                newCorridorId,
                expectedCells,
                "DE-COR-013 new-anchor reload");
        assertTrue(runtime.editorApi().current().selectedWindow().map().editorHandles().stream()
                        .anyMatch(handle -> "CORRIDOR_ANCHOR".equals(handle.ref().kind().name())
                                && handle.ref().topologyRef().id() == materializedAnchorRef
                                && handle.cell().q() == materializedAnchorCell.q()
                                && handle.cell().r() == materializedAnchorCell.r()
                                && handle.cell().level() == materializedAnchorCell.level()),
                "DE-COR-013 new-anchor reload preserves the materialized anchor topology identity");

    }


    private static void verifyInvalidCorridorRouteRejectedThroughMapView() {
        TestRuntime runtime = TestRuntime.create();
        TestBinding binding = bindTest(runtime);
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
        assertPointerTarget(binding.mapContentModel(), westWall,
                features.dungeon.api.editor.DungeonEditorPointerInput.TargetKind.BOUNDARY, "DE-COR-008 west endpoint");
        assertPointerTarget(binding.mapContentModel(), eastWall,
                features.dungeon.api.editor.DungeonEditorPointerInput.TargetKind.BOUNDARY, "DE-COR-008 east endpoint");
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();

        fireMapMousePressed(mapView, MouseButton.PRIMARY,
                viewport.sceneToScreenX(westWall.getX()), viewport.sceneToScreenY(westWall.getY()), false);
        fireMapMouse(mapView, MouseEvent.MOUSE_MOVED, MouseButton.NONE,
                viewport.sceneToScreenX(eastWall.getX()), viewport.sceneToScreenY(eastWall.getY()), false);
        assertEquals(DungeonEditorPreview.none(), runtime.editorApi().current().preview(),
                "DE-COR-008 invalid candidate does not publish a corridor preview");
        fireMapMousePressed(mapView, MouseButton.PRIMARY,
                viewport.sceneToScreenX(eastWall.getX()), viewport.sceneToScreenY(eastWall.getY()), false);

        assertEquals(corridorIdsBefore, runtime.database().corridorIdsForMap(mapId),
                "DE-COR-008 invalid route creates no corridor row");
        assertEquals(authoredStateBefore, runtime.database().authoredGeometryState(mapId),
                "DE-COR-008 invalid route leaves authored DB state unchanged");
        assertEquals(DungeonEditorPreview.none(), runtime.editorApi().current().preview(),
                "DE-COR-008 invalid route clears published preview state");
        assertTrue(runtime.editorApi().current().commandStatus().message().contains("blockiert"),
                "DE-COR-008 status reports route rejection");
        assertEquals(
                features.dungeon.api.editor.DungeonEditorCommandOutcome.RejectionReason.BLOCKED_ROUTE,
                ((features.dungeon.api.editor.DungeonEditorCommandOutcome.Rejected)
                        runtime.editorApi().current().commandStatus().outcome()).reason(),
                "DE-COR-008 publishes typed blocked-route rejection");
        assertEquals(0L, runtime.editorApi().current().selectedWindow().map().areas().stream()
                        .filter(area -> "CORRIDOR".equalsIgnoreCase(area.kind()))
                        .count(),
                "DE-COR-008 publishes no committed corridor area");
        assertEquals(renderCellsBefore, renderSurfaceCellOriginsWithZ(binding.mapContentModel()),
                "DE-COR-008 render-facing cell state remains unchanged");


    }


    private static void verifyGenericEndpointMaterializesOnlyAtFullCommitThroughMapView() {
        verifyGenericRoomHitMaterializesFacingDoorThroughMapView();
        verifyGenericCorridorHitReusesAnchorEndpointThroughMapView();
        verifyGenericCorridorHitMaterializesAbsentAnchorEndpointThroughMapView();

    }

    private static void verifyGenericRoomHitMaterializesFacingDoorThroughMapView() {
        TestRuntime runtime = TestRuntime.create();
        TestBinding binding = bindTest(runtime);
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
        assertPointerTarget(binding.mapContentModel(), roomInterior,
                features.dungeon.api.editor.DungeonEditorPointerInput.TargetKind.LABEL, "DE-COR-013 generic-room start");
        assertEquals(features.dungeon.api.editor.DungeonEditorPointerInput.ElementKind.ROOM,
                runtimePointerTarget(binding.mapContentModel(), roomInterior.getX(), roomInterior.getY())
                        .elementKind(),
                "DE-COR-013 generic-room start resolves as a room target rather than a door target");
        assertCorridorToolDoorBoundaryTarget(binding.mapContentModel(), doorTwo,
                "DE-COR-013 generic-room second door");
        AuthoredCorridorState beforeFirstClick = AuthoredCorridorState.capture(runtime, binding, mapId);
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();

        fireMapMousePressed(mapView, MouseButton.PRIMARY,
                viewport.sceneToScreenX(roomInterior.getX()), viewport.sceneToScreenY(roomInterior.getY()), false);
        assertFirstClickDraftOnly(
                beforeFirstClick,
                runtime,
                binding,
                mapId,
                "DE-COR-013 generic room first click");
        fireMapMouse(mapView, MouseEvent.MOUSE_MOVED, MouseButton.NONE,
                viewport.sceneToScreenX(doorTwo.getX()), viewport.sceneToScreenY(doorTwo.getY()), false);
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
                                && row.contains("|cell_x=3|")
                                && row.contains("|cell_y=2|")
                                && row.contains("|edge_direction=EAST|")
                                && row.contains("|edge_type=DOOR|")
                                && row.contains("|topology_element_id=" + materializedDoorRef)),
                "DE-COR-013 generic-room materialized door row uses the absolute R1 east edge: " + doorRowsAfter);
        assertTrue(stableState.stream().anyMatch(row ->
                        row.startsWith("dungeon_corridor_door_overrides|corridor_id=" + newCorridorId + "|")
                                && row.contains("|relative_cell_x=3|")
                                && row.contains("|relative_cell_y=2|")
                                && row.contains("|edge_direction=EAST|")
                                && row.contains("|topology_element_id=" + materializedDoorRef)),
                "DE-COR-013 generic-room endpoint persists the materialized absolute east-facing door edge: "
                        + stableState);
        assertCorridorCreatedInSnapshot(
                runtime.editorApi().current(),
                binding.mapContentModel(),
                newCorridorId,
                cellRect(4, 2, 7, 2, 0),
                "DE-COR-013 generic-room");
        DungeonTopologyElementRef materializedDoor =
                new DungeonTopologyElementRef(features.dungeon.api.DungeonTopologyElementKind.DOOR, materializedDoorRef);
        assertTrue(runtime.editorApi().current().selectedWindow().map().boundaries().stream()
                        .anyMatch(boundary -> "door".equalsIgnoreCase(boundary.kind())
                                && boundary.topologyRef().equals(materializedDoor)),
                "DE-COR-013 generic-room published snapshot exposes the materialized door boundary");
        assertTrue(renderHasBoundaryNear(binding.mapContentModel(), "DOOR", 4.0, 2.5),
                "DE-COR-013 generic-room render scene shows the materialized door boundary");
        selectMap(controls, "Corridor Generic Room Door Reload Hop");
        selectMap(controls, "Corridor Generic Room Door Map");
        assertCorridorCreatedInSnapshot(
                runtime.editorApi().current(),
                binding.mapContentModel(),
                newCorridorId,
                cellRect(4, 2, 7, 2, 0),
                "DE-COR-013 generic-room reload");
        assertTrue(runtime.editorApi().current().selectedWindow().map().boundaries().stream()
                        .anyMatch(boundary -> "door".equalsIgnoreCase(boundary.kind())
                                && boundary.topologyRef().equals(materializedDoor)),
                "DE-COR-013 generic-room reload published snapshot preserves the materialized door topology identity");

    }

    private static void assertFirstClickDraftOnly(
            AuthoredCorridorState before,
            TestRuntime runtime,
            TestBinding binding,
            long mapId,
            String message
    ) {
        DungeonEditorState draftState = runtime.editorApi().current();
        assertEquals(DungeonEditorToolSelection.family(DungeonEditorToolFamily.CORRIDOR), draftState.toolSelection(),
                message + " keeps the corridor-create tool active for the second endpoint");
        assertTrue(draftState.commandStatus().message().startsWith("Start:"),
                message + " publishes the first endpoint status through atomic editor state");
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
        assertEquals(before.surfaceCorridorCount(), surfaceCorridorCount(draftState),
                message + " publishes no additional committed corridor surface");
        assertEquals(before.renderCells(), renderSurfaceCellOriginsWithZ(binding.mapContentModel()),
                message + " leaves rendered committed geometry unchanged");
        assertEquals(DungeonEditorPreview.none(), draftState.preview(),
                message + " keeps the published preview surface clear until a valid completion candidate exists");
    }

    private static void assertHoverKeepsCommittedCorridorState(
            AuthoredCorridorState before,
            TestRuntime runtime,
            TestBinding binding,
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
        assertEquals(before.surfaceCorridorCount(), surfaceCorridorCount(runtime.editorApi().current()),
                message + " publishes no additional committed corridor surface before commit");
        assertEquals(before.surfaceMapCells(), mapSnapshotCellSet(runtime.editorApi().current().selectedWindow().map()),
                message + " leaves committed surface map cells unchanged before commit");
    }

    private static void assertVisibleCorridorPreview(
            TestRuntime runtime,
            TestBinding binding,
            Set<String> expectedCells,
            String message
    ) {
        DungeonEditorState snapshot = runtime.editorApi().current();
        assertEquals(DungeonEditorPreview.none(), snapshot.preview(),
                message + " keeps corridor preview out of the public typed preview channel");
        assertTrue(snapshot.selectedWindow().previewMap() != null,
                message + " publishes a visible preview map");
        Set<String> committedCells = mapSnapshotCellSet(snapshot.selectedWindow().map());
        Set<String> expectedAddedPreviewCells = new LinkedHashSet<>(expectedCells);
        expectedAddedPreviewCells.removeAll(committedCells);
        Set<String> addedPreviewCells = new LinkedHashSet<>(mapSnapshotCellSet(snapshot.selectedWindow().previewMap()));
        addedPreviewCells.removeAll(committedCells);
        assertEquals(expectedAddedPreviewCells, addedPreviewCells,
                message + " preview map adds exactly the candidate corridor route cells");
        PreviewDiff previewRenderDiff = PreviewDiff.from(snapshot);
        assertTrue(!previewRenderDiff.isEmpty(),
                message + " publishes runtime-prepared preview diff facts");
        assertEquals(expectedCells, renderPreviewSurfaceCellOriginsWithZ(binding.mapContentModel()),
                message + " render scene paints exactly the candidate corridor route cells");
    }

    private static void assertRejectedCompletionLeavesAuthoredState(
            AuthoredCorridorState before,
            TestRuntime runtime,
            TestBinding binding,
            long mapId,
            String message
    ) {
        assertTrue(runtime.editorApi().current().commandStatus().message().contains("blockiert"),
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
        assertEquals(before.surfaceCorridorCount(), surfaceCorridorCount(runtime.editorApi().current()),
                message + " publishes no committed corridor surface");
        assertEquals(before.renderCells(), renderSurfaceCellOriginsWithZ(binding.mapContentModel()),
                message + " leaves rendered committed geometry unchanged");
        assertEquals(DungeonEditorPreview.none(), runtime.editorApi().current().preview(),
                message + " clears preview after rejection");
    }

    private static Point2D corridorBodyCenter(
            DungeonEditorState state,
            long corridorId,
            String scenario
    ) {
        var corridor = state.selectedWindow().map().areas().stream()
                .filter(area -> "CORRIDOR".equals(area.kind()))
                .filter(area -> area.topologyRef().id() == corridorId)
                .findFirst()
                .orElseThrow(() -> new IllegalStateException(
                        scenario + " corridor area not loaded for corridor " + corridorId + "."));
        var cell = corridor.cells().stream()
                .findFirst()
                .orElseThrow(() -> new IllegalStateException(
                        scenario + " corridor area has no published cells."));
        return new Point2D(cell.q() + 0.5, cell.r() + 0.5);
    }

    private static Point2D selectableGenericCorridorPoint(
            DungeonEditorState state,
            DungeonMapContentModel mapContentModel,
            DungeonEditorHandleSnapshot hostAnchor,
            String scenario
    ) {
        long corridorId = hostAnchor.ref().corridorId();
        return state.selectedWindow().map().areas().stream()
                .filter(area -> "CORRIDOR".equalsIgnoreCase(area.kind()))
                .filter(area -> area.topologyRef().id() == corridorId)
                .flatMap(area -> area.cells().stream())
                .sorted(Comparator.comparingInt(cell -> Math.abs(cell.q() - hostAnchor.cell().q())
                        + Math.abs(cell.r() - hostAnchor.cell().r())
                        + Math.abs(cell.level() - hostAnchor.cell().level())))
                .map(cell -> new Point2D(cell.q() + 0.5, cell.r() + 0.5))
                .filter(point -> genericCorridorTargetAt(mapContentModel, point, corridorId))
                .findFirst()
                .orElseThrow(() -> new AssertionError(
                        scenario + " has no published generic corridor cell selectable through the map input route"));
    }

    private static boolean genericCorridorTargetAt(
            DungeonMapContentModel mapContentModel,
            Point2D point,
            long corridorId
    ) {
        var target = runtimePointerTarget(mapContentModel, point.getX(), point.getY());
        return target.targetKind() == DungeonEditorPointerInput.TargetKind.CELL
                && target.elementKind() == DungeonEditorPointerInput.ElementKind.CORRIDOR
                && target.topologyId() == corridorId;
    }

    private static DungeonTopologyElementRef dependentHostAnchorRef(
            List<String> stableRows,
            long dependentCorridorId,
            String scenario
    ) {
        String prefix = "dungeon_corridor_anchor_refs|corridor_id=" + dependentCorridorId + "|";
        List<Long> anchorIds = stableRows.stream()
                .filter(row -> row.startsWith(prefix))
                .map(row -> stableRowLong(row, "topology_element_id="))
                .distinct()
                .toList();
        if (anchorIds.size() != 1) {
            throw new AssertionError(scenario + " expected exactly one host-anchor binding, rows=" + stableRows);
        }
        return new DungeonTopologyElementRef(
                features.dungeon.api.DungeonTopologyElementKind.CORRIDOR_ANCHOR, anchorIds.get(0));
    }

    private static DungeonEditorHandleSnapshot corridorAnchorHandle(
            DungeonEditorState state,
            DungeonTopologyElementRef anchorRef,
            String scenario
    ) {
        return state.selectedWindow().map().editorHandles().stream()
                .filter(handle -> handle.ref().topologyRef().equals(anchorRef))
                .filter(handle -> "CORRIDOR_ANCHOR".equals(handle.ref().kind().name()))
                .findFirst()
                .orElseThrow(() -> new AssertionError(
                        scenario + " host anchor is not published for " + anchorRef));
    }

    private static void assertCorridorToolDoorBoundaryTarget(
            DungeonMapContentModel mapContentModel,
            Point2D doorPoint,
            String scenario
    ) {
        var target = runtimePointerTarget(mapContentModel, doorPoint.getX(), doorPoint.getY(), true);
        assertEquals(DungeonEditorPointerInput.TargetKind.BOUNDARY, target.targetKind(),
                scenario + " uses the corridor tool's boundary-preferred pointer route");
        assertEquals(DungeonEditorPointerInput.BoundaryKind.DOOR, target.boundaryRef().boundaryKind(),
                scenario + " boundary remains a fixed door endpoint");
    }

    private static Set<String> manhattanCorridorCells(Point2D start, Point2D doorBoundaryTarget) {
        int startQ = (int) Math.floor(start.getX());
        int startR = (int) Math.floor(start.getY());
        int targetQ = (int) Math.floor(doorBoundaryTarget.getX());
        int targetR = (int) Math.floor(doorBoundaryTarget.getY());
        Set<String> cells = new LinkedHashSet<>();
        int qStep = Integer.compare(startQ, targetQ);
        for (int q = targetQ; q != startQ + qStep; q += qStep) {
            cells.add(cellKeyAt(q, targetR, 0));
        }
        int rStep = Integer.compare(startR, targetR);
        for (int r = targetR + rStep; r != startR + rStep; r += rStep) {
            cells.add(cellKeyAt(startQ, r, 0));
        }
        return Set.copyOf(cells);
    }

    private static Set<String> translatedCellKeys(Set<String> cells, int deltaQ, int deltaR, int deltaLevel) {
        Set<String> translated = new LinkedHashSet<>();
        for (String cell : cells) {
            String[] coordinates = cell.split(",");
            if (coordinates.length != 3) {
                throw new AssertionError("Expected q,r,level cell key: " + cell);
            }
            translated.add(cellKeyAt(
                    Integer.parseInt(coordinates[0]) + deltaQ,
                    Integer.parseInt(coordinates[1]) + deltaR,
                    Integer.parseInt(coordinates[2]) + deltaLevel));
        }
        return Set.copyOf(translated);
    }

    private static Set<String> clusterSurfaceCells(
            features.dungeon.api.DungeonEditorMapSnapshot map,
            long clusterId
    ) {
        Set<String> cells = new LinkedHashSet<>();
        for (var area : map.areas()) {
            if (area.clusterId() == clusterId) {
                for (var cell : area.cells()) {
                    cells.add(cellKeyAt(cell.q(), cell.r(), cell.level()));
                }
            }
        }
        return Set.copyOf(cells);
    }

    private static Point2D clusterLabelCenterForRef(
            DungeonMapContentModel mapContentModel,
            DungeonTopologyElementRef topologyRef
    ) {
        String selectionRef = topologyRef.kind() + ":" + topologyRef.id();
        return mapContentModel.canvasStateProperty().get().renderScene().texts().stream()
                .filter(text -> selectionRef.equals(text.selectionRef()))
                .filter(text -> text.hitRef().endsWith(":CLUSTER_LABEL"))
                .map(text -> new Point2D(text.centerX(), text.centerY()))
                .findFirst()
                .orElseThrow(() -> new AssertionError(
                        "DE-CLUSTER-COR-001 rendered cluster-label hit text not found for " + selectionRef));
    }

    private static Cell primaryCell(Set<String> cells) {
        Cell primary = null;
        for (String cell : cells) {
            String[] coordinates = cell.split(",");
            if (coordinates.length != 3) {
                throw new AssertionError("Expected q,r,level cell key: " + cell);
            }
            Cell candidate = new Cell(
                    Integer.parseInt(coordinates[0]),
                    Integer.parseInt(coordinates[1]),
                    Integer.parseInt(coordinates[2]));
            if (primary == null
                    || candidate.level() < primary.level()
                    || candidate.level() == primary.level() && candidate.r() < primary.r()
                    || candidate.level() == primary.level() && candidate.r() == primary.r()
                            && candidate.q() < primary.q()) {
                primary = candidate;
            }
        }
        if (primary == null) {
            throw new AssertionError("Expected at least one translated cluster cell");
        }
        return primary;
    }

    private static String cellKeyAt(int q, int r, int level) {
        return q + "," + r + "," + level;
    }

    private static long stableRowLong(String row, String key) {
        int start = row.indexOf(key);
        if (start < 0) {
            throw new AssertionError("Missing " + key + " in stable row: " + row);
        }
        String value = row.substring(start + key.length()).split("[|,]")[0];
        return Long.parseLong(value);
    }

    private static long surfaceCorridorCount(DungeonEditorState snapshot) {
        return snapshot.selectedWindow().map().areas().stream()
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
                TestRuntime runtime,
                TestBinding binding,
                long mapId
        ) {
            return new AuthoredCorridorState(
                    runtime.database().corridorIdsForMap(mapId),
                    runtime.database().corridorAnchorState(mapId),
                    runtime.database().doorBoundaryState(mapId),
                    runtime.database().corridorStableConnectionState(mapId),
                    runtime.database().corridorWaypointAbsoluteState(mapId),
                    runtime.database().authoredGeometryState(mapId),
                    mapSnapshotCellSet(runtime.editorApi().current().selectedWindow().map()),
                    renderSurfaceCellOriginsWithZ(binding.mapContentModel()),
                    DungeonEditorCorridorScenarios.surfaceCorridorCount(runtime.editorApi().current()));
        }
    }

}
