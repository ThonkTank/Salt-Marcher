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

final class DungeonEditorProjectionOverlayHarness {

    private static final String OWNER = "DungeonEditorProjectionOverlayHarness";

    private DungeonEditorProjectionOverlayHarness() {
    }

    static void run(List<String> results) throws Exception {
        route(results, () -> verifyProjectionLevelButtonsThroughControlsView(results));
        route(results, () -> verifyProjectionLevelShortcutsThroughMapView(results));
        route(results, () -> verifyViewModeControlsThroughControlsView(results));
        route(results, () -> verifyOverlayControlsThroughControlsView(results));
        route(results, () -> verifyOverlayPopupThroughControlsView(results));
    }

    private static void route(
            List<String> results,
            DungeonEditorBehaviorHarnessSupport.ThrowingRunnable action
    ) throws Exception {
        DungeonEditorBehaviorHarnessSupport.runRouteProof(results, OWNER, action);
    }

    private static void verifyProjectionLevelButtonsThroughControlsView(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();

        long mapId = createMapThroughControls(controls, runtime, "Visible Level Controls Map");
        runtime.database().seedF6MultiLevelFloors(mapId);
        long geometryRowsBefore = runtime.database().countAuthoredGeometryRows(mapId);

        click(button(controls, "+"));

        DungeonEditorControlsSnapshot afterPlusControls = runtime.controlsModel().current();
        DungeonEditorMapSurfaceSnapshot afterPlusSurface = runtime.mapSurfaceModel().current();
        assertEquals(1L, afterPlusControls.projectionLevel(), "DE-LVL-001 controls projection level increments");
        assertEquals(1L, afterPlusSurface.projectionLevel(), "DE-LVL-001 map surface projection level increments");
        assertTrue(surfaceContainsLevel(afterPlusSurface, 1),
                "DE-LVL-001 published map surface contains level 1 authored cells");
        assertTrue(labelVisible(controls, "Ebene z=1"),
                "DE-LVL-001 visible level label updates");
        assertCanvasPaintedAtScene(binding.mapView(), 2.5, 2.5,
                "DE-LVL-001 rendered canvas paints level 1 room coordinates");
        assertEquals(geometryRowsBefore, runtime.database().countAuthoredGeometryRows(mapId),
                "DE-LVL-001 leaves authored DB rows unchanged");

        click(button(controls, "-"));

        DungeonEditorControlsSnapshot afterMinusControls = runtime.controlsModel().current();
        DungeonEditorMapSurfaceSnapshot afterMinusSurface = runtime.mapSurfaceModel().current();
        assertEquals(0L, afterMinusControls.projectionLevel(), "DE-LVL-002 controls projection level decrements");
        assertEquals(0L, afterMinusSurface.projectionLevel(), "DE-LVL-002 map surface projection level decrements");
        assertTrue(surfaceContainsLevel(afterMinusSurface, 0),
                "DE-LVL-002 published map surface contains level 0 authored cells");
        assertTrue(labelVisible(controls, "Ebene z=0"),
                "DE-LVL-002 visible level label updates");
        assertCanvasPaintedAtScene(binding.mapView(), 2.5, 2.5,
                "DE-LVL-002 rendered canvas paints level 0 room coordinates");
        assertEquals(geometryRowsBefore, runtime.database().countAuthoredGeometryRows(mapId),
                "DE-LVL-002 leaves authored DB rows unchanged");

        results.add("DE-LVL-001 Ready: DungeonEditorControlsView + button -> SQLite unchanged -> projection z=1");
        results.add("DE-LVL-002 Ready: DungeonEditorControlsView - button -> SQLite unchanged -> projection z=0");
    }


