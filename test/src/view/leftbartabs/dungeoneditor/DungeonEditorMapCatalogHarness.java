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

final class DungeonEditorMapCatalogHarness {

    private static final String OWNER = "DungeonEditorMapCatalogHarness";

    private DungeonEditorMapCatalogHarness() {
    }

    static void run(List<String> results) throws Exception {
        route(results, () -> verifyCreateMapThroughControlsView(results));
        route(results, () -> verifyRenameMapThroughControlsView(results));
        route(results, () -> verifyDeleteMapThroughControlsView(results));
        route(results, () -> verifyLoadMapThroughControlsView(results));
        route(results, () -> verifyReloadMapThroughControlsView(results));
        route(results, () -> verifyLargeStoredVertexStartupThroughMapView(results));
    }

    private static void route(
            List<String> results,
            DungeonEditorBehaviorHarnessSupport.ThrowingRunnable action
    ) throws Exception {
        DungeonEditorBehaviorHarnessSupport.runRouteProof(results, OWNER, action);
    }

    private static void verifyCreateMapThroughControlsView(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();

        click(button(controls, "Neu"));
        textField(controls, "Dungeon-Name").setText("Gamma");
        click(button(controls, "Erstellen"));

        long gammaRows = runtime.database().countMapsNamed("Gamma");
        assertEquals(1L, gammaRows, "DE-MAP-001 persisted one Gamma dungeon_maps row");
        DungeonEditorControlsSnapshot controlsSnapshot = runtime.controlsModel().current();
        assertTrue(
                controlsSnapshot.maps().stream().anyMatch(map -> "Gamma".equals(map.mapName())),
                "DE-MAP-001 published catalog contains Gamma");
        DungeonMapSummary selected = controlsSnapshot.maps().stream()
                .filter(map -> "Gamma".equals(map.mapName()))
                .findFirst()
                .orElseThrow();
        assertTrue(selected.mapId().value() > 0L, "DE-MAP-001 selected Gamma map has a stable id");
        assertEquals(selected.mapId(), controlsSnapshot.selectedMapId(), "DE-MAP-001 controls snapshot selects Gamma");
        assertEquals(0L, runtime.database().countAuthoredGeometryRows(selected.mapId().value()),
                "DE-MAP-001 created map starts without authored geometry rows");
        assertEmptyMapSurface(runtime.mapSurfaceModel().current(), "Gamma");
        assertVisiblePlaceholder(binding.mapView(), "DE-MAP-001");
        results.add("DE-MAP-001 Ready: DungeonEditorControlsView -> SQLite -> DungeonEditorControlsModel");
    }


    private static void verifyRenameMapThroughControlsView(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();

        long alphaMapId = createMapThroughControls(controls, runtime, "Alpha");
        runtime.database().seedF1SingleRoom(alphaMapId, "A1", 0, 1, 1);
        long betaMapId = createMapThroughControls(controls, runtime, "Beta");
        runtime.database().seedTwoByTwoRoom(betaMapId, "B1", 0, 10, 10);
        selectMap(controls, "Alpha");
        long geometryRowsBefore = runtime.database().countAuthoredGeometryRows(alphaMapId);

        click(menuItem(splitMenuButton(controls, "Neu"), "Dungeon bearbeiten"));
        TextField mapNameField = textField(controls, "Dungeon-Name");
        mapNameField.setText("Alpha Prime");
        click(button(controls, "Speichern"));

        assertEquals(1L, runtime.database().countMapIdWithName(alphaMapId, "Alpha Prime"),
                "DE-MAP-002 selected dungeon_maps row is renamed");
        assertEquals(0L, runtime.database().countMapIdWithName(alphaMapId, "Alpha"),
                "DE-MAP-002 old selected dungeon_maps name is gone");
        assertEquals(geometryRowsBefore, runtime.database().countAuthoredGeometryRows(alphaMapId),
                "DE-MAP-002 leaves authored geometry rows unchanged");
        DungeonEditorControlsSnapshot controlsSnapshot = runtime.controlsModel().current();
        assertEquals(alphaMapId, controlsSnapshot.selectedMapId().value(),
                "DE-MAP-002 selection remains on the renamed map id");
        assertTrue(
                controlsSnapshot.maps().stream().anyMatch(map ->
                        map.mapId().value() == alphaMapId && "Alpha Prime".equals(map.mapName())),
                "DE-MAP-002 published catalog contains renamed map");
        DungeonEditorMapSurfaceSnapshot surfaceSnapshot = runtime.mapSurfaceModel().current();
        assertEquals("Alpha Prime", surfaceSnapshot.surface().mapName(),
                "DE-MAP-002 map surface name reflects rename");
        assertTrue(surfaceContainsLevel(surfaceSnapshot, 0),
                "DE-MAP-002 render-facing map surface keeps authored level 0 cells");
        assertCanvasPaintedAtScene(binding.mapView(), 2.5, 2.5,
                "DE-MAP-002 rendered canvas keeps authored geometry at the room coordinates");

        results.add("DE-MAP-002 Ready: DungeonEditorControlsView rename dialog -> SQLite rename -> surface name");
    }


