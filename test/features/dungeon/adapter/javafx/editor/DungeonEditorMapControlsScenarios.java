package features.dungeon.adapter.javafx.editor;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Direction;
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

final class DungeonEditorMapControlsScenarios {


    private DungeonEditorMapControlsScenarios() {
    }

    static void run() throws Exception {
        route(() -> verifyCameraPanThroughMapView());
        route(() -> verifyCameraZoomThroughMapView());
        route(() -> verifyToolFamilyRowThroughControlsView());
        route(() -> verifySecondaryToolDropdownThroughControlsView());
        route(() -> verifyEscapeResetsToolThroughMapView());
        route(() -> verifySessionUndoRedoThroughMapView());
    }

    private static void verifySessionUndoRedoThroughMapView() {
        TestRuntime runtime = TestRuntime.create();
        TestBinding binding = bindTest(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();
        long mapId = createMapThroughControls(controls, runtime, "Undo Redo Map");
        click(button(controls, "Raum"));
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();
        double startX = viewport.sceneToScreenX(1.5);
        double startY = viewport.sceneToScreenY(1.5);
        double endX = viewport.sceneToScreenX(3.5);
        double endY = viewport.sceneToScreenY(3.5);
        fireMapMouse(mapView, MouseEvent.MOUSE_PRESSED, MouseButton.PRIMARY, startX, startY, false);
        fireMapMouse(mapView, MouseEvent.MOUSE_DRAGGED, MouseButton.PRIMARY, endX, endY, false);
        fireMapMouse(mapView, MouseEvent.MOUSE_RELEASED, MouseButton.PRIMARY, endX, endY, false);
        assertEquals(1L, runtime.database().countRoomsForMap(mapId),
                "DE-HISTORY-001 room exists after committed edit");
        assertEquals(2L, runtime.database().mapRevision(mapId),
                "DE-HISTORY-001 committed edit persists the aggregate revision");
        assertEquals(1L, runtime.database().countChunksForMap(mapId),
                "DE-HISTORY-001 committed edit persists the affected chunk inventory");

        click(button(controls, "Auswahl"));
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_PRESSED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(2.5),
                viewport.sceneToScreenY(2.5),
                false);
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_RELEASED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(2.5),
                viewport.sceneToScreenY(2.5),
                false);
        assertTrue(runtime.stateModel().current().selection().topologyRef().id() > 0L,
                "DE-HISTORY-003 room selection reaches a stable authored target");
        dragMap(mapView, MouseButton.MIDDLE, 300, 300, 330, 320);
        viewport = binding.mapContentModel().currentViewport();