    private static void verifyProjectionLevelShortcutsThroughMapView(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();

        long mapId = createMapThroughControls(controls, runtime, "F6 Multi Level Floors");
        runtime.database().seedF6MultiLevelFloors(mapId);
        long geometryRowsBefore = runtime.database().countAuthoredGeometryRows(mapId);

        fireMapShortcut(mapView, KeyCode.E);

        DungeonEditorControlsSnapshot afterEControls = runtime.controlsModel().current();
        DungeonEditorMapSurfaceSnapshot afterESurface = runtime.mapSurfaceModel().current();
        assertEquals(1L, afterEControls.projectionLevel(), "DE-LVL-003 controls projection level increments");
        assertEquals(1L, afterESurface.projectionLevel(), "DE-LVL-003 map surface projection level increments");
        assertTrue(afterEControls.reachableLevels().containsAll(List.of(0, 1, 2)),
                "DE-LVL-003 fixture exposes F6 reachable levels");
        assertTrue(surfaceContainsLevel(afterESurface, 1),
                "DE-LVL-003 published map surface contains level 1 authored cells");
        assertTrue(labelVisible(controls, "Ebene z=1"),
                "DE-LVL-003 controls render-facing level label updates");
        assertCanvasPaintedAtScene(binding.mapView(), 2.5, 2.5,
                "DE-LVL-003 rendered canvas paints level 1 room coordinates");
        assertEquals(geometryRowsBefore, runtime.database().countAuthoredGeometryRows(mapId),
                "DE-LVL-003 leaves authored DB rows unchanged");

        fireMapShortcut(mapView, KeyCode.Q);

        DungeonEditorControlsSnapshot afterQControls = runtime.controlsModel().current();
        DungeonEditorMapSurfaceSnapshot afterQSurface = runtime.mapSurfaceModel().current();
        assertEquals(0L, afterQControls.projectionLevel(), "DE-LVL-004 controls projection level decrements");
        assertEquals(0L, afterQSurface.projectionLevel(), "DE-LVL-004 map surface projection level decrements");
        assertTrue(surfaceContainsLevel(afterQSurface, 0),
                "DE-LVL-004 published map surface contains level 0 authored cells");
        assertTrue(labelVisible(controls, "Ebene z=0"),
                "DE-LVL-004 controls render-facing level label updates");
        assertCanvasPaintedAtScene(binding.mapView(), 2.5, 2.5,
                "DE-LVL-004 rendered canvas paints level 0 room coordinates");
        assertEquals(geometryRowsBefore, runtime.database().countAuthoredGeometryRows(mapId),
                "DE-LVL-004 leaves authored DB rows unchanged");

        results.add("DE-LVL-003 Ready: DungeonMapView E key -> SQLite unchanged -> published projection z=1");
        results.add("DE-LVL-004 Ready: DungeonMapView Q key -> SQLite unchanged -> published projection z=0");
    }


    private static void verifyViewModeControlsThroughControlsView(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();

        long mapId = createMapThroughControls(controls, runtime, "View Mode Controls Map");
        runtime.database().seedF1SingleRoom(mapId, "R1", 0, 1, 1);
        long geometryRowsBefore = runtime.database().countAuthoredGeometryRows(mapId);

        click(button(controls, "Graph"));

        DungeonEditorControlsSnapshot graphControls = runtime.controlsModel().current();
        DungeonEditorMapSurfaceSnapshot graphSurface = runtime.mapSurfaceModel().current();
        assertEquals(DungeonEditorViewMode.GRAPH, graphControls.viewMode(), "DE-VIEW-001 controls view mode");
        assertEquals(DungeonEditorViewMode.GRAPH, graphSurface.viewMode(), "DE-VIEW-001 map surface view mode");
        assertTrue(toggleSelected(controls, "Graph"), "DE-VIEW-001 graph control is visibly selected");
        assertTrue(surfaceContainsLevel(graphSurface, 0),
                "DE-VIEW-001 graph snapshot keeps the authored topology available");
        assertCanvasHasPaintedContent(binding.mapView(), "DE-VIEW-001 graph canvas renders authored topology");
        assertEquals(geometryRowsBefore, runtime.database().countAuthoredGeometryRows(mapId),
                "DE-VIEW-001 leaves authored DB rows unchanged");

        click(button(controls, "Grid"));

        DungeonEditorControlsSnapshot gridControls = runtime.controlsModel().current();
        DungeonEditorMapSurfaceSnapshot gridSurface = runtime.mapSurfaceModel().current();
        assertEquals(DungeonEditorViewMode.GRID, gridControls.viewMode(), "DE-VIEW-002 controls view mode");
        assertEquals(DungeonEditorViewMode.GRID, gridSurface.viewMode(), "DE-VIEW-002 map surface view mode");
        assertTrue(toggleSelected(controls, "Grid"), "DE-VIEW-002 grid control is visibly selected");
        assertTrue(surfaceContainsLevel(gridSurface, 0),
                "DE-VIEW-002 grid snapshot keeps the authored topology available");
        assertCanvasPaintedAtScene(binding.mapView(), 2.5, 2.5,
                "DE-VIEW-002 grid canvas paints authored room coordinates");
        assertEquals(geometryRowsBefore, runtime.database().countAuthoredGeometryRows(mapId),
                "DE-VIEW-002 leaves authored DB rows unchanged");

        results.add("DE-VIEW-001 Ready: DungeonEditorControlsView Graph toggle -> SQLite unchanged -> GRAPH");
        results.add("DE-VIEW-002 Ready: DungeonEditorControlsView Grid toggle -> SQLite unchanged -> GRID");
    }