    private static void verifyDeleteMapThroughControlsView(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();

        long zetaMapId = createMapThroughControls(controls, runtime, "Zeta");
        runtime.database().seedTwoByTwoRoom(zetaMapId, "Z1", 0, 20, 20);
        long alphaMapId = createMapThroughControls(controls, runtime, "Alpha");
        runtime.database().seedF1SingleRoom(alphaMapId, "A1", 0, 1, 1);
        long betaMapId = createMapThroughControls(controls, runtime, "Beta");
        runtime.database().seedTwoByTwoRoom(betaMapId, "B1", 0, 10, 10);
        selectMap(controls, "Alpha");
        selectMap(controls, "Beta");
        long zetaGeometryRowsBefore = runtime.database().countAuthoredGeometryRows(zetaMapId);
        long alphaGeometryRowsBefore = runtime.database().countAuthoredGeometryRows(alphaMapId);
        long betaGeometryRowsBefore = runtime.database().countAuthoredGeometryRows(betaMapId);
        assertTrue(zetaMapId < alphaMapId, "DE-MAP-003 Zeta has a lower inserted map id than Alpha");
        assertTrue(betaGeometryRowsBefore > 0L, "DE-MAP-003 Beta fixture has authored rows before delete");
        assertTrue(renderSurfaceCellOrigins(binding.mapContentModel()).contains("10,10"),
                "DE-MAP-003 Beta renders before delete");

        click(menuItem(splitMenuButton(controls, "Neu"), "Dungeon löschen"));
        click(button(controls, "Löschen"));

        assertEquals(0L, runtime.database().countMapIdWithName(betaMapId, "Beta"),
                "DE-MAP-003 selected Beta dungeon_maps row is deleted");
        assertEquals(0L, runtime.database().countAuthoredGeometryRows(betaMapId),
                "DE-MAP-003 cascading authored rows for Beta are deleted");
        assertEquals(1L, runtime.database().countMapIdWithName(zetaMapId, "Zeta"),
                "DE-MAP-003 lower-id Zeta dungeon_maps row remains");
        assertEquals(zetaGeometryRowsBefore, runtime.database().countAuthoredGeometryRows(zetaMapId),
                "DE-MAP-003 lower-id Zeta authored rows remain unchanged");
        assertEquals(1L, runtime.database().countMapIdWithName(alphaMapId, "Alpha"),
                "DE-MAP-003 fallback Alpha dungeon_maps row remains");
        assertEquals(alphaGeometryRowsBefore, runtime.database().countAuthoredGeometryRows(alphaMapId),
                "DE-MAP-003 fallback Alpha authored rows remain unchanged");
        DungeonEditorControlsSnapshot controlsSnapshot = runtime.controlsModel().current();
        assertEquals(alphaMapId, controlsSnapshot.selectedMapId().value(),
                "DE-MAP-003 selected map falls back to name-ordered Alpha instead of lower-id Zeta");
        assertTrue(controlsSnapshot.maps().stream().noneMatch(map -> map.mapId().value() == betaMapId),
                "DE-MAP-003 published catalog omits deleted Beta");
        assertEquals("Dungeon-Map gelöscht.", controlsSnapshot.statusText(),
                "DE-MAP-003 published controls status reports deletion");
        DungeonEditorMapSurfaceSnapshot surfaceSnapshot = runtime.mapSurfaceModel().current();
        assertEquals("Alpha", surfaceSnapshot.surface().mapName(),
                "DE-MAP-003 map surface falls back to Alpha");
        assertEmptySelection(surfaceSnapshot.selection(), "DE-MAP-003 fallback surface");
        assertEquals(DungeonEditorPreview.none(), surfaceSnapshot.preview(),
                "DE-MAP-003 fallback surface clears preview");
        assertEquals(
                Set.of("1,1,0", "1,2,0", "1,3,0", "2,1,0", "2,2,0", "2,3,0", "3,1,0", "3,2,0", "3,3,0"),
                surfaceCellSet(surfaceSnapshot),
                "DE-MAP-003 fallback Alpha surface contains exactly A1 cells");
        assertTrue(renderSurfaceCellOrigins(binding.mapContentModel()).contains("1,1"),
                "DE-MAP-003 render scene shows fallback Alpha cells");
        assertTrue(!renderSurfaceCellOrigins(binding.mapContentModel()).contains("10,10"),
                "DE-MAP-003 render scene omits deleted Beta cells");
        assertTrue(!renderSurfaceCellOrigins(binding.mapContentModel()).contains("20,20"),
                "DE-MAP-003 render scene omits lower-id Zeta cells");
        assertCanvasPaintedAtScene(binding.mapView(), 2.5, 2.5,
                "DE-MAP-003 rendered canvas paints fallback Alpha room surface");

        results.add(
                "DE-MAP-003 Ready: DungeonEditorControlsView delete dialog -> SQLite cascade -> name-ordered Alpha fallback");
    }


