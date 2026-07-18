package features.dungeon.adapter.javafx.editor;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Direction;
import features.dungeon.api.DungeonCellRef;
import features.dungeon.api.DungeonEdgeRef;
import features.dungeon.api.DungeonEditorControlsModel;
import features.dungeon.api.DungeonEditorControlsSnapshot;
import features.dungeon.api.DungeonEditorMapSurfaceModel;
import features.dungeon.api.DungeonEditorMapSurfaceSnapshot;
import features.dungeon.api.DungeonEditorPreview;
import features.dungeon.api.DungeonEditorStateSnapshot;
import features.dungeon.api.DungeonTopologyElementRef;
import features.dungeon.api.editor.DungeonEditorToolFamily;
import features.dungeon.api.editor.DungeonEditorToolOptions;
import features.dungeon.api.editor.DungeonEditorToolSelection;
import features.dungeon.api.DungeonEditorViewMode;
import features.dungeon.api.DungeonInspectorSnapshot;
import features.dungeon.api.DungeonMapSummary;
import features.dungeon.api.DungeonOverlaySettings;
import features.dungeon.application.editor.DungeonEditorRuntimePointerTarget;
import features.dungeon.api.DungeonTopologyElementRef;
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

final class DungeonEditorStairScenarios {


    private DungeonEditorStairScenarios() {
    }

    static void run() throws Exception {
        route(() -> verifyStraightStairCreateThroughMapView());
        route(() -> verifyStairAnchorMoveThroughMapView());
        route(() -> verifyStraightStairGeometryEditThroughStateView());
        route(() -> verifyInvalidStairRoomInteriorRecomputeThroughStateView());
        route(() -> verifyStairDeleteThroughMapView());
        route(() -> verifyCrossLevelCorridorCreatesStairThroughMapView());
    }

    private static void route(
            DungeonEditorTestSupport.ThrowingRunnable action
    ) throws Exception {
        DungeonEditorTestSupport.runRoute(action);
    }

