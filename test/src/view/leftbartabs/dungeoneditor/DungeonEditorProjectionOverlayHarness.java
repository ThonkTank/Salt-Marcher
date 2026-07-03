package src.view.leftbartabs.dungeoneditor;

import java.util.List;
import java.util.Set;
import src.domain.dungeon.published.DungeonEditorControlsSnapshot;
import src.domain.dungeon.published.DungeonEditorMapSurfaceSnapshot;
import src.domain.dungeon.published.DungeonEditorPreview;
import src.domain.dungeon.published.DungeonEditorViewMode;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel;
import src.view.slotcontent.main.dungeonmap.DungeonMapView;
import javafx.event.ActionEvent;
import javafx.scene.Parent;
import javafx.scene.control.ButtonBase;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.Slider;
import javafx.scene.control.Spinner;
import javafx.scene.control.TextArea;
import javafx.scene.control.TextField;
import javafx.scene.input.KeyCode;
import javafx.scene.input.MouseButton;
import javafx.scene.input.MouseEvent;
import javafx.scene.layout.HBox;
import static src.view.leftbartabs.dungeoneditor.DungeonEditorBehaviorHarnessSupport.*;

final class DungeonEditorProjectionOverlayHarness {

    private static final String OWNER = "DungeonEditorProjectionOverlayHarness";

    private DungeonEditorProjectionOverlayHarness() {
    }