    private static void verifyOverlayControlsThroughControlsView(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();

        long mapId = createMapThroughControls(controls, runtime, "Overlay Controls Map");
        runtime.database().seedF6MultiLevelFloors(mapId);
        long geometryRowsBefore = runtime.database().countAuthoredGeometryRows(mapId);
        ComboBox<?> overlayModeSelector = comboBoxWithDisplayedItem(controls, "Nahe Ebenen");

        selectComboItem(overlayModeSelector, "Nahe Ebenen");
        selectComboItem(overlayModeSelector, "Aus");

        assertOverlaySettings(runtime.controlsModel().current().overlaySettings(), "OFF", 2, 0.35, List.of(),
                "DE-OVR-001 controls overlay settings");
        assertOverlaySettings(runtime.mapSurfaceModel().current().overlaySettings(), "OFF", 2, 0.35, List.of(),
                "DE-OVR-001 map surface overlay settings");
        assertTrue(buttonVisible(controls, "Overlay: Aus"),
                "DE-OVR-001 overlay trigger text summarizes off settings");
        assertEquals(Set.of("1,1,0", "1,2,0", "1,3,0", "2,1,0", "2,2,0", "2,3,0", "3,1,0", "3,2,0", "3,3,0"),
                renderSurfaceCellOriginsWithZ(binding.mapContentModel()),
                "DE-OVR-001 render scene contains only active level cells");
        assertEquals(geometryRowsBefore, runtime.database().countAuthoredGeometryRows(mapId),
                "DE-OVR-001 leaves authored DB rows unchanged");

        selectComboItem(overlayModeSelector, "Nahe Ebenen");
        setSpinnerValue(spinner(controls), 1);
        setSliderValue(slider(controls), 35.0);

        assertOverlaySettings(runtime.controlsModel().current().overlaySettings(), "NEARBY", 1, 0.35, List.of(),
                "DE-OVR-002 controls overlay settings");
        assertOverlaySettings(runtime.mapSurfaceModel().current().overlaySettings(), "NEARBY", 1, 0.35, List.of(),
                "DE-OVR-002 map surface overlay settings");
        assertTrue(buttonVisible(controls, "Overlay: Nachbarn +/-1 35%"),
                "DE-OVR-002 overlay trigger text summarizes nearby settings");
        assertCanvasPaintedAtScene(binding.mapView(), 2.5, 2.5,
                "DE-OVR-002 rendered canvas paints active/nearby overlay room coordinates");
        assertEquals(geometryRowsBefore, runtime.database().countAuthoredGeometryRows(mapId),
                "DE-OVR-002 leaves authored DB rows unchanged");

        selectComboItem(overlayModeSelector, "Auswahl");
        TextField selectedLevelsField = textFieldByPrompt(controls, "-1, 1, 3");
        selectedLevelsField.setText("-1,1,2");
        selectedLevelsField.fireEvent(new ActionEvent());

        assertOverlaySettings(runtime.controlsModel().current().overlaySettings(), "SELECTED", 1, 0.35, List.of(-1, 1, 2),
                "DE-OVR-003 controls overlay settings");
        assertOverlaySettings(runtime.mapSurfaceModel().current().overlaySettings(), "SELECTED", 1, 0.35, List.of(-1, 1, 2),
                "DE-OVR-003 map surface overlay settings");
        assertTrue(buttonVisible(controls, "Overlay: Auswahl z=-1, 1, 2 35%"),
                "DE-OVR-003 overlay trigger text summarizes selected levels");
        assertCanvasPaintedAtScene(binding.mapView(), 2.5, 2.5,
                "DE-OVR-003 rendered canvas paints active/selected overlay room coordinates");
        assertEquals(geometryRowsBefore, runtime.database().countAuthoredGeometryRows(mapId),
                "DE-OVR-003 leaves authored DB rows unchanged");

        results.add("DE-OVR-001 Ready: DungeonEditorControlsView overlay off -> SQLite unchanged -> OFF");
        results.add("DE-OVR-002 Ready: DungeonEditorControlsView nearby overlay controls -> SQLite unchanged -> NEARBY");
        results.add("DE-OVR-003 Ready: DungeonEditorControlsView selected overlay controls -> SQLite unchanged -> SELECTED");
    }