    private static void verifyLoadMapThroughControlsView(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();

        long alphaMapId = createMapThroughControls(controls, runtime, "Alpha");
        runtime.database().seedF1SingleRoom(alphaMapId, "A1", 0, 1, 1);
        long betaMapId = createMapThroughControls(controls, runtime, "Beta");
        runtime.database().seedTwoByTwoRoom(betaMapId, "B1", 0, 10, 10);
        long alphaGeometryRowsBefore = runtime.database().countAuthoredGeometryRows(alphaMapId);
        long betaGeometryRowsBefore = runtime.database().countAuthoredGeometryRows(betaMapId);

        selectMap(controls, "Alpha");
        selectMap(controls, "Beta");

        DungeonEditorControlsSnapshot controlsSnapshot = runtime.controlsModel().current();
        assertEquals(betaMapId, controlsSnapshot.selectedMapId().value(), "DE-MAP-004 controls selects Beta");
        DungeonEditorMapSurfaceSnapshot surfaceSnapshot = runtime.mapSurfaceModel().current();
        assertEquals("Beta", surfaceSnapshot.surface().mapName(), "DE-MAP-004 map surface name");
        assertEquals(
                Set.of("10,10,0", "10,11,0", "11,10,0", "11,11,0"),
                surfaceCellSet(surfaceSnapshot),
                "DE-MAP-004 Beta surface contains exactly B1 cells");
        assertEquals(1L, surfaceSnapshot.surface().map().areas().size(), "DE-MAP-004 Beta has one room area");
        assertEquals(0L, surfaceSnapshot.surface().map().features().size(), "DE-MAP-004 Beta has no doors or corridors");
        assertTrue(surfaceSnapshot.surface().map().boundaries().stream().noneMatch(boundary ->
                        "door".equalsIgnoreCase(boundary.kind())),
                "DE-MAP-004 Beta has no door boundaries");
        assertTrue(surfaceSnapshot.surface().map().boundaries().size() > 0,
                "DE-MAP-004 Beta surface includes authored wall boundaries");
        assertEquals(
                Set.of("10,10", "10,11", "11,10", "11,11"),
                renderSurfaceCellOrigins(binding.mapContentModel()),
                "DE-MAP-004 render scene shows only Beta B1 cells");
        assertTrue(!renderSurfaceCellOrigins(binding.mapContentModel()).contains("1,1"),
                "DE-MAP-004 render scene does not show Alpha cells");
        assertCanvasHasPaintedContent(binding.mapView(),
                "DE-MAP-004 rendered canvas paints the loaded Beta room surface");
        assertEquals(alphaGeometryRowsBefore, runtime.database().countAuthoredGeometryRows(alphaMapId),
                "DE-MAP-004 leaves Alpha authored DB rows unchanged");
        assertEquals(betaGeometryRowsBefore, runtime.database().countAuthoredGeometryRows(betaMapId),
                "DE-MAP-004 leaves Beta authored DB rows unchanged");

        results.add("DE-MAP-004 Ready: DungeonEditorControlsView map selector -> SQLite unchanged -> Beta surface");
    }