    static void run(List<String> results) throws Exception {
        route(results, () -> verifyProjectionLevelButtonsThroughControlsView(results));
        route(results, () -> verifyProjectionLevelButtonsReachEmptyLevels(results));
        route(results, () -> verifyProjectionLevelShortcutsThroughMapView(results));
        route(results, () -> verifyViewModeControlsThroughControlsView(results));
        route(results, () -> verifyViewModeClearsActiveInteractionSession(results));
        route(results, () -> verifyViewModeClearsInlineLabelDraft(results));
        route(results, () -> verifyOverlayControlsThroughControlsView(results));
        route(results, () -> verifyOverlayPopupThroughControlsView(results));
        route(results, () -> verifyOverlayPreservesActivePreviewSurface(results));
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

        String mapName = "Visible Level Controls Map";
        long mapId = createMapThroughControls(controls, runtime, mapName);
        runtime.database().seedF6MultiLevelFloors(mapId);
        createMapThroughControls(controls, runtime, "Visible Level Controls Reload Hop");
        selectMap(controls, mapName);
        long geometryRowsBefore = runtime.database().countAuthoredGeometryRows(mapId);
        DungeonMapStateProbe.Snapshot beforeProjectionSnapshot =
                DungeonMapStateProbe.snapshot(binding.mapContentModel());

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
        assertProjectionRenderStateChanged(
                beforeProjectionSnapshot,
                DungeonMapStateProbe.snapshot(binding.mapContentModel()),
                "DE-LVL-001 projection-level change updates render and hit signatures");
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

    private static void assertProjectionRenderStateChanged(
            DungeonMapStateProbe.Snapshot before,
            DungeonMapStateProbe.Snapshot after,
            String message
    ) {
        assertTrue(after.projectionLevel() > before.projectionLevel(), message + " projectionLevel");
        assertTrue(!after.renderGeometrySignature().equals(before.renderGeometrySignature()),
                message + " renderGeometrySignature");
        assertTrue(!after.hitTargetSignature().equals(before.hitTargetSignature()),
                message + " hitTargetSignature");
    }

    private static void verifyProjectionLevelButtonsReachEmptyLevels(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();

        String mapName = "Empty Level Expansion Map";
        long mapId = createMapThroughControls(controls, runtime, mapName);
        runtime.database().seedF1SingleRoom(mapId, "R1", 0, 1, 1);
        createMapThroughControls(controls, runtime, "Empty Level Expansion Reload Hop");
        selectMap(controls, mapName);
        long geometryRowsBefore = runtime.database().countAuthoredGeometryRows(mapId);

        click(button(controls, "+"));

        DungeonEditorControlsSnapshot afterPlusControls = runtime.controlsModel().current();
        DungeonEditorMapSurfaceSnapshot afterPlusSurface = runtime.mapSurfaceModel().current();
        assertEquals(1L, afterPlusControls.projectionLevel(),
                "DE-LVL-005 controls projection level reaches empty positive level");
        assertEquals(1L, afterPlusSurface.projectionLevel(),
                "DE-LVL-005 map surface projection level reaches empty positive level");
        assertTrue(labelVisible(controls, "Ebene z=1"),
                "DE-LVL-005 visible level label updates to empty positive level");
        assertTrue(renderSurfaceCellOriginsWithZ(binding.mapContentModel()).isEmpty(),
                "DE-LVL-005 active empty z=1 renders no z=0 floor cells");
        assertEquals(geometryRowsBefore, runtime.database().countAuthoredGeometryRows(mapId),
                "DE-LVL-005 leaves authored DB rows unchanged");

        click(button(controls, "-"));
        click(button(controls, "-"));

        DungeonEditorControlsSnapshot afterMinusControls = runtime.controlsModel().current();
        DungeonEditorMapSurfaceSnapshot afterMinusSurface = runtime.mapSurfaceModel().current();
        assertEquals(-1L, afterMinusControls.projectionLevel(),
                "DE-LVL-006 controls projection level reaches empty negative level");
        assertEquals(-1L, afterMinusSurface.projectionLevel(),
                "DE-LVL-006 map surface projection level reaches empty negative level");
        assertTrue(labelVisible(controls, "Ebene z=-1"),
                "DE-LVL-006 visible level label updates to empty negative level");
        assertTrue(renderSurfaceCellOriginsWithZ(binding.mapContentModel()).isEmpty(),
                "DE-LVL-006 active empty z=-1 renders no z=0 floor cells");
        assertEquals(geometryRowsBefore, runtime.database().countAuthoredGeometryRows(mapId),
                "DE-LVL-006 leaves authored DB rows unchanged");

        click(button(controls, "Raum"));
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();
        double startX = viewport.sceneToScreenX(6.5);
        double startY = viewport.sceneToScreenY(6.5);
        double endX = viewport.sceneToScreenX(7.5);
        double endY = viewport.sceneToScreenY(7.5);
        fireMapMouse(binding.mapView(), MouseEvent.MOUSE_PRESSED, MouseButton.PRIMARY, startX, startY, false);
        fireMapMouse(binding.mapView(), MouseEvent.MOUSE_DRAGGED, MouseButton.PRIMARY, endX, endY, false);
        fireMapMouse(binding.mapView(), MouseEvent.MOUSE_RELEASED, MouseButton.PRIMARY, endX, endY, false);

        DungeonEditorMapSurfaceSnapshot afterPaintSurface = runtime.mapSurfaceModel().current();
        assertEquals(-1L, afterPaintSurface.projectionLevel(),
                "DE-LVL-007 room paint keeps the selected negative projection level");
        assertTrue(renderSurfaceCellOriginsWithZ(binding.mapContentModel()).containsAll(cellRect(6, 6, 7, 7, -1)),
                "DE-LVL-007 render shows newly authored negative-level room cells");
        assertTrue(runtime.database().authoredGeometryState(mapId).stream().anyMatch(row ->
                        row.startsWith("dungeon_room_cluster_floor_cells|") && row.contains("|level_z=-1")),
                "DE-LVL-007 SQLite floor cells persist at z=-1");
        assertTrue(runtime.database().countAuthoredGeometryRows(mapId) > geometryRowsBefore,
                "DE-LVL-007 writes authored geometry on the selected negative level");

        results.add("DE-LVL-005 Ready: DungeonEditorControlsView + button -> empty positive projection z=1");
        results.add("DE-LVL-006 Ready: DungeonEditorControlsView - button -> empty negative projection z=-1");
        results.add("DE-LVL-007 Ready: DungeonEditorControlsView - button + room paint -> SQLite level_z=-1");
    }


    private static void verifyProjectionLevelShortcutsThroughMapView(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();

        String mapName = "F6 Multi Level Floors";
        long mapId = createMapThroughControls(controls, runtime, mapName);
        runtime.database().seedF6MultiLevelFloors(mapId);
        createMapThroughControls(controls, runtime, "F6 Multi Level Floors Reload Hop");
        selectMap(controls, mapName);
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

        String mapName = "View Mode Controls Map";
        long mapId = createMapThroughControls(controls, runtime, mapName);
        runtime.database().seedF1SingleRoom(mapId, "R1", 0, 1, 1);
        createMapThroughControls(controls, runtime, "View Mode Controls Reload Hop");
        selectMap(controls, mapName);
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


    private static void verifyViewModeClearsActiveInteractionSession(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();

        long mapId = createMapThroughControls(controls, runtime, "View Mode Clears Draft Map");
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
        fireMapMouse(mapView, MouseEvent.MOUSE_DRAGGED, MouseButton.PRIMARY, dragEndX, dragEndY, false);

        assertTrue(runtime.mapSurfaceModel().current().preview() instanceof DungeonEditorPreview.RoomRectanglePreview,
                "DE-VIEW-003 starts from a live room preview before view-mode change");
        assertTrue(renderPreviewSurfaceCellOriginsWithZ(binding.mapContentModel()).containsAll(cellRect(1, 1, 3, 3, 0)),
                "DE-VIEW-003 preview render is visible before view-mode change");

        click(button(controls, "Graph"));

        DungeonEditorMapSurfaceSnapshot graphSurface = runtime.mapSurfaceModel().current();
        assertEquals(DungeonEditorViewMode.GRAPH, graphSurface.viewMode(), "DE-VIEW-003 map surface view mode");
        assertEquals(DungeonEditorPreview.none(), graphSurface.preview(),
                "DE-VIEW-003 view-mode change clears active room preview");
        assertTrue(renderPreviewSurfaceCellOriginsWithZ(binding.mapContentModel()).isEmpty(),
                "DE-VIEW-003 view-mode change clears preview render");
        assertEquals(0L, runtime.database().countAuthoredGeometryRows(mapId),
                "DE-VIEW-003 view-mode change writes no authored geometry");
        assertEquals(authoredStateBefore, runtime.database().authoredGeometryState(mapId),
                "DE-VIEW-003 view-mode change leaves authored DB state unchanged");

        fireMapMouse(mapView, MouseEvent.MOUSE_RELEASED, MouseButton.PRIMARY, dragEndX, dragEndY, false);

        DungeonEditorMapSurfaceSnapshot releasedSurface = runtime.mapSurfaceModel().current();
        assertEquals(DungeonEditorViewMode.GRAPH, releasedSurface.viewMode(),
                "DE-VIEW-003 stale release keeps graph view mode");
        assertEquals(DungeonEditorPreview.none(), releasedSurface.preview(),
                "DE-VIEW-003 stale release keeps preview cleared");
        assertTrue(renderPreviewSurfaceCellOriginsWithZ(binding.mapContentModel()).isEmpty(),
                "DE-VIEW-003 stale release keeps preview render cleared");
        assertEquals(0L, runtime.database().countAuthoredGeometryRows(mapId),
                "DE-VIEW-003 stale release writes no authored geometry");
        assertEquals(authoredStateBefore, runtime.database().authoredGeometryState(mapId),
                "DE-VIEW-003 stale release leaves authored DB state unchanged");

        results.add("DE-VIEW-003 Ready: active room draft + view-mode switch"
                + " -> interaction reset -> stale release writes nothing");
    }

    private static void verifyViewModeClearsInlineLabelDraft(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();

        String mapName = "View Mode Clears Inline Label Map";
        long mapId = createMapThroughControls(controls, runtime, mapName);
        runtime.database().seedF1SingleRoom(mapId, "R1", 0, 1, 1);
        createMapThroughControls(controls, runtime, "View Mode Clears Inline Label Reload Hop");
        selectMap(controls, mapName);
        click(button(controls, "Auswahl"));

        RoomClusterIds ids = runtime.database().roomByComponent(mapId, 2, 2, 0);
        LabelCenter clusterLabelCenter = labelCenter(
                binding.mapContentModel(),
                "Cluster " + ids.clusterId(),
                "DE-VIEW-004 cluster label");
        doubleClickRenderedLabel(binding, clusterLabelCenter);
        TextField inlineEditor = textField(binding.mapView(), "Dungeon map label editor");
        assertTrue(inlineEditor.isVisible(), "DE-VIEW-004 opens inline label editor before view-mode change");

        inlineEditor.selectRange(0, inlineEditor.getLength());
        typeInlineEditorTextSequentially(inlineEditor, "   View Mode Stale Draft   ");
        assertTrue(binding.mapContentModel().currentInlineLabelEditState().active(),
                "DE-VIEW-004 starts from active inline-label projection");
        assertEquals("   View Mode Stale Draft   ",
                binding.mapContentModel().currentInlineLabelEditState().text(),
                "DE-VIEW-004 projects inline-label draft before view-mode change");

        click(button(controls, "Graph"));

        assertTrue(!inlineEditor.isVisible(), "DE-VIEW-004 view-mode change hides inline label editor");
        assertTrue(!binding.mapContentModel().currentInlineLabelEditState().active(),
                "DE-VIEW-004 view-mode change clears runtime inline-label projection");
        assertEquals("", runtime.database().clusterName(ids.clusterId()),
                "DE-VIEW-004 view-mode change does not persist inline-label draft");

        fireControlsShortcut(inlineEditor, KeyCode.ENTER);

        assertEquals("", runtime.database().clusterName(ids.clusterId()),
                "DE-VIEW-004 stale inline-label Enter after view-mode change writes nothing");

        results.add("DE-VIEW-004 Ready: active inline label draft + view-mode switch"
                + " -> draft reset -> stale Enter writes nothing");
    }

    private static void doubleClickRenderedLabel(HarnessBinding binding, LabelCenter center) {
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();
        fireMapMouseClickCount(
                binding.mapView(),
                MouseEvent.MOUSE_PRESSED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(center.q()),
                viewport.sceneToScreenY(center.r()),
                2);
    }

    private static void typeInlineEditorTextSequentially(TextField inlineEditor, String text) {
        inlineEditor.requestFocus();
        for (int index = 0; index < text.length(); index++) {
            inlineEditor.replaceSelection(String.valueOf(text.charAt(index)));
        }
    }

    private static LabelCenter labelCenter(DungeonMapContentModel mapContentModel, String text, String message) {
        return mapContentModel.canvasStateProperty().get().renderScene().texts().stream()
                .filter(label -> text.equals(label.text()))
                .map(label -> new LabelCenter(label.centerX(), label.centerY()))
                .findFirst()
                .orElseThrow(() -> new AssertionError(message + " label not rendered: " + text));
    }

    private record LabelCenter(double q, double r) {
    }

    private static void verifyOverlayControlsThroughControlsView(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();

        String mapName = "Overlay Controls Map";
        long mapId = createMapThroughControls(controls, runtime, mapName);
        runtime.database().seedF6MultiLevelFloors(mapId);
        createMapThroughControls(controls, runtime, "Overlay Controls Reload Hop");
        selectMap(controls, mapName);
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

        String mapName = "Overlay Popup Map";
        long mapId = createMapThroughControls(controls, runtime, mapName);
        runtime.database().seedF6MultiLevelFloors(mapId);
        createMapThroughControls(controls, runtime, "Overlay Popup Reload Hop");
        selectMap(controls, mapName);
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

    private static void verifyOverlayPreservesActivePreviewSurface(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();

        long mapId = createMapThroughControls(controls, runtime, "Overlay Preserves Preview Map");
        long geometryRowsBefore = runtime.database().countAuthoredGeometryRows(mapId);
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
        fireMapMouse(mapView, MouseEvent.MOUSE_DRAGGED, MouseButton.PRIMARY, dragEndX, dragEndY, false);

        assertTrue(runtime.mapSurfaceModel().current().preview() instanceof DungeonEditorPreview.RoomRectanglePreview,
                "DE-OVR-005 starts from a live room preview before overlay change");
        assertTrue(renderPreviewSurfaceCellOriginsWithZ(binding.mapContentModel()).containsAll(cellRect(1, 1, 3, 3, 0)),
                "DE-OVR-005 preview render is visible before overlay change");

        ComboBox<?> overlayModeSelector = comboBoxWithDisplayedItem(controls, "Nahe Ebenen");
        selectComboItem(overlayModeSelector, "Nahe Ebenen");

        assertOverlaySettings(runtime.controlsModel().current().overlaySettings(), "NEARBY", 2, 0.35, List.of(),
                "DE-OVR-005 controls overlay settings");
        assertOverlaySettings(runtime.mapSurfaceModel().current().overlaySettings(), "NEARBY", 2, 0.35, List.of(),
                "DE-OVR-005 map surface overlay settings");
        assertTrue(runtime.mapSurfaceModel().current().preview() instanceof DungeonEditorPreview.RoomRectanglePreview,
                "DE-OVR-005 overlay change preserves active room preview");
        assertTrue(renderPreviewSurfaceCellOriginsWithZ(binding.mapContentModel()).containsAll(cellRect(1, 1, 3, 3, 0)),
                "DE-OVR-005 overlay change preserves preview render");
        assertEquals(geometryRowsBefore, runtime.database().countAuthoredGeometryRows(mapId),
                "DE-OVR-005 overlay change writes no authored geometry");

        fireMapMouse(mapView, MouseEvent.MOUSE_RELEASED, MouseButton.PRIMARY, dragEndX, dragEndY, false);

        assertTrue(runtime.database().countAuthoredGeometryRows(mapId) > geometryRowsBefore,
                "DE-OVR-005 stale release after overlay change still commits active room draft");

        results.add("DE-OVR-005 Ready: active room preview + overlay change"
                + " -> preview surface retained -> release commits draft");
    }

}