    private static void verifyOverlayPopupThroughControlsView(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();

        long mapId = createMapThroughControls(controls, runtime, "Overlay Popup Map");
        runtime.database().seedF6MultiLevelFloors(mapId);
        long geometryRowsBefore = runtime.database().countAuthoredGeometryRows(mapId);
        ButtonBase overlayTrigger = button(controls, "Overlay: Aus");

        click(overlayTrigger);
        Parent popup = popupContainer();
        assertPopupAnchoredBelow(overlayTrigger, popup, "DE-OVR-004");
        assertAccessibleNode(popup, HBox.class, "Overlay-Popup-Modus waehlen");
        assertAccessibleNode(popup, Spinner.class, "Overlay-Popup-Reichweite einstellen");
        assertAccessibleNode(popup, Slider.class, "Overlay-Popup-Deckkraft einstellen");
        assertAccessibleNode(popup, TextField.class, "Overlay-Popup-Ebenen eingeben");
        assertPopupOptionSelected("Aus", "DE-OVR-004 default overlay popup mode");
        click(popupButton("Nahe Ebenen"));
        setSpinnerValue(spinner(popupContainer()), 1);
        setSliderValue(slider(popupContainer()), 35.0);

        assertOverlaySettings(runtime.controlsModel().current().overlaySettings(), "NEARBY", 1, 0.35, List.of(),
                "DE-OVR-004 controls overlay settings");
        assertOverlaySettings(runtime.mapSurfaceModel().current().overlaySettings(), "NEARBY", 1, 0.35, List.of(),
                "DE-OVR-004 map surface overlay settings");
        assertTrue(popupContainerVisible(), "DE-OVR-004 overlay popup remains visible while editing");
        assertTrue(buttonVisible(controls, "Overlay: Nachbarn +/-1 35%"),
                "DE-OVR-004 overlay trigger summarizes popup result");
        assertCanvasPaintedAtScene(binding.mapView(), 2.5, 2.5,
                "DE-OVR-004 rendered canvas paints popup-selected overlay room coordinates");
        assertEquals(geometryRowsBefore, runtime.database().countAuthoredGeometryRows(mapId),
                "DE-OVR-004 leaves authored DB rows unchanged");
        firePopupMouseExited(popupContainer());
        assertTrue(!popupContainerVisible(), "DE-OVR-004 overlay popup can dismiss after editing");

        results.add("DE-OVR-004 Ready: DungeonEditorControlsView overlay popup -> SQLite unchanged -> NEARBY");
    }

}
