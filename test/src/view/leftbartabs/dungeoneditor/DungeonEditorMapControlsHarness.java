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

final class DungeonEditorMapControlsHarness {

    private static final String OWNER = "DungeonEditorMapControlsHarness";

    private DungeonEditorMapControlsHarness() {
    }

    static void run(List<String> results) throws Exception {
        route(results, () -> verifyCameraPanThroughMapView(results));
        route(results, () -> verifyCameraZoomThroughMapView(results));
        route(results, () -> verifyToolFamilyRowThroughControlsView(results));
        route(results, () -> verifySecondaryToolDropdownThroughControlsView(results));
        route(results, () -> verifyEscapeResetsToolThroughMapView(results));
    }

    private static void route(
            List<String> results,
            DungeonEditorBehaviorHarnessSupport.ThrowingRunnable action
    ) throws Exception {
        DungeonEditorBehaviorHarnessSupport.runRouteProof(results, OWNER, action);
    }

    private static void verifyCameraPanThroughMapView(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();
        DungeonMapContentModel mapContentModel = binding.mapContentModel();

        long mapId = createMapThroughControls(controls, runtime, "Camera Pan Map");
        runtime.database().seedF1SingleRoom(mapId, "R1", 0, 1, 1);
        long geometryRowsBefore = runtime.database().countAuthoredGeometryRows(mapId);
        DungeonEditorMapSurfaceSnapshot surfaceBefore = runtime.mapSurfaceModel().current();

        DungeonMapContentModel.Viewport initialViewport = mapContentModel.currentViewport();
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
        results.add("DE-CAM-001 Ready: DungeonMapView middle-drag right -> SQLite unchanged -> render shifts right");

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
        results.add("DE-CAM-002 Ready: DungeonMapView middle-drag left -> SQLite unchanged -> render shifts left");

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
        results.add("DE-CAM-003 Ready: DungeonMapView middle-drag down -> SQLite unchanged -> render shifts down");

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
        results.add("DE-CAM-004 Ready: DungeonMapView middle-drag up -> SQLite unchanged -> render shifts up");
    }


    private static void verifyCameraZoomThroughMapView(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
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
        results.add("DE-CAM-005 Ready: DungeonMapView scroll in -> SQLite unchanged -> cursor-anchored zoom");

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
        results.add("DE-CAM-006 Ready: DungeonMapView scroll out -> SQLite unchanged -> cursor-anchored zoom");
    }


    private static void verifyToolFamilyRowThroughControlsView(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindShellHarness(runtime, 960.0, 700.0);
        DungeonEditorControlsView controls = binding.controls();

        long mapId = createMapThroughControls(controls, runtime, "Tool Family Row Map");
        selectMap(controls, "Tool Family Row Map");
        List<String> authoredStateBefore = runtime.database().authoredGeometryState(mapId);
        String selectedControlsToolBefore = runtime.controlsModel().current().selectedTool().name();
        String selectedMapToolBefore = runtime.mapSurfaceModel().current().selectedTool().name();

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
        assertEquals(selectedControlsToolBefore, runtime.controlsModel().current().selectedTool().name(),
                "DE-TOOL-001 controls selected tool state remains unchanged");
        assertEquals(selectedMapToolBefore, runtime.mapSurfaceModel().current().selectedTool().name(),
                "DE-TOOL-001 map surface selected tool state remains unchanged");
        assertEquals(authoredStateBefore, runtime.database().authoredGeometryState(mapId),
                "DE-TOOL-001 leaves authored DB state unchanged");

        results.add("DE-TOOL-001 Ready: real shell 960px tool panel -> family row -> no top-level subactions");
    }


    private static void verifySecondaryToolDropdownThroughControlsView(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime, 960.0, 700.0);
        DungeonEditorControlsView controls = binding.controls();

        long mapId = createMapThroughControls(controls, runtime, "Tool Dropdown Map");
        selectMap(controls, "Tool Dropdown Map");
        List<String> authoredStateBefore = runtime.database().authoredGeometryState(mapId);
        ButtonBase stairFamily = button(controls, "Treppe");

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
        assertEquals("STAIR_CREATE", runtime.controlsModel().current().selectedTool().name(),
                "DE-TOOL-002 stair family activates the stair creation tool");
        assertTrue(stairFamily.getAccessibleText().contains("Gerade"),
                "DE-TOOL-002 family button announces the selected secondary option");
        assertEquals(authoredStateBefore, runtime.database().authoredGeometryState(mapId),
                "DE-TOOL-002 leaves authored DB state unchanged");
        results.add("DE-TOOL-002 Ready: DungeonEditorControlsView Treppe -> anchored secondary option dropdown");

        click(popupButton("Eckspirale"));
        assertEquals("STAIR_CREATE_SQUARE", runtime.controlsModel().current().selectedTool().name(),
                "DE-TOOL-003 supported stair sub-option selects the square stair creation route");
        assertEquals(authoredStateBefore, runtime.database().authoredGeometryState(mapId),
                "DE-TOOL-003 selecting the sub-option leaves authored DB state unchanged");
        assertTrue(stairFamily.getAccessibleText().contains("Eckspirale"),
                "DE-TOOL-003 family button announces the remembered secondary option");
        assertTrue(!popupButtonVisible("Eckspirale"),
                "DE-TOOL-003 selecting the sub-option closes the dropdown before reopening");
        click(stairFamily);
        assertPopupOptionSelected("Eckspirale", "DE-TOOL-003 remembers the non-default supported option");
        results.add("DE-TOOL-003 Ready: DungeonEditorControlsView secondary option -> reopen remembers selection");