    private static void verifyStairAnchorMoveThroughMapView() {
        TestRuntime runtime = TestRuntime.create();
        TestBinding binding = bindTest(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();

        long mapId = createMapThroughControls(controls, runtime, "Stair Anchor Move Map");
        createMapThroughControls(controls, runtime, "Stair Anchor Move Reload Hop");
        runtime.database().seedF7StairAnchor(mapId);
        selectMap(controls, "Stair Anchor Move Map");
        click(button(controls, "Auswahl"));
        assertEquals(DungeonEditorToolSelection.select(), runtime.controlsModel().current().toolSelection(),
                "DE-STAIR-005 input route uses the select tool");
        var stairHandle = runtime.mapSurfaceModel().current().surface().map().editorHandles().stream()
                .filter(handle -> "STAIR_ANCHOR".equals(handle.ref().kind().name()))
                .filter(handle -> handle.cell().q() == 2)
                .filter(handle -> handle.cell().r() == 2)
                .filter(handle -> handle.cell().level() == 0)
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("F7_STAIR_ANCHOR lower stair path handle not loaded."));
        DungeonTopologyElementRef stairRef = editorTopologyRef(stairHandle.ref().topologyRef());
        List<String> stableRowsBefore = runtime.database().stairStableState(mapId);
        List<String> pathRowsBefore = runtime.database().stairPathState(mapId);
        List<String> exitRowsBefore = runtime.database().stairExitState(mapId);
        String pathRowBefore = pathRowsBefore.stream()
                .filter(row -> row.contains("|sort_order=0|")
                        && row.contains("|cell_x=2|")
                        && row.contains("|cell_y=2|")
                        && row.contains("|cell_z=0"))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException(
                        "DE-STAIR-005 starts with lower path node at (2,2,0): " + pathRowsBefore));
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();
        Point2D anchorCenter = new Point2D(2.5, 2.5);
        assertEquals(DungeonEditorRuntimePointerTarget.TargetKind.HANDLE, runtimePointerTarget(binding.mapContentModel(), anchorCenter.getX(), anchorCenter.getY()).targetKind(),
                "DE-STAIR-005 input route resolves the stair anchor as a handle");

        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_PRESSED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(anchorCenter.getX()),
                viewport.sceneToScreenY(anchorCenter.getY()),
                false);
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_DRAGGED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(3.5),
                viewport.sceneToScreenY(2.5),
                false);

        DungeonEditorMapSurfaceSnapshot previewSurface = runtime.mapSurfaceModel().current();
        assertEquals(pathRowsBefore, runtime.database().stairPathState(mapId),
                "DE-STAIR-005 drag preview leaves stair path DB rows unchanged");
        assertEquals(exitRowsBefore, runtime.database().stairExitState(mapId),
                "DE-STAIR-005 drag preview leaves stair exit DB rows unchanged");
        assertEquals(stairRef, previewSurface.selection().topologyRef(),
                "DE-STAIR-005 preview keeps selected stair topology ref");
        assertTrue(previewSurface.preview() instanceof DungeonEditorPreview.MoveHandlePreview,
                "DE-STAIR-005 publishes a move-handle preview during stair drag");
        DungeonEditorPreview.MoveHandlePreview preview =
                (DungeonEditorPreview.MoveHandlePreview) previewSurface.preview();
        assertEquals(1L, preview.deltaQ(), "DE-STAIR-005 preview delta q");
        assertEquals(0L, preview.deltaR(), "DE-STAIR-005 preview delta r");
        assertEquals(0L, preview.deltaLevel(), "DE-STAIR-005 preview delta level");
        assertEquals(stairHandle.ref().kind(), preview.handleRef().kind(),
                "DE-STAIR-005 preview handle kind");
        assertEquals(stairHandle.ref().topologyRef(), preview.handleRef().topologyRef(),
                "DE-STAIR-005 preview handle topology ref");
        assertTrue(renderHasGlyphAt(binding.mapContentModel(), stairRef, 3.5, 2.5, true),
                "DE-STAIR-005 render scene shows selected preview stair handle at (3,2,0)");

        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_RELEASED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(3.5),
                viewport.sceneToScreenY(2.5),
                false);

        List<String> pathRowsAfter = runtime.database().stairPathState(mapId);
        assertTrue(pathRowsAfter.stream().anyMatch(row -> row.contains("|cell_x=3|")
                        && row.contains("|cell_y=2|")
                        && row.contains("|cell_z=0")),
                "DE-STAIR-005 persists the existing lower path node at (3,2,0): " + pathRowsAfter);
        assertTrue(!pathRowsAfter.contains(pathRowBefore),
                "DE-STAIR-005 removes old lower path node coordinates after release: " + pathRowsAfter);
        assertEquals(exitRowsBefore, runtime.database().stairExitState(mapId),
                "DE-STAIR-005 keeps stair exit coordinates unchanged for direct path-node movement");
        assertEquals(stableRowsBefore, runtime.database().stairStableState(mapId),
                "DE-STAIR-005 keeps stair identity, shape, dimensions, and topology refs stable");
        DungeonEditorMapSurfaceSnapshot committedSurface = runtime.mapSurfaceModel().current();
        assertEquals(DungeonEditorPreview.none(), committedSurface.preview(),
                "DE-STAIR-005 clears move preview after release");
        assertEquals(stairRef, committedSurface.selection().topologyRef(),
                "DE-STAIR-005 keeps selection on the same stair topology ref after release");
        assertStairMovedInSnapshot(committedSurface, binding.mapContentModel(), stairHandle.ref().topologyRef(),
                "DE-STAIR-005");
        assertCanvasPaintedAtScene(mapView, 3.5, 2.5,
                "DE-STAIR-005 rendered canvas paints the moved stair handle");

        selectMap(controls, "Stair Anchor Move Reload Hop");
        selectMap(controls, "Stair Anchor Move Map");
        assertEquals(pathRowsAfter, runtime.database().stairPathState(mapId),
                "DE-STAIR-005 reload keeps persisted stair path rows");
        assertEquals(exitRowsBefore, runtime.database().stairExitState(mapId),
                "DE-STAIR-005 reload keeps persisted stair exit rows");
        assertStairMovedInSnapshot(runtime.mapSurfaceModel().current(), binding.mapContentModel(),
                stairHandle.ref().topologyRef(), "DE-STAIR-005 reload");


    }


    private static void verifyStraightStairGeometryEditThroughStateView() {
        TestRuntime runtime = TestRuntime.create();
        TestBinding binding = bindTest(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();
        DungeonEditorStateView stateView = binding.stateView();

        long mapId = createMapThroughControls(controls, runtime, "Stair Geometry Map");
        createMapThroughControls(controls, runtime, "Stair Geometry Reload Hop");
        runtime.database().seedF7StairAnchor(mapId);
        selectMap(controls, "Stair Geometry Map");
        click(button(controls, "Auswahl"));
        var stairHandle = firstStairHandle(runtime.mapSurfaceModel().current(), "DE-STAIR-004");
        DungeonTopologyElementRef stairRef = editorTopologyRef(stairHandle.ref().topologyRef());
        Point2D stairCenter = glyphCenterForRef(binding.mapContentModel(), stairRef);
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();
        fireMapMousePressed(
                mapView,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(stairCenter.getX()),
                viewport.sceneToScreenY(stairCenter.getY()),
                false);

        ComboBox<?> shapeBox = comboBox(stateView, "Treppe Form");
        ComboBox<?> directionBox = comboBox(stateView, "Treppe Richtung");
        TextField dimension1Field = textField(stateView, "Treppe Laenge");
        TextField dimension2Field = textField(stateView, "Treppe Ebenenspanne");
        assertEquals("STRAIGHT", shapeBox.getValue(), "DE-STAIR-004 state card exposes current stair shape");
        assertEquals("NORTH", directionBox.getValue(), "DE-STAIR-004 state card exposes current stair direction");
        assertEquals("3", dimension1Field.getText(), "DE-STAIR-004 state card exposes current dimension1");
        assertEquals("1", dimension2Field.getText(), "DE-STAIR-004 state card exposes current dimension2");

        List<String> stableRowsBefore = runtime.database().stairStableState(mapId);
        List<String> pathRowsBefore = runtime.database().stairPathState(mapId);
        List<String> exitRowsBefore = runtime.database().stairExitState(mapId);
        long stairId = stairHandle.ref().topologyRef().id();
        selectComboItem(directionBox, "EAST");
        shapeBox = comboBox(stateView, "Treppe Form");
        directionBox = comboBox(stateView, "Treppe Richtung");
        dimension1Field = textField(stateView, "Treppe Laenge");
        dimension2Field = textField(stateView, "Treppe Ebenenspanne");
        assertStairGeometryDraftControls(
                shapeBox,
                directionBox,
                dimension1Field,
                dimension2Field,
                "STRAIGHT",
                "EAST",
                "3",
                "1",
                "DE-STATE-003 runtime publication keeps unsaved direction draft before save");
        dimension1Field.setText("4");
        shapeBox = comboBox(stateView, "Treppe Form");
        directionBox = comboBox(stateView, "Treppe Richtung");
        dimension1Field = textField(stateView, "Treppe Laenge");
        dimension2Field = textField(stateView, "Treppe Ebenenspanne");
        assertStairGeometryDraftControls(
                shapeBox,
                directionBox,
                dimension1Field,
                dimension2Field,
                "STRAIGHT",
                "EAST",
                "4",
                "1",
                "DE-STATE-003 runtime publication keeps unsaved dimension1 draft before save");
        dimension2Field.setText("2");
        shapeBox = comboBox(stateView, "Treppe Form");
        directionBox = comboBox(stateView, "Treppe Richtung");
        dimension1Field = textField(stateView, "Treppe Laenge");
        dimension2Field = textField(stateView, "Treppe Ebenenspanne");
        assertStairGeometryDraftControls(
                shapeBox,
                directionBox,
                dimension1Field,
                dimension2Field,
                "STRAIGHT",
                "EAST",
                "4",
                "2",
                "DE-STATE-003 runtime publication keeps complete unsaved stair draft before save");
        click(button(stateView, "Treppe aktualisieren"));

        List<String> stableRowsAfter = runtime.database().stairStableState(mapId);
        assertTrue(stableRowsAfter.stream().anyMatch(row -> row.startsWith("dungeon_stairs|stair_id=" + stairId)
                        && row.contains("|shape=STRAIGHT")
                        && row.contains("|direction=1")
                        && row.contains("|dimension1=4")
                        && row.contains("|dimension2=2")),
                "DE-STAIR-004 persists edited straight stair scalar spec: " + stableRowsAfter);
        assertTrue(stableRowsAfter.stream().anyMatch(row -> row.startsWith("dungeon_topology_elements|")
                        && row.contains("|element_kind=STAIR")
                        && row.contains("|element_id=" + stairId)),
                "DE-STAIR-010 keeps stable stair topology ref after recompute: " + stableRowsAfter);
        assertEquals(
                Set.of("2,2,0", "3,2,0", "4,2,0", "5,2,0"),
                stairPathCells(runtime.database().stairPathState(mapId), stairId),
                "DE-STAIR-004 recomputes straight stair path cells from the preserved anchor");
        assertUniqueStairPathCells(runtime.database().stairPathState(mapId), stairId,
                "DE-STAIR-007 straight recompute path cells stay unique");
        assertEquals(
                Set.of("2,2,0", "4,2,1", "5,2,2"),
                stairExitCells(runtime.database().stairExitState(mapId), stairId),
                "DE-STAIR-006 persists exits for every crossed floor");
        assertTrue(!pathRowsBefore.equals(runtime.database().stairPathState(mapId)),
                "DE-STAIR-010 path rows change through full recompute");
        assertTrue(!exitRowsBefore.equals(runtime.database().stairExitState(mapId)),
                "DE-STAIR-010 exit rows change through full recompute");
        DungeonEditorMapSurfaceSnapshot editedSurface = runtime.mapSurfaceModel().current();
        assertEquals(stairRef, editedSurface.selection().topologyRef(),
                "DE-STAIR-010 keeps selection on the recomputed stair");
        assertTrue(editedSurface.surface().map().features().stream()
                        .filter(feature -> feature.id() == stairId)
                        .flatMap(feature -> feature.cells().stream())
                        .anyMatch(cell -> cell.q() == 5 && cell.r() == 2 && cell.level() == 2),
                "DE-STAIR-006 published feature exposes generated top-floor exit");
        assertTrue(renderSurfaceCellOriginsWithZ(binding.mapContentModel()).containsAll(
                        Set.of("2,2,0", "3,2,0", "4,2,0", "5,2,0")),
                "DE-STAIR-004 render state exposes recomputed active-level path");
        click(button(controls, "+"));
        assertTrue(renderSurfaceCellOriginsWithZ(binding.mapContentModel()).contains("4,2,1"),
                "DE-STAIR-006 render state exposes intermediate crossed-floor exit");
        click(button(controls, "+"));
        assertTrue(renderSurfaceCellOriginsWithZ(binding.mapContentModel()).contains("5,2,2"),
                "DE-STAIR-006 render state exposes top crossed-floor exit");
        click(button(controls, "-"));
        click(button(controls, "-"));

        shapeBox = comboBox(stateView, "Treppe Form");
        directionBox = comboBox(stateView, "Treppe Richtung");
        selectComboItem(shapeBox, "SQUARE");
        shapeBox = comboBox(stateView, "Treppe Form");
        directionBox = comboBox(stateView, "Treppe Richtung");
        selectComboItem(directionBox, "SOUTH");
        shapeBox = comboBox(stateView, "Treppe Form");
        directionBox = comboBox(stateView, "Treppe Richtung");
        dimension1Field = textField(stateView, "Treppe Laenge");
        dimension2Field = textField(stateView, "Treppe Ebenenspanne");
        dimension1Field.setText("4");
        dimension1Field = textField(stateView, "Treppe Laenge");
        dimension2Field = textField(stateView, "Treppe Ebenenspanne");
        dimension2Field.setText("2");
        click(button(stateView, "Treppe aktualisieren"));

        Set<String> expectedSquarePath = Set.of(
                "2,2,0", "2,3,0", "2,4,0", "2,5,0",
                "1,5,0", "0,5,0", "-1,5,0", "-1,4,0",
                "-1,3,0", "-1,2,0", "0,2,0", "1,2,0",
                "1,3,0", "1,4,0", "0,4,0", "0,3,0");
        List<String> squareStableRows = runtime.database().stairStableState(mapId);
        assertTrue(squareStableRows.stream().anyMatch(row -> row.startsWith("dungeon_stairs|stair_id=" + stairId)
                        && row.contains("|shape=SQUARE")
                        && row.contains("|direction=2")
                        && row.contains("|dimension1=4")
                        && row.contains("|dimension2=2")),
                "DE-STATE-003 persists edited square stair scalar spec: " + squareStableRows);
        assertEquals(
                expectedSquarePath,
                stairPathCells(runtime.database().stairPathState(mapId), stairId),
                "DE-STATE-003 recomputes square stair path cells from the preserved anchor");
        assertUniqueStairPathCells(runtime.database().stairPathState(mapId), stairId,
                "DE-STAIR-007 square recompute path cells stay unique");
        assertEquals(
                Set.of("2,2,0", "-1,3,1", "0,3,2"),
                stairExitCells(runtime.database().stairExitState(mapId), stairId),
                "DE-STATE-003 recomputes square stair exits across every crossed floor");
        DungeonEditorMapSurfaceSnapshot squareSurface = runtime.mapSurfaceModel().current();
        assertEquals(stairRef, squareSurface.selection().topologyRef(),
                "DE-STATE-003 keeps selection on the square recomputed stair");
        assertTrue(squareSurface.surface().map().features().stream()
                        .filter(feature -> feature.id() == stairId)
                        .flatMap(feature -> feature.cells().stream())
                        .anyMatch(cell -> cell.q() == -1 && cell.r() == 3 && cell.level() == 1),
                "DE-STATE-003 published feature exposes generated square intermediate exit");
        assertTrue(renderSurfaceCellOriginsWithZ(binding.mapContentModel()).containsAll(expectedSquarePath),
                "DE-STATE-003 render state exposes square active-level path");
        click(button(controls, "+"));
        assertTrue(renderSurfaceCellOriginsWithZ(binding.mapContentModel()).contains("-1,3,1"),
                "DE-STATE-003 render state exposes square intermediate crossed-floor exit");
        click(button(controls, "+"));
        assertTrue(renderSurfaceCellOriginsWithZ(binding.mapContentModel()).contains("0,3,2"),
                "DE-STATE-003 render state exposes square top crossed-floor exit");
        click(button(controls, "-"));
        click(button(controls, "-"));

        shapeBox = comboBox(stateView, "Treppe Form");
        directionBox = comboBox(stateView, "Treppe Richtung");
        selectComboItem(shapeBox, "CIRCULAR");
        shapeBox = comboBox(stateView, "Treppe Form");
        directionBox = comboBox(stateView, "Treppe Richtung");
        selectComboItem(directionBox, "NORTH");
        shapeBox = comboBox(stateView, "Treppe Form");
        directionBox = comboBox(stateView, "Treppe Richtung");
        dimension1Field = textField(stateView, "Treppe Laenge");
        dimension2Field = textField(stateView, "Treppe Ebenenspanne");
        dimension1Field.setText("4");
        dimension1Field = textField(stateView, "Treppe Laenge");
        dimension2Field = textField(stateView, "Treppe Ebenenspanne");
        dimension2Field.setText("1");
        click(button(stateView, "Treppe aktualisieren"));

        Set<String> expectedCircularPath = Set.of(
                "2,1,0", "2,2,0", "2,3,0",
                "3,0,0", "3,1,0", "3,2,0", "3,3,0", "3,4,0",
                "4,0,0", "4,1,0", "4,2,0", "4,3,0", "4,4,0",
                "5,0,0", "5,1,0", "5,2,0", "5,3,0", "5,4,0",
                "6,1,0", "6,2,0", "6,3,0");
        List<String> circularStableRows = runtime.database().stairStableState(mapId);
        assertTrue(circularStableRows.stream().anyMatch(row -> row.startsWith("dungeon_stairs|stair_id=" + stairId)
                        && row.contains("|shape=CIRCULAR")
                        && row.contains("|direction=0")
                        && row.contains("|dimension1=5")
                        && row.contains("|dimension2=1")),
                "DE-STATE-003 persists edited circular stair scalar spec with normalized diameter: "
                        + circularStableRows);
        assertEquals(
                expectedCircularPath,
                stairPathCells(runtime.database().stairPathState(mapId), stairId),
                "DE-STATE-003 recomputes circular stair path cells from the preserved anchor");
        assertUniqueStairPathCells(runtime.database().stairPathState(mapId), stairId,
                "DE-STAIR-007 circular recompute path cells stay unique");
        assertEquals(
                Set.of("2,2,0", "4,2,1"),
                stairExitCells(runtime.database().stairExitState(mapId), stairId),
                "DE-STATE-003 recomputes circular stair exits from generated path endpoints");
        DungeonEditorMapSurfaceSnapshot circularSurface = runtime.mapSurfaceModel().current();
        assertEquals(stairRef, circularSurface.selection().topologyRef(),
                "DE-STATE-003 keeps selection on the circular recomputed stair");
        assertTrue(circularSurface.surface().map().features().stream()
                        .filter(feature -> feature.id() == stairId)
                        .flatMap(feature -> feature.cells().stream())
                        .anyMatch(cell -> cell.q() == 4 && cell.r() == 2 && cell.level() == 1),
                "DE-STATE-003 published feature exposes generated circular top exit");
        assertTrue(renderSurfaceCellOriginsWithZ(binding.mapContentModel()).containsAll(expectedCircularPath),
                "DE-STATE-003 render state exposes circular active-level path");
        assertTrue(runtime.controlsModel().current().commandOutcome()
                        instanceof features.dungeon.api.editor.DungeonEditorCommandOutcome.Accepted,
                "DE-STATE-003 publishes typed accepted stair edit outcome");
        assertEquals(
                runtime.mapSurfaceModel().current().surface().revision(),
                (int) ((features.dungeon.api.editor.DungeonEditorCommandOutcome.Accepted)
                        runtime.controlsModel().current().commandOutcome()).authoredRevision(),
                "DE-STATE-003 accepted outcome identifies committed authored revision");
        click(button(controls, "+"));
        assertTrue(renderSurfaceCellOriginsWithZ(binding.mapContentModel()).contains("4,2,1"),
                "DE-STATE-003 render state exposes circular top crossed-floor exit");
        click(button(controls, "-"));

        List<String> stableRowsEdited = runtime.database().stairStableState(mapId);
        List<String> pathRowsEdited = runtime.database().stairPathState(mapId);
        List<String> exitRowsEdited = runtime.database().stairExitState(mapId);
        DungeonEditorMapSurfaceSnapshot invalidBaselineSurface = runtime.mapSurfaceModel().current();
        Set<String> invalidBaselineRenderCells = renderSurfaceCellOriginsWithZ(binding.mapContentModel());
        dimension2Field = textField(stateView, "Treppe Ebenenspanne");
        dimension2Field.setText("0");
        click(button(stateView, "Treppe aktualisieren"));
        assertEquals(stableRowsEdited, runtime.database().stairStableState(mapId),
                "DE-STAIR-007 invalid zero-level span leaves stair scalar DB rows unchanged");
        assertEquals(pathRowsEdited, runtime.database().stairPathState(mapId),
                "DE-STAIR-007 invalid zero-level span leaves path DB rows unchanged");
        assertEquals(exitRowsEdited, runtime.database().stairExitState(mapId),
                "DE-STAIR-007 invalid zero-level span leaves exit DB rows unchanged");
        assertInvalidStairGeometryLeavesViewState(
                runtime,
                binding,
                invalidBaselineSurface,
                invalidBaselineRenderCells,
                "DE-STAIR-007 zero-level span");
        assertEquals("Treppengeometrie ungueltig.", runtime.controlsModel().current().statusText(),
                "DE-STAIR-007 zero-level span publishes rejection status");
        assertEquals(
                features.dungeon.api.editor.DungeonEditorCommandOutcome.RejectionReason.INVALID_STAIR_GEOMETRY,
                ((features.dungeon.api.editor.DungeonEditorCommandOutcome.Rejected)
                        runtime.controlsModel().current().commandOutcome()).reason(),
                "DE-STAIR-007 publishes typed invalid-geometry rejection");

        invalidBaselineSurface = runtime.mapSurfaceModel().current();
        invalidBaselineRenderCells = renderSurfaceCellOriginsWithZ(binding.mapContentModel());
        dimension1Field = textField(stateView, "Treppe Laenge");
        dimension2Field = textField(stateView, "Treppe Ebenenspanne");
        dimension1Field.setText("32");
        dimension2Field.setText("1");
        click(button(stateView, "Treppe aktualisieren"));
        assertEquals(stableRowsEdited, runtime.database().stairStableState(mapId),
                "DE-STAIR-007 out-of-range dimension leaves stair scalar DB rows unchanged");
        assertEquals(pathRowsEdited, runtime.database().stairPathState(mapId),
                "DE-STAIR-007 out-of-range dimension leaves path DB rows unchanged");
        assertEquals(exitRowsEdited, runtime.database().stairExitState(mapId),
                "DE-STAIR-007 out-of-range dimension leaves exit DB rows unchanged");
        assertInvalidStairGeometryLeavesViewState(
                runtime,
                binding,
                invalidBaselineSurface,
                invalidBaselineRenderCells,
                "DE-STAIR-007 out-of-range dimension");
        assertEquals("Treppengeometrie ungueltig.", runtime.controlsModel().current().statusText(),
                "DE-STAIR-007 out-of-range dimension publishes rejection status");

        selectMap(controls, "Stair Geometry Reload Hop");
        selectMap(controls, "Stair Geometry Map");
        assertEquals(stableRowsEdited, runtime.database().stairStableState(mapId),
                "DE-STAIR-010 reload keeps recomputed stair stable rows");
        assertEquals(pathRowsEdited, runtime.database().stairPathState(mapId),
                "DE-STAIR-010 reload keeps recomputed path rows");
        assertEquals(exitRowsEdited, runtime.database().stairExitState(mapId),
                "DE-STAIR-010 reload keeps recomputed exit rows");

        assertTrue(!stableRowsBefore.equals(stableRowsEdited),
                "DE-STAIR-004 edited scalar spec differs from fixture baseline");




    }

    private static void assertStairGeometryDraftControls(
            ComboBox<?> shapeBox,
            ComboBox<?> directionBox,
            TextField dimension1Field,
            TextField dimension2Field,
            String expectedShape,
            String expectedDirection,
            String expectedDimension1,
            String expectedDimension2,
            String scenario
    ) {
        assertEquals(expectedShape, shapeBox.getValue(), scenario + " shape");
        assertEquals(expectedDirection, directionBox.getValue(), scenario + " direction");
        assertEquals(expectedDimension1, dimension1Field.getText(), scenario + " dimension1");
        assertEquals(expectedDimension2, dimension2Field.getText(), scenario + " dimension2");
    }

    private static void verifyInvalidStairRoomInteriorRecomputeThroughStateView() {
        TestRuntime runtime = TestRuntime.create();
        TestBinding binding = bindTest(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();
        DungeonEditorStateView stateView = binding.stateView();

        long mapId = createMapThroughControls(controls, runtime, "Stair Invalid Recompute Map");
        createMapThroughControls(controls, runtime, "Stair Invalid Recompute Reload Hop");
        runtime.database().seedF7StairAnchorWithBlockingRoom(mapId);
        selectMap(controls, "Stair Invalid Recompute Map");
        click(button(controls, "Auswahl"));
        var stairHandle = firstStairHandle(runtime.mapSurfaceModel().current(), "DE-STAIR-007");
        DungeonTopologyElementRef stairRef = editorTopologyRef(stairHandle.ref().topologyRef());
        Point2D stairCenter = glyphCenterForRef(binding.mapContentModel(), stairRef);
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();
        fireMapMousePressed(
                mapView,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(stairCenter.getX()),
                viewport.sceneToScreenY(stairCenter.getY()),
                false);

        long stairId = stairHandle.ref().topologyRef().id();
        List<String> stableRowsBefore = runtime.database().stairStableState(mapId);
        List<String> pathRowsBefore = runtime.database().stairPathState(mapId);
        List<String> exitRowsBefore = runtime.database().stairExitState(mapId);
        assertUniqueStairPathCells(pathRowsBefore, stairId,
                "DE-STAIR-007 blocking-room fixture starts with unique path cells");
        DungeonEditorMapSurfaceSnapshot surfaceBefore = runtime.mapSurfaceModel().current();
        Set<String> renderCellsBefore = renderSurfaceCellOriginsWithZ(binding.mapContentModel());

        ComboBox<?> shapeBox = comboBox(stateView, "Treppe Form");
        ComboBox<?> directionBox = comboBox(stateView, "Treppe Richtung");
        assertTrue(!comboBoxContainsDisplayText(shapeBox, "LADDER"),
                "DE-STAIR-007 state-panel shape input cannot emit unsupported LADDER");
        assertTrue(!comboBoxContainsDisplayText(shapeBox, "RECTANGULAR"),
                "DE-STAIR-007 state-panel shape input cannot emit unsupported RECTANGULAR");
        assertTrue(!comboBoxContainsDisplayText(directionBox, "NORTHEAST"),
                "DE-STAIR-007 state-panel direction input cannot emit non-cardinal values");
        selectComboItem(directionBox, "EAST");
        textField(stateView, "Treppe Laenge").setText("4");
        textField(stateView, "Treppe Ebenenspanne").setText("1");
        click(button(stateView, "Treppe aktualisieren"));

        assertEquals(stableRowsBefore, runtime.database().stairStableState(mapId),
                "DE-STAIR-007 room-interior recompute leaves stair scalar DB rows unchanged");
        assertEquals(pathRowsBefore, runtime.database().stairPathState(mapId),
                "DE-STAIR-007 room-interior recompute leaves path DB rows unchanged");
        assertEquals(exitRowsBefore, runtime.database().stairExitState(mapId),
                "DE-STAIR-007 room-interior recompute leaves exit DB rows unchanged");
        assertInvalidStairGeometryLeavesViewState(
                runtime,
                binding,
                surfaceBefore,
                renderCellsBefore,
                "DE-STAIR-007 room-interior recompute");
        assertEquals("Treppengeometrie ungueltig.", runtime.controlsModel().current().statusText(),
                "DE-STAIR-007 room-interior recompute publishes rejection status");
        assertEquals(stairRef, runtime.mapSurfaceModel().current().selection().topologyRef(),
                "DE-STAIR-007 room-interior recompute keeps stair selected");
        assertTrue(runtime.database().stairStableState(mapId).stream()
                        .anyMatch(row -> row.startsWith("dungeon_stairs|stair_id=" + stairId)
                                && row.contains("|direction=0")),
                "DE-STAIR-007 room-interior recompute keeps original north direction");

        selectMap(controls, "Stair Invalid Recompute Reload Hop");
        selectMap(controls, "Stair Invalid Recompute Map");
        assertEquals(stableRowsBefore, runtime.database().stairStableState(mapId),
                "DE-STAIR-007 room-interior recompute reload keeps stair scalar DB rows unchanged");
        assertEquals(pathRowsBefore, runtime.database().stairPathState(mapId),
                "DE-STAIR-007 room-interior recompute reload keeps path DB rows unchanged");
        assertEquals(exitRowsBefore, runtime.database().stairExitState(mapId),
                "DE-STAIR-007 room-interior recompute reload keeps exit DB rows unchanged");


    }


    private static void verifyStraightStairCreateThroughMapView() {
        TestRuntime runtime = TestRuntime.create();
        TestBinding binding = bindTest(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();

        long mapId = createMapThroughControls(controls, runtime, "Stair Create Map");
        runtime.database().seedF1SingleRoom(mapId, "R1", 0, 1, 1);
        runtime.database().seedF1SingleRoom(mapId, "R2", 1, 1, 1);
        long reloadHopMapId = createMapThroughControls(controls, runtime, "Stair Create Reload Hop");
        runtime.database().seedGlobalStairIdentitySentinel(reloadHopMapId);
        long globalStairIdBefore = runtime.database().maxStairId();
        selectMap(controls, "Stair Create Map");
        List<String> stableRowsBefore = runtime.database().stairStableState(mapId);
        List<String> pathRowsBefore = runtime.database().stairPathState(mapId);
        List<String> exitRowsBefore = runtime.database().stairExitState(mapId);
        assertTrue(stableRowsBefore.isEmpty(), "DE-STAIR-001 fixture starts without stair stable rows");
        assertTrue(pathRowsBefore.isEmpty(), "DE-STAIR-001 fixture starts without stair path rows");
        assertTrue(exitRowsBefore.isEmpty(), "DE-STAIR-001 fixture starts without stair exit rows");
        click(button(controls, "Treppe"));
        assertTrue(popupButtonVisible("Gerade"), "DE-STAIR-001 straight stair option is visible");
        click(popupButton("Gerade"));
        assertEquals(DungeonEditorToolSelection.stair(DungeonEditorToolOptions.Stair.Shape.STRAIGHT),
                runtime.controlsModel().current().toolSelection(),
                "DE-STAIR-001 input route selects the straight stair creation tool");
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();
        clickMap(
                mapView,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(6.5),
                viewport.sceneToScreenY(6.5),
                false);
        assertStairCreatePreview(
                runtime.mapSurfaceModel().current(),
                "STRAIGHT",
                6,
                6,
                0,
                6,
                6,
                0,
                false,
                "DE-STAIR-001 straight stair start");
        assertTrue(renderSurfaceCellOriginsWithZ(binding.mapContentModel()).contains("6,6,0"),
                "DE-STAIR-001 render scene exposes the straight stair start preview cell");
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_MOVED,
                MouseButton.NONE,
                viewport.sceneToScreenX(6.5),
                viewport.sceneToScreenY(4.5),
                false);
        assertEquals(stableRowsBefore, runtime.database().stairStableState(mapId),
                "DE-STAIR-001 mouse movement after start does not create stair scalar DB rows");
        assertEquals(pathRowsBefore, runtime.database().stairPathState(mapId),
                "DE-STAIR-001 mouse movement after start does not create stair path DB rows");
        click(button(controls, "+"));
        assertStairCreatePreview(
                runtime.mapSurfaceModel().current(),
                "STRAIGHT",
                6,
                6,
                0,
                6,
                4,
                1,
                true,
                "DE-STAIR-001 straight stair cross-level preview");
        assertTrue(previewFeatureCells(runtime.mapSurfaceModel().current()).containsAll(
                        Set.of("6,6,0", "6,5,0", "6,4,0", "6,4,1")),
                "DE-STAIR-001 preview map exposes the full generated straight stair path and upper exit");
        assertEquals(stableRowsBefore, runtime.database().stairStableState(mapId),
                "DE-STAIR-001 cross-level preview does not create stair scalar DB rows");
        assertEquals(pathRowsBefore, runtime.database().stairPathState(mapId),
                "DE-STAIR-001 cross-level preview does not create stair path DB rows");
        assertEquals(exitRowsBefore, runtime.database().stairExitState(mapId),
                "DE-STAIR-001 cross-level preview does not create stair exit DB rows");
        clickMap(
                mapView,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(6.5),
                viewport.sceneToScreenY(4.5),
                false);

        List<String> stableRowsAfter = runtime.database().stairStableState(mapId);
        long stairId = singleNewStairId(stableRowsBefore, stableRowsAfter, "DE-STAIR-001");
        assertTrue(stairId > globalStairIdBefore,
                "DE-STAIR-001 allocates stair id from global SQLite identity state, not selected-map rows");
        assertTrue(stableRowsAfter.stream().anyMatch(row -> row.startsWith("dungeon_stairs|stair_id=" + stairId)
                        && row.contains("|shape=STRAIGHT")
                        && row.contains("|direction=0")
                        && row.contains("|dimension1=3")
                        && row.contains("|dimension2=1")
                        && row.contains("|corridor_id=<null>")),
                "DE-STAIR-001 persists straight NORTH 3/1 stair scalar spec: " + stableRowsAfter);
        assertTrue(stableRowsAfter.stream().anyMatch(row -> row.startsWith("dungeon_topology_elements|")
                        && row.contains("|element_kind=STAIR")
                        && row.contains("|element_id=" + stairId)),
                "DE-STAIR-001 persists stable stair topology ref: " + stableRowsAfter);
        assertEquals(
                Set.of("6,6,0", "6,5,0", "6,4,0"),
                stairPathCells(runtime.database().stairPathState(mapId), stairId),
                "DE-STAIR-001 persists generated straight north path nodes");
        assertUniqueStairPathCells(runtime.database().stairPathState(mapId), stairId,
                "DE-STAIR-007 straight create path cells stay unique");
        assertEquals(
                Set.of("6,6,0", "6,4,1"),
                stairExitCells(runtime.database().stairExitState(mapId), stairId),
                "DE-STAIR-001 persists generated lower and upper exits");

        DungeonEditorMapSurfaceSnapshot committedSurface = runtime.mapSurfaceModel().current();
        assertEquals(DungeonEditorPreview.none(), committedSurface.preview(),
                "DE-STAIR-001 clears preview after commit");
        click(button(controls, "-"));
        committedSurface = runtime.mapSurfaceModel().current();
        assertStraightStairCreatedInSnapshot(
                committedSurface,
                binding.mapContentModel(),
                stairId,
                6,
                6,
                "DE-STAIR-001 committed create");
        click(button(controls, "+"));
        assertTrue(renderSurfaceCellOriginsWithZ(binding.mapContentModel()).contains("6,4,1"),
                "DE-STAIR-001 renders generated upper exit on the crossed level");
        click(button(controls, "-"));

        selectMap(controls, "Stair Create Reload Hop");
        selectMap(controls, "Stair Create Map");
        assertEquals(stableRowsAfter, runtime.database().stairStableState(mapId),
                "DE-STAIR-001 reload keeps stair stable rows");
        assertEquals(Set.of("6,6,0", "6,5,0", "6,4,0"),
                stairPathCells(runtime.database().stairPathState(mapId), stairId),
                "DE-STAIR-001 reload keeps generated path nodes");
        assertEquals(Set.of("6,6,0", "6,4,1"),
                stairExitCells(runtime.database().stairExitState(mapId), stairId),
                "DE-STAIR-001 reload keeps generated exits");
        assertStraightStairCreatedInSnapshot(
                runtime.mapSurfaceModel().current(),
                binding.mapContentModel(),
                stairId,
                6,
                6,
                "DE-STAIR-001 reload");

        List<String> squareStableRowsBefore = runtime.database().stairStableState(mapId);
        click(button(controls, "Treppe"));
        assertTrue(popupButtonVisible("Eckspirale"), "DE-STAIR-002 square stair option is visible");
        click(popupButton("Eckspirale"));
        assertEquals(DungeonEditorToolSelection.stair(DungeonEditorToolOptions.Stair.Shape.SQUARE),
                runtime.controlsModel().current().toolSelection(),
                "DE-STAIR-002 input route selects the square stair creation tool");
        clickMap(
                mapView,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(9.5),
                viewport.sceneToScreenY(6.5),
                false);
        assertEquals(squareStableRowsBefore, runtime.database().stairStableState(mapId),
                "DE-STAIR-002 first click does not create square stair rows");
        click(button(controls, "+"));
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_MOVED,
                MouseButton.NONE,
                viewport.sceneToScreenX(12.5),
                viewport.sceneToScreenY(6.5),
                false);
        assertEquals("Treppengeometrie ungueltig: Zielpunkt passt nicht zur gewaehlten Form.",
                runtime.controlsModel().current().statusText(),
                "DE-STAIR-002 invalid square endpoint publishes exact mismatch status");
        assertEquals(squareStableRowsBefore, runtime.database().stairStableState(mapId),
                "DE-STAIR-002 invalid square preview does not create stair rows");
        clickMap(
                mapView,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(12.5),
                viewport.sceneToScreenY(6.5),
                false);
        assertEquals("Treppengeometrie ungueltig: Zielpunkt passt nicht zur gewaehlten Form.",
                runtime.controlsModel().current().statusText(),
                "DE-STAIR-002 invalid square second click keeps exact mismatch status");
        assertEquals(squareStableRowsBefore, runtime.database().stairStableState(mapId),
                "DE-STAIR-002 invalid square second click does not create stair rows");
        assertStairCreatePreview(
                runtime.mapSurfaceModel().current(),
                "SQUARE",
                9,
                6,
                0,
                12,
                6,
                1,
                false,
                "DE-STAIR-002 invalid square second click keeps draft active");
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_MOVED,
                MouseButton.NONE,
                viewport.sceneToScreenX(10.5),
                viewport.sceneToScreenY(5.5),
                false);
        assertStairCreatePreview(
                runtime.mapSurfaceModel().current(),
                "SQUARE",
                9,
                6,
                0,
                10,
                5,
                1,
                true,
                "DE-STAIR-002 square stair cross-level preview");
        clickMap(
                mapView,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(10.5),
                viewport.sceneToScreenY(5.5),
                false);

        List<String> squareStableRowsAfter = runtime.database().stairStableState(mapId);
        long squareStairId = singleNewStairId(squareStableRowsBefore, squareStableRowsAfter, "DE-STAIR-002");
        assertTrue(squareStableRowsAfter.stream().anyMatch(row -> row.startsWith("dungeon_stairs|stair_id="
                        + squareStairId)
                        && row.contains("|shape=SQUARE")
                        && row.contains("|direction=0")
                        && row.contains("|dimension1=3")
                        && row.contains("|dimension2=1")
                        && row.contains("|corridor_id=<null>")),
                "DE-STAIR-002 persists square NORTH 3/1 stair scalar spec: " + squareStableRowsAfter);
        Set<String> expectedSquarePath = Set.of(
                "9,6,0", "9,5,0", "9,4,0",
                "10,4,0", "11,4,0", "11,5,0",
                "11,6,0", "10,6,0", "10,5,0");
        assertEquals(
                expectedSquarePath,
                stairPathCells(runtime.database().stairPathState(mapId), squareStairId),
                "DE-STAIR-002 persists generated square stair path nodes");
        assertUniqueStairPathCells(runtime.database().stairPathState(mapId), squareStairId,
                "DE-STAIR-007 square create path cells stay unique");
        assertEquals(
                Set.of("9,6,0", "10,5,1"),
                stairExitCells(runtime.database().stairExitState(mapId), squareStairId),
                "DE-STAIR-002 persists generated square lower and upper exits");
        assertTrue(runtime.mapSurfaceModel().current().surface().map().features().stream()
                        .filter(feature -> feature.id() == squareStairId)
                        .flatMap(feature -> feature.cells().stream())
                        .anyMatch(cell -> cell.q() == 10 && cell.r() == 5 && cell.level() == 1),
                "DE-STAIR-002 published feature exposes square upper exit");
        click(button(controls, "-"));
        assertTrue(renderSurfaceCellOriginsWithZ(binding.mapContentModel()).containsAll(expectedSquarePath),
                "DE-STAIR-002 render state exposes square active-level path");
        click(button(controls, "+"));
        assertTrue(renderSurfaceCellOriginsWithZ(binding.mapContentModel()).contains("10,5,1"),
                "DE-STAIR-002 renders generated square upper exit on the crossed level");
        click(button(controls, "-"));

        selectMap(controls, "Stair Create Reload Hop");
        selectMap(controls, "Stair Create Map");
        assertTrue(runtime.database().stairStableState(mapId).containsAll(squareStableRowsAfter),
                "DE-STAIR-002 reload keeps square stair stable rows");
        assertEquals(expectedSquarePath,
                stairPathCells(runtime.database().stairPathState(mapId), squareStairId),
                "DE-STAIR-002 reload keeps generated square path nodes");
        assertEquals(Set.of("9,6,0", "10,5,1"),
                stairExitCells(runtime.database().stairExitState(mapId), squareStairId),
                "DE-STAIR-002 reload keeps generated square exits");

        List<String> circularStableRowsBefore = runtime.database().stairStableState(mapId);
        click(button(controls, "Treppe"));
        assertTrue(popupButtonVisible("Rundspirale"), "DE-STAIR-003 round stair option is visible");
        click(popupButton("Rundspirale"));
        assertEquals(DungeonEditorToolSelection.stair(DungeonEditorToolOptions.Stair.Shape.CIRCULAR),
                runtime.controlsModel().current().toolSelection(),
                "DE-STAIR-003 input route selects the circular stair creation tool");
        clickMap(
                mapView,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(12.5),
                viewport.sceneToScreenY(6.5),
                false);
        assertEquals(circularStableRowsBefore, runtime.database().stairStableState(mapId),
                "DE-STAIR-003 first click does not create circular stair rows");
        click(button(controls, "+"));
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_MOVED,
                MouseButton.NONE,
                viewport.sceneToScreenX(13.5),
                viewport.sceneToScreenY(6.5),
                false);
        assertStairCreatePreview(
                runtime.mapSurfaceModel().current(),
                "CIRCULAR",
                12,
                6,
                0,
                13,
                6,
                1,
                true,
                "DE-STAIR-003 circular stair cross-level preview");
        clickMap(
                mapView,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(13.5),
                viewport.sceneToScreenY(6.5),
                false);

        List<String> circularStableRowsAfter = runtime.database().stairStableState(mapId);
        long circularStairId = singleNewStairId(circularStableRowsBefore, circularStableRowsAfter, "DE-STAIR-003");
        assertTrue(circularStableRowsAfter.stream().anyMatch(row -> row.startsWith("dungeon_stairs|stair_id="
                        + circularStairId)
                        && row.contains("|shape=CIRCULAR")
                        && row.contains("|direction=0")
                        && row.contains("|dimension1=3")
                        && row.contains("|dimension2=1")
                        && row.contains("|corridor_id=<null>")),
                "DE-STAIR-003 persists circular NORTH 3/1 stair scalar spec: " + circularStableRowsAfter);
        Set<String> expectedCircularPath = Set.of(
                "12,6,0", "12,5,0", "13,5,0",
                "14,5,0", "14,6,0", "14,7,0",
                "13,7,0", "12,7,0", "13,6,0");
        assertEquals(
                expectedCircularPath,
                stairPathCells(runtime.database().stairPathState(mapId), circularStairId),
                "DE-STAIR-003 persists generated circular stair path nodes");
        assertUniqueStairPathCells(runtime.database().stairPathState(mapId), circularStairId,
                "DE-STAIR-007 circular create path cells stay unique");
        assertEquals(
                Set.of("12,6,0", "13,6,1"),
                stairExitCells(runtime.database().stairExitState(mapId), circularStairId),
                "DE-STAIR-003 persists generated circular lower and upper exits");
        assertTrue(runtime.mapSurfaceModel().current().surface().map().features().stream()
                        .filter(feature -> feature.id() == circularStairId)
                        .flatMap(feature -> feature.cells().stream())
                        .anyMatch(cell -> cell.q() == 13 && cell.r() == 6 && cell.level() == 1),
                "DE-STAIR-003 published feature exposes circular upper exit");
        click(button(controls, "-"));
        assertTrue(renderSurfaceCellOriginsWithZ(binding.mapContentModel()).containsAll(expectedCircularPath),
                "DE-STAIR-003 render state exposes circular active-level path");
        click(button(controls, "+"));
        assertTrue(renderSurfaceCellOriginsWithZ(binding.mapContentModel()).contains("13,6,1"),
                "DE-STAIR-003 renders generated circular upper exit on the crossed level");
        click(button(controls, "-"));

        selectMap(controls, "Stair Create Reload Hop");
        selectMap(controls, "Stair Create Map");
        assertTrue(runtime.database().stairStableState(mapId).containsAll(circularStableRowsAfter),
                "DE-STAIR-003 reload keeps circular stair stable rows");
        assertEquals(expectedCircularPath,
                stairPathCells(runtime.database().stairPathState(mapId), circularStairId),
                "DE-STAIR-003 reload keeps generated circular path nodes");
        assertEquals(Set.of("12,6,0", "13,6,1"),
                stairExitCells(runtime.database().stairExitState(mapId), circularStairId),
                "DE-STAIR-003 reload keeps generated circular exits");




    }


    private static void verifyStairDeleteThroughMapView() {
        TestRuntime runtime = TestRuntime.create();
        TestBinding binding = bindTest(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();

        long mapId = createMapThroughControls(controls, runtime, "Stair Delete Map");
        runtime.database().seedF7StairAnchor(mapId);
        createMapThroughControls(controls, runtime, "Stair Delete Reload Hop");
        selectMap(controls, "Stair Delete Map");

        var stairHandle = firstStairHandle(runtime.mapSurfaceModel().current(), "DE-STAIR-009 unbound");
        long stairId = stairHandle.ref().topologyRef().id();
        DungeonTopologyElementRef stairRef = editorTopologyRef(stairHandle.ref().topologyRef());
        Point2D stairCenter = glyphCenterForRef(binding.mapContentModel(), stairRef);
        assertTrue(!runtime.database().stairStableState(mapId).isEmpty(),
                "DE-STAIR-009 unbound fixture starts with a stair row and topology ref");
        assertTrue(!runtime.database().stairPathState(mapId).isEmpty(),
                "DE-STAIR-009 unbound fixture starts with stair path rows");
        assertTrue(!runtime.database().stairExitState(mapId).isEmpty(),
                "DE-STAIR-009 unbound fixture starts with stair exit rows");
        click(button(controls, "Treppe"));
        assertEquals(DungeonEditorToolSelection.stair(DungeonEditorToolOptions.Stair.Shape.STRAIGHT),
                runtime.controlsModel().current().toolSelection(),
                "DE-STAIR-009 input route selects the stair family tool");
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();
        clickMap(
                mapView,
                MouseButton.SECONDARY,
                viewport.sceneToScreenX(stairCenter.getX()),
                viewport.sceneToScreenY(stairCenter.getY()),
                false);

        assertTrue(runtime.database().stairStableState(mapId).isEmpty(),
                "DE-STAIR-009 unbound delete removes dungeon_stairs and stair topology refs");
        assertTrue(runtime.database().stairPathState(mapId).isEmpty(),
                "DE-STAIR-009 unbound delete removes dungeon_stair_path_nodes rows");
        assertTrue(runtime.database().stairExitState(mapId).isEmpty(),
                "DE-STAIR-009 unbound delete removes dungeon_stair_exits rows");
        assertEquals(0L, runtime.database().countStairPathRowsByStairId(stairId),
                "DE-STAIR-009 unbound delete removes path rows for the deleted stair id");
        assertEquals(0L, runtime.database().countStairExitRowsByStairId(stairId),
                "DE-STAIR-009 unbound delete removes exit rows for the deleted stair id");
        DungeonEditorMapSurfaceSnapshot deletedSurface = runtime.mapSurfaceModel().current();
        assertEmptySelection(deletedSurface.selection(), "DE-STAIR-009 unbound map surface after delete");
        assertEmptySelection(runtime.stateModel().current().selection(), "DE-STAIR-009 unbound state after delete");
        assertStairAbsentFromSnapshotAndRender(deletedSurface, binding.mapContentModel(), stairRef, stairCenter,
                "DE-STAIR-009 unbound delete");

        selectMap(controls, "Stair Delete Reload Hop");
        selectMap(controls, "Stair Delete Map");
        assertTrue(runtime.database().stairStableState(mapId).isEmpty(),
                "DE-STAIR-009 unbound reload keeps stair stable rows absent");
        assertTrue(runtime.database().stairPathState(mapId).isEmpty(),
                "DE-STAIR-009 unbound reload keeps stair path rows absent");
        assertTrue(runtime.database().stairExitState(mapId).isEmpty(),
                "DE-STAIR-009 unbound reload keeps stair exit rows absent");
        assertEquals(0L, runtime.database().countStairPathRowsByStairId(stairId),
                "DE-STAIR-009 unbound reload keeps deleted stair path rows absent by stair id");
        assertEquals(0L, runtime.database().countStairExitRowsByStairId(stairId),
                "DE-STAIR-009 unbound reload keeps deleted stair exit rows absent by stair id");
        assertStairAbsentFromSnapshotAndRender(runtime.mapSurfaceModel().current(), binding.mapContentModel(), stairRef,
                stairCenter, "DE-STAIR-009 unbound reload");

        long boundMapId = createMapThroughControls(controls, runtime, "Stair Delete Bound Map");
        runtime.database().seedCorridorBoundStairAnchor(boundMapId);
        createMapThroughControls(controls, runtime, "Stair Delete Bound Reload Hop");
        selectMap(controls, "Stair Delete Bound Map");
        verifyCorridorBoundStairDeleteRejectedThroughMapView(controls, runtime, binding, mapView, boundMapId);


    }


    private static void verifyCorridorBoundStairDeleteRejectedThroughMapView(
            DungeonEditorControlsView controls,
            TestRuntime runtime,
            TestBinding binding,
            DungeonMapView mapView,
            long mapId
    ) {
        var stairHandle = firstStairHandle(runtime.mapSurfaceModel().current(), "DE-STAIR-009 bound rejection");
        DungeonTopologyElementRef stairRef = editorTopologyRef(stairHandle.ref().topologyRef());
        Point2D stairCenter = glyphCenterForRef(binding.mapContentModel(), stairRef);
        click(button(controls, "Auswahl"));
        DungeonMapContentModel.Viewport selectViewport = binding.mapContentModel().currentViewport();
        fireMapMousePressed(
                mapView,
                MouseButton.PRIMARY,
                selectViewport.sceneToScreenX(stairCenter.getX()),
                selectViewport.sceneToScreenY(stairCenter.getY()),
                false);
        assertEquals(stairRef, runtime.mapSurfaceModel().current().selection().topologyRef(),
                "DE-STAIR-009 bound rejection fixture selects the stair before protected delete");
        click(button(controls, "Treppe"));
        List<String> authoredStateBefore = runtime.database().authoredGeometryState(mapId);
        List<String> stableRowsBefore = runtime.database().stairStableState(mapId);
        List<String> pathRowsBefore = runtime.database().stairPathState(mapId);
        List<String> exitRowsBefore = runtime.database().stairExitState(mapId);
        DungeonEditorMapSurfaceSnapshot surfaceBefore = runtime.mapSurfaceModel().current();
        assertTrue(stableRowsBefore.stream().anyMatch(row -> row.contains("|corridor_id=")),
                "DE-STAIR-009 bound rejection fixture starts with a corridor-bound stair: " + stableRowsBefore);
        DungeonMapContentModel.Viewport deleteViewport = binding.mapContentModel().currentViewport();
        clickMap(
                mapView,
                MouseButton.SECONDARY,
                deleteViewport.sceneToScreenX(stairCenter.getX()),
                deleteViewport.sceneToScreenY(stairCenter.getY()),
                false);

        assertEquals(authoredStateBefore, runtime.database().authoredGeometryState(mapId),
                "DE-STAIR-009 bound rejection leaves authored DB rows unchanged");
        assertEquals(stableRowsBefore, runtime.database().stairStableState(mapId),
                "DE-STAIR-009 bound rejection keeps stair stable rows and topology refs");
        assertEquals(pathRowsBefore, runtime.database().stairPathState(mapId),
                "DE-STAIR-009 bound rejection keeps stair path rows");
        assertEquals(exitRowsBefore, runtime.database().stairExitState(mapId),
                "DE-STAIR-009 bound rejection keeps stair exit rows");
        DungeonEditorMapSurfaceSnapshot surfaceAfter = runtime.mapSurfaceModel().current();
        assertEquals(surfaceBefore.surface().map(), surfaceAfter.surface().map(),
                "DE-STAIR-009 bound rejection keeps published map stable");
        assertEquals(surfaceBefore.selection(), surfaceAfter.selection(),
                "DE-STAIR-009 bound rejection keeps selection stable");
        assertEquals(surfaceBefore.projectionLevel(), surfaceAfter.projectionLevel(),
                "DE-STAIR-009 bound rejection keeps projection stable");
        assertEquals(DungeonEditorPreview.none(), surfaceAfter.preview(),
                "DE-STAIR-009 bound rejection keeps preview empty");
        assertTrue(renderHasGlyphAt(binding.mapContentModel(), stairRef, stairCenter.getX(), stairCenter.getY(), false),
                "DE-STAIR-009 bound rejection keeps rendered stair marker");
    }


    private static void verifyCrossLevelCorridorCreatesStairThroughMapView() {
        TestRuntime runtime = TestRuntime.create();
        TestBinding binding = bindTest(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();

        long mapId = createMapThroughControls(controls, runtime, "Cross Level Corridor Stair Map");
        runtime.database().seedF6MultiLevelFloors(mapId);
        long reloadHopMapId = createMapThroughControls(controls, runtime, "Cross Level Corridor Stair Reload Hop");
        runtime.database().seedGlobalStairIdentitySentinel(reloadHopMapId);
        long globalStairIdBefore = runtime.database().maxStairId();
        selectMap(controls, "Cross Level Corridor Stair Map");
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();

        click(button(controls, "Treppe"));
        click(popupButton("Gerade"));
        fireMapMouse(mapView, MouseEvent.MOUSE_MOVED, MouseButton.NONE,
                viewport.sceneToScreenX(4.5), viewport.sceneToScreenY(2.5), false);
        assertEquals(DungeonEditorPreview.none(), runtime.mapSurfaceModel().current().preview(),
                "DE-STAIR-001 pre-start stair hover stays passive");
        clickMap(
                mapView,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(4.5),
                viewport.sceneToScreenY(2.5),
                false);
        assertStairCreatePreview(
                runtime.mapSurfaceModel().current(),
                "STRAIGHT",
                4,
                2,
                0,
                4,
                2,
                0,
                false,
                "DE-STAIR-001 cross-level straight stair start");
        click(button(controls, "+"));
        assertEquals(1, runtime.mapSurfaceModel().current().projectionLevel(),
                "DE-STAIR-001 level shift publishes the next projection level");
        assertStairCreatePreview(
                runtime.mapSurfaceModel().current(),
                "STRAIGHT",
                4,
                2,
                0,
                4,
                2,
                1,
                true,
                "DE-STAIR-001 same-position stair preview after level shift");
        click(button(controls, "-"));

        click(button(controls, "Tür"));
        Point2D levelZeroWall = boundaryMidpointNear(binding.mapContentModel(), "WALL", 4.0, 2.5);
        clickMap(
                mapView,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(levelZeroWall.getX()),
                viewport.sceneToScreenY(levelZeroWall.getY()),
                false);
        click(button(controls, "+"));
        Point2D levelOneWall = boundaryMidpointNear(binding.mapContentModel(), "WALL", 4.0, 2.5);
        clickMap(
                mapView,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(levelOneWall.getX()),
                viewport.sceneToScreenY(levelOneWall.getY()),
                false);
        assertEquals(2L, runtime.database().countDoorBoundariesAt(mapId, 1, 0, "EAST"),
                "DE-STAIR-008 fixture setup creates one east door on each tested level");

        Set<Long> corridorIdsBefore = runtime.database().corridorIdsForMap(mapId);
        List<String> stairRowsBefore = runtime.database().stairStableState(mapId);
        assertTrue(stairRowsBefore.isEmpty(), "DE-STAIR-008 fixture starts without stair rows");
        long revisionBeforeCorridor = runtime.database().mapRevision(mapId);
        click(button(controls, "-"));
        click(button(controls, "Korridor"));
        assertEquals(DungeonEditorToolSelection.family(DungeonEditorToolFamily.CORRIDOR),
                runtime.controlsModel().current().toolSelection(),
                "DE-STAIR-008 corridor family selects corridor-create tool");
        Point2D levelZeroDoor = doorHandleCenterAt(
                runtime.mapSurfaceModel().current(),
                binding.mapContentModel(),
                4,
                2,
                0,
                "DE-STAIR-008 lower door");
        fireMapMousePressed(
                mapView,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(levelZeroDoor.getX()),
                viewport.sceneToScreenY(levelZeroDoor.getY()),
                false);
        assertEquals(corridorIdsBefore, runtime.database().corridorIdsForMap(mapId),
                "DE-STAIR-008 first cross-level endpoint does not persist a partial corridor");
        click(button(controls, "+"));
        Point2D levelOneDoor = doorHandleCenterAt(
                runtime.mapSurfaceModel().current(),
                binding.mapContentModel(),
                4,
                2,
                1,
                "DE-STAIR-008 upper door");
        fireMapMousePressed(
                mapView,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(levelOneDoor.getX()),
                viewport.sceneToScreenY(levelOneDoor.getY()),
                false);

        long newCorridorId = singleNewCorridorId(corridorIdsBefore, runtime.database().corridorIdsForMap(mapId),
                "DE-STAIR-008");
        assertEquals(revisionBeforeCorridor + 1L, runtime.database().mapRevision(mapId),
                "DE-STAIR-008 cross-level corridor and bound stair commit exactly one aggregate revision");
        List<String> stableCorridorState = runtime.database().corridorStableConnectionState(mapId);
        assertCorridorDoorBindingCount(stableCorridorState, newCorridorId, 2, "DE-STAIR-008");
        List<String> stairRowsAfter = runtime.database().stairStableState(mapId);
        long stairId = singleNewStairId(stairRowsBefore, stairRowsAfter, "DE-STAIR-008");
        assertTrue(stairId > globalStairIdBefore,
                "DE-STAIR-008 allocates corridor-bound stair id from global SQLite identity state");
        assertTrue(stairRowsAfter.stream().anyMatch(row -> row.startsWith("dungeon_stairs|stair_id=" + stairId)
                        && row.contains("|shape=STRAIGHT")
                        && row.contains("|direction=0")
                        && row.contains("|dimension1=1")
                        && row.contains("|dimension2=1")
                        && row.contains("|corridor_id=" + newCorridorId)),
                "DE-STAIR-008 persists corridor-bound stair scalar spec: " + stairRowsAfter);
        assertTrue(stairRowsAfter.stream().anyMatch(row -> row.startsWith("dungeon_topology_elements|")
                        && row.contains("|element_kind=STAIR")
                        && row.contains("|element_id=" + stairId)),
                "DE-STAIR-008 persists stable stair topology ref: " + stairRowsAfter);
        assertEquals(Set.of("4,2,0"), stairPathCells(runtime.database().stairPathState(mapId), stairId),
                "DE-STAIR-008 persists the lower corridor-bound stair path node");
        assertEquals(Set.of("4,2,0", "4,2,1"), stairExitCells(runtime.database().stairExitState(mapId), stairId),
                "DE-STAIR-008 persists lower and upper corridor-bound stair exits");

        DungeonEditorMapSurfaceSnapshot committedSurface = runtime.mapSurfaceModel().current();
        var corridorArea = corridorAreaById(committedSurface, newCorridorId, "DE-STAIR-008 committed corridor");
        assertEquals(Set.of("4,2,0", "4,2,1"), areaCellSet(corridorArea),
                "DE-STAIR-008 published corridor route cells");
        assertEquals(DungeonEditorPreview.none(), committedSurface.preview(),
                "DE-STAIR-008 preview clears after commit");
        assertCrossLevelStairInSnapshot(committedSurface, stairId, "DE-STAIR-008 committed stair");
        assertTrue(renderSurfaceCellOriginsWithZ(binding.mapContentModel()).contains("4,2,1"),
                "DE-STAIR-008 renders upper corridor/stair state on level 1");
        click(button(controls, "-"));
        assertTrue(renderSurfaceCellOriginsWithZ(binding.mapContentModel()).contains("4,2,0"),
                "DE-STAIR-008 renders lower corridor/stair state on level 0");

        selectMap(controls, "Cross Level Corridor Stair Reload Hop");
        selectMap(controls, "Cross Level Corridor Stair Map");
        assertEquals(stairRowsAfter, runtime.database().stairStableState(mapId),
                "DE-STAIR-008 reload keeps corridor-bound stair stable rows");
        assertEquals(Set.of("4,2,0"), stairPathCells(runtime.database().stairPathState(mapId), stairId),
                "DE-STAIR-008 reload keeps the lower stair path node");
        assertEquals(Set.of("4,2,0", "4,2,1"), stairExitCells(runtime.database().stairExitState(mapId), stairId),
                "DE-STAIR-008 reload keeps stair exits");
        assertCrossLevelStairInSnapshot(
                runtime.mapSurfaceModel().current(),
                stairId,
                "DE-STAIR-008 reload stair");

        assertCrossLevelCorridorCreatesEveryCrossedLevelExit("DE-STAIR-008 multi-level exit variant");


    }

    private static void assertStairCreatePreview(
            DungeonEditorMapSurfaceSnapshot snapshot,
            String expectedShape,
            int expectedQ,
            int expectedR,
            int expectedLevel,
            String message
    ) {
        assertTrue(snapshot.preview() instanceof DungeonEditorPreview.StairCreatePreview,
                message + " publishes a stair create preview");
        DungeonEditorPreview.StairCreatePreview preview =
                (DungeonEditorPreview.StairCreatePreview) snapshot.preview();
        assertEquals(expectedShape, preview.shapeName(), message + " preview shape");
        assertEquals(expectedQ, preview.anchor().q(), message + " preview anchor q");
        assertEquals(expectedR, preview.anchor().r(), message + " preview anchor r");
        assertEquals(expectedLevel, preview.anchor().level(), message + " preview anchor level");
    }

    private static void assertStairCreatePreview(
            DungeonEditorMapSurfaceSnapshot snapshot,
            String expectedShape,
            int expectedStartQ,
            int expectedStartR,
            int expectedStartLevel,
            int expectedEndQ,
            int expectedEndR,
            int expectedEndLevel,
            boolean expectedValid,
            String message
    ) {
        assertStairCreatePreview(
                snapshot,
                expectedShape,
                expectedStartQ,
                expectedStartR,
                expectedStartLevel,
                message);
        DungeonEditorPreview.StairCreatePreview preview =
                (DungeonEditorPreview.StairCreatePreview) snapshot.preview();
        assertEquals(expectedEndQ, preview.end().q(), message + " preview end q");
        assertEquals(expectedEndR, preview.end().r(), message + " preview end r");
        assertEquals(expectedEndLevel, preview.end().level(), message + " preview end level");
        assertEquals(expectedValid, preview.valid(), message + " preview validity");
    }

    private static Set<String> previewFeatureCells(DungeonEditorMapSurfaceSnapshot snapshot) {
        if (snapshot == null || snapshot.surface() == null || snapshot.surface().previewMap() == null) {
            return Set.of();
        }
        Set<String> cells = new LinkedHashSet<>();
        snapshot.surface().previewMap().features().stream()
                .flatMap(feature -> feature.cells().stream())
                .map(DungeonEditorStairScenarios::cellKey)
                .forEach(cells::add);
        return cells;
    }

    private static String cellKey(DungeonCellRef cell) {
        return cell.q() + "," + cell.r() + "," + cell.level();
    }

    private static void assertCrossLevelCorridorCreatesEveryCrossedLevelExit(String scenario) {
        TestRuntime runtime = TestRuntime.create();
        TestBinding binding = bindTest(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();

        long mapId = createMapThroughControls(controls, runtime, "Cross Level Corridor Multi Exit Map");
        runtime.database().seedF6MultiLevelFloors(mapId);
        createMapThroughControls(controls, runtime, "Cross Level Corridor Multi Exit Reload Hop");
        selectMap(controls, "Cross Level Corridor Multi Exit Map");
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();

        click(button(controls, "Tür"));
        Point2D levelZeroWall = boundaryMidpointNear(binding.mapContentModel(), "WALL", 4.0, 2.5);
        clickMap(mapView, MouseButton.PRIMARY,
                viewport.sceneToScreenX(levelZeroWall.getX()), viewport.sceneToScreenY(levelZeroWall.getY()), false);
        click(button(controls, "+"));
        click(button(controls, "+"));
        Point2D levelTwoWall = boundaryMidpointNear(binding.mapContentModel(), "WALL", 4.0, 2.5);
        clickMap(mapView, MouseButton.PRIMARY,
                viewport.sceneToScreenX(levelTwoWall.getX()), viewport.sceneToScreenY(levelTwoWall.getY()), false);
        assertEquals(2L, runtime.database().countDoorBoundariesAt(mapId, 1, 0, "EAST"),
                scenario + " creates one east door on each connected level");

        Set<Long> corridorIdsBefore = runtime.database().corridorIdsForMap(mapId);
        List<String> stairRowsBefore = runtime.database().stairStableState(mapId);
        click(button(controls, "-"));
        click(button(controls, "-"));
        click(button(controls, "Korridor"));
        Point2D levelZeroDoor = doorHandleCenterAt(
                runtime.mapSurfaceModel().current(),
                binding.mapContentModel(),
                4,
                2,
                0,
                scenario + " lower door");
        fireMapMousePressed(mapView, MouseButton.PRIMARY,
                viewport.sceneToScreenX(levelZeroDoor.getX()), viewport.sceneToScreenY(levelZeroDoor.getY()), false);
        click(button(controls, "+"));
        click(button(controls, "+"));
        Point2D levelTwoDoor = doorHandleCenterAt(
                runtime.mapSurfaceModel().current(),
                binding.mapContentModel(),
                4,
                2,
                2,
                scenario + " upper door");
        fireMapMousePressed(mapView, MouseButton.PRIMARY,
                viewport.sceneToScreenX(levelTwoDoor.getX()), viewport.sceneToScreenY(levelTwoDoor.getY()), false);

        long newCorridorId = singleNewCorridorId(corridorIdsBefore, runtime.database().corridorIdsForMap(mapId),
                scenario);
        List<String> stairRowsAfter = runtime.database().stairStableState(mapId);
        long stairId = singleNewStairId(stairRowsBefore, stairRowsAfter, scenario);
        assertTrue(stairRowsAfter.stream().anyMatch(row -> row.startsWith("dungeon_stairs|stair_id=" + stairId)
                        && row.contains("|dimension2=2")
                        && row.contains("|corridor_id=" + newCorridorId)),
                scenario + " persists a corridor-bound stair spanning two levels: " + stairRowsAfter);
        assertEquals(Set.of("4,2,0", "4,2,1", "4,2,2"),
                stairExitCells(runtime.database().stairExitState(mapId), stairId),
                scenario + " persists an exit for every crossed level");
        assertTrue(runtime.mapSurfaceModel().current().surface().map().features().stream()
                        .filter(feature -> "STAIR".equals(feature.kind()))
                        .filter(feature -> feature.id() == stairId)
                        .flatMap(feature -> feature.cells().stream())
                        .anyMatch(cell -> cell.q() == 4 && cell.r() == 2 && cell.level() == 1),
                scenario + " published feature exposes the intermediate exit level");
        selectMap(controls, "Cross Level Corridor Multi Exit Reload Hop");
        selectMap(controls, "Cross Level Corridor Multi Exit Map");
        assertEquals(Set.of("4,2,0", "4,2,1", "4,2,2"),
                stairExitCells(runtime.database().stairExitState(mapId), stairId),
                scenario + " reload keeps every crossed-level exit");
    }

}