        click(button(controls, "Raum"));
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_PRESSED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(5.5),
                viewport.sceneToScreenY(5.5),
                false);
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_DRAGGED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(6.5),
                viewport.sceneToScreenY(6.5),
                false);
        assertTrue(runtime.mapSurfaceModel().current().preview()
                        instanceof DungeonEditorPreview.RoomRectanglePreview,
                "DE-HISTORY-003 preview is active before cancellation");
        fireMapShortcut(mapView, KeyCode.ESCAPE);

        click(button(controls, "Wand"));
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
        assertEquals(
                features.dungeon.api.editor.DungeonEditorCommandOutcome.RejectionReason.PROTECTED_EXTERIOR_WALL,
                ((features.dungeon.api.editor.DungeonEditorCommandOutcome.Rejected)
                        runtime.controlsModel().current().commandOutcome()).reason(),
                "DE-HISTORY-003 exterior-wall delete reaches the typed rejection route");
        assertEquals(2L, runtime.database().mapRevision(mapId),
                "DE-HISTORY-003 tool, selection, camera, preview, and rejection do not commit a revision");

        fireMapShortcut(mapView, KeyCode.Z, true, false);
        assertEquals(0L, runtime.database().countRoomsForMap(mapId),
                "DE-HISTORY-001 shortcut undo restores the prior authored map");
        assertEquals(3L, runtime.database().mapRevision(mapId),
                "DE-HISTORY-001 undo restores content as a new revision");
        assertEquals(0L, runtime.database().countChunksForMap(mapId),
                "DE-HISTORY-001 undo removes obsolete chunk inventory");

        fireMapShortcut(mapView, KeyCode.Y, true, false);
        assertEquals(1L, runtime.database().countRoomsForMap(mapId),
                "DE-HISTORY-002 shortcut redo reapplies the authored edit");
        assertEquals(4L, runtime.database().mapRevision(mapId),
                "DE-HISTORY-002 redo restores content as a new revision");
        assertEquals(1L, runtime.database().countChunksForMap(mapId),
                "DE-HISTORY-002 redo restores chunk inventory");
    }

    private static void route(
            DungeonEditorTestSupport.ThrowingRunnable action
    ) throws Exception {
        DungeonEditorTestSupport.runRoute(action);
    }

    private static void verifyCameraPanThroughMapView() {
        TestRuntime runtime = TestRuntime.create();
        TestBinding binding = bindTest(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();
        DungeonMapContentModel mapContentModel = binding.mapContentModel();

        long mapId = createMapThroughControls(controls, runtime, "Camera Pan Map");
        runtime.database().seedF1SingleRoom(mapId, "R1", 0, 1, 1);
        long geometryRowsBefore = runtime.database().countAuthoredGeometryRows(mapId);
        DungeonEditorMapSurfaceSnapshot surfaceBefore = runtime.mapSurfaceModel().current();

        DungeonMapContentModel.Viewport initialViewport = mapContentModel.currentViewport();
        AtomicInteger canvasStateChanges = new AtomicInteger();
        mapContentModel.canvasStateProperty().addListener((observable, oldValue, newValue) ->
                canvasStateChanges.incrementAndGet());
        mapContentModel.resetCamera();
        assertEquals(0L, canvasStateChanges.get(),
                "DE-CAM-007 resetCamera at initial viewport does not notify unchanged canvas state");
        dragMap(mapView, MouseButton.MIDDLE, 300, 300, 420, 300);
        assertEquals(surfaceBefore, runtime.mapSurfaceModel().current(),
                "DE-CAM-001 pan right leaves published map surface unchanged");
        DungeonMapContentModel.Viewport afterRightViewport = mapContentModel.currentViewport();
        assertDoubleEquals(initialViewport.panX() + 120.0, afterRightViewport.panX(),
                "DE-CAM-001 viewport panX increases by 120px");
        assertDoubleEquals(initialViewport.panY(), afterRightViewport.panY(),
                "DE-CAM-001 viewport panY unchanged");
        assertDoubleEquals(initialViewport.zoom(), afterRightViewport.zoom(),
                "DE-CAM-001 viewport zoom unchanged");
        assertCanvasHasPaintedContent(mapView, "DE-CAM-001 rendered scene remains visible after pan right");
        assertEquals(geometryRowsBefore, runtime.database().countAuthoredGeometryRows(mapId),
                "DE-CAM-001 leaves authored DB rows unchanged");


        DungeonEditorMapSurfaceSnapshot afterRightSurface = runtime.mapSurfaceModel().current();
        dragMap(mapView, MouseButton.MIDDLE, 420, 300, 300, 300);
        assertEquals(afterRightSurface, runtime.mapSurfaceModel().current(),
                "DE-CAM-002 pan left leaves published map surface unchanged");
        DungeonMapContentModel.Viewport afterLeftViewport = mapContentModel.currentViewport();
        assertDoubleEquals(afterRightViewport.panX() - 120.0, afterLeftViewport.panX(),
                "DE-CAM-002 viewport panX decreases by 120px");
        assertDoubleEquals(afterRightViewport.panY(), afterLeftViewport.panY(),
                "DE-CAM-002 viewport panY unchanged");
        assertDoubleEquals(afterRightViewport.zoom(), afterLeftViewport.zoom(),
                "DE-CAM-002 viewport zoom unchanged");
        assertCanvasHasPaintedContent(mapView, "DE-CAM-002 rendered scene remains visible after pan left");
        assertEquals(geometryRowsBefore, runtime.database().countAuthoredGeometryRows(mapId),
                "DE-CAM-002 leaves authored DB rows unchanged");


        DungeonEditorMapSurfaceSnapshot beforeDownSurface = runtime.mapSurfaceModel().current();
        dragMap(mapView, MouseButton.MIDDLE, 300, 300, 300, 420);
        assertEquals(beforeDownSurface, runtime.mapSurfaceModel().current(),
                "DE-CAM-003 pan down leaves published map surface unchanged");
        DungeonMapContentModel.Viewport afterDownViewport = mapContentModel.currentViewport();
        assertDoubleEquals(afterLeftViewport.panX(), afterDownViewport.panX(),
                "DE-CAM-003 viewport panX unchanged");
        assertDoubleEquals(afterLeftViewport.panY() + 120.0, afterDownViewport.panY(),
                "DE-CAM-003 viewport panY increases by 120px");
        assertDoubleEquals(afterLeftViewport.zoom(), afterDownViewport.zoom(),
                "DE-CAM-003 viewport zoom unchanged");
        assertCanvasHasPaintedContent(mapView, "DE-CAM-003 rendered scene remains visible after pan down");
        assertEquals(geometryRowsBefore, runtime.database().countAuthoredGeometryRows(mapId),
                "DE-CAM-003 leaves authored DB rows unchanged");


        DungeonEditorMapSurfaceSnapshot beforeUpSurface = runtime.mapSurfaceModel().current();
        dragMap(mapView, MouseButton.MIDDLE, 300, 420, 300, 300);
        assertEquals(beforeUpSurface, runtime.mapSurfaceModel().current(),
                "DE-CAM-004 pan up leaves published map surface unchanged");
        DungeonMapContentModel.Viewport afterUpViewport = mapContentModel.currentViewport();
        assertDoubleEquals(afterDownViewport.panX(), afterUpViewport.panX(),
                "DE-CAM-004 viewport panX unchanged");
        assertDoubleEquals(afterDownViewport.panY() - 120.0, afterUpViewport.panY(),
                "DE-CAM-004 viewport panY decreases by 120px");
        assertDoubleEquals(afterDownViewport.zoom(), afterUpViewport.zoom(),
                "DE-CAM-004 viewport zoom unchanged");
        assertCanvasHasPaintedContent(mapView, "DE-CAM-004 rendered scene remains visible after pan up");
        assertEquals(geometryRowsBefore, runtime.database().countAuthoredGeometryRows(mapId),
                "DE-CAM-004 leaves authored DB rows unchanged");


    }


    private static void verifyCameraZoomThroughMapView() {
        TestRuntime runtime = TestRuntime.create();
        TestBinding binding = bindTest(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();
        DungeonMapContentModel mapContentModel = binding.mapContentModel();

        long mapId = createMapThroughControls(controls, runtime, "Camera Zoom Map");
        runtime.database().seedF1SingleRoom(mapId, "R1", 0, 1, 1);
        long geometryRowsBefore = runtime.database().countAuthoredGeometryRows(mapId);
        DungeonEditorMapSurfaceSnapshot surfaceBefore = runtime.mapSurfaceModel().current();

        DungeonMapContentModel.Viewport initialViewport = mapContentModel.currentViewport();
        fireMapScroll(mapView, 80, 80, 120);
        assertEquals(surfaceBefore, runtime.mapSurfaceModel().current(),
                "DE-CAM-005 zoom in leaves published map surface unchanged");
        DungeonMapContentModel.Viewport zoomedInViewport = mapContentModel.currentViewport();
        assertTrue(zoomedInViewport.zoom() > initialViewport.zoom(),
                "DE-CAM-005 viewport zoom increases");
        assertTrue(zoomedInViewport.panX() != initialViewport.panX(),
                "DE-CAM-005 viewport panX is recalculated for zoom");
        assertTrue(zoomedInViewport.panY() != initialViewport.panY(),
                "DE-CAM-005 viewport panY is recalculated for zoom");
        assertDoubleEquals(80.0, zoomedInViewport.sceneToScreenX(initialViewport.screenToSceneX(80.0)),
                "DE-CAM-005 cursor scene x remains anchored");
        assertDoubleEquals(80.0, zoomedInViewport.sceneToScreenY(initialViewport.screenToSceneY(80.0)),
                "DE-CAM-005 cursor scene y remains anchored");
        assertCanvasHasPaintedContent(mapView, "DE-CAM-005 rendered scene remains visible after zoom in");
        assertEquals(geometryRowsBefore, runtime.database().countAuthoredGeometryRows(mapId),
                "DE-CAM-005 leaves authored DB rows unchanged");


        DungeonEditorMapSurfaceSnapshot afterZoomInSurface = runtime.mapSurfaceModel().current();
        fireMapScroll(mapView, 80, 80, -120);
        assertEquals(afterZoomInSurface, runtime.mapSurfaceModel().current(),
                "DE-CAM-006 zoom out leaves published map surface unchanged");
        DungeonMapContentModel.Viewport zoomedOutViewport = mapContentModel.currentViewport();
        assertTrue(zoomedOutViewport.zoom() < zoomedInViewport.zoom(),
                "DE-CAM-006 viewport zoom decreases");
        assertTrue(zoomedOutViewport.panX() != zoomedInViewport.panX(),
                "DE-CAM-006 viewport panX is recalculated for zoom");
        assertTrue(zoomedOutViewport.panY() != zoomedInViewport.panY(),
                "DE-CAM-006 viewport panY is recalculated for zoom");
        assertDoubleEquals(80.0, zoomedOutViewport.sceneToScreenX(zoomedInViewport.screenToSceneX(80.0)),
                "DE-CAM-006 cursor scene x remains anchored");
        assertDoubleEquals(80.0, zoomedOutViewport.sceneToScreenY(zoomedInViewport.screenToSceneY(80.0)),
                "DE-CAM-006 cursor scene y remains anchored");
        assertCanvasHasPaintedContent(mapView, "DE-CAM-006 rendered scene remains visible after zoom out");
        assertEquals(geometryRowsBefore, runtime.database().countAuthoredGeometryRows(mapId),
                "DE-CAM-006 leaves authored DB rows unchanged");

    }


    private static void verifyToolFamilyRowThroughControlsView() {
        TestRuntime runtime = TestRuntime.create();
        TestBinding binding = bindShellTest(runtime, 960.0, 700.0);
        DungeonEditorControlsView controls = binding.controls();

        long mapId = createMapThroughControls(controls, runtime, "Tool Family Row Map");
        selectMap(controls, "Tool Family Row Map");
        List<String> authoredStateBefore = runtime.database().authoredGeometryState(mapId);
        DungeonEditorToolSelection selectedControlsToolBefore = runtime.controlsModel().current().toolSelection();
        DungeonEditorToolSelection selectedMapToolBefore = runtime.mapSurfaceModel().current().toolSelection();

        List<String> familyLabels = List.of(
                "Auswahl",
                "Raum",
                "Wand",
                "Tür",
                "Korridor",
                "Feature",
                "Treppe",
                "Übergang");
        for (String label : List.of(
                "Raum malen",
                "Raum löschen",
                "Wand setzen",
                "Wand löschen",
                "Tür setzen",
                "Tür löschen",
                "Korridor erstellen",
                "Korridor löschen",
                "POI",
                "Objekt",
                "Encounter",
                "Feature löschen",
                "Treppe erstellen",
                "Treppe löschen",
                "Übergang erstellen",
                "Übergang löschen")) {
            assertTrue(!buttonVisible(controls, label), "DE-TOOL-001 no top-level subaction button: " + label);
        }

        HBox toolRow = toolFamilyRow(controls);
        Parent toolPanel = ancestorWithStyleClass(controls, "control-panel");
        Bounds controlsBounds = toolPanel.localToScene(toolPanel.getLayoutBounds());
        Bounds rowBounds = toolRow.localToScene(toolRow.getLayoutBounds());
        Set<String> visibleRowLabels = visibleRowButtonTexts(toolRow);
        assertEquals(new LinkedHashSet<>(familyLabels), visibleRowLabels,
                "DE-TOOL-001 exact visible family buttons live in the measured tool row");
        assertTrue(rowBounds.getMinX() >= controlsBounds.getMinX() - 0.5,
                "DE-TOOL-001 tool family row starts inside the tool panel");
        assertTrue(rowBounds.getMaxX() <= controlsBounds.getMaxX() + 0.5,
                "DE-TOOL-001 tool family row remains inside the tool panel");
        assertTrue(rowBounds.getWidth() <= controlsBounds.getWidth() + 0.5,
                "DE-TOOL-001 tool family row is not wider than the tool panel");
        assertTrue(controlsBounds.getMaxX() <= 960.0 + 0.5,
                "DE-TOOL-001 real shell tool panel fits within the 960px scene");
        for (ButtonBase button : visibleRowButtons(toolRow)) {
            Bounds buttonBounds = button.localToScene(button.getLayoutBounds());
            assertTrue(buttonBounds.getWidth() > 1.0 && buttonBounds.getHeight() > 1.0,
                    "DE-TOOL-001 family button has usable scene bounds: " + button.getText());
            assertTrue(buttonBounds.getMinX() >= rowBounds.getMinX() - 0.5
                            && buttonBounds.getMaxX() <= rowBounds.getMaxX() + 0.5,
                    "DE-TOOL-001 family button stays inside measured row: " + button.getText());
            assertTrue(buttonBounds.getMinX() >= controlsBounds.getMinX() - 0.5
                            && buttonBounds.getMaxX() <= controlsBounds.getMaxX() + 0.5,
                    "DE-TOOL-001 family button stays inside controls panel: " + button.getText());
            assertTrue(buttonBounds.getMinX() >= -0.5 && buttonBounds.getMaxX() <= 960.0 + 0.5,
                    "DE-TOOL-001 family button stays inside 960px scene: " + button.getText());
        }
        assertEquals(selectedControlsToolBefore, runtime.controlsModel().current().toolSelection(),
                "DE-TOOL-001 controls selected tool state remains unchanged");
        assertEquals(selectedMapToolBefore, runtime.mapSurfaceModel().current().toolSelection(),
                "DE-TOOL-001 map surface selected tool state remains unchanged");
        assertEquals(authoredStateBefore, runtime.database().authoredGeometryState(mapId),
                "DE-TOOL-001 leaves authored DB state unchanged");


    }


    private static void verifySecondaryToolDropdownThroughControlsView() {
        TestRuntime runtime = TestRuntime.create();
        TestBinding binding = bindTest(runtime, 960.0, 700.0);
        DungeonEditorControlsView controls = binding.controls();

        long mapId = createMapThroughControls(controls, runtime, "Tool Dropdown Map");
        selectMap(controls, "Tool Dropdown Map");
        List<String> authoredStateBefore = runtime.database().authoredGeometryState(mapId);
        ButtonBase stairFamily = button(controls, "Treppe");
        DungeonEditorMapSurfaceSnapshot surfaceBeforeStairSelection = runtime.mapSurfaceModel().current();
        AtomicInteger stairSelectionSurfacePublications = new AtomicInteger();
        AtomicInteger stairSelectionStatePublications = new AtomicInteger();
        Runnable unsubscribeStairSelectionSurface =
                runtime.mapSurfaceModel().subscribe(ignored -> stairSelectionSurfacePublications.incrementAndGet());
        Runnable unsubscribeStairSelectionState =
                runtime.stateModel().subscribe(ignored -> stairSelectionStatePublications.incrementAndGet());

        click(stairFamily);
        Parent dropdown = popupContainer();
        assertTrue(popupButtonVisible("Gerade"), "DE-TOOL-002 first stair option is visible");
        assertTrue(popupButtonVisible("Eckspirale"), "DE-TOOL-002 second stair option is visible");
        assertTrue(popupButtonVisible("Rundspirale"), "DE-TOOL-002 third stair option is visible");
        assertTrue(!popupButton("Eckspirale").isDisabled(),
                "DE-TOOL-002 supported square stair option is selectable");
        assertTrue(!popupButton("Rundspirale").isDisabled(),
                "DE-TOOL-002 supported round stair option is selectable");
        assertPopupAnchoredBelow(stairFamily, dropdown, "DE-TOOL-002");
        assertPopupOptionSelected("Gerade", "DE-TOOL-002 first option is preselected by default");
        assertEquals(DungeonEditorToolSelection.stair(DungeonEditorToolOptions.Stair.Shape.STRAIGHT),
                runtime.controlsModel().current().toolSelection(),
                "DE-TOOL-002 stair family activates the stair creation tool");
        unsubscribeStairSelectionSurface.run();
        unsubscribeStairSelectionState.run();
        assertEquals(surfaceBeforeStairSelection, runtime.mapSurfaceModel().current(),
                "DE-TOOL-002 stair family leaves published map surface unchanged");
        assertEquals(0L, stairSelectionSurfacePublications.get(),
                "DE-TOOL-002 stair family does not publish map surface");
        assertEquals(0L, stairSelectionStatePublications.get(),
                "DE-TOOL-002 stair family does not publish state");
        assertTrue(stairFamily.getAccessibleText().contains("Gerade"),
                "DE-TOOL-002 family button announces the selected secondary option");
        assertEquals(authoredStateBefore, runtime.database().authoredGeometryState(mapId),
                "DE-TOOL-002 leaves authored DB state unchanged");


        click(popupButton("Eckspirale"));
        assertEquals(DungeonEditorToolSelection.stair(DungeonEditorToolOptions.Stair.Shape.SQUARE),
                runtime.controlsModel().current().toolSelection(),
                "DE-TOOL-003 supported stair sub-option selects the square stair creation route");
        assertEquals(authoredStateBefore, runtime.database().authoredGeometryState(mapId),
                "DE-TOOL-003 selecting the sub-option leaves authored DB state unchanged");
        assertTrue(stairFamily.getAccessibleText().contains("Eckspirale"),
                "DE-TOOL-003 family button announces the remembered secondary option");
        assertTrue(!popupButtonVisible("Eckspirale"),
                "DE-TOOL-003 selecting the sub-option closes the dropdown before reopening");
        click(stairFamily);
        assertPopupOptionSelected("Eckspirale", "DE-TOOL-003 remembers the non-default supported option");


        firePopupMouseExited(popupContainer());
        assertTrue(!popupButtonVisible("Eckspirale"),
                "DE-TOOL-004 dropdown closes when pointer leaves the dropdown window area");
        assertEquals(DungeonEditorToolSelection.stair(DungeonEditorToolOptions.Stair.Shape.SQUARE),
                runtime.controlsModel().current().toolSelection(),
                "DE-TOOL-004 pointer leave keeps selected family tool unchanged");
        assertEquals(authoredStateBefore, runtime.database().authoredGeometryState(mapId),
                "DE-TOOL-004 leaves authored DB state unchanged");


        click(stairFamily);
        assertPopupOptionSelected("Eckspirale", "DE-TOOL-006 starts with the remembered stair option");
        DungeonEditorMapSurfaceSnapshot surfaceBeforeDropdownEscape = runtime.mapSurfaceModel().current();
        AtomicInteger dropdownEscapeSurfacePublications = new AtomicInteger();
        AtomicInteger dropdownEscapeStatePublications = new AtomicInteger();
        Runnable unsubscribeDropdownEscapeSurface =
                runtime.mapSurfaceModel().subscribe(ignored -> dropdownEscapeSurfacePublications.incrementAndGet());
        Runnable unsubscribeDropdownEscapeState =
                runtime.stateModel().subscribe(ignored -> dropdownEscapeStatePublications.incrementAndGet());
        firePopupShortcut(popupContainer(), KeyCode.ESCAPE);
        unsubscribeDropdownEscapeSurface.run();
        unsubscribeDropdownEscapeState.run();
        assertTrue(!popupButtonVisible("Eckspirale"), "DE-TOOL-006 Esc closes the secondary option dropdown");
        assertEquals(DungeonEditorToolSelection.select(), runtime.controlsModel().current().toolSelection(),
                "DE-TOOL-006 controls selected tool resets to Auswahl");
        assertEquals(surfaceBeforeDropdownEscape, runtime.mapSurfaceModel().current(),
                "DE-TOOL-006 dropdown Esc leaves published map surface unchanged");
        assertEquals(0L, dropdownEscapeSurfacePublications.get(),
                "DE-TOOL-006 dropdown Esc does not publish map surface");
        assertEquals(0L, dropdownEscapeStatePublications.get(),
                "DE-TOOL-006 dropdown Esc does not publish state");
        click(stairFamily);
        assertPopupOptionSelected("Gerade", "DE-TOOL-006 Esc clears remembered secondary option intent");
        firePopupMouseExited(popupContainer());
        assertEquals(authoredStateBefore, runtime.database().authoredGeometryState(mapId),
                "DE-TOOL-006 leaves authored DB state unchanged");

    }


    private static void verifyEscapeResetsToolThroughMapView() {
        TestRuntime runtime = TestRuntime.create();
        TestBinding binding = bindTest(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();

        long mapId = createMapThroughControls(controls, runtime, "Escape Tool Reset Map");
        long geometryRowsBefore = runtime.database().countAuthoredGeometryRows(mapId);
        click(button(controls, "Raum"));

        DungeonEditorControlsSnapshot roomControls = runtime.controlsModel().current();
        assertEquals(DungeonEditorToolSelection.family(DungeonEditorToolFamily.ROOM), roomControls.toolSelection(),
                "DE-TOOL-005 room family button selects the remembered/default tool without a second click");
        assertTrue(buttonVisible(controls, "Raum"), "DE-TOOL-005 room family button remains visible");
        assertTrue(!popupButtonVisible("Raum löschen"), "DE-TOOL-005 delete is not a secondary dropdown option");
        DungeonEditorMapSurfaceSnapshot surfaceBeforeShiftSecondary = runtime.mapSurfaceModel().current();
        fireMapMousePressed(mapView, MouseButton.SECONDARY, true);
        assertEquals(DungeonEditorToolSelection.family(DungeonEditorToolFamily.ROOM),
                runtime.controlsModel().current().toolSelection(),
                "DE-TOOL-005 shift-secondary does not change selected tool or route to delete");
        assertEquals(surfaceBeforeShiftSecondary, runtime.mapSurfaceModel().current(),
                "DE-TOOL-005 shift-secondary leaves the published map surface unchanged");

        DungeonEditorMapSurfaceSnapshot surfaceBeforeMapEscape = runtime.mapSurfaceModel().current();
        AtomicInteger mapEscapeSurfacePublications = new AtomicInteger();
        AtomicInteger mapEscapeStatePublications = new AtomicInteger();
        Runnable unsubscribeMapEscapeSurface =
                runtime.mapSurfaceModel().subscribe(ignored -> mapEscapeSurfacePublications.incrementAndGet());
        Runnable unsubscribeMapEscapeState =
                runtime.stateModel().subscribe(ignored -> mapEscapeStatePublications.incrementAndGet());
        fireMapShortcut(mapView, KeyCode.ESCAPE);
        unsubscribeMapEscapeSurface.run();
        unsubscribeMapEscapeState.run();

        DungeonEditorControlsSnapshot resetControls = runtime.controlsModel().current();
        DungeonEditorMapSurfaceSnapshot resetSurface = runtime.mapSurfaceModel().current();
        assertEquals(DungeonEditorToolSelection.select(), resetControls.toolSelection(),
                "DE-TOOL-005 controls selected tool resets");
        assertEquals(surfaceBeforeMapEscape, resetSurface, "DE-TOOL-005 map Esc leaves published map surface unchanged");
        assertEquals(0L, mapEscapeSurfacePublications.get(), "DE-TOOL-005 map Esc does not publish map surface");
        assertEquals(0L, mapEscapeStatePublications.get(), "DE-TOOL-005 map Esc does not publish state");
        assertTrue(toggleSelected(controls, "Auswahl"), "DE-TOOL-005 selection tool appears active");
        assertTrue(!popupButtonVisible("Raum malen"), "DE-TOOL-005 no room popup is visible after Esc");
        assertEquals(geometryRowsBefore, runtime.database().countAuthoredGeometryRows(mapId),
                "DE-TOOL-005 leaves authored DB rows unchanged");

        click(button(controls, "Raum"));
        assertEquals(DungeonEditorToolSelection.family(DungeonEditorToolFamily.ROOM),
                runtime.controlsModel().current().toolSelection(),
                "DE-TOOL-005 room family can be selected from the controls before controls-focused Esc");

        DungeonEditorMapSurfaceSnapshot surfaceBeforeControlsEscape = runtime.mapSurfaceModel().current();
        AtomicInteger controlsEscapeSurfacePublications = new AtomicInteger();
        AtomicInteger controlsEscapeStatePublications = new AtomicInteger();
        Runnable unsubscribeControlsEscapeSurface =
                runtime.mapSurfaceModel().subscribe(ignored -> controlsEscapeSurfacePublications.incrementAndGet());
        Runnable unsubscribeControlsEscapeState =
                runtime.stateModel().subscribe(ignored -> controlsEscapeStatePublications.incrementAndGet());
        fireControlsShortcut(button(controls, "Raum"), KeyCode.ESCAPE);
        unsubscribeControlsEscapeSurface.run();
        unsubscribeControlsEscapeState.run();

        DungeonEditorControlsSnapshot controlsFocusedReset = runtime.controlsModel().current();
        DungeonEditorMapSurfaceSnapshot controlsFocusedSurface = runtime.mapSurfaceModel().current();
        assertEquals(DungeonEditorToolSelection.select(), controlsFocusedReset.toolSelection(),
                "DE-TOOL-005 controls-focused Esc resets controls selected tool");
        assertEquals(surfaceBeforeControlsEscape, controlsFocusedSurface,
                "DE-TOOL-005 controls-focused Esc leaves published map surface unchanged");
        assertEquals(0L, controlsEscapeSurfacePublications.get(),
                "DE-TOOL-005 controls-focused Esc does not publish map surface");
        assertEquals(0L, controlsEscapeStatePublications.get(),
                "DE-TOOL-005 controls-focused Esc does not publish state");
        assertTrue(toggleSelected(controls, "Auswahl"),
                "DE-TOOL-005 controls-focused Esc makes Auswahl active");
        assertEquals(geometryRowsBefore, runtime.database().countAuthoredGeometryRows(mapId),
                "DE-TOOL-005 controls-focused Esc leaves authored DB rows unchanged");


    }

}