    private static void verifyReloadMapThroughControlsView(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();
        DungeonMapContentModel mapContentModel = binding.mapContentModel();

        long mapId = createMapThroughControls(controls, runtime, "Reload Map");
        runtime.database().seedF1SingleRoom(mapId, "R1", 0, 1, 1);
        createMapThroughControls(controls, runtime, "Reload Hop");
        selectMap(controls, "Reload Map");
        List<String> authoredStateBefore = runtime.database().authoredGeometryState(mapId);
        assertEquals(
                Set.of("1,1,0", "1,2,0", "1,3,0", "2,1,0", "2,2,0", "2,3,0", "3,1,0", "3,2,0", "3,3,0"),
                surfaceCellSet(runtime.mapSurfaceModel().current()),
                "DE-MAP-005 initial selected surface shows R1 cells");

        click(button(controls, "Raum"));
        DungeonMapContentModel.Viewport viewport = mapContentModel.currentViewport();
        Set<String> previewCells = cellRect(5, 5, 6, 6, 0);
        double previewEndX = viewport.sceneToScreenX(6.5);
        double previewEndY = viewport.sceneToScreenY(6.5);
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
                previewEndX,
                previewEndY,
                false);

        assertEquals(authoredStateBefore, runtime.database().authoredGeometryState(mapId),
                "DE-MAP-005 live preview does not mutate authored DB rows before reload");
        assertTrue(runtime.mapSurfaceModel().current().preview() instanceof DungeonEditorPreview.RoomRectanglePreview,
                "DE-MAP-005 starts reload from a real non-empty room preview");
        assertTrue(renderSurfaceCellOriginsWithZ(mapContentModel).containsAll(previewCells),
                "DE-MAP-005 render scene shows transient preview cells before reload");

        runtime.database().seedTwoByTwoRoom(mapId, "R2", 0, 10, 10);
        List<String> authoredStateAfterExternalChange = runtime.database().authoredGeometryState(mapId);
        assertTrue(!authoredStateBefore.equals(authoredStateAfterExternalChange),
                "DE-MAP-005 fixture external persisted change updates DB oracle");
        assertTrue(!surfaceCellSet(runtime.mapSurfaceModel().current()).contains("10,10,0"),
                "DE-MAP-005 external persisted change is not visible before reload");
        assertTrue(!renderSurfaceCellOrigins(binding.mapContentModel()).contains("10,10"),
                "DE-MAP-005 render scene is not refreshed before reload");

        click(menuItem(splitMenuButton(controls, "Neu"), "Dungeon neu laden"));

        assertEquals(authoredStateAfterExternalChange, runtime.database().authoredGeometryState(mapId),
                "DE-MAP-005 reload does not add authored DB rows beyond the external persisted change");
        DungeonEditorControlsSnapshot controlsSnapshot = runtime.controlsModel().current();
        assertEquals(mapId, controlsSnapshot.selectedMapId().value(),
                "DE-MAP-005 controls keep the reloaded map selected");
        DungeonEditorMapSurfaceSnapshot reloadedSurface = runtime.mapSurfaceModel().current();
        assertEquals("Reload Map", reloadedSurface.surface().mapName(),
                "DE-MAP-005 reloaded surface keeps the selected map name");
        assertEquals(DungeonEditorPreview.none(), reloadedSurface.preview(),
                "DE-MAP-005 reload clears transient preview state");
        assertTrue(surfaceCellSet(reloadedSurface).contains("10,10,0"),
                "DE-MAP-005 reloaded surface reads externally persisted R2 cells");
        assertTrue(!renderSurfaceCellOriginsWithZ(mapContentModel).contains("5,5,0"),
                "DE-MAP-005 render scene drops stale preview cells after reload");
        assertTrue(renderSurfaceCellOrigins(binding.mapContentModel()).contains("10,10"),
                "DE-MAP-005 render scene reflects externally persisted R2 cells after reload");
        assertCanvasHasPaintedContent(binding.mapView(),
                "DE-MAP-005 rendered canvas paints the reloaded persisted surface");