        firePopupMouseExited(popupContainer());
        assertTrue(!popupButtonVisible("Eckspirale"),
                "DE-TOOL-004 dropdown closes when pointer leaves the dropdown window area");
        assertEquals("STAIR_CREATE_SQUARE", runtime.controlsModel().current().selectedTool().name(),
                "DE-TOOL-004 pointer leave keeps selected family tool unchanged");
        assertEquals(authoredStateBefore, runtime.database().authoredGeometryState(mapId),
                "DE-TOOL-004 leaves authored DB state unchanged");
        results.add("DE-TOOL-004 Ready: DungeonEditorControlsView secondary option dropdown -> mouse exit closes");

        click(stairFamily);
        assertPopupOptionSelected("Eckspirale", "DE-TOOL-006 starts with the remembered stair option");
        firePopupShortcut(popupContainer(), KeyCode.ESCAPE);
        assertTrue(!popupButtonVisible("Eckspirale"), "DE-TOOL-006 Esc closes the secondary option dropdown");
        assertEquals("SELECT", runtime.controlsModel().current().selectedTool().name(),
                "DE-TOOL-006 controls selected tool resets to Auswahl");
        assertEquals("SELECT", runtime.mapSurfaceModel().current().selectedTool().name(),
                "DE-TOOL-006 map surface selected tool resets to Auswahl");
        click(stairFamily);
        assertPopupOptionSelected("Gerade", "DE-TOOL-006 Esc clears remembered secondary option intent");
        firePopupMouseExited(popupContainer());
        assertEquals(authoredStateBefore, runtime.database().authoredGeometryState(mapId),
                "DE-TOOL-006 leaves authored DB state unchanged");
        results.add("DE-TOOL-006 Ready: DungeonEditorControlsView dropdown Esc -> closed and reset");
    }


    private static void verifyEscapeResetsToolThroughMapView(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();

        long mapId = createMapThroughControls(controls, runtime, "Escape Tool Reset Map");
        long geometryRowsBefore = runtime.database().countAuthoredGeometryRows(mapId);
        click(button(controls, "Raum"));

        DungeonEditorControlsSnapshot roomControls = runtime.controlsModel().current();
        assertEquals("ROOM_PAINT", roomControls.selectedTool().name(),
                "DE-TOOL-005 room family button selects the remembered/default tool without a second click");
        assertTrue(buttonVisible(controls, "Raum"), "DE-TOOL-005 room family button remains visible");
        assertTrue(!popupButtonVisible("Raum löschen"), "DE-TOOL-005 delete is not a secondary dropdown option");
        DungeonEditorMapSurfaceSnapshot surfaceBeforeShiftSecondary = runtime.mapSurfaceModel().current();
        fireMapMousePressed(mapView, MouseButton.SECONDARY, true);
        assertEquals("ROOM_PAINT", runtime.controlsModel().current().selectedTool().name(),
                "DE-TOOL-005 shift-secondary does not change selected tool or route to delete");
        assertEquals(surfaceBeforeShiftSecondary, runtime.mapSurfaceModel().current(),
                "DE-TOOL-005 shift-secondary leaves the published map surface unchanged");

        fireMapShortcut(mapView, KeyCode.ESCAPE);

        DungeonEditorControlsSnapshot resetControls = runtime.controlsModel().current();
        DungeonEditorMapSurfaceSnapshot resetSurface = runtime.mapSurfaceModel().current();
        assertEquals("SELECT", resetControls.selectedTool().name(), "DE-TOOL-005 controls selected tool resets");
        assertEquals("SELECT", resetSurface.selectedTool().name(), "DE-TOOL-005 map surface selected tool resets");
        assertTrue(toggleSelected(controls, "Auswahl"), "DE-TOOL-005 selection tool appears active");
        assertTrue(!popupButtonVisible("Raum malen"), "DE-TOOL-005 no room popup is visible after Esc");
        assertEquals(geometryRowsBefore, runtime.database().countAuthoredGeometryRows(mapId),
                "DE-TOOL-005 leaves authored DB rows unchanged");

        click(button(controls, "Raum"));
        assertEquals("ROOM_PAINT", runtime.controlsModel().current().selectedTool().name(),
                "DE-TOOL-005 room family can be selected from the controls before controls-focused Esc");

        fireControlsShortcut(button(controls, "Raum"), KeyCode.ESCAPE);

        DungeonEditorControlsSnapshot controlsFocusedReset = runtime.controlsModel().current();
        DungeonEditorMapSurfaceSnapshot controlsFocusedSurface = runtime.mapSurfaceModel().current();
        assertEquals("SELECT", controlsFocusedReset.selectedTool().name(),
                "DE-TOOL-005 controls-focused Esc resets controls selected tool");
        assertEquals("SELECT", controlsFocusedSurface.selectedTool().name(),
                "DE-TOOL-005 controls-focused Esc resets map surface selected tool");
        assertTrue(toggleSelected(controls, "Auswahl"),
                "DE-TOOL-005 controls-focused Esc makes Auswahl active");
        assertEquals(geometryRowsBefore, runtime.database().countAuthoredGeometryRows(mapId),
                "DE-TOOL-005 controls-focused Esc leaves authored DB rows unchanged");

        results.add("DE-TOOL-005 Ready: DungeonMapView and controls-focused Esc -> SQLite unchanged -> Auswahl");
    }

}