        fireMapMouse(mapView, MouseEvent.MOUSE_RELEASED, MouseButton.PRIMARY, previewEndX, previewEndY, false);
        assertEquals(authoredStateAfterExternalChange, runtime.database().authoredGeometryState(mapId),
                "DE-MAP-005 post-reload release does not commit the stale preview");
        assertEquals(DungeonEditorPreview.none(), runtime.mapSurfaceModel().current().preview(),
                "DE-MAP-005 post-reload release keeps preview cleared");
        assertTrue(!renderSurfaceCellOriginsWithZ(mapContentModel).contains("5,5,0"),
                "DE-MAP-005 post-reload release keeps stale preview render cleared");

        results.add("DE-MAP-005 Ready: DungeonEditorControlsView reload menu -> SQLite readback -> refreshed render");
    }


    private static void verifyLargeStoredVertexStartupThroughMapView(List<String> results) {
        DatabaseAssertions database = new DatabaseAssertions();
        database.clearDungeonData();
        long mapId = database.createPersistedMap("Large Stored Vertex Startup Map");
        database.seedLargePerCellLoopRoom(
                mapId,
                LARGE_VERTEX_FIXTURE_WIDTH,
                LARGE_VERTEX_FIXTURE_HEIGHT);
        long startupStarted = System.nanoTime();
        ApplicationHarnessBinding application = bindDiscoveredApplicationHarness(1_150.0, 700.0);
        long startupMillis = elapsedMillis(startupStarted);
        HarnessBinding binding = application.binding();
        DungeonEditorControlsModel controlsModel = application.controlsModel();
        DungeonEditorMapSurfaceModel mapSurfaceModel = application.mapSurfaceModel();
        DungeonMapView mapView = binding.mapView();
        DungeonEditorControlsView controls = binding.controls();
        DungeonEditorControlsSnapshot controlsSnapshot = controlsModel.current();

        long persistedVertexRows = database.countClusterVertexRows(mapId);

        assertTrue(startupMillis <= LARGE_VERTEX_STARTUP_MAX_MILLIS,
                "DE-START-001 installed-shell startup latency millis=" + startupMillis);
        assertEquals(null, controlsSnapshot.selectedMapId(),
                "DE-START-001 discovered app shell does not auto-load the large persisted map");
        assertTrue(
                controlsSnapshot.maps().stream().anyMatch(map ->
                        map.mapId().value() == mapId
                                && "Large Stored Vertex Startup Map".equals(map.mapName())),
                "DE-START-001 discovered app shell publishes the seeded map in the catalog");
        assertEquals(
                (long) LARGE_VERTEX_FIXTURE_WIDTH * LARGE_VERTEX_FIXTURE_HEIGHT * 5L,
                persistedVertexRows,
                "DE-START-001 fixture stores the expected per-cell vertex loop rows");
        assertTrue(persistedVertexRows >= LARGE_VERTEX_FIXTURE_MIN_ROWS,
                "DE-START-001 fixture covers the reported 56k-scale persisted vertex class");
        assertEquals(null, mapSurfaceModel.current().surface(),
                "DE-START-001 startup surface remains unloaded until explicit map selection");
        assertVisiblePlaceholder(mapView,
                "DE-START-001 real JavaFX canvas renders a responsive unloaded-map placeholder");

        click(button(controls, "Raum"));
        long inputStarted = System.nanoTime();
        fireMapShortcut(mapView, KeyCode.ESCAPE);
        long inputMillis = elapsedMillis(inputStarted);
        assertTrue(inputMillis <= LARGE_VERTEX_INPUT_MAX_MILLIS,
                "DE-START-001 post-load map key input latency millis=" + inputMillis);
        assertEquals("SELECT", controlsModel.current().selectedTool().name(),
                "DE-START-001 map key input remains responsive after installed-shell startup");
        assertEquals("SELECT", mapSurfaceModel.current().selectedTool().name(),
                "DE-START-001 published surface returns to selection after real View Esc route");
        assertEquals(1L, database.countMapsNamed("Large Stored Vertex Startup Map"),
                "DE-START-001 persisted map survives the startup/input smoke route");

        results.add("DE-START-001 Ready: 56k persisted per-cell vertices -> AppBootstrap discovered shell catalog startup -> "
                + "bounded render/input latency startupMillis=" + startupMillis + " inputMillis=" + inputMillis);
    }

}
