package src.view.leftbartabs.dungeoneditor;

import java.lang.reflect.Field;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import javafx.application.Platform;
import javafx.event.ActionEvent;
import javafx.geometry.Bounds;
import javafx.geometry.Point2D;
import javafx.scene.Scene;
import javafx.scene.Node;
import javafx.scene.Parent;
import javafx.scene.canvas.Canvas;
import javafx.scene.control.Button;
import javafx.scene.control.ButtonBase;
import javafx.scene.control.CheckBox;
import javafx.scene.control.ComboBox;
import javafx.scene.control.Label;
import javafx.scene.control.MenuItem;
import javafx.scene.control.Slider;
import javafx.scene.control.Spinner;
import javafx.scene.control.SplitMenuButton;
import javafx.scene.control.TextArea;
import javafx.scene.control.TextField;
import javafx.scene.control.ToggleButton;
import javafx.scene.image.WritableImage;
import javafx.scene.input.KeyCode;
import javafx.scene.input.KeyEvent;
import javafx.scene.input.MouseButton;
import javafx.scene.input.MouseEvent;
import javafx.scene.input.ScrollEvent;
import javafx.scene.layout.HBox;
import javafx.scene.layout.Pane;
import javafx.scene.paint.Color;
import javafx.stage.Stage;
import javafx.stage.Window;
import bootstrap.AppBootstrap;
import shell.api.ShellLeftBarTabSpec;
import shell.api.InspectorEntrySpec;
import shell.api.InspectorSink;
import shell.api.ServiceRegistry;
import shell.api.ShellBinding;
import shell.api.ShellRuntimeContext;
import shell.api.ShellSlot;
import shell.host.AppShell;
import src.data.dungeon.model.DungeonPersistenceSchema;
import src.data.dungeon.repository.SqliteDungeonMapRepository;
import src.domain.dungeon.DungeonServiceContribution;
import src.domain.dungeon.model.worldspace.model.DungeonBoundaryKey;
import src.domain.dungeon.model.worldspace.model.DungeonCell;
import src.domain.dungeon.model.worldspace.model.DungeonEdge;
import src.domain.dungeon.model.worldspace.model.DungeonEdgeDirection;
import src.domain.dungeon.model.worldspace.model.DungeonMap;
import src.domain.dungeon.model.worldspace.model.DungeonMapIdentity;
import src.domain.dungeon.model.worldspace.model.DungeonRoomCellProjection;
import src.domain.dungeon.model.worldspace.model.DungeonRoomCluster;
import src.domain.dungeon.model.worldspace.model.session.model.TravelDungeonActiveState;
import src.domain.dungeon.model.worldspace.model.session.model.TravelDungeonSessionMovement;
import src.domain.dungeon.model.worldspace.model.session.model.TravelDungeonSessionSurface;
import src.domain.dungeon.model.worldspace.model.session.model.TravelDungeonSessionValues;
import src.domain.dungeon.model.worldspace.repository.DungeonMapRepository;
import src.domain.dungeon.model.worldspace.repository.TravelDungeonSessionRepository;
import src.domain.dungeon.published.DungeonEditorControlsModel;
import src.domain.dungeon.published.DungeonEditorControlsSnapshot;
import src.domain.dungeon.published.DungeonEditorMapSurfaceModel;
import src.domain.dungeon.published.DungeonEditorMapSurfaceSnapshot;
import src.domain.dungeon.published.DungeonEditorPreview;
import src.domain.dungeon.published.DungeonEditorStateModel;
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

public final class DungeonEditorToolBehaviorHarness {

    private static final int AWAIT_SECONDS = 60;
    private static final double DEFAULT_GRID_SIZE = 32.0;
    private static final int LARGE_VERTEX_FIXTURE_WIDTH = 104;
    private static final int LARGE_VERTEX_FIXTURE_HEIGHT = 108;
    private static final long LARGE_VERTEX_FIXTURE_MIN_ROWS = 56_000L;
    private static final long LARGE_VERTEX_STARTUP_MAX_MILLIS = 3_500L;
    private static final long LARGE_VERTEX_INPUT_MAX_MILLIS = 500L;
    private static final Color MAP_BACKGROUND = Color.rgb(0x12, 0x18, 0x1c);
    private static final AtomicBoolean FX_STARTED = new AtomicBoolean();

    private DungeonEditorToolBehaviorHarness() {
    }

    public static void main(String[] args) throws Exception {
        try {
            List<String> results = new ArrayList<>();
            runOnFxThread(() -> verifyCreateMapThroughControlsView(results));
            runOnFxThread(() -> verifyRenameMapThroughControlsView(results));
            runOnFxThread(() -> verifyDeleteMapThroughControlsView(results));
            runOnFxThread(() -> verifyLoadMapThroughControlsView(results));
            runOnFxThread(() -> verifyReloadMapThroughControlsView(results));
            runOnFxThread(() -> verifyLargeStoredVertexStartupThroughMapView(results));
            runOnFxThread(() -> verifyCameraPanThroughMapView(results));
            runOnFxThread(() -> verifyCameraZoomThroughMapView(results));
            runOnFxThread(() -> verifyProjectionLevelButtonsThroughControlsView(results));
            runOnFxThread(() -> verifyProjectionLevelShortcutsThroughMapView(results));
            runOnFxThread(() -> verifyViewModeControlsThroughControlsView(results));
            runOnFxThread(() -> verifyOverlayControlsThroughControlsView(results));
            runOnFxThread(() -> verifyOverlayPopupThroughControlsView(results));
            runOnFxThread(() -> verifySelectionThroughMapView(results));
            runOnFxThread(() -> verifyDoorSelectionThroughMapView(results));
            runOnFxThread(() -> verifyStairSelectionThroughMapView(results));
            runOnFxThread(() -> verifyStraightStairCreateThroughMapView(results));
            runOnFxThread(() -> verifyStairAnchorMoveThroughMapView(results));
            runOnFxThread(() -> verifyStraightStairGeometryEditThroughStateView(results));
            runOnFxThread(() -> verifyInvalidStairRoomInteriorRecomputeThroughStateView(results));
            runOnFxThread(() -> verifyStairDeleteThroughMapView(results));
            runOnFxThread(() -> verifyCorridorSelectionThroughMapView(results));
            runOnFxThread(() -> verifyCorridorAnchorMoveThroughMapView(results));
            runOnFxThread(() -> verifyCorridorPointEditThroughStateView(results));
            runOnFxThread(() -> verifyTransitionCreateThroughMapView(results));
            runOnFxThread(() -> verifyTransitionDescriptionThroughStateView(results));
            runOnFxThread(() -> verifyBidirectionalTransitionLinkThroughStateView(results));
            runOnFxThread(() -> verifyTransitionDeleteThroughMapView(results));
            runOnFxThread(() -> verifyDoorToDoorCorridorCreateThroughMapView(results));
            runOnFxThread(() -> verifyDoorToAnchorCorridorCreateThroughMapView(results));
            runOnFxThread(() -> verifyAnchorToAnchorCorridorCreateThroughMapView(results));
            runOnFxThread(() -> verifyCorridorSplitAtCrossingThroughMapView(results));
            runOnFxThread(() -> verifyCorridorConnectionPointDeleteThroughMapView(results));
            runOnFxThread(() -> verifyCorridorDoorConnectionDeleteThroughMapView(results));
            runOnFxThread(() -> verifyCrossLevelCorridorCreatesStairThroughMapView(results));
            runOnFxThread(() -> verifyGenericCorridorHitCreatesAnchorEndpointThroughMapView(results));
            runOnFxThread(() -> verifyGenericCorridorHitMaterializesAbsentAnchorEndpointThroughMapView(results));
            runOnFxThread(() -> verifyInvalidCorridorRouteRejectedThroughMapView(results));
            runOnFxThread(() -> verifyGenericRoomHitMaterializesFacingDoorThroughMapView(results));
            runOnFxThread(() -> verifySelectedStraightWallStretchThroughMapView(results));
            runOnFxThread(() -> verifySelectedWallCornerMoveThroughMapView(results));
            runOnFxThread(() -> verifyWholeClusterMoveThroughMapView(results));
            runOnFxThread(() -> verifyRoomNarrationThroughStateView(results));
            runOnFxThread(() -> verifyDoorCreateThroughMapView(results));
            runOnFxThread(() -> verifyDoorDeleteThroughMapView(results));
            runOnFxThread(() -> verifyRoomPreviewThroughMapView(results));
            runOnFxThread(() -> verifyIsolatedRoomPaintThroughMapView(results));
            runOnFxThread(() -> verifyOverlappingRoomPaintThroughMapView(results));
            runOnFxThread(() -> verifyAdjacentRoomPaintThroughMapView(results));
            runOnFxThread(() -> verifyRoomDeleteThroughMapView(results));
            runOnFxThread(() -> verifyWallStartDraftThroughMapView(results));
            runOnFxThread(() -> verifyWallPreviewMoveThroughMapView(results));
            runOnFxThread(() -> verifyWallFinalizeThroughMapView(results));
            runOnFxThread(() -> verifyWallAlternateFinalizeThroughMapView(results));
            runOnFxThread(() -> verifyWallDeletePathThroughMapView(results));
            runOnFxThread(() -> verifyWallDeleteSegmentThroughMapView(results));
            runOnFxThread(() -> verifyWallDeleteCornerThroughMapView(results));
            runOnFxThread(() -> verifyCancelDraftThroughMapView(results));
            runOnFxThread(() -> verifyToolFamilyRowThroughControlsView(results));
            runOnFxThread(() -> verifySecondaryToolDropdownThroughControlsView(results));
            runOnFxThread(() -> verifyEscapeResetsToolThroughMapView(results));
            writeResults(results);
            System.out.println("Dungeon Editor behavior harness passed: " + results.size() + " proof item(s).");
            for (String result : results) {
                System.out.println(result);
            }
            shutdownFx();
            System.exit(0);
        } catch (Throwable throwable) {
            throwable.printStackTrace(System.err);
            System.exit(1);
        }
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

    private static void verifySelectionThroughMapView(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();

        long mapId = createMapThroughControls(controls, runtime, "Selection Map");
        runtime.database().seedF1SingleRoom(mapId, "R1", 0, 1, 1);
        long geometryRowsBefore = runtime.database().countAuthoredGeometryRows(mapId);
        createMapThroughControls(controls, runtime, "Selection Reload Hop");
        selectMap(controls, "Selection Map");
        List<String> authoredStateBefore = runtime.database().authoredGeometryState(mapId);
        click(button(controls, "Auswahl"));
        DungeonEditorMapSurfaceSnapshot loadedSurface = runtime.mapSurfaceModel().current();
        var roomArea = loadedSurface.surface().map().areas().stream()
                .filter(area -> "R1".equals(area.label()))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("F1_SINGLE_ROOM R1 area not loaded."));
        DungeonEditorTopologyElementRef roomRef = roomArea.topologyRef();
        long roomClusterId = roomArea.clusterId();

        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();
        fireMapMousePressed(
                mapView,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(2.5),
                viewport.sceneToScreenY(2.5),
                false);

        DungeonEditorStateSnapshot selectedState = runtime.stateModel().current();
        DungeonEditorMapSurfaceSnapshot selectedSurface = runtime.mapSurfaceModel().current();
        assertSelectionMatches(roomRef, roomClusterId, selectedState.selection(), "DE-SEL-001 state model");
        assertSelectionMatches(roomRef, roomClusterId, selectedSurface.selection(), "DE-SEL-001 map surface");
        assertTrue(selectedState.inspector() != null, "DE-SEL-001 inspector is published for the selected room");
        assertTrue(
                selectedState.inspector().title().contains("R1") || selectedState.inspector().facts().stream()
                        .anyMatch(fact -> fact.contains("R1") || fact.contains(String.valueOf(roomRef.id()))),
                "DE-SEL-001 inspector identifies the selected room");
        assertTrue(renderHasSelectedSurfacePrimitive(binding.mapContentModel(), roomRef),
                "DE-SEL-001 render scene highlights the selected room surface");
        assertCanvasPaintedAtScene(mapView, 2.5, 2.5,
                "DE-SEL-001 rendered canvas paints the selected room coordinates");
        assertEquals(geometryRowsBefore, runtime.database().countAuthoredGeometryRows(mapId),
                "DE-SEL-001 leaves authored DB rows unchanged");
        assertEquals(authoredStateBefore, runtime.database().authoredGeometryState(mapId),
                "DE-SEL-001 leaves authored DB state unchanged");
        results.add("DE-SEL-001 Ready: DungeonMapView primary click -> SQLite unchanged -> room selection");

        fireMapMousePressed(
                mapView,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(8.5),
                viewport.sceneToScreenY(8.5),
                false);

        DungeonEditorStateSnapshot clearedState = runtime.stateModel().current();
        DungeonEditorMapSurfaceSnapshot clearedSurface = runtime.mapSurfaceModel().current();
        assertEmptySelection(clearedState.selection(), "DE-SEL-005 state model");
        assertEmptySelection(clearedSurface.selection(), "DE-SEL-005 map surface");
        assertTrue(clearedState.inspector() == null, "DE-SEL-005 inspector clears after empty-grid click");
        assertTrue(!renderHasSelectedSurfacePrimitive(binding.mapContentModel(), roomRef),
                "DE-SEL-005 render scene removes the room highlight");
        assertTrue(!surfaceCellSet(clearedSurface).contains("8,8,0"),
                "DE-SEL-005 clicked empty grid coordinate remains empty");
        assertEquals(geometryRowsBefore, runtime.database().countAuthoredGeometryRows(mapId),
                "DE-SEL-005 leaves authored DB rows unchanged");
        assertEquals(authoredStateBefore, runtime.database().authoredGeometryState(mapId),
                "DE-SEL-005 leaves authored DB state unchanged");
        results.add("DE-SEL-005 Ready: DungeonMapView empty primary click -> SQLite unchanged -> selection cleared");
    }

    private static void verifyDoorSelectionThroughMapView(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();

        long mapId = createMapThroughControls(controls, runtime, "Door Selection Map");
        runtime.database().seedF4WalledRoomWithDoor(mapId);
        long geometryRowsBefore = runtime.database().countAuthoredGeometryRows(mapId);
        createMapThroughControls(controls, runtime, "Door Selection Reload Hop");
        selectMap(controls, "Door Selection Map");
        List<String> authoredStateBefore = runtime.database().authoredGeometryState(mapId);
        click(button(controls, "Auswahl"));
        assertEquals(1L, runtime.database().countDoorBoundariesAt(mapId, 1, 0, "EAST"),
                "DE-SEL-002 fixture contains one east door boundary");
        var doorBoundary = runtime.mapSurfaceModel().current().surface().map().boundaries().stream()
                .filter(boundary -> "door".equalsIgnoreCase(boundary.kind()))
                .filter(boundary -> boundary.edge().from().q() == 4 && boundary.edge().from().r() == 2)
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("DE-SEL-002 door boundary not loaded."));
        Point2D doorMidpoint = boundaryMidpointNear(binding.mapContentModel(), "DOOR", 4.0, 2.5);
        assertEquals("BOUNDARY", binding.mapContentModel()
                        .resolvePointerTarget(doorMidpoint.getX(), doorMidpoint.getY())
                        .targetKind()
                        .name(),
                "DE-SEL-002 render hit index resolves the door midpoint as a boundary");
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();

        fireMapMousePressed(
                mapView,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(doorMidpoint.getX()),
                viewport.sceneToScreenY(doorMidpoint.getY()),
                false);

        DungeonEditorStateSnapshot selectedState = runtime.stateModel().current();
        DungeonEditorMapSurfaceSnapshot selectedSurface = runtime.mapSurfaceModel().current();
        assertEquals(doorBoundary.topologyRef(), selectedState.selection().topologyRef(),
                "DE-SEL-002 state model selected door topology ref");
        assertEquals(doorBoundary.topologyRef(), selectedSurface.selection().topologyRef(),
                "DE-SEL-002 map surface selected door topology ref");
        assertDoorInspector(selectedState.inspector(), doorBoundary.topologyRef(), doorBoundary.label());
        assertDoorOwningRoomFacts(selectedSurface, doorBoundary);
        assertTrue(renderHasBoundaryPrimitive(binding.mapContentModel(), doorBoundary.topologyRef()),
                "DE-SEL-002 render scene contains the selected door boundary primitive");
        assertTrue(renderHasSelectedDoorBoundaryPrimitive(binding.mapContentModel(), doorBoundary.topologyRef()),
                "DE-SEL-002 render scene styles the selected door boundary distinctly");
        assertTrue(selectedDoorBoundaryDiffersFromNormalDoorStyle(binding.mapContentModel(), doorBoundary.topologyRef()),
                "DE-SEL-002 selected door boundary differs from normal door styling");
        assertCanvasPaintedAtScene(mapView, doorMidpoint.getX(), doorMidpoint.getY(),
                "DE-SEL-002 rendered canvas paints the selected door edge");
        assertEquals(geometryRowsBefore, runtime.database().countAuthoredGeometryRows(mapId),
                "DE-SEL-002 leaves authored DB row count unchanged");
        assertEquals(authoredStateBefore, runtime.database().authoredGeometryState(mapId),
                "DE-SEL-002 leaves authored DB state unchanged");

        results.add("DE-SEL-002 Ready: DungeonMapView door click -> SQLite unchanged -> door selection");
    }

    private static void verifyStairSelectionThroughMapView(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();

        long mapId = createMapThroughControls(controls, runtime, "Stair Selection Map");
        createMapThroughControls(controls, runtime, "Stair Selection Reload Hop");
        runtime.database().seedF7StairAnchor(mapId);
        selectMap(controls, "Stair Selection Map");
        long geometryRowsBefore = runtime.database().countAuthoredGeometryRows(mapId);
        List<String> authoredStateBefore = runtime.database().authoredGeometryState(mapId);
        click(button(controls, "Auswahl"));

        var stairFeature = runtime.mapSurfaceModel().current().surface().map().features().stream()
                .filter(feature -> "STAIR".equals(feature.kind()))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("F7_STAIR_ANCHOR stair feature not loaded."));
        var stairHandle = runtime.mapSurfaceModel().current().surface().map().editorHandles().stream()
                .filter(handle -> "STAIR_ANCHOR".equals(handle.ref().kind().name()))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("F7_STAIR_ANCHOR stair handle not loaded."));
        DungeonEditorTopologyElementRef stairRef = stairFeature.topologyRef();
        assertEquals(stairRef, editorTopologyRef(stairHandle.ref().topologyRef()),
                "DE-SEL-003 stair feature and handle share topology ref");
        assertTrue(runtime.mapSurfaceModel().current().surface().map().features().stream()
                        .anyMatch(feature -> feature.cells().stream()
                                .anyMatch(cell -> cell.q() == 2 && cell.r() == 2 && cell.level() == 0)),
                "DE-SEL-003 published stair feature includes anchor coordinate");
        assertTrue(stairFeature.cells().stream()
                        .anyMatch(cell -> cell.q() == 2 && cell.r() == 0 && cell.level() == 1),
                "DE-SEL-003 published stair feature includes upper exit coordinate");
        assertEquals("HANDLE", binding.mapContentModel()
                        .resolvePointerTarget(
                                glyphCenterForRef(binding.mapContentModel(), stairRef).getX(),
                                glyphCenterForRef(binding.mapContentModel(), stairRef).getY())
                        .targetKind()
                        .name(),
                "DE-SEL-003 render hit index resolves the stair marker as a handle");

        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();
        Point2D stairCenter = glyphCenterForRef(binding.mapContentModel(), stairRef);
        fireMapMousePressed(
                mapView,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(stairCenter.getX()),
                viewport.sceneToScreenY(stairCenter.getY()),
                false);

        DungeonEditorStateSnapshot selectedState = runtime.stateModel().current();
        DungeonEditorMapSurfaceSnapshot selectedSurface = runtime.mapSurfaceModel().current();
        assertEquals(stairRef, selectedState.selection().topologyRef(),
                "DE-SEL-003 state model selected stair topology ref");
        assertEquals(stairRef, selectedSurface.selection().topologyRef(),
                "DE-SEL-003 map surface selected stair topology ref");
        assertTrue(selectedState.selection().handleRef() != null,
                "DE-SEL-003 state model selected stair handle ref is present");
        assertEquals(stairHandle.ref().kind(), selectedState.selection().handleRef().kind(),
                "DE-SEL-003 state model selected stair handle kind");
        assertEquals(stairHandle.ref().topologyRef(), selectedState.selection().handleRef().topologyRef(),
                "DE-SEL-003 state model selected stair handle topology ref");
        assertTrue(selectedState.inspector() != null, "DE-SEL-003 inspector is published for selected stair");
        assertTrue(selectedState.inspector().title().contains("S1")
                        || selectedState.inspector().facts().stream()
                        .anyMatch(fact -> fact.contains("STAIR") || fact.contains(String.valueOf(stairRef.id()))),
                "DE-SEL-003 inspector identifies selected stair");
        assertTrue(renderHasSelectedGlyphPrimitive(binding.mapContentModel(), stairRef),
                "DE-SEL-003 render scene highlights the selected stair marker");
        assertTrue(renderHasSelectedSurfacePrimitive(binding.mapContentModel(), stairRef),
                "DE-SEL-003 render scene highlights the selected active-level stair path cell");
        assertCanvasPaintedAtScene(mapView, stairCenter.getX(), stairCenter.getY(),
                "DE-SEL-003 rendered canvas paints the selected stair marker");
        assertEquals(geometryRowsBefore, runtime.database().countAuthoredGeometryRows(mapId),
                "DE-SEL-003 leaves authored DB row count unchanged");
        assertEquals(authoredStateBefore, runtime.database().authoredGeometryState(mapId),
                "DE-SEL-003 leaves authored DB state unchanged");

        results.add("DE-SEL-003 Ready: DungeonMapView stair handle click -> SQLite unchanged -> stair selection");
    }

    private static void verifyStairAnchorMoveThroughMapView(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();

        long mapId = createMapThroughControls(controls, runtime, "Stair Anchor Move Map");
        createMapThroughControls(controls, runtime, "Stair Anchor Move Reload Hop");
        runtime.database().seedF7StairAnchor(mapId);
        selectMap(controls, "Stair Anchor Move Map");
        click(button(controls, "Auswahl"));
        assertEquals("SELECT", runtime.controlsModel().current().selectedTool().name(),
                "DE-STAIR-005 input route uses the select tool");
        var stairHandle = runtime.mapSurfaceModel().current().surface().map().editorHandles().stream()
                .filter(handle -> "STAIR_ANCHOR".equals(handle.ref().kind().name()))
                .filter(handle -> handle.cell().q() == 2)
                .filter(handle -> handle.cell().r() == 2)
                .filter(handle -> handle.cell().level() == 0)
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("F7_STAIR_ANCHOR lower stair path handle not loaded."));
        DungeonEditorTopologyElementRef stairRef = editorTopologyRef(stairHandle.ref().topologyRef());
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
        assertEquals("HANDLE", binding.mapContentModel()
                        .resolvePointerTarget(anchorCenter.getX(), anchorCenter.getY())
                        .targetKind()
                        .name(),
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

        results.add("DE-STAIR-005 Ready: DungeonMapView stair handle drag -> SQLite path-node move -> reload");
    }

    private static void verifyStraightStairGeometryEditThroughStateView(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();
        DungeonEditorStateView stateView = binding.stateView();

        long mapId = createMapThroughControls(controls, runtime, "Stair Geometry Map");
        createMapThroughControls(controls, runtime, "Stair Geometry Reload Hop");
        runtime.database().seedF7StairAnchor(mapId);
        selectMap(controls, "Stair Geometry Map");
        click(button(controls, "Auswahl"));
        var stairHandle = firstStairHandle(runtime.mapSurfaceModel().current(), "DE-STAIR-004");
        DungeonEditorTopologyElementRef stairRef = editorTopologyRef(stairHandle.ref().topologyRef());
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
        dimension1Field.setText("4");
        dimension2Field.setText("2");
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
        selectComboItem(directionBox, "SOUTH");
        dimension1Field = textField(stateView, "Treppe Laenge");
        dimension2Field = textField(stateView, "Treppe Ebenenspanne");
        dimension1Field.setText("4");
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
        selectComboItem(directionBox, "NORTH");
        dimension1Field = textField(stateView, "Treppe Laenge");
        dimension2Field = textField(stateView, "Treppe Ebenenspanne");
        dimension1Field.setText("4");
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
        results.add("DE-STAIR-004 Ready: DungeonEditorStateView stair card -> SQLite scalar/path/exit recompute");
        results.add("DE-STAIR-006 Ready: DungeonEditorStateView dimension2=2 -> every crossed-floor exit persists/renders");
        results.add("DE-STAIR-010 Ready: DungeonEditorStateView recompute keeps stair id/topology/selection stable");
        results.add("DE-STATE-003 Ready: DungeonEditorStateView stair card -> shape/direction/dimension recompute");
    }

    private static void verifyInvalidStairRoomInteriorRecomputeThroughStateView(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();
        DungeonEditorStateView stateView = binding.stateView();

        long mapId = createMapThroughControls(controls, runtime, "Stair Invalid Recompute Map");
        createMapThroughControls(controls, runtime, "Stair Invalid Recompute Reload Hop");
        runtime.database().seedF7StairAnchorWithBlockingRoom(mapId);
        selectMap(controls, "Stair Invalid Recompute Map");
        click(button(controls, "Auswahl"));
        var stairHandle = firstStairHandle(runtime.mapSurfaceModel().current(), "DE-STAIR-007");
        DungeonEditorTopologyElementRef stairRef = editorTopologyRef(stairHandle.ref().topologyRef());
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

        results.add("DE-STAIR-007 Ready: DungeonEditorStateView invalid stair geometry + constrained inputs"
                + " + DungeonMapView room-interior create rejection -> SQLite unchanged -> snapshot/render stable");
    }

    private static void assertInvalidStairGeometryLeavesViewState(
            HarnessRuntime runtime,
            HarnessBinding binding,
            DungeonEditorMapSurfaceSnapshot surfaceBefore,
            Set<String> renderCellsBefore,
            String message
    ) {
        DungeonEditorMapSurfaceSnapshot surfaceAfter = runtime.mapSurfaceModel().current();
        assertEquals(surfaceBefore.surface().map(), surfaceAfter.surface().map(),
                message + " keeps published map stable");
        assertEquals(surfaceBefore.selection(), surfaceAfter.selection(),
                message + " keeps selected stair stable");
        assertEquals(surfaceBefore.projectionLevel(), surfaceAfter.projectionLevel(),
                message + " keeps projection stable");
        assertEquals(DungeonEditorPreview.none(), surfaceAfter.preview(),
                message + " keeps preview empty");
        assertEquals(renderCellsBefore, renderSurfaceCellOriginsWithZ(binding.mapContentModel()),
                message + " keeps rendered active-level stair cells stable");
    }

    private static void verifyStraightStairCreateThroughMapView(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();

        long mapId = createMapThroughControls(controls, runtime, "Stair Create Map");
        runtime.database().seedF1SingleRoom(mapId, "R1", 0, 1, 1);
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
        assertEquals("STAIR_CREATE", runtime.controlsModel().current().selectedTool().name(),
                "DE-STAIR-001 input route selects the straight stair creation tool");
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();
        List<String> invalidAuthoredRowsBefore = runtime.database().authoredGeometryState(mapId);
        DungeonEditorMapSurfaceSnapshot invalidCreateSurfaceBefore = runtime.mapSurfaceModel().current();
        Set<String> invalidCreateRenderCellsBefore = renderSurfaceCellOriginsWithZ(binding.mapContentModel());
        clickMap(
                mapView,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(2.5),
                viewport.sceneToScreenY(4.5),
                false);
        assertEquals(invalidAuthoredRowsBefore, runtime.database().authoredGeometryState(mapId),
                "DE-STAIR-007 room-interior stair create leaves authored DB rows unchanged");
        assertEquals(stableRowsBefore, runtime.database().stairStableState(mapId),
                "DE-STAIR-007 room-interior stair create leaves stair scalar DB rows unchanged");
        assertEquals(pathRowsBefore, runtime.database().stairPathState(mapId),
                "DE-STAIR-007 room-interior stair create leaves path DB rows unchanged");
        assertEquals(exitRowsBefore, runtime.database().stairExitState(mapId),
                "DE-STAIR-007 room-interior stair create leaves exit DB rows unchanged");
        assertInvalidStairGeometryLeavesViewState(
                runtime,
                binding,
                invalidCreateSurfaceBefore,
                invalidCreateRenderCellsBefore,
                "DE-STAIR-007 room-interior stair create");
        assertEquals("Treppengeometrie ungueltig.", runtime.controlsModel().current().statusText(),
                "DE-STAIR-007 room-interior stair create publishes rejection status");
        assertEquals("STAIR_CREATE", runtime.controlsModel().current().selectedTool().name(),
                "DE-STAIR-007 room-interior rejection keeps straight stair creation selected");
        clickMap(
                mapView,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(6.5),
                viewport.sceneToScreenY(6.5),
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
        assertStraightStairCreatedInSnapshot(
                committedSurface,
                binding.mapContentModel(),
                stairId,
                6,
                6,
                "DE-STAIR-001 committed create");
        assertEquals(DungeonEditorPreview.none(), committedSurface.preview(),
                "DE-STAIR-001 clears preview after commit");
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
        assertEquals("STAIR_CREATE_SQUARE", runtime.controlsModel().current().selectedTool().name(),
                "DE-STAIR-002 input route selects the square stair creation tool");
        clickMap(
                mapView,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(9.5),
                viewport.sceneToScreenY(6.5),
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
        assertEquals("STAIR_CREATE_CIRCULAR", runtime.controlsModel().current().selectedTool().name(),
                "DE-STAIR-003 input route selects the circular stair creation tool");
        clickMap(
                mapView,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(12.5),
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

        results.add("DE-STAIR-001 Ready: DungeonEditorControlsView Treppe/Gerade -> DungeonMapView primary place"
                + " -> SQLite stair graph/topology -> snapshot/render");
        results.add("DE-STAIR-002 Ready: DungeonEditorControlsView Treppe/Eckspirale -> DungeonMapView primary place"
                + " -> SQLite square stair graph/topology -> snapshot/render");
        results.add("DE-STAIR-003 Ready: DungeonEditorControlsView Treppe/Rundspirale -> DungeonMapView primary place"
                + " -> SQLite circular stair graph/topology -> snapshot/render");
    }

    private static void verifyStairDeleteThroughMapView(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();

        long mapId = createMapThroughControls(controls, runtime, "Stair Delete Map");
        runtime.database().seedF7StairAnchor(mapId);
        createMapThroughControls(controls, runtime, "Stair Delete Reload Hop");
        selectMap(controls, "Stair Delete Map");

        var stairHandle = firstStairHandle(runtime.mapSurfaceModel().current(), "DE-STAIR-009 unbound");
        long stairId = stairHandle.ref().topologyRef().id();
        DungeonEditorTopologyElementRef stairRef = editorTopologyRef(stairHandle.ref().topologyRef());
        Point2D stairCenter = glyphCenterForRef(binding.mapContentModel(), stairRef);
        assertTrue(!runtime.database().stairStableState(mapId).isEmpty(),
                "DE-STAIR-009 unbound fixture starts with a stair row and topology ref");
        assertTrue(!runtime.database().stairPathState(mapId).isEmpty(),
                "DE-STAIR-009 unbound fixture starts with stair path rows");
        assertTrue(!runtime.database().stairExitState(mapId).isEmpty(),
                "DE-STAIR-009 unbound fixture starts with stair exit rows");
        click(button(controls, "Treppe"));
        assertEquals("STAIR_CREATE", runtime.controlsModel().current().selectedTool().name(),
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

        results.add("DE-STAIR-009 Ready: DungeonEditorControlsView Treppe -> DungeonMapView secondary stair delete"
                + "/corridor-bound rejection -> SQLite stair graph/topology -> render");
    }

    private static void verifyCorridorBoundStairDeleteRejectedThroughMapView(
            DungeonEditorControlsView controls,
            HarnessRuntime runtime,
            HarnessBinding binding,
            DungeonMapView mapView,
            long mapId
    ) {
        var stairHandle = firstStairHandle(runtime.mapSurfaceModel().current(), "DE-STAIR-009 bound rejection");
        DungeonEditorTopologyElementRef stairRef = editorTopologyRef(stairHandle.ref().topologyRef());
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

    private static void verifyCorridorSelectionThroughMapView(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();

        long mapId = createMapThroughControls(controls, runtime, "Corridor Selection Map");
        runtime.database().seedCorridorWithAnchor(mapId);
        long geometryRowsBefore = runtime.database().countAuthoredGeometryRows(mapId);
        createMapThroughControls(controls, runtime, "Corridor Selection Reload Hop");
        selectMap(controls, "Corridor Selection Map");
        List<String> authoredStateBefore = runtime.database().authoredGeometryState(mapId);
        click(button(controls, "Auswahl"));
        var corridorAnchor = runtime.mapSurfaceModel().current().surface().map().editorHandles().stream()
                .filter(handle -> "CORRIDOR_ANCHOR".equals(handle.ref().kind().name()))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("F5_CORRIDOR_WITH_ANCHOR anchor handle not loaded."));
        DungeonEditorTopologyElementRef anchorRef = editorTopologyRef(corridorAnchor.ref().topologyRef());
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();
        Point2D anchorCenter = glyphCenterForRef(binding.mapContentModel(), anchorRef);

        fireMapMousePressed(
                mapView,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(anchorCenter.getX()),
                viewport.sceneToScreenY(anchorCenter.getY()),
                false);

        DungeonEditorStateSnapshot selectedState = runtime.stateModel().current();
        DungeonEditorMapSurfaceSnapshot selectedSurface = runtime.mapSurfaceModel().current();
        assertEquals(anchorRef, selectedState.selection().topologyRef(),
                "DE-SEL-004 state model selected corridor-anchor topology ref");
        assertEquals(anchorRef, selectedSurface.selection().topologyRef(),
                "DE-SEL-004 map surface selected corridor-anchor topology ref");
        assertEquals(corridorAnchor.ref(), selectedState.selection().handleRef(),
                "DE-SEL-004 state model selected handle ref");
        assertTrue(selectedState.inspector() != null, "DE-SEL-004 inspector is published for selected corridor anchor");
        assertTrue(renderHasSelectedGlyphPrimitive(binding.mapContentModel(), anchorRef),
                "DE-SEL-004 render scene highlights the selected corridor-anchor handle");
        assertCanvasPaintedAtScene(mapView, 6.5, 3.5,
                "DE-SEL-004 rendered canvas paints the selected anchor corridor route");
        assertEquals(geometryRowsBefore, runtime.database().countAuthoredGeometryRows(mapId),
                "DE-SEL-004 leaves authored DB row count unchanged");
        assertEquals(authoredStateBefore, runtime.database().authoredGeometryState(mapId),
                "DE-SEL-004 leaves authored DB state unchanged");

        results.add("DE-SEL-004 Ready: DungeonMapView corridor-anchor click -> SQLite unchanged -> anchor selection");
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
        DungeonEditorTopologyElementRef anchorRef = editorTopologyRef(corridorAnchor.ref().topologyRef());
        List<String> anchorRowsBefore = runtime.database().corridorAnchorState(mapId);
        List<String> stableRowsBefore = runtime.database().corridorStableConnectionState(mapId);
        String a1AnchorRowBefore = anchorRowsBefore.stream()
                .filter(row -> row.contains("anchor_id=1")
                        && row.contains("cell_x=6")
                        && row.contains("cell_y=5")
                        && row.contains("cell_z=0"))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException(
                        "DE-COR-005 starts with A1 anchored at (6,5,0): " + anchorRowsBefore));
        assertTrue(a1AnchorRowBefore.contains("|cell_y=5|"),
                "DE-COR-005 captures exact A1 anchor row at (6,5,0): " + a1AnchorRowBefore);
        String a1AnchorRowAfter = a1AnchorRowBefore.replace("|cell_y=5|", "|cell_y=4|");
        assertTrue(a1AnchorRowAfter.contains("|cell_y=4|"),
                "DE-COR-005 expected A1 anchor row changes only to cell_y=4: " + a1AnchorRowAfter);
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();
        Point2D anchorCenter = glyphCenterForRef(binding.mapContentModel(), anchorRef);

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
                viewport.sceneToScreenX(6.5),
                viewport.sceneToScreenY(4.5),
                false);

        DungeonEditorMapSurfaceSnapshot previewSurface = runtime.mapSurfaceModel().current();
        assertEquals(anchorRowsBefore, runtime.database().corridorAnchorState(mapId),
                "DE-SEL-006 drag preview leaves corridor anchor DB rows unchanged before release");
        assertEquals(stableRowsBefore, runtime.database().corridorStableConnectionState(mapId),
                "DE-SEL-006 drag preview leaves stable corridor connection DB rows unchanged before release");
        assertEquals(anchorRef, previewSurface.selection().topologyRef(),
                "DE-SEL-006 preview keeps the same selected anchor topology ref");
        assertTrue(previewSurface.preview() instanceof DungeonEditorPreview.MoveHandlePreview,
                "DE-SEL-006 publishes a move-handle preview during anchor drag");
        DungeonEditorPreview.MoveHandlePreview preview =
                (DungeonEditorPreview.MoveHandlePreview) previewSurface.preview();
        assertEquals(0L, preview.deltaQ(), "DE-SEL-006 preview delta q");
        assertEquals(-1L, preview.deltaR(), "DE-SEL-006 preview delta r");
        assertEquals(0L, preview.deltaLevel(), "DE-SEL-006 preview delta level");
        assertTrue(renderHasGlyphAt(binding.mapContentModel(), anchorRef, 6.5, 4.5, true),
                "DE-SEL-006 render scene shows selected preview anchor marker at (6,4,0)");

        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_RELEASED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(6.5),
                viewport.sceneToScreenY(4.5),
                false);

        List<String> anchorRowsAfter = runtime.database().corridorAnchorState(mapId);
        assertTrue(anchorRowsAfter.contains(a1AnchorRowAfter),
                "DE-COR-005 persists existing A1 anchor at (6,4,0): " + anchorRowsAfter);
        assertTrue(!anchorRowsAfter.contains(a1AnchorRowBefore),
                "DE-COR-005 removes old A1 anchor coordinates after release: " + anchorRowsAfter);
        assertEquals(stableRowsBefore, runtime.database().corridorStableConnectionState(mapId),
                "DE-COR-005 keeps stable corridor rows, endpoint refs, waypoints, and topology refs");
        DungeonEditorMapSurfaceSnapshot committedSurface = runtime.mapSurfaceModel().current();
        assertEquals(DungeonEditorPreview.none(), committedSurface.preview(),
                "DE-COR-005 clears move preview after release");
        assertEquals(anchorRef, committedSurface.selection().topologyRef(),
                "DE-COR-005 keeps selection on the same anchor topology ref after release");
        assertTrue(committedSurface.surface().map().editorHandles().stream().anyMatch(handle ->
                        handle.ref().topologyRef().equals(corridorAnchor.ref().topologyRef())
                                && handle.cell().q() == 6
                                && handle.cell().r() == 4
                                && handle.cell().level() == 0),
                "DE-COR-005 published handle readback moves A1 to (6,4,0)");
        assertTrue(renderHasGlyphAt(binding.mapContentModel(), anchorRef, 6.5, 4.5, false),
                "DE-COR-005 render scene shows committed anchor marker at (6,4,0)");
        assertCanvasPaintedAtScene(mapView, 6.5, 4.5,
                "DE-COR-005 rendered canvas paints the moved anchor corridor route");

        results.add("DE-SEL-006 Ready: DungeonMapView anchor drag -> preview without DB mutation");
        results.add("DE-COR-005 Ready: DungeonMapView anchor release -> SQLite anchor move -> render readback");
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
        DungeonEditorTopologyElementRef anchorRef = editorTopologyRef(corridorAnchor.ref().topologyRef());
        Set<Long> existingCorridorIds = runtime.database().corridorIdsForMap(mapId);
        assertEquals(1L, existingCorridorIds.size(), "DE-STATE-004 fixture starts with one authored corridor");
        long existingCorridorId = existingCorridorIds.iterator().next();
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
        Point2D anchorCenter = glyphCenterForRef(binding.mapContentModel(), anchorRef);

        fireMapMousePressed(
                mapView,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(anchorCenter.getX()),
                viewport.sceneToScreenY(anchorCenter.getY()),
                false);

        assertEquals(corridorAnchor.ref(), runtime.stateModel().current().selection().handleRef(),
                "DE-STATE-004 state model selects the corridor anchor handle");
        TextField qField = textField(stateView, "Korridorpunkt q");
        TextField rField = textField(stateView, "Korridorpunkt r");
        Label levelLabel = label(stateView, "Korridorpunkt z");
        assertEquals("6", qField.getText(), "DE-STATE-004 state panel exposes anchor q");
        assertEquals("5", rField.getText(), "DE-STATE-004 state panel exposes anchor r");
        assertEquals("0", levelLabel.getText(), "DE-STATE-004 state panel displays anchor z");
        assertTrue(!textFieldPresent(stateView, "Korridorpunkt z"),
                "DE-STATE-004 state panel does not expose z as a freeform coordinate field");

        qField.setText("");
        rField.setText("");
        ButtonBase moveButton = buttonWithAccessibleText(stateView, "Korridor-Anker verschieben");
        assertTrue(moveButton.isDisabled(), "DE-STATE-004 incomplete blank q/r draft keeps move disabled");
        fireMapMousePressed(
                mapView,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(anchorCenter.getX()),
                viewport.sceneToScreenY(anchorCenter.getY()),
                false);
        qField = textField(stateView, "Korridorpunkt q");
        rField = textField(stateView, "Korridorpunkt r");
        assertEquals("", qField.getText(), "DE-STATE-004 projection refresh preserves blank q draft");
        assertEquals("", rField.getText(), "DE-STATE-004 projection refresh preserves blank r draft");
        qField.setText("6");
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
        assertEquals(anchorRef, committedSurface.selection().topologyRef(),
                "DE-STATE-004 keeps selection on the moved anchor topology ref");
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
        assertTrue(renderHasGlyphAt(binding.mapContentModel(), anchorRef, 6.5, 4.5, false),
                "DE-STATE-004 render scene shows committed anchor marker at (6,4,0)");
        selectMap(controls, "Corridor State Point Reload Hop");
        selectMap(controls, "Corridor State Point Map");
        assertTrue(areaCellSet(corridorAreaById(
                        runtime.mapSurfaceModel().current(),
                        existingCorridorId,
                        "DE-STATE-004 reload")).contains("6,4,0"),
                "DE-STATE-004 reload published corridor area keeps the edited connection point cell");
        assertTrue(renderHasGlyphAt(binding.mapContentModel(), anchorRef, 6.5, 4.5, false),
                "DE-STATE-004 reload render keeps committed anchor marker at (6,4,0)");

        results.add("DE-STATE-004 Ready: DungeonEditorStateView corridor point edit -> SQLite anchor move -> render");
    }

    private static void verifyTransitionDescriptionThroughStateView(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();
        DungeonEditorStateView stateView = binding.stateView();

        long mapId = createMapThroughControls(controls, runtime, "Transition Description Map");
        runtime.database().seedTransitionDescriptionFixture(mapId);
        List<String> transitionStableStateBefore = runtime.database().transitionStableState(mapId);
        long transitionId = runtime.database().transitionIdByDescription(mapId, "Initial transition.");
        createMapThroughControls(controls, runtime, "Transition Description Reload Hop");
        selectMap(controls, "Transition Description Map");
        click(button(controls, "Auswahl"));

        DungeonEditorTopologyElementRef transitionRef = new DungeonEditorTopologyElementRef("TRANSITION", transitionId);
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();
        Point2D transitionCenter = glyphCenterForRef(binding.mapContentModel(), transitionRef);
        fireMapMousePressed(
                mapView,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(transitionCenter.getX()),
                viewport.sceneToScreenY(transitionCenter.getY()),
                false);

        DungeonEditorStateSnapshot selectedState = runtime.stateModel().current();
        assertEquals(transitionRef, selectedState.selection().topologyRef(),
                "DE-TRN-004 state model selects transition topology ref");
        assertTrue(selectedState.inspector() != null, "DE-TRN-004 inspector is published for selected transition");
        assertEquals("Initial transition.", selectedState.inspector().summary(),
                "DE-TRN-004 inspector exposes initial transition description");
        assertTrue(!textFieldPresent(stateView, "Korridorpunkt q"),
                "DE-TRN-004 transition marker does not expose the corridor point card");
        TextArea descriptionArea = textArea(stateView, "Übergang Beschreibung");
        assertEquals("Initial transition.", descriptionArea.getText(),
                "DE-TRN-004 state panel exposes transition description");
        descriptionArea.setText("Hidden stairwell to the cistern.");
        click(buttonWithAccessibleText(stateView, "Übergang " + transitionId + " speichern"));

        assertEquals(1L, runtime.database().countTransitionDescription(
                        mapId,
                        transitionId,
                        "Hidden stairwell to the cistern."),
                "DE-TRN-004 persists dungeon_transitions.description");
        assertEquals(transitionStableStateBefore, runtime.database().transitionStableState(mapId),
                "DE-TRN-004 leaves transition destination/link/cell state unchanged");
        DungeonEditorMapSurfaceSnapshot committedSurface = runtime.mapSurfaceModel().current();
        assertEquals(transitionRef, committedSurface.selection().topologyRef(),
                "DE-TRN-004 map surface keeps transition selected after save");
        assertTrue(committedSurface.surface().map().features().stream().anyMatch(feature ->
                        feature.id() == transitionId
                                && "TRANSITION".equals(feature.kind())
                                && "Hidden stairwell to the cistern.".equals(feature.description())),
                "DE-TRN-004 published feature exposes saved transition description");
        assertEquals("Hidden stairwell to the cistern.", runtime.stateModel().current().inspector().summary(),
                "DE-TRN-004 inspector readback exposes saved transition description");
        assertEquals("Hidden stairwell to the cistern.",
                textArea(stateView, "Übergang Beschreibung").getText(),
                "DE-TRN-004 state panel readback shows saved transition description");
        assertTrue(renderHasSelectedGlyphPrimitive(binding.mapContentModel(), transitionRef),
                "DE-TRN-004 render scene keeps the selected transition marker");
        assertCanvasPaintedAtScene(mapView, transitionCenter.getX(), transitionCenter.getY(),
                "DE-TRN-004 rendered canvas paints the selected transition marker");

        selectMap(controls, "Transition Description Reload Hop");
        selectMap(controls, "Transition Description Map");
        click(button(controls, "Auswahl"));
        Point2D reloadedTransitionCenter = glyphCenterForRef(binding.mapContentModel(), transitionRef);
        DungeonMapContentModel.Viewport reloadedViewport = binding.mapContentModel().currentViewport();
        fireMapMousePressed(
                mapView,
                MouseButton.PRIMARY,
                reloadedViewport.sceneToScreenX(reloadedTransitionCenter.getX()),
                reloadedViewport.sceneToScreenY(reloadedTransitionCenter.getY()),
                false);
        assertEquals("Hidden stairwell to the cistern.", runtime.stateModel().current().inspector().summary(),
                "DE-TRN-004 reload inspector keeps saved transition description");
        assertEquals("Hidden stairwell to the cistern.",
                textArea(stateView, "Übergang Beschreibung").getText(),
                "DE-TRN-004 reload state panel keeps saved transition description");
        assertTrue(renderHasSelectedGlyphPrimitive(binding.mapContentModel(), transitionRef),
                "DE-TRN-004 reload render keeps selected transition marker");

        results.add("DE-TRN-004 Ready: DungeonEditorStateView transition description save -> SQLite -> readback");
    }

    private static void verifyBidirectionalTransitionLinkThroughStateView(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();
        DungeonEditorStateView stateView = binding.stateView();

        long sourceMapId = createMapThroughControls(controls, runtime, "Transition Link Source Map");
        long targetMapId = createMapThroughControls(controls, runtime, "Transition Link Target Map");
        runtime.database().seedTransitionLinkFixture(sourceMapId, targetMapId);
        long sourceTransitionId = runtime.database().transitionIdByDescription(sourceMapId, "Source transition.");
        long targetTransitionId = runtime.database().transitionIdByDescription(targetMapId, "Target transition.");
        createMapThroughControls(controls, runtime, "Transition Link Reload Hop");
        selectMap(controls, "Transition Link Source Map");
        click(button(controls, "Auswahl"));

        DungeonEditorTopologyElementRef sourceRef =
                new DungeonEditorTopologyElementRef("TRANSITION", sourceTransitionId);
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();
        Point2D sourceCenter = glyphCenterForRef(binding.mapContentModel(), sourceRef);
        fireMapMousePressed(
                mapView,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(sourceCenter.getX()),
                viewport.sceneToScreenY(sourceCenter.getY()),
                false);
        assertEquals(sourceRef, runtime.mapSurfaceModel().current().selection().topologyRef(),
                "DE-TRN-003 state route selects source transition before linking");
        assertTrue(buttonWithAccessibleText(stateView, "Übergang-Verknüpfung speichern").isVisible(),
                "DE-TRN-003 state route exposes transition link save button for selected source");

        List<String> sourceRowsBefore = runtime.database().transitionStableState(sourceMapId);
        List<String> targetRowsBefore = runtime.database().transitionStableState(targetMapId);
        submitTransitionLink(stateView, targetMapId + 1000L, targetTransitionId, true);
        assertEquals(sourceRowsBefore, runtime.database().transitionStableState(sourceMapId),
                "DE-TRN-003 invalid target map leaves source transitions unchanged");
        assertEquals(targetRowsBefore, runtime.database().transitionStableState(targetMapId),
                "DE-TRN-003 invalid target map leaves target transitions unchanged");

        submitTransitionLink(stateView, targetMapId, targetTransitionId + 1000L, true);
        assertEquals(sourceRowsBefore, runtime.database().transitionStableState(sourceMapId),
                "DE-TRN-003 invalid target transition leaves source transitions unchanged");
        assertEquals(targetRowsBefore, runtime.database().transitionStableState(targetMapId),
                "DE-TRN-003 invalid target transition leaves target transitions unchanged");

        submitTransitionLink(stateView, targetMapId, targetTransitionId, true);
        assertTransitionRowContains(
                runtime.database().transitionStableState(sourceMapId),
                sourceTransitionId,
                List.of(
                        "destination_type=DUNGEON_MAP",
                        "target_overworld_map_id=<null>",
                        "target_overworld_tile_id=<null>",
                        "target_dungeon_map_id=" + targetMapId,
                        "target_transition_id=" + targetTransitionId,
                        "linked_transition_id=<null>"),
                "DE-TRN-003 source transition row targets T2");
        assertTransitionRowContains(
                runtime.database().transitionStableState(targetMapId),
                targetTransitionId,
                List.of("linked_transition_id=" + sourceTransitionId),
                "DE-TRN-003 target transition row links back to T1");
        assertEquals(1L, runtime.database().countTransitionTopologyElementById(sourceMapId, sourceTransitionId),
                "DE-TRN-003 source transition topology ref remains stable");
        assertEquals(1L, runtime.database().countTransitionTopologyElementById(targetMapId, targetTransitionId),
                "DE-TRN-003 target transition topology ref remains stable");

        String destinationLabel = "Dungeon " + targetMapId + " / Übergang " + targetTransitionId;
        DungeonEditorMapSurfaceSnapshot sourceSurface = runtime.mapSurfaceModel().current();
        assertEquals(sourceRef, sourceSurface.selection().topologyRef(),
                "DE-TRN-003 source selection remains after save");
        assertEquals(DungeonEditorPreview.none(), sourceSurface.preview(),
                "DE-TRN-003 source save clears preview");
        assertTransitionCreatedInSnapshot(
                sourceSurface,
                binding.mapContentModel(),
                sourceTransitionId,
                5,
                2,
                0,
                5.5,
                2.5,
                destinationLabel,
                "DE-TRN-003 committed source link");

        selectMap(controls, "Transition Link Reload Hop");
        selectMap(controls, "Transition Link Source Map");
        assertTransitionCreatedInSnapshot(
                runtime.mapSurfaceModel().current(),
                binding.mapContentModel(),
                sourceTransitionId,
                5,
                2,
                0,
                5.5,
                2.5,
                destinationLabel,
                "DE-TRN-003 reloaded source link");

        selectMap(controls, "Transition Link Target Map");
        DungeonEditorTopologyElementRef targetRef =
                new DungeonEditorTopologyElementRef("TRANSITION", targetTransitionId);
        assertTransitionCreatedInSnapshot(
                runtime.mapSurfaceModel().current(),
                binding.mapContentModel(),
                targetTransitionId,
                6,
                2,
                0,
                6.5,
                2.5,
                "Overworld-Feld 88",
                "DE-TRN-003 target marker remains selectable after source reload");
        click(button(controls, "Auswahl"));
        Point2D targetCenter = glyphCenterForRef(binding.mapContentModel(), targetRef);
        DungeonMapContentModel.Viewport targetViewport = binding.mapContentModel().currentViewport();
        fireMapMousePressed(
                mapView,
                MouseButton.PRIMARY,
                targetViewport.sceneToScreenX(targetCenter.getX()),
                targetViewport.sceneToScreenY(targetCenter.getY()),
                false);
        assertEquals(targetRef, runtime.mapSurfaceModel().current().selection().topologyRef(),
                "DE-TRN-003 target marker remains selectable");

        List<String> protectedTargetRowsBefore = runtime.database().transitionStableState(targetMapId);
        click(button(controls, "Übergang"));
        clickMap(
                mapView,
                MouseButton.SECONDARY,
                targetViewport.sceneToScreenX(targetCenter.getX()),
                targetViewport.sceneToScreenY(targetCenter.getY()),
                false);
        assertEquals(protectedTargetRowsBefore, runtime.database().transitionStableState(targetMapId),
                "DE-TRN-003 linked target delete protection leaves target transition rows unchanged");
        assertTrue(renderHasGlyphAt(binding.mapContentModel(), targetRef, 6.5, 2.5, false),
                "DE-TRN-003 linked target marker remains rendered after protected delete");

        results.add("DE-TRN-003 Ready: DungeonEditorStateView bidirectional link save -> SQLite source/target"
                + " -> snapshot/render/reload/delete protection");
    }

    private static void submitTransitionLink(
            DungeonEditorStateView stateView,
            long targetMapId,
            long targetTransitionId,
            boolean bidirectional
    ) {
        selectComboItem(comboBox(stateView, "Übergang Zieltyp"), "DUNGEON_MAP");
        textField(stateView, "Übergang Zielkarte").setText(Long.toString(targetMapId));
        textField(stateView, "Übergang Zieluebergang").setText(Long.toString(targetTransitionId));
        CheckBox bidirectionalBox = checkBox(stateView, "Übergang bidirektional verknuepfen");
        if (bidirectionalBox.isSelected() != bidirectional) {
            click(bidirectionalBox);
        }
        click(buttonWithAccessibleText(stateView, "Übergang-Verknüpfung speichern"));
    }

    private static void verifyTransitionCreateThroughMapView(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();
        DungeonEditorStateView stateView = binding.stateView();

        long mapId = createMapThroughControls(controls, runtime, "Transition Create Map");
        runtime.database().seedF6MultiLevelFloors(mapId);
        long reloadHopMapId = createMapThroughControls(controls, runtime, "Transition Create Reload Hop");
        runtime.database().seedGlobalTransitionIdentitySentinel(reloadHopMapId);
        long globalTransitionIdBefore = runtime.database().maxTransitionId();
        selectMap(controls, "Transition Create Map");
        assertTrue(runtime.database().transitionStableState(mapId).isEmpty(),
                "DE-TRN-001 fixture starts without transition rows");

        click(button(controls, "Übergang"));
        assertEquals("TRANSITION_CREATE", runtime.controlsModel().current().selectedTool().name(),
                "DE-TRN-001 transition family selects transition creation");
        ComboBox<?> destinationType = comboBox(stateView, "Übergang Zieltyp");
        assertTrue(comboBoxContainsDisplayText(destinationType, "OVERWORLD_TILE"),
                "DE-TRN-001 destination surface exposes overworld destination option");
        assertTrue(comboBoxContainsDisplayText(destinationType, "DUNGEON_MAP"),
                "DE-TRN-001 destination surface exposes dungeon destination option");
        selectComboItem(destinationType, "OVERWORLD_TILE");
        textField(stateView, "Übergang Zielkarte").setText("77");
        textField(stateView, "Übergang Zielkachel").setText("88");
        textField(stateView, "Übergang Zieluebergang").setText("");

        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();
        clickMap(
                mapView,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(5.5),
                viewport.sceneToScreenY(2.5),
                false);

        long transitionId = runtime.database().transitionIdAt(mapId, 5, 2, 0);
        assertTrue(transitionId > globalTransitionIdBefore,
                "DE-TRN-001 allocates transition id from global SQLite identity state, not selected-map rows");
        List<String> stableRowsAfter = runtime.database().transitionStableState(mapId);
        assertTrue(stableRowsAfter.stream().anyMatch(row -> row.startsWith("dungeon_transitions|transition_id=" + transitionId)
                        && row.contains("|cell_x=5")
                        && row.contains("|cell_y=2")
                        && row.contains("|level_z=0")
                        && row.contains("|destination_type=OVERWORLD_TILE")
                        && row.contains("|target_overworld_map_id=77")
                        && row.contains("|target_overworld_tile_id=88")),
                "DE-TRN-001 persists transition cell and overworld destination: " + stableRowsAfter);
        assertEquals(1L, runtime.database().countTransitionTopologyElementById(mapId, transitionId),
                "DE-TRN-001 persists stable transition topology ref");
        DungeonEditorTopologyElementRef transitionRef = new DungeonEditorTopologyElementRef("TRANSITION", transitionId);
        assertTransitionCreatedInSnapshot(
                runtime.mapSurfaceModel().current(),
                binding.mapContentModel(),
                transitionId,
                5,
                2,
                0,
                5.5,
                2.5,
                "Overworld-Feld 88",
                "DE-TRN-001 committed create");

        selectMap(controls, "Transition Create Reload Hop");
        selectMap(controls, "Transition Create Map");
        assertEquals(stableRowsAfter, runtime.database().transitionStableState(mapId),
                "DE-TRN-001 reload keeps transition stable rows");
        assertEquals(1L, runtime.database().countTransitionTopologyElementById(mapId, transitionId),
                "DE-TRN-001 reload keeps transition topology ref");
        assertTransitionCreatedInSnapshot(
                runtime.mapSurfaceModel().current(),
                binding.mapContentModel(),
                transitionId,
                5,
                2,
                0,
                5.5,
                2.5,
                "Overworld-Feld 88",
                "DE-TRN-001 reload");
        assertTrue(renderHasGlyphAt(binding.mapContentModel(), transitionRef, 5.5, 2.5, false),
                "DE-TRN-001 reload render keeps committed transition marker");

        results.add("DE-TRN-001 Ready: DungeonEditorControlsView Übergang + DungeonEditorStateView destination"
                + " -> DungeonMapView primary create -> SQLite transition/topology -> render");
    }

    private static void verifyTransitionDeleteThroughMapView(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();

        long mapId = createMapThroughControls(controls, runtime, "Transition Delete Map");
        runtime.database().seedTransitionDescriptionFixture(mapId);
        long transitionId = runtime.database().transitionIdByDescription(mapId, "Initial transition.");
        assertEquals(1L, runtime.database().countTransitionTopologyElementById(mapId, transitionId),
                "DE-TRN-002 fixture starts with one transition topology ref");
        createMapThroughControls(controls, runtime, "Transition Delete Reload Hop");
        selectMap(controls, "Transition Delete Map");

        DungeonEditorTopologyElementRef transitionRef = new DungeonEditorTopologyElementRef("TRANSITION", transitionId);
        Point2D transitionCenter = glyphCenterForRef(binding.mapContentModel(), transitionRef);
        assertEquals("HANDLE", binding.mapContentModel()
                        .resolvePointerTarget(transitionCenter.getX(), transitionCenter.getY())
                        .targetKind()
                        .name(),
                "DE-TRN-002 transition marker resolves as a real map pointer target");
        assertEquals("TRANSITION", binding.mapContentModel()
                        .resolvePointerTarget(transitionCenter.getX(), transitionCenter.getY())
                        .topologyKind(),
                "DE-TRN-002 transition marker carries a transition topology ref");
        click(button(controls, "Übergang"));
        assertEquals("TRANSITION_CREATE", runtime.controlsModel().current().selectedTool().name(),
                "DE-TRN-002 transition family selects the transition family tool");
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();

        clickMap(
                mapView,
                MouseButton.SECONDARY,
                viewport.sceneToScreenX(transitionCenter.getX()),
                viewport.sceneToScreenY(transitionCenter.getY()),
                false);

        assertEquals(0L, runtime.database().countTransitionById(mapId, transitionId),
                "DE-TRN-002 deletes the selected dungeon_transitions row");
        assertEquals(0L, runtime.database().countTransitionTopologyElementById(mapId, transitionId),
                "DE-TRN-002 deletes the selected transition topology ref");
        DungeonEditorMapSurfaceSnapshot committedSurface = runtime.mapSurfaceModel().current();
        assertEmptySelection(committedSurface.selection(), "DE-TRN-002 map surface after transition delete");
        assertEmptySelection(runtime.stateModel().current().selection(), "DE-TRN-002 state after transition delete");
        assertTrue(committedSurface.surface().map().features().stream().noneMatch(feature ->
                        feature.id() == transitionId && "TRANSITION".equals(feature.kind())),
                "DE-TRN-002 published feature list omits the deleted transition");
        assertTrue(!renderHasGlyphAt(binding.mapContentModel(), transitionRef, transitionCenter.getX(), transitionCenter.getY(), false),
                "DE-TRN-002 render scene omits the deleted transition marker");

        selectMap(controls, "Transition Delete Reload Hop");
        selectMap(controls, "Transition Delete Map");
        assertEquals(0L, runtime.database().countTransitionById(mapId, transitionId),
                "DE-TRN-002 reload readback keeps the transition deleted");
        assertEquals(0L, runtime.database().countTransitionTopologyElementById(mapId, transitionId),
                "DE-TRN-002 reload readback keeps the transition topology ref deleted");
        assertTrue(runtime.mapSurfaceModel().current().surface().map().features().stream().noneMatch(feature ->
                        feature.id() == transitionId && "TRANSITION".equals(feature.kind())),
                "DE-TRN-002 reload snapshot keeps the transition absent");

        long selectedLinkedMapId = createMapThroughControls(controls, runtime, "Transition Delete Selected Linked Map");
        verifyTransitionDeleteRejectedThroughMapView(
                "DE-TRN-002 selected linked rejection",
                "Transition Delete Selected Linked Map",
                database -> database.seedSelectedLinkedTransitionFixture(selectedLinkedMapId),
                controls,
                runtime,
                binding,
                mapView,
                selectedLinkedMapId,
                "Selected linked transition.");
        long reverseLinkedMapId = createMapThroughControls(controls, runtime, "Transition Delete Reverse Linked Map");
        verifyTransitionDeleteRejectedThroughMapView(
                "DE-TRN-002 reverse linked rejection",
                "Transition Delete Reverse Linked Map",
                database -> database.seedReverseLinkedTransitionFixture(reverseLinkedMapId),
                controls,
                runtime,
                binding,
                mapView,
                reverseLinkedMapId,
                "Reverse linked target transition.");
        long destinationReferenceMapId = createMapThroughControls(
                controls,
                runtime,
                "Transition Delete Destination Reference Map");
        verifyTransitionDeleteRejectedThroughMapView(
                "DE-TRN-002 dungeon destination rejection",
                "Transition Delete Destination Reference Map",
                database -> database.seedDestinationReferenceTransitionFixture(destinationReferenceMapId),
                controls,
                runtime,
                binding,
                mapView,
                destinationReferenceMapId,
                "Destination target transition.");

        results.add("DE-TRN-002 Ready: DungeonEditorControlsView Übergang -> DungeonMapView secondary transition delete"
                + "/reject -> SQLite delete/readback/topology -> render absence");
    }

    private static void verifyTransitionDeleteRejectedThroughMapView(
            String scenario,
            String mapName,
            DatabaseFixtureSeeder seeder,
            DungeonEditorControlsView controls,
            HarnessRuntime runtime,
            HarnessBinding binding,
            DungeonMapView mapView,
            long mapId,
            String selectedDescription
    ) {
        seeder.seed(runtime.database());
        createMapThroughControls(controls, runtime, mapName + " Reload Hop");
        selectMap(controls, mapName);
        long transitionId = runtime.database().transitionIdByDescription(mapId, selectedDescription);
        DungeonEditorTopologyElementRef transitionRef = new DungeonEditorTopologyElementRef("TRANSITION", transitionId);
        Point2D transitionCenter = glyphCenterForRef(binding.mapContentModel(), transitionRef);
        List<String> authoredStateBefore = runtime.database().authoredGeometryState(mapId);
        DungeonEditorMapSurfaceSnapshot surfaceBefore = runtime.mapSurfaceModel().current();
        assertEquals(1L, runtime.database().countTransitionById(mapId, transitionId),
                scenario + " fixture starts with selected transition row");
        assertEquals(1L, runtime.database().countTransitionTopologyElementById(mapId, transitionId),
                scenario + " fixture starts with selected topology ref");

        click(button(controls, "Übergang"));
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();
        clickMap(
                mapView,
                MouseButton.SECONDARY,
                viewport.sceneToScreenX(transitionCenter.getX()),
                viewport.sceneToScreenY(transitionCenter.getY()),
                false);

        assertEquals(authoredStateBefore, runtime.database().authoredGeometryState(mapId),
                scenario + " leaves authored DB rows unchanged");
        assertEquals(1L, runtime.database().countTransitionById(mapId, transitionId),
                scenario + " keeps selected transition row");
        assertEquals(1L, runtime.database().countTransitionTopologyElementById(mapId, transitionId),
                scenario + " keeps selected topology ref");
        assertEquals(surfaceBefore.surface().map(), runtime.mapSurfaceModel().current().surface().map(),
                scenario + " keeps published map stable");
        assertEquals(surfaceBefore.selection(), runtime.mapSurfaceModel().current().selection(),
                scenario + " keeps selection stable");
        assertEquals(surfaceBefore.projectionLevel(), runtime.mapSurfaceModel().current().projectionLevel(),
                scenario + " keeps projection level stable");
        assertEquals(DungeonEditorPreview.none(), runtime.mapSurfaceModel().current().preview(),
                scenario + " keeps preview empty");
        assertTrue(renderHasGlyphAt(binding.mapContentModel(), transitionRef, transitionCenter.getX(), transitionCenter.getY(), false),
                scenario + " keeps rendered transition marker");
    }

    @FunctionalInterface
    private interface DatabaseFixtureSeeder {
        void seed(DatabaseAssertions database);
    }

    private static void verifyDoorToDoorCorridorCreateThroughMapView(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();

        long mapId = createMapThroughControls(controls, runtime, "Corridor Door Route Map");
        runtime.database().seedTwoDoorRouteTarget(mapId);
        createMapThroughControls(controls, runtime, "Corridor Door Route Reload Hop");
        selectMap(controls, "Corridor Door Route Map");
        Set<Long> corridorIdsBefore = runtime.database().corridorIdsForMap(mapId);
        List<String> doorRowsBefore = runtime.database().doorBoundaryState(mapId);
        click(button(controls, "Korridor"));
        assertEquals("CORRIDOR_CREATE", runtime.controlsModel().current().selectedTool().name(),
                "DE-COR-001 corridor family selects corridor-create tool");
        Point2D doorOne = boundaryMidpointNear(binding.mapContentModel(), "DOOR", 4.0, 2.5);
        Point2D doorTwo = boundaryMidpointNear(binding.mapContentModel(), "DOOR", 8.0, 2.5);
        assertPointerTarget(binding.mapContentModel(), doorOne, "BOUNDARY", "DE-COR-001 first door");
        assertPointerTarget(binding.mapContentModel(), doorTwo, "BOUNDARY", "DE-COR-001 second door");
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();

        fireMapMousePressed(mapView, MouseButton.PRIMARY,
                viewport.sceneToScreenX(doorOne.getX()), viewport.sceneToScreenY(doorOne.getY()), false);
        assertEquals(corridorIdsBefore, runtime.database().corridorIdsForMap(mapId),
                "DE-COR-001 first endpoint click does not persist a partial corridor");
        fireMapMouse(mapView, MouseEvent.MOUSE_MOVED, MouseButton.NONE,
                viewport.sceneToScreenX(doorTwo.getX()), viewport.sceneToScreenY(doorTwo.getY()), false);
        assertEquals(DungeonEditorPreview.none(), runtime.mapSurfaceModel().current().preview(),
                "DE-COR-001 keeps published preview surface clear before commit");
        fireMapMousePressed(mapView, MouseButton.PRIMARY,
                viewport.sceneToScreenX(doorTwo.getX()), viewport.sceneToScreenY(doorTwo.getY()), false);

        long newCorridorId = singleNewCorridorId(corridorIdsBefore, runtime.database().corridorIdsForMap(mapId),
                "DE-COR-001");
        List<String> stableState = runtime.database().corridorStableConnectionState(mapId);
        assertCorridorDoorBindingCount(stableState, newCorridorId, 2, "DE-COR-001");
        assertEquals(doorRowsBefore, runtime.database().doorBoundaryState(mapId),
                "DE-COR-001 reuses the explicit door endpoint identities");
        assertCorridorCreatedInSnapshot(
                runtime.mapSurfaceModel().current(),
                binding.mapContentModel(),
                newCorridorId,
                cellRect(4, 2, 7, 2, 0),
                "DE-COR-001");
        selectMap(controls, "Corridor Door Route Reload Hop");
        selectMap(controls, "Corridor Door Route Map");
        assertCorridorCreatedInSnapshot(
                runtime.mapSurfaceModel().current(),
                binding.mapContentModel(),
                newCorridorId,
                cellRect(4, 2, 7, 2, 0),
                "DE-COR-001 reload");

        results.add("DE-COR-001 Ready: DungeonEditorControlsView corridor tool + two door hits -> SQLite -> render");
    }

    private static void verifyDoorToAnchorCorridorCreateThroughMapView(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();

        long mapId = createMapThroughControls(controls, runtime, "Corridor Door Anchor Map");
        runtime.database().seedCorridorWithAnchor(mapId);
        createMapThroughControls(controls, runtime, "Corridor Door Anchor Reload Hop");
        selectMap(controls, "Corridor Door Anchor Map");
        Set<Long> corridorIdsBefore = runtime.database().corridorIdsForMap(mapId);
        List<String> anchorRowsBefore = runtime.database().corridorAnchorState(mapId);
        click(button(controls, "Korridor"));
        assertEquals("CORRIDOR_CREATE", runtime.controlsModel().current().selectedTool().name(),
                "DE-COR-002 corridor family selects corridor-create tool");
        Point2D doorOne = boundaryMidpointNear(binding.mapContentModel(), "DOOR", 4.0, 2.5);
        var anchorHandle = firstCorridorAnchorHandle(runtime.mapSurfaceModel().current(), "DE-COR-002");
        DungeonEditorTopologyElementRef anchorRef = editorTopologyRef(anchorHandle.ref().topologyRef());
        Point2D anchor = glyphCenterForRef(binding.mapContentModel(), anchorRef);
        assertPointerTarget(binding.mapContentModel(), doorOne, "BOUNDARY", "DE-COR-002 door");
        assertPointerTarget(binding.mapContentModel(), anchor, "HANDLE", "DE-COR-002 anchor");
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();

        fireMapMousePressed(mapView, MouseButton.PRIMARY,
                viewport.sceneToScreenX(doorOne.getX()), viewport.sceneToScreenY(doorOne.getY()), false);
        fireMapMouse(mapView, MouseEvent.MOUSE_MOVED, MouseButton.NONE,
                viewport.sceneToScreenX(anchor.getX()), viewport.sceneToScreenY(anchor.getY()), false);
        assertEquals(DungeonEditorPreview.none(), runtime.mapSurfaceModel().current().preview(),
                "DE-COR-002 keeps published preview surface clear before commit");
        fireMapMousePressed(mapView, MouseButton.PRIMARY,
                viewport.sceneToScreenX(anchor.getX()), viewport.sceneToScreenY(anchor.getY()), false);

        long newCorridorId = singleNewCorridorId(corridorIdsBefore, runtime.database().corridorIdsForMap(mapId),
                "DE-COR-002");
        List<String> stableState = runtime.database().corridorStableConnectionState(mapId);
        assertCorridorDoorBindingCount(stableState, newCorridorId, 1, "DE-COR-002");
        assertCorridorAnchorRef(stableState, newCorridorId, anchorRef.id(), "DE-COR-002");
        assertEquals(anchorRowsBefore, runtime.database().corridorAnchorState(mapId),
                "DE-COR-002 reuses existing A1 without creating a duplicate anchor row");
        assertCorridorCreatedInSnapshot(
                runtime.mapSurfaceModel().current(),
                binding.mapContentModel(),
                newCorridorId,
                Set.of("4,2,0", "5,2,0", "6,2,0", "6,3,0", "6,4,0", "6,5,0"),
                "DE-COR-002");
        selectMap(controls, "Corridor Door Anchor Reload Hop");
        selectMap(controls, "Corridor Door Anchor Map");
        assertCorridorCreatedInSnapshot(
                runtime.mapSurfaceModel().current(),
                binding.mapContentModel(),
                newCorridorId,
                Set.of("4,2,0", "5,2,0", "6,2,0", "6,3,0", "6,4,0", "6,5,0"),
                "DE-COR-002 reload");

        results.add("DE-COR-002 Ready: DungeonEditorControlsView corridor tool + door/anchor hits -> SQLite -> render");
    }

    private static void verifyAnchorToAnchorCorridorCreateThroughMapView(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();

        long mapId = createMapThroughControls(controls, runtime, "Corridor Anchor Route Map");
        runtime.database().seedTwoAnchorRouteTarget(mapId);
        createMapThroughControls(controls, runtime, "Corridor Anchor Route Reload Hop");
        selectMap(controls, "Corridor Anchor Route Map");
        Set<Long> corridorIdsBefore = runtime.database().corridorIdsForMap(mapId);
        List<String> anchorRowsBefore = runtime.database().corridorAnchorState(mapId);
        List<DungeonEditorTopologyElementRef> anchorRefs = corridorAnchorRefs(runtime.mapSurfaceModel().current());
        assertEquals(2, anchorRefs.size(), "DE-COR-003 fixture publishes exactly two corridor anchors");
        click(button(controls, "Korridor"));
        assertEquals("CORRIDOR_CREATE", runtime.controlsModel().current().selectedTool().name(),
                "DE-COR-003 corridor family selects corridor-create tool");
        Point2D anchorOne = glyphCenterForRef(binding.mapContentModel(), anchorRefs.get(0));
        Point2D anchorTwo = glyphCenterForRef(binding.mapContentModel(), anchorRefs.get(1));
        assertPointerTarget(binding.mapContentModel(), anchorOne, "HANDLE", "DE-COR-003 first anchor");
        assertPointerTarget(binding.mapContentModel(), anchorTwo, "HANDLE", "DE-COR-003 second anchor");
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();

        fireMapMousePressed(mapView, MouseButton.PRIMARY,
                viewport.sceneToScreenX(anchorOne.getX()), viewport.sceneToScreenY(anchorOne.getY()), false);
        fireMapMouse(mapView, MouseEvent.MOUSE_MOVED, MouseButton.NONE,
                viewport.sceneToScreenX(anchorTwo.getX()), viewport.sceneToScreenY(anchorTwo.getY()), false);
        assertEquals(DungeonEditorPreview.none(), runtime.mapSurfaceModel().current().preview(),
                "DE-COR-003 keeps published preview surface clear before commit");
        fireMapMousePressed(mapView, MouseButton.PRIMARY,
                viewport.sceneToScreenX(anchorTwo.getX()), viewport.sceneToScreenY(anchorTwo.getY()), false);

        long newCorridorId = singleNewCorridorId(corridorIdsBefore, runtime.database().corridorIdsForMap(mapId),
                "DE-COR-003");
        List<String> stableState = runtime.database().corridorStableConnectionState(mapId);
        assertCorridorAnchorRef(stableState, newCorridorId, anchorRefs.get(0).id(), "DE-COR-003 first anchor");
        assertCorridorAnchorRef(stableState, newCorridorId, anchorRefs.get(1).id(), "DE-COR-003 second anchor");
        assertEquals(anchorRowsBefore, runtime.database().corridorAnchorState(mapId),
                "DE-COR-003 reuses both existing anchor rows without duplicates");
        assertCorridorCreatedInSnapshot(
                runtime.mapSurfaceModel().current(),
                binding.mapContentModel(),
                newCorridorId,
                cellRect(2, 6, 8, 6, 0),
                "DE-COR-003");
        selectMap(controls, "Corridor Anchor Route Reload Hop");
        selectMap(controls, "Corridor Anchor Route Map");
        assertCorridorCreatedInSnapshot(
                runtime.mapSurfaceModel().current(),
                binding.mapContentModel(),
                newCorridorId,
                cellRect(2, 6, 8, 6, 0),
                "DE-COR-003 reload");

        results.add("DE-COR-003 Ready: DungeonEditorControlsView corridor tool + two anchor hits -> SQLite -> render");
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
        assertPointerTarget(binding.mapContentModel(), doorOne, "BOUNDARY", "DE-COR-004 D1");
        assertPointerTarget(binding.mapContentModel(), doorThree, "BOUNDARY", "DE-COR-004 D3");
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();

        fireMapMousePressed(mapView, MouseButton.PRIMARY,
                viewport.sceneToScreenX(doorOne.getX()), viewport.sceneToScreenY(doorOne.getY()), false);
        fireMapMouse(mapView, MouseEvent.MOUSE_MOVED, MouseButton.NONE,
                viewport.sceneToScreenX(doorThree.getX()), viewport.sceneToScreenY(doorThree.getY()), false);
        assertEquals(DungeonEditorPreview.none(), runtime.mapSurfaceModel().current().preview(),
                "DE-COR-004 keeps published preview surface clear before commit");
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
        assertCorridorCreatedInSnapshot(
                runtime.mapSurfaceModel().current(),
                binding.mapContentModel(),
                newCorridorId,
                expectedCells,
                "DE-COR-004");
        assertCorridorAnchorHandleAt(runtime.mapSurfaceModel().current(), 6, 5, 0, "DE-COR-004");
        assertOnlyCorridorWaypointHandleAt(runtime.mapSurfaceModel().current(), newCorridorId, 6, 5, 0, "DE-COR-004");
        DungeonEditorTopologyElementRef crossingAnchor =
                new DungeonEditorTopologyElementRef("CORRIDOR_ANCHOR", crossingAnchorTopologyId);
        assertTrue(renderHasGlyphAt(binding.mapContentModel(), crossingAnchor, 6.5, 5.5, false),
                "DE-COR-004 render scene shows the reused crossing anchor marker at (6,5,0)");
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
        Point2D anchorCenter = glyphCenterForRef(binding.mapContentModel(), anchorRef);
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
        Point2D doorCenter = glyphCenterForRef(binding.mapContentModel(), doorRef);
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
        assertTrue(renderHasGlyphAt(binding.mapContentModel(), anchorRef, 6.5, 5.5, false),
                "DE-COR-007 render preserves A1 marker");

        selectMap(controls, "Corridor Door Delete Reload Hop");
        selectMap(controls, "Corridor Door Delete Map");
        assertCorridorCreatedInSnapshot(runtime.mapSurfaceModel().current(), binding.mapContentModel(), corridorId,
                expectedCells, "DE-COR-007 reload");
        assertNoCorridorDoorBinding(runtime.database().corridorStableConnectionState(mapId), corridorId, doorRef.id(),
                "DE-COR-007 reload");

        results.add("DE-COR-007 Ready: DungeonEditorControlsView Korridor -> DungeonMapView secondary D1 delete"
                + " -> SQLite branch removal -> snapshot/render");
    }

    private static void verifyCrossLevelCorridorCreatesStairThroughMapView(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();

        long mapId = createMapThroughControls(controls, runtime, "Cross Level Corridor Stair Map");
        runtime.database().seedF6MultiLevelFloors(mapId);
        long reloadHopMapId = createMapThroughControls(controls, runtime, "Cross Level Corridor Stair Reload Hop");
        runtime.database().seedGlobalStairIdentitySentinel(reloadHopMapId);
        long globalStairIdBefore = runtime.database().maxStairId();
        selectMap(controls, "Cross Level Corridor Stair Map");

        click(button(controls, "Tür"));
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();
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
        click(button(controls, "-"));
        click(button(controls, "Korridor"));
        assertEquals("CORRIDOR_CREATE", runtime.controlsModel().current().selectedTool().name(),
                "DE-STAIR-008 corridor family selects corridor-create tool");
        Point2D levelZeroDoor = boundaryMidpointNear(binding.mapContentModel(), "DOOR", 4.0, 2.5);
        fireMapMousePressed(
                mapView,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(levelZeroDoor.getX()),
                viewport.sceneToScreenY(levelZeroDoor.getY()),
                false);
        assertEquals(corridorIdsBefore, runtime.database().corridorIdsForMap(mapId),
                "DE-STAIR-008 first cross-level endpoint does not persist a partial corridor");
        click(button(controls, "+"));
        Point2D levelOneDoor = boundaryMidpointNear(binding.mapContentModel(), "DOOR", 4.0, 2.5);
        fireMapMousePressed(
                mapView,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(levelOneDoor.getX()),
                viewport.sceneToScreenY(levelOneDoor.getY()),
                false);

        long newCorridorId = singleNewCorridorId(corridorIdsBefore, runtime.database().corridorIdsForMap(mapId),
                "DE-STAIR-008");
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

        results.add("DE-STAIR-008 Ready: cross-level door corridor -> SQLite corridor-bound stair -> snapshot/render");
    }

    private static void assertCrossLevelCorridorCreatesEveryCrossedLevelExit(String scenario) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
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
        Point2D levelZeroDoor = boundaryMidpointNear(binding.mapContentModel(), "DOOR", 4.0, 2.5);
        fireMapMousePressed(mapView, MouseButton.PRIMARY,
                viewport.sceneToScreenX(levelZeroDoor.getX()), viewport.sceneToScreenY(levelZeroDoor.getY()), false);
        click(button(controls, "+"));
        click(button(controls, "+"));
        Point2D levelTwoDoor = boundaryMidpointNear(binding.mapContentModel(), "DOOR", 4.0, 2.5);
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

    private static void verifyGenericCorridorHitCreatesAnchorEndpointThroughMapView(List<String> results) {
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
                editorTopologyRef(firstCorridorAnchorHandle(runtime.mapSurfaceModel().current(), "DE-COR-010")
                        .ref().topologyRef());
        Point2D genericCorridorPoint = new Point2D(6.05, 5.05);
        Point2D doorOne = boundaryMidpointNear(binding.mapContentModel(), "DOOR", 4.0, 2.5);
        click(button(controls, "Korridor"));
        assertEquals("CORRIDOR_CREATE", runtime.controlsModel().current().selectedTool().name(),
                "DE-COR-010 corridor family selects corridor-create tool");
        assertPointerTarget(binding.mapContentModel(), genericCorridorPoint, "CELL", "DE-COR-010 corridor body");
        assertEquals("CORRIDOR", binding.mapContentModel()
                        .resolvePointerTarget(genericCorridorPoint.getX(), genericCorridorPoint.getY())
                        .elementKind(),
                "DE-COR-010 body hit resolves as a generic corridor cell instead of the anchor handle");
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();

        fireMapMousePressed(mapView, MouseButton.PRIMARY,
                viewport.sceneToScreenX(genericCorridorPoint.getX()),
                viewport.sceneToScreenY(genericCorridorPoint.getY()),
                false);
        fireMapMouse(mapView, MouseEvent.MOUSE_MOVED, MouseButton.NONE,
                viewport.sceneToScreenX(doorOne.getX()), viewport.sceneToScreenY(doorOne.getY()), false);
        assertEquals(DungeonEditorPreview.none(), runtime.mapSurfaceModel().current().preview(),
                "DE-COR-010 keeps published preview surface clear before commit");
        fireMapMousePressed(mapView, MouseButton.PRIMARY,
                viewport.sceneToScreenX(doorOne.getX()), viewport.sceneToScreenY(doorOne.getY()), false);

        long newCorridorId = singleNewCorridorId(corridorIdsBefore, runtime.database().corridorIdsForMap(mapId),
                "DE-COR-010");
        List<String> stableState = runtime.database().corridorStableConnectionState(mapId);
        assertCorridorDoorBindingCount(stableState, newCorridorId, 1, "DE-COR-010");
        assertCorridorAnchorRef(stableState, newCorridorId, anchorRef.id(), "DE-COR-010");
        assertEquals(anchorRowsBefore, runtime.database().corridorAnchorState(mapId),
                "DE-COR-010 generic body hit reuses exact A1 and creates no duplicate anchor row");
        assertCorridorCreatedInSnapshot(
                runtime.mapSurfaceModel().current(),
                binding.mapContentModel(),
                newCorridorId,
                Set.of("4,2,0", "5,2,0", "6,2,0", "6,3,0", "6,4,0", "6,5,0"),
                "DE-COR-010");
        selectMap(controls, "Corridor Generic Anchor Reload Hop");
        selectMap(controls, "Corridor Generic Anchor Map");
        assertCorridorCreatedInSnapshot(
                runtime.mapSurfaceModel().current(),
                binding.mapContentModel(),
                newCorridorId,
                Set.of("4,2,0", "5,2,0", "6,2,0", "6,3,0", "6,4,0", "6,5,0"),
                "DE-COR-010 reload");

        results.add("DE-COR-010 Ready: DungeonMapView generic corridor body hit -> reused anchor -> SQLite -> render");
    }

    private static void verifyGenericCorridorHitMaterializesAbsentAnchorEndpointThroughMapView(List<String> results) {
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
                "DE-COR-011 corridor family selects corridor-create tool");
        assertPointerTarget(binding.mapContentModel(), genericCorridorPoint, "CELL", "DE-COR-011 corridor body");
        assertEquals("CORRIDOR", binding.mapContentModel()
                        .resolvePointerTarget(genericCorridorPoint.getX(), genericCorridorPoint.getY())
                        .elementKind(),
                "DE-COR-011 body hit resolves as a generic corridor cell instead of an anchor handle");
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();

        fireMapMousePressed(mapView, MouseButton.PRIMARY,
                viewport.sceneToScreenX(genericCorridorPoint.getX()),
                viewport.sceneToScreenY(genericCorridorPoint.getY()),
                false);
        fireMapMouse(mapView, MouseEvent.MOUSE_MOVED, MouseButton.NONE,
                viewport.sceneToScreenX(doorOne.getX()), viewport.sceneToScreenY(doorOne.getY()), false);
        assertEquals(DungeonEditorPreview.none(), runtime.mapSurfaceModel().current().preview(),
                "DE-COR-011 keeps published preview surface clear before commit");
        fireMapMousePressed(mapView, MouseButton.PRIMARY,
                viewport.sceneToScreenX(doorOne.getX()), viewport.sceneToScreenY(doorOne.getY()), false);

        long newCorridorId = singleNewCorridorId(corridorIdsBefore, runtime.database().corridorIdsForMap(mapId),
                "DE-COR-011");
        List<String> anchorRowsAfter = runtime.database().corridorAnchorState(mapId);
        assertEquals(anchorRowsBefore.size() + 1L, anchorRowsAfter.size(),
                "DE-COR-011 materializes exactly one additional corridor anchor row");
        long materializedAnchorRef = singleNewAnchorTopologyId(anchorRowsBefore, anchorRowsAfter, "DE-COR-011");
        assertTrue(anchorRowsAfter.stream().anyMatch(row ->
                        row.contains("host_corridor_id=1")
                                && row.contains("cell_x=6")
                                && row.contains("cell_y=4")
                                && row.contains("cell_z=0")
                                && row.contains("topology_element_id=" + materializedAnchorRef)),
                "DE-COR-011 materialized anchor is owned by K1 at (6,4,0): " + anchorRowsAfter);
        List<String> stableState = runtime.database().corridorStableConnectionState(mapId);
        assertCorridorDoorBindingCount(stableState, newCorridorId, 1, "DE-COR-011");
        assertCorridorAnchorRef(stableState, newCorridorId, materializedAnchorRef, "DE-COR-011");
        assertCorridorCreatedInSnapshot(
                runtime.mapSurfaceModel().current(),
                binding.mapContentModel(),
                newCorridorId,
                Set.of("4,2,0", "5,2,0", "6,2,0", "6,3,0", "6,4,0"),
                "DE-COR-011");
        assertTrue(runtime.mapSurfaceModel().current().surface().map().editorHandles().stream()
                        .anyMatch(handle -> "CORRIDOR_ANCHOR".equals(handle.ref().kind().name())
                                && handle.ref().topologyRef().id() == materializedAnchorRef
                                && handle.cell().q() == 6
                                && handle.cell().r() == 4
                                && handle.cell().level() == 0),
                "DE-COR-011 published snapshot exposes the new anchor handle at (6,4,0)");
        DungeonEditorTopologyElementRef materializedAnchor =
                new DungeonEditorTopologyElementRef("CORRIDOR_ANCHOR", materializedAnchorRef);
        assertTrue(renderHasGlyphAt(binding.mapContentModel(), materializedAnchor, 6.5, 4.5, false),
                "DE-COR-011 render scene shows materialized anchor marker at (6,4,0)");
        selectMap(controls, "Corridor Absent Anchor Reload Hop");
        selectMap(controls, "Corridor Absent Anchor Map");
        assertCorridorCreatedInSnapshot(
                runtime.mapSurfaceModel().current(),
                binding.mapContentModel(),
                newCorridorId,
                Set.of("4,2,0", "5,2,0", "6,2,0", "6,3,0", "6,4,0"),
                "DE-COR-011 reload");

        results.add("DE-COR-011 Ready: DungeonMapView generic corridor body hit -> new anchor -> SQLite -> render");
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

    private static void verifyGenericRoomHitMaterializesFacingDoorThroughMapView(List<String> results) {
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
        assertPointerTarget(binding.mapContentModel(), roomInterior, "CELL", "DE-COR-009 generic room");
        assertEquals("ROOM", binding.mapContentModel()
                        .resolvePointerTarget(roomInterior.getX(), roomInterior.getY())
                        .elementKind(),
                "DE-COR-009 generic room cell hit is a room target rather than a door target");
        assertPointerTarget(binding.mapContentModel(), doorTwo, "BOUNDARY", "DE-COR-009 second door");
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();

        fireMapMousePressed(mapView, MouseButton.PRIMARY,
                viewport.sceneToScreenX(roomInterior.getX()), viewport.sceneToScreenY(roomInterior.getY()), false);
        assertTrue(runtime.controlsModel().current().statusText().contains("Start:"),
                "DE-COR-009 first generic room click arms a corridor draft");
        assertEquals(corridorIdsBefore, runtime.database().corridorIdsForMap(mapId),
                "DE-COR-009 first generic room click does not persist a partial corridor");
        fireMapMouse(mapView, MouseEvent.MOUSE_MOVED, MouseButton.NONE,
                viewport.sceneToScreenX(doorTwo.getX()), viewport.sceneToScreenY(doorTwo.getY()), false);
        fireMapMousePressed(mapView, MouseButton.PRIMARY,
                viewport.sceneToScreenX(doorTwo.getX()), viewport.sceneToScreenY(doorTwo.getY()), false);

        long newCorridorId = singleNewCorridorId(corridorIdsBefore, runtime.database().corridorIdsForMap(mapId),
                "DE-COR-009");
        List<String> doorRowsAfter = runtime.database().doorBoundaryState(mapId);
        long materializedDoorRef = singleNewDoorTopologyId(doorRowsBefore, doorRowsAfter, "DE-COR-009");
        List<String> stableState = runtime.database().corridorStableConnectionState(mapId);
        assertCorridorDoorBindingCount(stableState, newCorridorId, 2, "DE-COR-009");
        assertEquals(1L, runtime.database().countDoorBoundariesAt(mapId, 1, 0, "EAST"),
                "DE-COR-009 materializes exactly one east-facing door on R1");
        assertTrue(doorRowsAfter.stream().anyMatch(row ->
                        row.startsWith("door_edges|cluster_id=" + roomIds.clusterId() + "|")
                                && row.contains("|cell_x=1|")
                                && row.contains("|cell_y=0|")
                                && row.contains("|edge_direction=EAST|")
                                && row.contains("|edge_type=DOOR|")
                                && row.contains("|topology_element_id=" + materializedDoorRef)),
                "DE-COR-009 materialized door row is the R1 east edge: " + doorRowsAfter);
        assertTrue(stableState.stream().anyMatch(row ->
                        row.startsWith("dungeon_corridor_door_overrides|corridor_id=" + newCorridorId + "|")
                                && row.contains("|relative_cell_x=1|")
                                && row.contains("|relative_cell_y=0|")
                                && row.contains("|edge_direction=EAST|")
                                && row.contains("|topology_element_id=" + materializedDoorRef)),
                "DE-COR-009 generic room endpoint binds the materialized east-facing door edge");
        assertCorridorCreatedInSnapshot(
                runtime.mapSurfaceModel().current(),
                binding.mapContentModel(),
                newCorridorId,
                cellRect(4, 2, 7, 2, 0),
                "DE-COR-009");
        selectMap(controls, "Corridor Generic Room Door Reload Hop");
        selectMap(controls, "Corridor Generic Room Door Map");
        assertCorridorCreatedInSnapshot(
                runtime.mapSurfaceModel().current(),
                binding.mapContentModel(),
                newCorridorId,
                cellRect(4, 2, 7, 2, 0),
                "DE-COR-009 reload");

        results.add("DE-COR-009 Ready: DungeonMapView generic room hit -> facing door endpoint -> SQLite -> render");
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

    private static long createWallFixture(
            DungeonEditorControlsView controls,
            HarnessRuntime runtime,
            String mapName
    ) {
        long mapId = createMapThroughControls(controls, runtime, mapName);
        runtime.database().seedF1SingleRoom(mapId, "R1", 0, 1, 1);
        createMapThroughControls(controls, runtime, mapName + " Reload Hop");
        selectMap(controls, mapName);
        return mapId;
    }

    private static void startAndPreviewInternalWall(
            DungeonMapView mapView,
            DungeonMapContentModel.Viewport viewport
    ) {
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
    }

    private static DungeonEditorPreview.ClusterBoundariesPreview assertWallPreview(
            DungeonEditorMapSurfaceSnapshot snapshot,
            int expectedEdgeCount,
            boolean deleteMode,
            String message
    ) {
        assertTrue(snapshot.preview() instanceof DungeonEditorPreview.ClusterBoundariesPreview,
                message + " publishes a cluster-boundary wall preview");
        DungeonEditorPreview.ClusterBoundariesPreview preview =
                (DungeonEditorPreview.ClusterBoundariesPreview) snapshot.preview();
        assertEquals(expectedEdgeCount, preview.edges().size(), message + " preview edge count");
        assertEquals("WALL", preview.boundaryKind(), message + " preview boundary kind");
        assertTrue(preview.clusterId() > 0L, message + " preview has a cluster id");
        assertEquals(deleteMode, preview.deleteMode(), message + " preview delete mode");
        return preview;
    }

    private static boolean previewHasEdge(
            DungeonEditorPreview.ClusterBoundariesPreview preview,
            int fromQ,
            int fromR,
            int fromLevel,
            int toQ,
            int toR,
            int toLevel
    ) {
        DungeonCell from = new DungeonCell(fromQ, fromR, fromLevel);
        DungeonCell to = new DungeonCell(toQ, toR, toLevel);
        return preview.edges().stream().anyMatch(edge -> samePreviewEdge(edge, from, to));
    }

    private static boolean samePreviewEdge(DungeonEdgeRef edge, DungeonCell from, DungeonCell to) {
        return sameCell(edge.from(), from) && sameCell(edge.to(), to)
                || sameCell(edge.from(), to) && sameCell(edge.to(), from);
    }

    private static void assertInternalWallPublishedAndRendered(
            DungeonEditorMapSurfaceSnapshot snapshot,
            DungeonMapContentModel mapContentModel,
            String message
    ) {
        assertTrue(surfaceHasBoundaryKindAt(
                        snapshot,
                        "wall",
                        new DungeonCell(2, 1, 0),
                        new DungeonCell(2, 2, 0)),
                message + " published map includes north internal wall edge");
        assertTrue(surfaceHasBoundaryKindAt(
                        snapshot,
                        "wall",
                        new DungeonCell(2, 2, 0),
                        new DungeonCell(2, 3, 0)),
                message + " published map includes center internal wall edge");
        assertTrue(surfaceHasBoundaryKindAt(
                        snapshot,
                        "wall",
                        new DungeonCell(2, 3, 0),
                        new DungeonCell(2, 4, 0)),
                message + " published map includes south internal wall edge");
        assertTrue(renderHasBoundaryNear(mapContentModel, "WALL", 2.0, 1.5),
                message + " render-facing state includes north internal wall edge");
        assertTrue(renderHasBoundaryNear(mapContentModel, "WALL", 2.0, 2.5),
                message + " render-facing state includes center internal wall edge");
        assertTrue(renderHasBoundaryNear(mapContentModel, "WALL", 2.0, 3.5),
                message + " render-facing state includes south internal wall edge");
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

    private static void verifyToolFamilyRowThroughControlsView(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindShellHarness(runtime, 960.0, 700.0);
        DungeonEditorControlsView controls = binding.controls();

        long mapId = createMapThroughControls(controls, runtime, "Tool Family Row Map");
        selectMap(controls, "Tool Family Row Map");
        List<String> authoredStateBefore = runtime.database().authoredGeometryState(mapId);
        String selectedControlsToolBefore = runtime.controlsModel().current().selectedTool().name();
        String selectedMapToolBefore = runtime.mapSurfaceModel().current().selectedTool().name();

        List<String> familyLabels = List.of("Auswahl", "Raum", "Wand", "Tür", "Korridor", "Treppe", "Übergang");
        for (String label : List.of(
                "Raum malen",
                "Raum löschen",
                "Wand setzen",
                "Wand löschen",
                "Tür setzen",
                "Tür löschen",
                "Korridor erstellen",
                "Korridor löschen",
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

    private static long createMapThroughControls(
            DungeonEditorControlsView controls,
            HarnessRuntime runtime,
            String mapName
    ) {
        click(button(controls, "Neu"));
        textField(controls, "Dungeon-Name").setText(mapName);
        click(button(controls, "Erstellen"));
        return selectedMapId(runtime.controlsModel().current(), mapName);
    }

    private static long selectedMapId(DungeonEditorControlsSnapshot snapshot, String expectedMapName) {
        DungeonMapSummary selected = snapshot.maps().stream()
                .filter(map -> expectedMapName.equals(map.mapName()))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("Map not selected after create: " + expectedMapName));
        return selected.mapId().value();
    }

    private static void selectMap(DungeonEditorControlsView controls, String mapName) {
        selectComboItem(comboBox(controls, "Dungeon auswählen"), mapName);
    }

    private static void fireMapShortcut(DungeonMapView view, KeyCode keyCode) {
        Pane canvasLayer = mapCanvasLayer(view);
        canvasLayer.fireEvent(new KeyEvent(
                KeyEvent.KEY_PRESSED,
                keyCode.getChar(),
                keyCode.getName(),
                keyCode,
                false,
                false,
                false,
                false));
    }

    private static void fireControlsShortcut(Node focusedControl, KeyCode keyCode) {
        focusedControl.requestFocus();
        focusedControl.fireEvent(new KeyEvent(
                KeyEvent.KEY_PRESSED,
                keyCode.getChar(),
                keyCode.getName(),
                keyCode,
                false,
                false,
                false,
                false));
    }

    private static void fireMapMousePressed(
            DungeonMapView view,
            MouseButton button,
            boolean shiftDown
    ) {
        fireMapMousePressed(view, button, 80.0, 80.0, shiftDown);
    }

    private static void fireMapMousePressed(
            DungeonMapView view,
            MouseButton button,
            double canvasX,
            double canvasY,
            boolean shiftDown
    ) {
        fireMapMouse(view, MouseEvent.MOUSE_PRESSED, button, canvasX, canvasY, shiftDown);
    }

    private static void clickMap(
            DungeonMapView view,
            MouseButton button,
            double canvasX,
            double canvasY,
            boolean shiftDown
    ) {
        fireMapMouse(view, MouseEvent.MOUSE_PRESSED, button, canvasX, canvasY, shiftDown);
        fireMapMouse(view, MouseEvent.MOUSE_RELEASED, button, canvasX, canvasY, shiftDown);
    }

    private static void dragMap(
            DungeonMapView view,
            MouseButton button,
            double startX,
            double startY,
            double endX,
            double endY
    ) {
        fireMapMouse(view, MouseEvent.MOUSE_PRESSED, button, startX, startY, false);
        fireMapMouse(view, MouseEvent.MOUSE_DRAGGED, button, endX, endY, false);
        fireMapMouse(view, MouseEvent.MOUSE_RELEASED, button, endX, endY, false);
    }

    private static void fireMapMouse(
            DungeonMapView view,
            javafx.event.EventType<MouseEvent> eventType,
            MouseButton button,
            double canvasX,
            double canvasY,
            boolean shiftDown
    ) {
        Pane canvasLayer = mapCanvasLayer(view);
        MouseEvent event = new MouseEvent(
                eventType,
                canvasX,
                canvasY,
                canvasX,
                canvasY,
                button,
                1,
                shiftDown,
                false,
                false,
                false,
                button == MouseButton.PRIMARY,
                button == MouseButton.MIDDLE,
                button == MouseButton.SECONDARY,
                false,
                false,
                false,
                null);
        if (eventType == MouseEvent.MOUSE_PRESSED && canvasLayer.getOnMousePressed() != null) {
            canvasLayer.getOnMousePressed().handle(event);
        } else if (eventType == MouseEvent.MOUSE_DRAGGED && canvasLayer.getOnMouseDragged() != null) {
            canvasLayer.getOnMouseDragged().handle(event);
        } else if (eventType == MouseEvent.MOUSE_MOVED && canvasLayer.getOnMouseMoved() != null) {
            canvasLayer.getOnMouseMoved().handle(event);
        } else if (eventType == MouseEvent.MOUSE_RELEASED && canvasLayer.getOnMouseReleased() != null) {
            canvasLayer.getOnMouseReleased().handle(event);
        } else {
            canvasLayer.fireEvent(event);
        }
    }

    private static void fireMapScroll(DungeonMapView view, double canvasX, double canvasY, double deltaY) {
        Pane canvasLayer = mapCanvasLayer(view);
        Point2D screenPoint = canvasLayer.localToScreen(canvasX, canvasY);
        ScrollEvent event = new ScrollEvent(
                ScrollEvent.SCROLL,
                canvasX,
                canvasY,
                screenPoint.getX(),
                screenPoint.getY(),
                false,
                false,
                false,
                false,
                false,
                false,
                0.0,
                deltaY,
                0.0,
                deltaY,
                ScrollEvent.HorizontalTextScrollUnits.NONE,
                0.0,
                ScrollEvent.VerticalTextScrollUnits.NONE,
                0.0,
                0,
                null);
        canvasLayer.getOnScroll().handle(event);
    }

    private static Pane mapCanvasLayer(DungeonMapView view) {
        return descendants(view).stream()
                .filter(Pane.class::isInstance)
                .map(Pane.class::cast)
                .filter(Pane::isFocusTraversable)
                .filter(pane -> "Dungeon map".equals(pane.getAccessibleText()))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("Dungeon map canvas layer not found."));
    }

    private static boolean popupButtonVisible(String text) {
        return popupDescendants().stream()
                .filter(ButtonBase.class::isInstance)
                .map(ButtonBase.class::cast)
                .anyMatch(button -> text.equals(button.getText()) && button.isVisible());
    }

    private static ButtonBase popupButton(String text) {
        return popupDescendants().stream()
                .filter(ButtonBase.class::isInstance)
                .map(ButtonBase.class::cast)
                .filter(button -> text.equals(button.getText()) && button.isVisible())
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("Popup button not found: " + text));
    }

    private static Parent popupContainer() {
        return popupDescendants().stream()
                .filter(Parent.class::isInstance)
                .map(Parent.class::cast)
                .filter(parent -> parent.getStyleClass().contains("dungeon-editor-popup"))
                .filter(Node::isVisible)
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("Dungeon Editor popup container not found."));
    }

    private static boolean popupContainerVisible() {
        return popupDescendants().stream()
                .filter(Parent.class::isInstance)
                .map(Parent.class::cast)
                .anyMatch(parent -> parent.getStyleClass().contains("dungeon-editor-popup") && parent.isVisible());
    }

    private static void assertPopupOptionSelected(String text, String message) {
        ButtonBase button = popupButton(text);
        assertTrue(button.getStyleClass().contains("selected"), message + " style");
        assertTrue(button.getAccessibleText().contains("aktiv"), message + " accessibility state");
    }

    private static void assertPopupAnchoredBelow(Node anchor, Node popup, String message) {
        Bounds anchorBounds = screenBounds(anchor);
        Bounds popupBounds = screenBounds(popup);
        assertTrue(popupBounds.getMinY() >= anchorBounds.getMaxY() - 1.0,
                message + " popup opens below the focused family button");
        assertTrue(popupBounds.getMaxX() >= anchorBounds.getMinX()
                        && popupBounds.getMinX() <= anchorBounds.getMaxX(),
                message + " popup horizontally overlaps the focused family button");
    }

    private static void firePopupMouseExited(Parent popup) {
        Bounds popupBounds = screenBounds(popup);
        popup.fireEvent(new MouseEvent(
                MouseEvent.MOUSE_EXITED,
                1.0,
                1.0,
                popupBounds.getMaxX() + 1.0,
                popupBounds.getMaxY() + 1.0,
                MouseButton.NONE,
                0,
                false,
                false,
                false,
                false,
                false,
                false,
                false,
                false,
                false,
                false,
                null));
    }

    private static void firePopupShortcut(Parent popup, KeyCode keyCode) {
        popup.fireEvent(new KeyEvent(
                KeyEvent.KEY_PRESSED,
                keyCode.getChar(),
                keyCode.getName(),
                keyCode,
                false,
                false,
                false,
                false));
    }

    private static Bounds screenBounds(Node node) {
        Bounds bounds = node.localToScreen(node.getLayoutBounds());
        if (bounds == null) {
            throw new IllegalStateException("Node has no screen bounds: " + node);
        }
        return bounds;
    }

    private static List<Node> popupDescendants() {
        List<Node> nodes = new ArrayList<>();
        for (Window window : Window.getWindows()) {
            if (window.isShowing() && window.getScene() != null && window.getScene().getRoot() != null) {
                nodes.addAll(descendants(window.getScene().getRoot()));
            }
        }
        return nodes;
    }

    private static boolean surfaceContainsLevel(DungeonEditorMapSurfaceSnapshot snapshot, int level) {
        return snapshot.surface() != null
                && snapshot.surface().map().areas().stream()
                        .flatMap(area -> area.cells().stream())
                        .anyMatch(cell -> cell.level() == level);
    }

    private static Set<String> surfaceCellSet(DungeonEditorMapSurfaceSnapshot snapshot) {
        Set<String> cells = new LinkedHashSet<>();
        if (snapshot.surface() == null) {
            return cells;
        }
        mapSnapshotCellSet(snapshot.surface().map()).forEach(cells::add);
        return cells;
    }

    private static Set<String> mapSnapshotCellSet(
            src.domain.dungeon.published.DungeonEditorMapSnapshot mapSnapshot
    ) {
        Set<String> cells = new LinkedHashSet<>();
        if (mapSnapshot == null) {
            return cells;
        }
        mapSnapshot.areas().stream()
                .flatMap(area -> area.cells().stream())
                .map(cell -> cell.q() + "," + cell.r() + "," + cell.level())
                .forEach(cells::add);
        return cells;
    }

    private static Set<String> areaCellSet(src.domain.dungeon.published.DungeonEditorMapSnapshot.Area area) {
        Set<String> cells = new LinkedHashSet<>();
        area.cells().stream()
                .map(cell -> cell.q() + "," + cell.r() + "," + cell.level())
                .forEach(cells::add);
        return cells;
    }

    private static src.domain.dungeon.published.DungeonEditorMapSnapshot.Area corridorAreaById(
            DungeonEditorMapSurfaceSnapshot snapshot,
            long corridorId,
            String message
    ) {
        return snapshot.surface().map().areas().stream()
                .filter(area -> "CORRIDOR".equalsIgnoreCase(area.kind()))
                .filter(area -> area.id() == corridorId)
                .findFirst()
                .orElseThrow(() -> new AssertionError(message + " corridor area not published: " + corridorId));
    }

    private static long singleNewCorridorId(Set<Long> before, Set<Long> after, String message) {
        Set<Long> newIds = new LinkedHashSet<>(after);
        newIds.removeAll(before);
        assertEquals(1L, newIds.size(), message + " creates exactly one corridor row");
        return newIds.iterator().next();
    }

    private static long singleNewStairId(List<String> before, List<String> after, String message) {
        Set<Long> newIds = stairIds(after);
        newIds.removeAll(stairIds(before));
        assertEquals(1L, newIds.size(), message + " creates exactly one stair row");
        return newIds.iterator().next();
    }

    private static Set<Long> stairIds(List<String> rows) {
        Set<Long> result = new LinkedHashSet<>();
        for (String row : rows == null ? List.<String>of() : rows) {
            if (!row.startsWith("dungeon_stairs|")) {
                continue;
            }
            result.add(Long.parseLong(row.substring("dungeon_stairs|stair_id=".length()).split("[|]")[0]));
        }
        return result;
    }

    private static Set<String> stairPathCells(List<String> rows, long stairId) {
        Set<String> result = new LinkedHashSet<>();
        for (String row : rows == null ? List.<String>of() : rows) {
            if (row.startsWith("dungeon_stair_path_nodes|stair_id=" + stairId + "|")) {
                result.add(rowCell(row));
            }
        }
        return result;
    }

    private static void assertUniqueStairPathCells(List<String> rows, long stairId, String message) {
        List<String> cells = new ArrayList<>();
        for (String row : rows == null ? List.<String>of() : rows) {
            if (row.startsWith("dungeon_stair_path_nodes|stair_id=" + stairId + "|")) {
                cells.add(rowCell(row));
            }
        }
        assertEquals(cells.size(), new LinkedHashSet<>(cells).size(), message + ": " + cells);
    }

    private static Set<String> stairExitCells(List<String> rows, long stairId) {
        Set<String> result = new LinkedHashSet<>();
        for (String row : rows == null ? List.<String>of() : rows) {
            if (row.startsWith("dungeon_stair_exits|stair_exit_id=")
                    && row.contains("|stair_id=" + stairId + "|")) {
                result.add(rowCell(row));
            }
        }
        return result;
    }

    private static String rowCell(String row) {
        return rowInt(row, "cell_x=") + "," + rowInt(row, "cell_y=") + "," + rowInt(row, "cell_z=");
    }

    private static int rowInt(String row, String marker) {
        int start = row.indexOf(marker);
        if (start < 0) {
            throw new AssertionError("Missing " + marker + " in row: " + row);
        }
        return Integer.parseInt(row.substring(start + marker.length()).split("[|]")[0]);
    }

    private static long singleNewAnchorTopologyId(List<String> before, List<String> after, String message) {
        Set<Long> oldIds = topologyIds(before);
        Set<Long> newIds = topologyIds(after);
        newIds.removeAll(oldIds);
        assertEquals(1L, newIds.size(), message + " materializes exactly one anchor topology ref");
        return newIds.iterator().next();
    }

    private static long singleAnchorTopologyIdAt(
            List<String> anchorRows,
            int cellX,
            int cellY,
            int cellZ,
            String message
    ) {
        Set<Long> matches = new LinkedHashSet<>();
        for (String row : anchorRows) {
            if (row.contains("|cell_x=" + cellX)
                    && row.contains("|cell_y=" + cellY)
                    && row.contains("|cell_z=" + cellZ)) {
                matches.addAll(topologyIds(List.of(row)));
            }
        }
        assertEquals(1L, matches.size(), message + " fixture has exactly one anchor at split cell");
        return matches.iterator().next();
    }

    private static long singleNewDoorTopologyId(List<String> before, List<String> after, String message) {
        Set<Long> oldIds = topologyIds(before);
        Set<Long> newIds = topologyIds(after);
        newIds.removeAll(oldIds);
        assertEquals(1L, newIds.size(), message + " materializes exactly one door topology ref");
        return newIds.iterator().next();
    }

    private static Set<Long> topologyIds(List<String> rows) {
        Set<Long> result = new LinkedHashSet<>();
        for (String row : rows == null ? List.<String>of() : rows) {
            String marker = "topology_element_id=";
            int start = row.indexOf(marker);
            if (start >= 0) {
                result.add(Long.parseLong(row.substring(start + marker.length()).split("[,|]")[0]));
            }
        }
        return result;
    }

    private static void assertCorridorCreatedInSnapshot(
            DungeonEditorMapSurfaceSnapshot snapshot,
            DungeonMapContentModel mapContentModel,
            long corridorId,
            Set<String> expectedCells,
            String message
    ) {
        var corridorArea = corridorAreaById(snapshot, corridorId, message);
        assertEquals(expectedCells, areaCellSet(corridorArea), message + " published corridor route cells");
        assertEquals(DungeonEditorPreview.none(), snapshot.preview(), message + " preview clears after commit");
        assertTrue(renderSurfaceCellOriginsWithZ(mapContentModel).containsAll(expectedCells),
                message + " render scene contains committed corridor cells");
    }

    private static void assertCorridorDoorBindingCount(
            List<String> stableState,
            long corridorId,
            long expectedCount,
            String message
    ) {
        long actual = stableState.stream()
                .filter(row -> row.startsWith("dungeon_corridor_door_overrides|corridor_id=" + corridorId + "|"))
                .count();
        assertEquals(expectedCount, actual, message + " persisted door endpoint binding count");
    }

    private static void assertCorridorAnchorRef(
            List<String> stableState,
            long corridorId,
            long topologyElementId,
            String message
    ) {
        boolean found = stableState.stream().anyMatch(row ->
                row.startsWith("dungeon_corridor_anchor_refs|corridor_id=" + corridorId + "|")
                        && row.contains("|topology_element_id=" + topologyElementId));
        assertTrue(found, message + " persisted anchor endpoint ref " + topologyElementId);
    }

    private static void assertNoCorridorAnchorRef(
            List<String> stableState,
            long corridorId,
            long topologyElementId,
            String message
    ) {
        boolean found = stableState.stream().anyMatch(row ->
                row.startsWith("dungeon_corridor_anchor_refs|corridor_id=" + corridorId + "|")
                        && row.contains("|topology_element_id=" + topologyElementId));
        assertTrue(!found, message + " removes anchor endpoint ref " + topologyElementId);
    }

    private static void assertNoCorridorDoorBinding(
            List<String> stableState,
            long corridorId,
            long topologyElementId,
            String message
    ) {
        boolean found = stableState.stream().anyMatch(row ->
                row.startsWith("dungeon_corridor_door_overrides|corridor_id=" + corridorId + "|")
                        && row.contains("|topology_element_id=" + topologyElementId));
        assertTrue(!found, message + " removes door endpoint binding " + topologyElementId);
    }

    private static void assertNoCorridorWaypoints(
            List<String> waypointState,
            long corridorId,
            String message
    ) {
        boolean found = waypointState.stream()
                .anyMatch(row -> row.startsWith("dungeon_corridor_waypoints|corridor_id=" + corridorId + "|"));
        assertTrue(!found, message + " removes corridor waypoint rows");
    }

    private static void assertOnlyCorridorWaypointAt(
            List<String> waypointState,
            long corridorId,
            int cellX,
            int cellY,
            int cellZ,
            String message
    ) {
        long corridorRows = waypointState.stream()
                .filter(row -> row.startsWith("dungeon_corridor_waypoints|corridor_id=" + corridorId + "|"))
                .count();
        long matchingRows = waypointState.stream()
                .filter(row -> row.startsWith("dungeon_corridor_waypoints|corridor_id=" + corridorId + "|"))
                .filter(row -> row.contains("|cell_x=" + cellX))
                .filter(row -> row.contains("|cell_y=" + cellY))
                .filter(row -> row.contains("|cell_z=" + cellZ))
                .count();
        assertEquals(1L, corridorRows, message + " persists exactly one split waypoint row");
        assertEquals(1L, matchingRows, message + " persists exactly one split waypoint at the crossing cell");
    }

    private static void assertCorridorAnchorHandleAt(
            DungeonEditorMapSurfaceSnapshot snapshot,
            int cellX,
            int cellY,
            int cellZ,
            String message
    ) {
        assertTrue(snapshot.surface().map().editorHandles().stream()
                        .anyMatch(handle -> "CORRIDOR_ANCHOR".equals(handle.ref().kind().name())
                                && handle.cell().q() == cellX
                                && handle.cell().r() == cellY
                                && handle.cell().level() == cellZ),
                message + " published snapshot exposes the reused crossing anchor handle");
    }

    private static void assertOnlyCorridorWaypointHandleAt(
            DungeonEditorMapSurfaceSnapshot snapshot,
            long corridorId,
            int cellX,
            int cellY,
            int cellZ,
            String message
    ) {
        long waypointHandles = snapshot.surface().map().editorHandles().stream()
                .filter(handle -> "CORRIDOR_WAYPOINT".equals(handle.ref().kind().name()))
                .filter(handle -> handle.ref().corridorId() == corridorId)
                .count();
        long matchingHandles = snapshot.surface().map().editorHandles().stream()
                .filter(handle -> "CORRIDOR_WAYPOINT".equals(handle.ref().kind().name()))
                .filter(handle -> handle.ref().corridorId() == corridorId)
                .filter(handle -> handle.cell().q() == cellX)
                .filter(handle -> handle.cell().r() == cellY)
                .filter(handle -> handle.cell().level() == cellZ)
                .count();
        assertEquals(1L, waypointHandles, message + " published snapshot exposes exactly one split waypoint handle");
        assertEquals(1L, matchingHandles,
                message + " published snapshot exposes the split waypoint handle");
    }

    private static void assertCrossLevelStairInSnapshot(
            DungeonEditorMapSurfaceSnapshot snapshot,
            long stairId,
            String message
    ) {
        DungeonEditorTopologyElementRef ref = new DungeonEditorTopologyElementRef("STAIR", stairId);
        assertTrue(snapshot.surface().map().features().stream()
                        .filter(feature -> "STAIR".equals(feature.kind()))
                        .filter(feature -> feature.id() == stairId)
                        .filter(feature -> feature.topologyRef().equals(ref))
                        .filter(feature -> feature.cells().stream()
                                .map(cell -> cell.q() + "," + cell.r() + "," + cell.level())
                                .collect(java.util.stream.Collectors.toSet())
                                .containsAll(Set.of("4,2,0", "4,2,1")))
                        .anyMatch(feature -> feature.description().contains("2 Ausgaenge")),
                message + " published feature exposes bound stair exits");
    }

    private static void assertStairMovedInSnapshot(
            DungeonEditorMapSurfaceSnapshot snapshot,
            DungeonMapContentModel mapContentModel,
            DungeonTopologyElementRef ref,
            String message
    ) {
        assertTrue(snapshot.surface().map().features().stream()
                        .filter(feature -> "STAIR".equals(feature.kind()))
                        .filter(feature -> feature.topologyRef().equals(editorTopologyRef(ref)))
                        .anyMatch(feature -> feature.cells().stream()
                                .anyMatch(cell -> cell.q() == 3 && cell.r() == 2 && cell.level() == 0)),
                message + " published stair feature includes moved path node");
        assertTrue(snapshot.surface().map().features().stream()
                        .filter(feature -> "STAIR".equals(feature.kind()))
                        .filter(feature -> feature.topologyRef().equals(editorTopologyRef(ref)))
                        .anyMatch(feature -> feature.cells().stream()
                                .anyMatch(cell -> cell.q() == 2 && cell.r() == 2 && cell.level() == 0)),
                message + " published stair feature keeps lower exit cell");
        assertTrue(snapshot.surface().map().editorHandles().stream()
                        .anyMatch(handle -> handle.ref().topologyRef().equals(ref)
                                && handle.ref().kind().name().equals("STAIR_ANCHOR")
                                && handle.cell().q() == 3
                                && handle.cell().r() == 2
                                && handle.cell().level() == 0),
                message + " published handle readback moves the first stair path handle to (3,2,0)");
        assertTrue(renderSurfaceCellOriginsWithZ(mapContentModel).contains("3,2,0"),
                message + " render scene contains moved stair path cell");
        assertTrue(renderHasGlyphAt(mapContentModel, editorTopologyRef(ref), 3.5, 2.5, false),
                message + " render scene shows committed stair handle at (3,2,0)");
    }

    private static void assertStraightStairCreatedInSnapshot(
            DungeonEditorMapSurfaceSnapshot snapshot,
            DungeonMapContentModel mapContentModel,
            long stairId,
            int anchorQ,
            int anchorR,
            String message
    ) {
        DungeonEditorTopologyElementRef ref = new DungeonEditorTopologyElementRef("STAIR", stairId);
        int upperR = anchorR - 2;
        Set<String> expectedFeatureCells = Set.of(
                anchorQ + "," + anchorR + ",0",
                anchorQ + "," + (anchorR - 1) + ",0",
                anchorQ + "," + upperR + ",0",
                anchorQ + "," + upperR + ",1");
        assertTrue(snapshot.surface().map().features().stream()
                        .filter(feature -> "STAIR".equals(feature.kind()))
                        .filter(feature -> feature.id() == stairId)
                        .filter(feature -> feature.topologyRef().equals(ref))
                        .anyMatch(feature -> feature.cells().stream()
                                .map(cell -> cell.q() + "," + cell.r() + "," + cell.level())
                                .collect(java.util.stream.Collectors.toSet())
                                .containsAll(expectedFeatureCells)),
                message + " published stair feature exposes generated path and exits: "
                        + snapshot.surface().map().features());
        assertTrue(snapshot.surface().map().editorHandles().stream()
                        .anyMatch(handle -> "STAIR".equals(handle.ref().topologyRef().kind().name())
                                && handle.ref().topologyRef().id() == stairId
                                && "STAIR_ANCHOR".equals(handle.ref().kind().name())
                                && handle.cell().q() == anchorQ
                                && handle.cell().r() == anchorR
                                && handle.cell().level() == 0),
                message + " published snapshot exposes lower stair handle");
        assertTrue(snapshot.surface().map().editorHandles().stream()
                        .anyMatch(handle -> "STAIR".equals(handle.ref().topologyRef().kind().name())
                                && handle.ref().topologyRef().id() == stairId
                                && "STAIR_ANCHOR".equals(handle.ref().kind().name())
                                && handle.cell().q() == anchorQ
                                && handle.cell().r() == upperR
                                && handle.cell().level() == 1),
                message + " published snapshot exposes generated upper exit handle");
        assertTrue(renderSurfaceCellOriginsWithZ(mapContentModel).containsAll(
                        Set.of(
                                anchorQ + "," + anchorR + ",0",
                                anchorQ + "," + (anchorR - 1) + ",0",
                                anchorQ + "," + upperR + ",0")),
                message + " render scene contains active-level straight stair path");
        assertTrue(renderHasGlyphAt(mapContentModel, ref, anchorQ + 0.5, anchorR + 0.5, false),
                message + " render scene shows committed lower stair handle");
        assertTrue(renderHasGlyphAt(mapContentModel, ref, anchorQ + 0.5, upperR + 0.5, false),
                message + " render scene shows committed upper stair exit handle");
    }

    private static void assertTransitionCreatedInSnapshot(
            DungeonEditorMapSurfaceSnapshot snapshot,
            DungeonMapContentModel mapContentModel,
            long transitionId,
            int q,
            int r,
            int level,
            double renderX,
            double renderY,
            String destinationLabel,
            String message
    ) {
        DungeonEditorTopologyElementRef ref = new DungeonEditorTopologyElementRef("TRANSITION", transitionId);
        assertTrue(snapshot.surface().map().features().stream()
                        .filter(feature -> "TRANSITION".equals(feature.kind()))
                        .filter(feature -> feature.id() == transitionId)
                        .filter(feature -> feature.topologyRef().equals(ref))
                        .anyMatch(feature -> feature.cells().stream()
                                .anyMatch(cell -> cell.q() == q && cell.r() == r && cell.level() == level)
                                && destinationLabel.equals(feature.destinationLabel())),
                message + " published transition feature exposes cell and destination label: "
                        + snapshot.surface().map().features());
        assertTrue(renderHasGlyphAt(mapContentModel, ref, renderX, renderY, false),
                message + " render scene shows committed transition marker");
    }

    private static void assertTransitionRowContains(
            List<String> rows,
            long transitionId,
            List<String> fragments,
            String message
    ) {
        boolean matches = rows.stream().anyMatch(row ->
                row.contains("transition_id=" + transitionId) && fragments.stream().allMatch(row::contains));
        assertTrue(matches, message + " rows=" + rows);
    }

    private static src.domain.dungeon.published.DungeonEditorHandleSnapshot firstStairHandle(
            DungeonEditorMapSurfaceSnapshot snapshot,
            String message
    ) {
        return snapshot.surface().map().editorHandles().stream()
                .filter(handle -> "STAIR_ANCHOR".equals(handle.ref().kind().name()))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException(message + " stair handle not loaded."));
    }

    private static void assertStairAbsentFromSnapshotAndRender(
            DungeonEditorMapSurfaceSnapshot snapshot,
            DungeonMapContentModel mapContentModel,
            DungeonEditorTopologyElementRef ref,
            Point2D formerCenter,
            String message
    ) {
        assertTrue(snapshot.surface().map().features().stream().noneMatch(feature ->
                        feature.id() == ref.id() && "STAIR".equals(feature.kind())),
                message + " published feature list omits deleted stair");
        assertTrue(snapshot.surface().map().editorHandles().stream().noneMatch(handle ->
                        handle.ref().topologyRef().id() == ref.id()
                                && "STAIR".equals(handle.ref().topologyRef().kind().name())),
                message + " published handle list omits deleted stair handles");
        String selectionRef = ref.kind() + ":" + ref.id();
        assertTrue(mapContentModel.canvasStateProperty().get().renderScene().surfaces().stream()
                        .noneMatch(surface -> selectionRef.equals(surface.selectionRef())),
                message + " render scene omits deleted stair path and exit surfaces");
        assertTrue(!renderHasGlyphAt(mapContentModel, ref, formerCenter.getX(), formerCenter.getY(), false),
                message + " render scene omits deleted stair marker");
    }

    private static src.domain.dungeon.published.DungeonEditorHandleSnapshot firstCorridorAnchorHandle(
            DungeonEditorMapSurfaceSnapshot snapshot,
            String message
    ) {
        return snapshot.surface().map().editorHandles().stream()
                .filter(handle -> "CORRIDOR_ANCHOR".equals(handle.ref().kind().name()))
                .findFirst()
                .orElseThrow(() -> new AssertionError(message + " corridor anchor handle not published"));
    }

    private static src.domain.dungeon.published.DungeonEditorHandleSnapshot firstDoorHandleAt(
            DungeonEditorMapSurfaceSnapshot snapshot,
            int cellX,
            int cellY,
            int cellZ,
            String message
    ) {
        return snapshot.surface().map().editorHandles().stream()
                .filter(handle -> "DOOR".equals(handle.ref().kind().name()))
                .filter(handle -> handle.cell().q() == cellX)
                .filter(handle -> handle.cell().r() == cellY)
                .filter(handle -> handle.cell().level() == cellZ)
                .findFirst()
                .orElseThrow(() -> new AssertionError(message + " door handle not published"));
    }

    private static src.domain.dungeon.published.DungeonEditorHandleSnapshot firstClusterCornerHandleAt(
            DungeonEditorMapSurfaceSnapshot snapshot,
            int cellX,
            int cellY,
            int cellZ,
            String message
    ) {
        return snapshot.surface().map().editorHandles().stream()
                .filter(handle -> "CLUSTER_CORNER".equals(handle.ref().kind().name()))
                .filter(handle -> handle.cell().q() == cellX)
                .filter(handle -> handle.cell().r() == cellY)
                .filter(handle -> handle.cell().level() == cellZ)
                .findFirst()
                .orElseThrow(() -> new AssertionError(message + " cluster corner handle not published"));
    }

    private static void assertClusterCornerHandleAt(
            DungeonEditorMapSurfaceSnapshot snapshot,
            int cellX,
            int cellY,
            int cellZ,
            String message
    ) {
        firstClusterCornerHandleAt(snapshot, cellX, cellY, cellZ, message);
    }

    private static List<DungeonEditorTopologyElementRef> corridorAnchorRefs(DungeonEditorMapSurfaceSnapshot snapshot) {
        return snapshot.surface().map().editorHandles().stream()
                .filter(handle -> "CORRIDOR_ANCHOR".equals(handle.ref().kind().name()))
                .map(handle -> editorTopologyRef(handle.ref().topologyRef()))
                .sorted((left, right) -> Long.compare(left.id(), right.id()))
                .toList();
    }

    private static void assertPointerTarget(
            DungeonMapContentModel mapContentModel,
            Point2D scenePoint,
            String expectedKind,
            String message
    ) {
        assertEquals(expectedKind,
                mapContentModel.resolvePointerTarget(scenePoint.getX(), scenePoint.getY()).targetKind().name(),
                message + " input route resolves expected map hit target");
    }

    private static Set<String> persistedClusterCellsThroughRepository(long mapId, long clusterId, int level) {
        DungeonMap dungeonMap = new SqliteDungeonMapRepository()
                .findById(new DungeonMapIdentity(mapId))
                .orElseThrow(() -> new AssertionError("Map not found during persisted room readback: " + mapId));
        DungeonRoomCluster cluster = dungeonMap.topology().roomClusters().stream()
                .filter(candidate -> candidate.clusterId() == clusterId)
                .findFirst()
                .orElseThrow(() -> new AssertionError("Cluster not found during persisted room readback: "
                        + clusterId));
        var rooms = dungeonMap.rooms().rooms().stream()
                .filter(room -> room.clusterId() == clusterId)
                .toList();
        Set<String> cells = new LinkedHashSet<>();
        new DungeonRoomCellProjection().clusterCells(cluster, rooms, level).stream()
                .map(DungeonEditorToolBehaviorHarness::cellKey)
                .forEach(cells::add);
        return cells;
    }

    private static src.domain.dungeon.published.DungeonEditorMapSnapshot.Area roomAreaByLabel(
            DungeonEditorMapSurfaceSnapshot snapshot,
            String label,
            String message
    ) {
        return snapshot.surface().map().areas().stream()
                .filter(area -> "ROOM".equalsIgnoreCase(area.kind()))
                .filter(area -> label.equals(area.label()))
                .findFirst()
                .orElseThrow(() -> new AssertionError(message + " room area not published"));
    }

    private static src.domain.dungeon.published.DungeonEditorMapSnapshot.Area roomAreaByCells(
            DungeonEditorMapSurfaceSnapshot snapshot,
            Set<String> expectedCells,
            String message
    ) {
        return snapshot.surface().map().areas().stream()
                .filter(area -> "ROOM".equalsIgnoreCase(area.kind()))
                .filter(area -> areaCellSet(area).equals(expectedCells))
                .findFirst()
                .orElseThrow(() -> new AssertionError(message + " room area not published"));
    }

    private static void assertNoOverlappingSurfaceCellOwnership(
            DungeonEditorMapSurfaceSnapshot snapshot,
            String message
    ) {
        Set<String> seenCells = new LinkedHashSet<>();
        for (var area : snapshot.surface().map().areas()) {
            for (var cell : area.cells()) {
                String key = cell.q() + "," + cell.r() + "," + cell.level();
                assertTrue(seenCells.add(key), message + " overlapping cell ownership at " + key);
            }
        }
    }

    private static void assertDisjoint(Set<String> actual, Set<String> forbidden, String message) {
        Set<String> overlap = new LinkedHashSet<>(actual);
        overlap.retainAll(forbidden);
        assertTrue(overlap.isEmpty(), message + " overlap=" + overlap);
    }

    private static Set<String> renderSurfaceCellOrigins(DungeonMapContentModel mapContentModel) {
        Set<String> cells = new LinkedHashSet<>();
        mapContentModel.canvasStateProperty().get().renderScene().surfaces().stream()
                .map(surface -> surface.polygon().stream()
                        .reduce((first, ignored) -> first)
                        .orElseThrow())
                .map(point -> ((int) point.x()) + "," + ((int) point.y()))
                .forEach(cells::add);
        return cells;
    }

    private static Set<String> renderSurfaceCellOriginsWithZ(DungeonMapContentModel mapContentModel) {
        Set<String> cells = new LinkedHashSet<>();
        mapContentModel.canvasStateProperty().get().renderScene().surfaces().stream()
                .map(surface -> surface.polygon().stream()
                        .reduce((first, ignored) -> first)
                        .map(point -> ((int) point.x()) + "," + ((int) point.y()) + "," + surface.z())
                        .orElseThrow())
                .forEach(cells::add);
        return cells;
    }

    private static Set<String> renderPreviewSurfaceCellOriginsWithZ(DungeonMapContentModel mapContentModel) {
        Set<String> cells = new LinkedHashSet<>();
        mapContentModel.canvasStateProperty().get().renderScene().surfaces().stream()
                .filter(surface -> surface.style().alpha() < 1.0)
                .map(surface -> surface.polygon().stream()
                        .reduce((first, ignored) -> first)
                        .map(point -> ((int) point.x()) + "," + ((int) point.y()) + "," + surface.z())
                        .orElseThrow())
                .forEach(cells::add);
        return cells;
    }

    private static String renderSelectionRefAtCell(
            DungeonMapContentModel mapContentModel,
            int q,
            int r,
            int level
    ) {
        return mapContentModel.canvasStateProperty().get().renderScene().surfaces().stream()
                .filter(surface -> surface.z() == level)
                .filter(surface -> surface.polygon().stream()
                        .findFirst()
                        .map(point -> ((int) point.x()) == q && ((int) point.y()) == r)
                        .orElse(false))
                .map(DungeonMapContentModel.MapCanvasPolygonPrimitive::selectionRef)
                .filter(selectionRef -> !selectionRef.isBlank())
                .findFirst()
                .orElseThrow(() -> new AssertionError("Render surface not found at " + q + "," + r + "," + level));
    }

    private static boolean renderHasSelectedSurfacePrimitive(
            DungeonMapContentModel mapContentModel,
            DungeonEditorTopologyElementRef ref
    ) {
        String selectionRef = ref.kind() + ":" + ref.id();
        return mapContentModel.canvasStateProperty().get().renderScene().surfaces().stream()
                .anyMatch(surface -> selectionRef.equals(surface.selectionRef())
                        && surface.style().strokeWidth() > (2.0 / DEFAULT_GRID_SIZE));
    }

    private static boolean renderHasSelectedGlyphPrimitive(
            DungeonMapContentModel mapContentModel,
            DungeonEditorTopologyElementRef ref
    ) {
        String selectionRef = ref.kind() + ":" + ref.id();
        return mapContentModel.canvasStateProperty().get().renderScene().glyphs().stream()
                .anyMatch(glyph -> selectionRef.equals(glyph.selectionRef())
                        && glyph.style().strokeWidth() > (1.4 / DEFAULT_GRID_SIZE));
    }

    private static Point2D glyphCenterForRef(
            DungeonMapContentModel mapContentModel,
            DungeonEditorTopologyElementRef ref
    ) {
        String selectionRef = ref.kind() + ":" + ref.id();
        return mapContentModel.canvasStateProperty().get().renderScene().glyphs().stream()
                .filter(glyph -> selectionRef.equals(glyph.selectionRef()))
                .map(glyph -> {
                    double x = glyph.polygon().stream().mapToDouble(DungeonMapContentModel.MapCanvasPoint::x).average()
                            .orElseThrow();
                    double y = glyph.polygon().stream().mapToDouble(DungeonMapContentModel.MapCanvasPoint::y).average()
                            .orElseThrow();
                    return new Point2D(x, y);
                })
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("Glyph not found for " + selectionRef));
    }

    private static Point2D labelCenterForRef(
            DungeonMapContentModel mapContentModel,
            DungeonEditorTopologyElementRef ref
    ) {
        String selectionRef = ref.kind() + ":" + ref.id();
        return mapContentModel.canvasStateProperty().get().renderScene().texts().stream()
                .filter(text -> selectionRef.equals(text.selectionRef()))
                .map(text -> new Point2D(text.centerX(), text.centerY()))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("Label not found for " + selectionRef));
    }

    private static boolean renderHasTextAt(
            DungeonMapContentModel mapContentModel,
            DungeonEditorTopologyElementRef ref,
            double expectedX,
            double expectedY,
            boolean preview
    ) {
        String selectionRef = ref.kind() + ":" + ref.id();
        return mapContentModel.canvasStateProperty().get().renderScene().texts().stream()
                .filter(text -> selectionRef.equals(text.selectionRef()))
                .filter(text -> preview ? text.style().alpha() < 1.0 : text.style().alpha() == 1.0)
                .map(text -> new Point2D(text.centerX(), text.centerY()))
                .anyMatch(point -> point.distance(expectedX, expectedY) < 0.000_001);
    }

    private static boolean renderHasGlyphAt(
            DungeonMapContentModel mapContentModel,
            DungeonEditorTopologyElementRef ref,
            double expectedX,
            double expectedY,
            boolean preview
    ) {
        String selectionRef = ref.kind() + ":" + ref.id();
        return mapContentModel.canvasStateProperty().get().renderScene().glyphs().stream()
                .filter(glyph -> selectionRef.equals(glyph.selectionRef()))
                .filter(glyph -> preview ? glyph.style().alpha() < 1.0 : glyph.style().alpha() == 1.0)
                .map(glyph -> {
                    double x = glyph.polygon().stream().mapToDouble(DungeonMapContentModel.MapCanvasPoint::x).average()
                            .orElseThrow();
                    double y = glyph.polygon().stream().mapToDouble(DungeonMapContentModel.MapCanvasPoint::y).average()
                            .orElseThrow();
                    return new Point2D(x, y);
                })
                .anyMatch(point -> point.distance(expectedX, expectedY) < 0.000_001);
    }

    private static DungeonEditorTopologyElementRef editorTopologyRef(DungeonTopologyElementRef ref) {
        return new DungeonEditorTopologyElementRef(ref.kind().name(), ref.id());
    }

    private static boolean renderHasBoundaryPrimitive(
            DungeonMapContentModel mapContentModel,
            DungeonEditorTopologyElementRef ref
    ) {
        String selectionRef = ref.kind() + ":" + ref.id();
        return mapContentModel.canvasStateProperty().get().renderScene().boundaries().stream()
                .anyMatch(boundary -> selectionRef.equals(boundary.selectionRef()));
    }

    private static boolean renderHasSelectedDoorBoundaryPrimitive(
            DungeonMapContentModel mapContentModel,
            DungeonEditorTopologyElementRef ref
    ) {
        String selectionRef = ref.kind() + ":" + ref.id();
        return mapContentModel.canvasStateProperty().get().renderScene().boundaries().stream()
                .anyMatch(boundary -> selectionRef.equals(boundary.selectionRef())
                        && boundary.style().stroke().equals(DungeonMapContentModel.RenderColor.color(0xf1, 0xd3, 0x8a, 1.0))
                        && boundary.style().strokeWidth() > (3.6 / DEFAULT_GRID_SIZE));
    }

    private static boolean selectedDoorBoundaryDiffersFromNormalDoorStyle(
            DungeonMapContentModel mapContentModel,
            DungeonEditorTopologyElementRef selectedRef
    ) {
        String selectedSelectionRef = selectedRef.kind() + ":" + selectedRef.id();
        return mapContentModel.canvasStateProperty().get().renderScene().boundaries().stream()
                .filter(boundary -> selectedSelectionRef.equals(boundary.selectionRef()))
                .anyMatch(boundary -> !boundary.style().stroke().equals(
                        DungeonMapContentModel.RenderColor.color(0xc6, 0xe2, 0xff, 1.0))
                        && boundary.style().strokeWidth() != (3.6 / DEFAULT_GRID_SIZE));
    }

    private static void assertDoorInspector(
            DungeonInspectorSnapshot inspector,
            DungeonEditorTopologyElementRef doorRef,
            String doorLabel
    ) {
        if (inspector == null) {
            throw new AssertionError("DE-SEL-002 inspector is published for selected door");
        }
        assertEquals(doorLabel, inspector.title(), "DE-SEL-002 inspector title identifies selected door");
        assertEquals("Authorisierte Dungeon-Grenze.", inspector.summary(),
                "DE-SEL-002 inspector summary identifies selected boundary topology");
        assertTrue(inspector.facts().contains("ref: " + doorRef.kind() + " " + doorRef.id()),
                "DE-SEL-002 inspector facts identify selected door topology ref");
        assertTrue(inspector.facts().contains("kind: door"),
                "DE-SEL-002 inspector facts identify selected topology as door");
    }

    private static void assertDoorOwningRoomFacts(
            DungeonEditorMapSurfaceSnapshot surface,
            src.domain.dungeon.published.DungeonEditorMapSnapshot.Boundary doorBoundary
    ) {
        var owningArea = surface.surface().map().areas().stream()
                .filter(area -> "ROOM".equalsIgnoreCase(area.kind()))
                .filter(area -> area.cells().stream().anyMatch(cell ->
                        cell.level() == doorBoundary.edge().from().level()
                                && cell.r() == doorBoundary.edge().from().r()
                                && (cell.q() == doorBoundary.edge().from().q()
                                || cell.q() == doorBoundary.edge().from().q() - 1)))
                .findFirst()
                .orElseThrow(() -> new AssertionError("DE-SEL-002 published facts identify the door owning room"));
        assertEquals("R1", owningArea.label(), "DE-SEL-002 published facts identify the door owning room label");
        assertTrue(owningArea.clusterId() > 0L,
                "DE-SEL-002 published facts identify the door owning room/cluster id");
    }

    private static Set<String> cellRect(int minQ, int minR, int maxQ, int maxR, int level) {
        Set<String> expectedCells = new LinkedHashSet<>();
        for (int q = minQ; q <= maxQ; q++) {
            for (int r = minR; r <= maxR; r++) {
                expectedCells.add(q + "," + r + "," + level);
            }
        }
        return expectedCells;
    }

    private static String cellKey(src.domain.dungeon.published.DungeonCellRef cell) {
        return cell.q() + "," + cell.r() + "," + cell.level();
    }

    private static String cellKey(DungeonCell cell) {
        return cell.q() + "," + cell.r() + "," + cell.level();
    }

    private static String surfaceBoundarySummary(DungeonEditorMapSurfaceSnapshot snapshot) {
        return snapshot.surface().map().boundaries().stream()
                .map(boundary -> boundary.kind()
                        + ":"
                        + boundary.edge().from().q()
                        + ","
                        + boundary.edge().from().r()
                        + "->"
                        + boundary.edge().to().q()
                        + ","
                        + boundary.edge().to().r())
                .toList()
                .toString();
    }

    private static void assertNoPublishedBoundaryBetween(
            DungeonEditorMapSurfaceSnapshot snapshot,
            int q,
            int r,
            int level,
            DungeonEdgeDirection direction,
            String message
    ) {
        DungeonCell from = new DungeonCell(q, r, level);
        DungeonCell to = direction.neighborOf(from);
        boolean present = snapshot.surface().map().boundaries().stream()
                .map(boundary -> boundary.edge())
                .anyMatch(edge -> sameEdge(edge, from, to));
        assertTrue(!present, message + " boundaries=" + surfaceBoundarySummary(snapshot));
    }

    private static boolean surfaceHasBoundaryKindAt(
            DungeonEditorMapSurfaceSnapshot snapshot,
            String kind,
            DungeonCell from,
            DungeonCell to
    ) {
        return snapshot.surface().map().boundaries().stream()
                .filter(boundary -> kind.equalsIgnoreCase(boundary.kind()))
                .map(boundary -> boundary.edge())
                .anyMatch(edge -> sameEdge(edge, from, to));
    }

    private static boolean sameEdge(
            src.domain.dungeon.published.DungeonEdgeRef edge,
            DungeonCell from,
            DungeonCell to
    ) {
        return sameCell(edge.from(), from) && sameCell(edge.to(), to)
                || sameCell(edge.from(), to) && sameCell(edge.to(), from);
    }

    private static boolean sameCell(src.domain.dungeon.published.DungeonCellRef left, DungeonCell right) {
        return left.q() == right.q() && left.r() == right.r() && left.level() == right.level();
    }

    private static Point2D boundaryMidpointNear(
            DungeonMapContentModel mapContentModel,
            String selectionKind,
            double expectedX,
            double expectedY
    ) {
        return mapContentModel.canvasStateProperty().get().renderScene().boundaries().stream()
                .filter(boundary -> boundary.selectionRef().startsWith(selectionKind + ":"))
                .map(boundary -> {
                    var start = boundary.polyline().getFirst();
                    var end = boundary.polyline().getLast();
                    return new Point2D((start.x() + end.x()) / 2.0, (start.y() + end.y()) / 2.0);
                })
                .min((left, right) -> Double.compare(
                        left.distance(expectedX, expectedY),
                        right.distance(expectedX, expectedY)))
                .orElseThrow(() -> new IllegalStateException("Boundary not found near expected point."));
    }

    private static boolean renderHasBoundaryNear(
            DungeonMapContentModel mapContentModel,
            String selectionKind,
            double expectedX,
            double expectedY
    ) {
        return mapContentModel.canvasStateProperty().get().renderScene().boundaries().stream()
                .filter(boundary -> boundary.selectionRef().startsWith(selectionKind + ":"))
                .map(boundary -> {
                    var start = boundary.polyline().getFirst();
                    var end = boundary.polyline().getLast();
                    return new Point2D((start.x() + end.x()) / 2.0, (start.y() + end.y()) / 2.0);
                })
                .anyMatch(point -> point.distance(expectedX, expectedY) < 0.000_001);
    }

    private static boolean renderHasAnyBoundaryNear(
            DungeonMapContentModel mapContentModel,
            double expectedX,
            double expectedY
    ) {
        return mapContentModel.canvasStateProperty().get().renderScene().boundaries().stream()
                .map(DungeonEditorToolBehaviorHarness::boundaryMidpoint)
                .anyMatch(point -> point.distance(expectedX, expectedY) < 0.000_001);
    }

    private static Point2D boundaryMidpoint(DungeonMapContentModel.BoundaryPrimitive boundary) {
        var start = boundary.polyline().getFirst();
        var end = boundary.polyline().getLast();
        return new Point2D((start.x() + end.x()) / 2.0, (start.y() + end.y()) / 2.0);
    }

    private static void assertSelectionMatches(
            DungeonEditorTopologyElementRef expectedRef,
            long expectedClusterId,
            DungeonEditorStateSnapshot.Selection selection,
            String message
    ) {
        assertEquals(expectedRef, selection.topologyRef(), message + " selected topology ref");
        assertEquals(expectedClusterId, selection.clusterId(), message + " selected cluster id");
    }

    private static void assertHandleSelectionMatches(
            src.domain.dungeon.published.DungeonEditorHandleRef expected,
            src.domain.dungeon.published.DungeonEditorHandleRef actual,
            String message
    ) {
        assertTrue(actual != null, message + " is present");
        assertEquals(expected.kind(), actual.kind(), message + " kind");
        assertEquals(expected.topologyRef(), actual.topologyRef(), message + " topology ref");
        assertEquals(expected.ownerId(), actual.ownerId(), message + " owner id");
        assertEquals(expected.clusterId(), actual.clusterId(), message + " cluster id");
        assertEquals(expected.corridorId(), actual.corridorId(), message + " corridor id");
        assertEquals(expected.roomId(), actual.roomId(), message + " room id");
        assertEquals(expected.index(), actual.index(), message + " index");
        assertEquals(expected.cell(), actual.cell(), message + " cell");
    }

    private static void assertEmptySelection(
            DungeonEditorStateSnapshot.Selection selection,
            String message
    ) {
        assertEquals(DungeonEditorTopologyElementRef.empty(), selection.topologyRef(), message + " topology ref");
        assertEquals(0L, selection.clusterId(), message + " cluster id");
        assertTrue(!selection.clusterSelection(), message + " cluster selection flag");
        assertTrue(selection.handleRef() == null, message + " handle ref");
    }

    private static void assertOverlaySettings(
            DungeonOverlaySettings settings,
            String modeKey,
            int levelRange,
            double opacity,
            List<Integer> selectedLevels,
            String message
    ) {
        assertEquals(modeKey, settings.modeKey(), message + " mode");
        assertEquals(levelRange, settings.levelRange(), message + " range");
        assertDoubleEquals(opacity, settings.opacity(), message + " opacity");
        assertEquals(selectedLevels, settings.selectedLevels(), message + " selected levels");
    }

    private static void assertVisiblePlaceholder(DungeonMapView mapView, String rowId) {
        boolean visiblePlaceholder = descendants(mapView).stream()
                .filter(Label.class::isInstance)
                .map(Label.class::cast)
                .anyMatch(label -> label.isVisible() && !label.getText().isBlank());
        assertTrue(visiblePlaceholder, rowId + " rendered map view exposes the empty-map placeholder");
    }

    private static void assertCanvasPaintedAtScene(
            DungeonMapView mapView,
            double sceneX,
            double sceneY,
            String message
    ) {
        Canvas canvas = mapCanvas(mapView);
        WritableImage image = canvas.snapshot(null, null);
        int x = clampPixel((int) Math.round(sceneX * DEFAULT_GRID_SIZE), (int) image.getWidth());
        int y = clampPixel((int) Math.round(sceneY * DEFAULT_GRID_SIZE), (int) image.getHeight());
        Color color = image.getPixelReader().getColor(x, y);
        assertTrue(colorDistance(color, MAP_BACKGROUND) > 0.025, message + " pixel=" + color);
    }

    private static void assertCanvasHasPaintedContent(DungeonMapView mapView, String message) {
        Canvas canvas = mapCanvas(mapView);
        WritableImage image = canvas.snapshot(null, null);
        int width = (int) image.getWidth();
        int height = (int) image.getHeight();
        int paintedPixels = 0;
        for (int y = 0; y < height; y += 8) {
            for (int x = 0; x < width; x += 8) {
                Color color = image.getPixelReader().getColor(x, y);
                if (colorDistance(color, MAP_BACKGROUND) > 0.025) {
                    paintedPixels++;
                }
            }
        }
        assertTrue(paintedPixels > 0, message);
    }

    private static Canvas mapCanvas(DungeonMapView mapView) {
        return descendants(mapView).stream()
                .filter(Canvas.class::isInstance)
                .map(Canvas.class::cast)
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("Dungeon map canvas not found."));
    }

    private static int clampPixel(int value, int dimension) {
        return Math.max(0, Math.min(Math.max(0, dimension - 1), value));
    }

    private static double colorDistance(Color color, Color other) {
        double red = color.getRed() - other.getRed();
        double green = color.getGreen() - other.getGreen();
        double blue = color.getBlue() - other.getBlue();
        return Math.sqrt(red * red + green * green + blue * blue);
    }

    private static void assertEmptyMapSurface(DungeonEditorMapSurfaceSnapshot snapshot, String expectedMapName) {
        assertTrue(snapshot.surface() != null, "DE-MAP-001 map surface is published");
        assertEquals(expectedMapName, snapshot.surface().mapName(), "DE-MAP-001 map surface name");
        assertTrue(snapshot.surface().previewMap() == null, "DE-MAP-001 created map has no preview map");
        assertTrue(snapshot.surface().map().areas().isEmpty(), "DE-MAP-001 created map has no areas");
        assertTrue(snapshot.surface().map().boundaries().isEmpty(), "DE-MAP-001 created map has no boundaries");
        assertTrue(snapshot.surface().map().features().isEmpty(), "DE-MAP-001 created map has no features");
        assertTrue(snapshot.surface().map().editorHandles().isEmpty(),
                "DE-MAP-001 created map has no editor handles");
    }

    private static boolean labelVisible(Parent parent, String text) {
        return descendants(parent).stream()
                .filter(Label.class::isInstance)
                .map(Label.class::cast)
                .anyMatch(label -> text.equals(label.getText()) && label.isVisible());
    }

    private static boolean buttonVisible(Parent parent, String text) {
        return descendants(parent).stream()
                .filter(ButtonBase.class::isInstance)
                .map(ButtonBase.class::cast)
                .anyMatch(button -> text.equals(button.getText()) && button.isVisible());
    }

    private static HBox toolFamilyRow(Parent parent) {
        List<HBox> rows = descendants(parent).stream()
                .filter(HBox.class::isInstance)
                .map(HBox.class::cast)
                .filter(row -> row.getStyleClass().contains("dungeon-control-tool-row"))
                .toList();
        assertEquals(1, rows.size(), "DE-TOOL-001 exposes exactly one Dungeon Editor tool family row");
        return rows.getFirst();
    }

    private static List<ButtonBase> visibleRowButtons(Parent row) {
        return descendants(row).stream()
                .filter(ButtonBase.class::isInstance)
                .map(ButtonBase.class::cast)
                .filter(button -> button.isVisible() && !button.getText().isBlank())
                .toList();
    }

    private static Set<String> visibleRowButtonTexts(Parent row) {
        return visibleRowButtons(row).stream()
                .map(ButtonBase::getText)
                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
    }

    private static boolean toggleSelected(Parent parent, String text) {
        ToggleButton button = descendants(parent).stream()
                .filter(ToggleButton.class::isInstance)
                .map(ToggleButton.class::cast)
                .filter(candidate -> text.equals(candidate.getText()))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("ToggleButton not found: " + text));
        return button.isSelected();
    }

    private static void writeResults(List<String> results) throws Exception {
        String resultsDir = System.getProperty("saltmarcher.dungeonEditorBehavior.resultsDir", "");
        if (resultsDir.isBlank()) {
            return;
        }
        Path output = Path.of(resultsDir, "summary.txt");
        Files.createDirectories(output.getParent());
        Files.write(output, results);
    }

    private static void shutdownFx() throws Exception {
        runOnFxThread(() -> {
            for (Window window : List.copyOf(Window.getWindows())) {
                window.hide();
            }
            Platform.exit();
        });
    }

    private static void runOnFxThread(ThrowingRunnable action) throws Exception {
        CountDownLatch latch = new CountDownLatch(1);
        Throwable[] failure = new Throwable[1];
        Runnable wrappedAction = () -> {
            try {
                action.run();
            } catch (Throwable throwable) {
                failure[0] = throwable;
            } finally {
                latch.countDown();
            }
        };
        if (FX_STARTED.compareAndSet(false, true)) {
            Platform.startup(wrappedAction);
        } else {
            Platform.runLater(wrappedAction);
        }
        if (!latch.await(AWAIT_SECONDS, TimeUnit.SECONDS)) {
            throw new IllegalStateException("Timed out waiting for JavaFX Dungeon Editor harness.");
        }
        if (failure[0] != null) {
            throw new IllegalStateException("Dungeon Editor behavior harness failed.", failure[0]);
        }
    }

    private static void click(ButtonBase button) {
        button.fire();
    }

    private static ButtonBase button(Parent parent, String text) {
        return descendants(parent).stream()
                .filter(ButtonBase.class::isInstance)
                .map(ButtonBase.class::cast)
                .filter(button -> text.equals(button.getText()))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("Button not found: " + text));
    }

    private static ButtonBase buttonWithAccessibleText(Parent parent, String accessibleText) {
        return descendants(parent).stream()
                .filter(ButtonBase.class::isInstance)
                .map(ButtonBase.class::cast)
                .filter(button -> accessibleText.equals(button.getAccessibleText()))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("Button not found: " + accessibleText));
    }

    private static SplitMenuButton splitMenuButton(Parent parent, String text) {
        return descendants(parent).stream()
                .filter(SplitMenuButton.class::isInstance)
                .map(SplitMenuButton.class::cast)
                .filter(button -> text.equals(button.getText()))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("SplitMenuButton not found: " + text));
    }

    private static MenuItem menuItem(SplitMenuButton button, String text) {
        return button.getItems().stream()
                .filter(item -> text.equals(item.getText()))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("MenuItem not found: " + text));
    }

    private static void click(MenuItem item) {
        item.fire();
    }

    private static TextField textField(Parent parent, String accessibleText) {
        return descendants(parent).stream()
                .filter(TextField.class::isInstance)
                .map(TextField.class::cast)
                .filter(field -> accessibleText.equals(field.getAccessibleText()))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("TextField not found: " + accessibleText));
    }

    private static boolean textFieldPresent(Parent parent, String accessibleText) {
        return descendants(parent).stream()
                .filter(TextField.class::isInstance)
                .map(TextField.class::cast)
                .anyMatch(field -> accessibleText.equals(field.getAccessibleText()));
    }

    private static Label label(Parent parent, String accessibleText) {
        return descendants(parent).stream()
                .filter(Label.class::isInstance)
                .map(Label.class::cast)
                .filter(label -> accessibleText.equals(label.getAccessibleText()))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("Label not found: " + accessibleText));
    }

    private static TextField textFieldByPrompt(Parent parent, String promptText) {
        return descendants(parent).stream()
                .filter(TextField.class::isInstance)
                .map(TextField.class::cast)
                .filter(field -> promptText.equals(field.getPromptText()))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("TextField not found by prompt: " + promptText));
    }

    private static TextArea textArea(Parent parent, String accessibleText) {
        return descendants(parent).stream()
                .filter(TextArea.class::isInstance)
                .map(TextArea.class::cast)
                .filter(area -> accessibleText.equals(area.getAccessibleText()))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("TextArea not found: " + accessibleText));
    }

    private static CheckBox checkBox(Parent parent, String accessibleText) {
        return descendants(parent).stream()
                .filter(CheckBox.class::isInstance)
                .map(CheckBox.class::cast)
                .filter(box -> accessibleText.equals(box.getAccessibleText()))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("CheckBox not found: " + accessibleText));
    }

    private static List<TextArea> textAreas(Parent parent) {
        return descendants(parent).stream()
                .filter(TextArea.class::isInstance)
                .map(TextArea.class::cast)
                .toList();
    }

    private static ComboBox<?> comboBox(Parent parent, String accessibleText) {
        return descendants(parent).stream()
                .filter(ComboBox.class::isInstance)
                .map(ComboBox.class::cast)
                .filter(box -> accessibleText.equals(box.getAccessibleText()))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("ComboBox not found: " + accessibleText));
    }

    private static <T extends Node> void assertAccessibleNode(
            Parent parent,
            Class<T> type,
            String accessibleText
    ) {
        boolean found = descendants(parent).stream()
                .filter(type::isInstance)
                .map(type::cast)
                .anyMatch(node -> accessibleText.equals(node.getAccessibleText()) && node.isVisible());
        assertTrue(found, "Accessible node present: " + accessibleText);
    }

    private static ComboBox<?> comboBoxWithDisplayedItem(Parent parent, String displayText) {
        return descendants(parent).stream()
                .filter(ComboBox.class::isInstance)
                .map(ComboBox.class::cast)
                .filter(box -> comboBoxContainsDisplayText(box, displayText))
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("ComboBox item not found: " + displayText));
    }

    private static void selectComboItem(ComboBox<?> comboBox, String displayText) {
        selectComboItemTyped(comboBox, displayText);
    }

    private static <T> boolean comboBoxContainsDisplayText(ComboBox<T> comboBox, String displayText) {
        for (T item : comboBox.getItems()) {
            if (displayText.equals(comboDisplayText(comboBox, item))) {
                return true;
            }
        }
        return false;
    }

    private static <T> void selectComboItemTyped(ComboBox<T> comboBox, String displayText) {
        for (int index = 0; index < comboBox.getItems().size(); index++) {
            T item = comboBox.getItems().get(index);
            if (displayText.equals(comboDisplayText(comboBox, item))) {
                comboBox.getSelectionModel().select(index);
                return;
            }
        }
        throw new IllegalStateException("ComboBox item not found: " + displayText);
    }

    private static <T> String comboDisplayText(ComboBox<T> comboBox, T item) {
        if (comboBox.getConverter() != null) {
            return comboBox.getConverter().toString(item);
        }
        return String.valueOf(item);
    }

    private static Spinner<Integer> spinner(Parent parent) {
        return descendants(parent).stream()
                .filter(Spinner.class::isInstance)
                .map(Spinner.class::cast)
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("Spinner not found."));
    }

    private static void setSpinnerValue(Spinner<Integer> spinner, int value) {
        if (spinner.getValueFactory() == null) {
            throw new IllegalStateException("Spinner has no value factory.");
        }
        spinner.getValueFactory().setValue(value);
    }

    private static Slider slider(Parent parent) {
        return descendants(parent).stream()
                .filter(Slider.class::isInstance)
                .map(Slider.class::cast)
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("Slider not found."));
    }

    private static void setSliderValue(Slider slider, double value) {
        slider.setValue(value);
    }

    private static List<Node> descendants(Parent parent) {
        List<Node> nodes = new ArrayList<>();
        collect(parent, nodes);
        return nodes;
    }

    private static <T extends Node> T descendant(Parent parent, Class<T> type) {
        return descendants(parent).stream()
                .filter(type::isInstance)
                .map(type::cast)
                .findFirst()
                .orElseThrow(() -> new IllegalStateException("Descendant not found: " + type.getSimpleName()));
    }

    private static Parent ancestorWithStyleClass(Node node, String styleClass) {
        Parent parent = node.getParent();
        while (parent != null) {
            if (parent.getStyleClass().contains(styleClass)) {
                return parent;
            }
            parent = parent.getParent();
        }
        throw new IllegalStateException("Ancestor style class not found: " + styleClass);
    }

    private static void collect(Node node, List<Node> nodes) {
        nodes.add(node);
        if (node instanceof Parent parent) {
            for (Node child : parent.getChildrenUnmodifiable()) {
                collect(child, nodes);
            }
        }
    }

    private static HarnessBinding bindHarness(HarnessRuntime runtime) {
        return bindHarness(runtime, 1_400.0, 900.0);
    }

    private static HarnessBinding bindHarness(HarnessRuntime runtime, double width, double height) {
        ShellBinding shellBinding = new DungeonEditorContribution().bind(runtime.context());
        DungeonEditorControlsView controls =
                slot(shellBinding, ShellSlot.COCKPIT_CONTROLS, DungeonEditorControlsView.class);
        DungeonMapView mapView = slot(shellBinding, ShellSlot.COCKPIT_MAIN, DungeonMapView.class);
        DungeonEditorStateView stateView = slot(shellBinding, ShellSlot.COCKPIT_STATE, DungeonEditorStateView.class);
        Stage stage = new Stage();
        HBox root = new HBox(controls, mapView, stateView);
        stage.setScene(new Scene(root, width, height));
        stage.show();
        root.applyCss();
        root.layout();
        return new HarnessBinding(controls, mapView, stateView, boundContentModel(mapView));
    }

    private static HarnessBinding bindShellHarness(HarnessRuntime runtime, double width, double height) {
        AppShell shell = new AppShell(runtime.context().services());
        DungeonEditorContribution contribution = new DungeonEditorContribution();
        ShellBinding shellBinding = contribution.bind(shell.runtimeContext());
        ShellLeftBarTabSpec registrationSpec = (ShellLeftBarTabSpec) contribution.registrationSpec();
        shell.registerLeftBarTab(registrationSpec, shellBinding);
        shell.navigateTo(registrationSpec.key());

        Stage stage = new Stage();
        stage.setScene(new Scene(shell, width, height));
        stage.show();
        shell.applyCss();
        shell.layout();
        DungeonEditorControlsView controls = descendant(shell, DungeonEditorControlsView.class);
        DungeonMapView mapView = descendant(shell, DungeonMapView.class);
        DungeonEditorStateView stateView = descendant(shell, DungeonEditorStateView.class);
        return new HarnessBinding(controls, mapView, stateView, boundContentModel(mapView));
    }

    private static ApplicationHarnessBinding bindDiscoveredApplicationHarness(double width, double height) {
        AppShell shell = new AppBootstrap().createShell();
        Stage stage = new Stage();
        stage.setScene(new Scene(shell, width, height));
        stage.show();
        shell.applyCss();
        shell.layout();
        DungeonEditorControlsView controls = descendant(shell, DungeonEditorControlsView.class);
        DungeonMapView mapView = descendant(shell, DungeonMapView.class);
        DungeonEditorStateView stateView = descendant(shell, DungeonEditorStateView.class);
        ServiceRegistry services = shell.runtimeContext().services();
        return new ApplicationHarnessBinding(
                new HarnessBinding(controls, mapView, stateView, boundContentModel(mapView)),
                services.require(DungeonEditorControlsModel.class),
                services.require(DungeonEditorMapSurfaceModel.class),
                services.require(DungeonEditorStateModel.class));
    }

    private static <T extends Node> T slot(ShellBinding shellBinding, ShellSlot slot, Class<T> type) {
        Node node = shellBinding.slotContent().get(slot);
        if (!type.isInstance(node)) {
            throw new IllegalStateException("Unexpected " + slot + " slot content: " + node);
        }
        return type.cast(node);
    }

    private static DungeonMapContentModel boundContentModel(DungeonMapView mapView) {
        try {
            Field bindingField = DungeonMapView.class.getDeclaredField("removeCanvasBinding");
            bindingField.setAccessible(true);
            Object binding = bindingField.get(mapView);
            for (Field capturedField : binding.getClass().getDeclaredFields()) {
                capturedField.setAccessible(true);
                Object value = capturedField.get(binding);
                if (value instanceof DungeonMapContentModel contentModel) {
                    return contentModel;
                }
            }
        } catch (ReflectiveOperationException exception) {
            throw new IllegalStateException("Could not inspect bound DungeonMapContentModel.", exception);
        }
        throw new IllegalStateException("Bound DungeonMapContentModel not found on DungeonMapView.");
    }

    private static void assertTrue(boolean condition, String message) {
        if (!condition) {
            throw new AssertionError(message);
        }
    }

    private static long elapsedMillis(long startedNanos) {
        return TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startedNanos);
    }

    private static void assertEquals(long expected, long actual, String message) {
        if (expected != actual) {
            throw new AssertionError(message + " expected=" + expected + " actual=" + actual);
        }
    }

    private static void assertEquals(Object expected, Object actual, String message) {
        if (!Objects.equals(expected, actual)) {
            throw new AssertionError(message + " expected=" + expected + " actual=" + actual);
        }
    }

    private static void assertDoubleEquals(double expected, double actual, String message) {
        double tolerance = 0.000_001;
        if (Math.abs(expected - actual) > tolerance) {
            throw new AssertionError(message + " expected=" + expected + " actual=" + actual);
        }
    }

    @FunctionalInterface
    private interface ThrowingRunnable {
        void run() throws Exception;
    }

    private record HarnessBinding(
            DungeonEditorControlsView controls,
            DungeonMapView mapView,
            DungeonEditorStateView stateView,
            DungeonMapContentModel mapContentModel
    ) {
    }

    private record ApplicationHarnessBinding(
            HarnessBinding binding,
            DungeonEditorControlsModel controlsModel,
            DungeonEditorMapSurfaceModel mapSurfaceModel,
            DungeonEditorStateModel stateModel
    ) {
    }

    private record RoomClusterIds(long roomId, long clusterId) {
    }

    private record HarnessRuntime(
            ShellRuntimeContext context,
            DungeonEditorControlsModel controlsModel,
            DungeonEditorMapSurfaceModel mapSurfaceModel,
            DungeonEditorStateModel stateModel,
            DatabaseAssertions database
    ) {
        static HarnessRuntime create() {
            DatabaseAssertions database = new DatabaseAssertions();
            database.clearDungeonData();
            ServiceRegistry.Builder builder = new ServiceRegistry.Builder();
            builder.register(DungeonMapRepository.class, new SqliteDungeonMapRepository());
            builder.register(TravelDungeonSessionRepository.class, new EmptyTravelDungeonSessionRepository());
            new DungeonServiceContribution().register(builder);
            ServiceRegistry registry = builder.build();
            return new HarnessRuntime(
                    new ShellRuntimeContext(EmptyInspectorSink.INSTANCE, registry),
                    registry.require(DungeonEditorControlsModel.class),
                    registry.require(DungeonEditorMapSurfaceModel.class),
                    registry.require(DungeonEditorStateModel.class),
                    database);
        }
    }

    private enum EmptyInspectorSink implements InspectorSink {
        INSTANCE;

        @Override
        public void push(InspectorEntrySpec entry) {
        }

        @Override
        public void clear() {
        }

        @Override
        public boolean isShowing(Object entryKey) {
            return false;
        }
    }

    private static final class EmptyTravelDungeonSessionRepository implements TravelDungeonSessionRepository {
        @Override
        public TravelDungeonActiveState.ActiveTravelStateData loadActiveTravelState() {
            return new TravelDungeonActiveState.ActiveTravelStateData(List.of(), null);
        }

        @Override
        public TravelDungeonSessionSurface.SurfaceData loadDungeonSurface(
                TravelDungeonSessionSurface.PositionData position
        ) {
            return TravelDungeonSessionSurface.outsideDungeonSurface(0L);
        }

        @Override
        public TravelDungeonSessionMovement.MoveResultData moveDungeonAction(
                TravelDungeonSessionSurface.PositionData position,
                String actionId
        ) {
            return new TravelDungeonSessionMovement.MoveResultData(
                    TravelDungeonSessionValues.MoveStatus.NO_MAP,
                    TravelDungeonSessionSurface.outsideDungeonSurface(0L),
                    null);
        }

        @Override
        public void saveDungeonPosition(
                TravelDungeonSessionSurface.PositionData position,
                List<Long> characterIds
        ) {
        }

        @Override
        public boolean saveOverworldPosition(
                TravelDungeonSessionValues.OverworldTarget target,
                List<Long> characterIds
        ) {
            return false;
        }
    }

    private static final class DatabaseAssertions {
        private final Path databasePath;

        private DatabaseAssertions() {
            String xdgDataHome = System.getenv("XDG_DATA_HOME");
            if (xdgDataHome == null || xdgDataHome.isBlank()) {
                throw new IllegalStateException("XDG_DATA_HOME must isolate the Dungeon Editor behavior DB.");
            }
            databasePath = Path.of(xdgDataHome, "salt-marcher", DungeonPersistenceSchema.DATABASE_FILE_NAME);
        }

        private long countMapsNamed(String mapName) {
            return count("SELECT COUNT(*) FROM dungeon_maps WHERE name=?", mapName);
        }

        private void clearDungeonData() {
            try (Connection connection = open();
                 Statement statement = connection.createStatement()) {
                statement.execute("PRAGMA foreign_keys=ON");
                for (String createTableSql : DungeonPersistenceSchema.CREATE_TABLE_SQL) {
                    statement.execute(createTableSql);
                }
                statement.executeUpdate("DELETE FROM dungeon_maps");
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to reset Dungeon Editor behavior DB.", exception);
            }
        }

        private long createPersistedMap(String mapName) {
            try (Connection connection = open()) {
                connection.setAutoCommit(false);
                long mapId = insertAndReturnId(
                        connection,
                        "INSERT INTO dungeon_maps(name) VALUES(?)",
                        mapName);
                connection.commit();
                return mapId;
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to create persisted dungeon map fixture.", exception);
            }
        }

        private long countMapIdWithName(long mapId, String mapName) {
            return count("SELECT COUNT(*) FROM dungeon_maps WHERE dungeon_map_id=? AND name=?", mapId, mapName);
        }

        private long countAuthoredGeometryRows(long mapId) {
            long rows = 0L;
            rows += count("SELECT COUNT(*) FROM dungeon_rooms WHERE dungeon_map_id=?", mapId);
            rows += count("SELECT COUNT(*) FROM dungeon_room_clusters WHERE dungeon_map_id=?", mapId);
            rows += count("SELECT COUNT(*) FROM dungeon_room_floors WHERE room_id IN ("
                    + "SELECT room_id FROM dungeon_rooms WHERE dungeon_map_id=?)", mapId);
            rows += count("SELECT COUNT(*) FROM dungeon_room_cluster_vertices WHERE cluster_id IN ("
                    + "SELECT cluster_id FROM dungeon_room_clusters WHERE dungeon_map_id=?)", mapId);
            rows += count("SELECT COUNT(*) FROM dungeon_room_cluster_edges WHERE cluster_id IN ("
                    + "SELECT cluster_id FROM dungeon_room_clusters WHERE dungeon_map_id=?)", mapId);
            rows += count("SELECT COUNT(*) FROM dungeon_corridors WHERE dungeon_map_id=?", mapId);
            rows += count("SELECT COUNT(*) FROM dungeon_topology_elements WHERE dungeon_map_id=?", mapId);
            rows += count("SELECT COUNT(*) FROM dungeon_stairs WHERE dungeon_map_id=?", mapId);
            rows += count("SELECT COUNT(*) FROM dungeon_transitions WHERE dungeon_map_id=?", mapId);
            return rows;
        }

        private long countRoomsForMap(long mapId) {
            return count("SELECT COUNT(*) FROM dungeon_rooms WHERE dungeon_map_id=?", mapId);
        }

        private long countRoomClustersForMap(long mapId) {
            return count("SELECT COUNT(*) FROM dungeon_room_clusters WHERE dungeon_map_id=?", mapId);
        }

        private long countClusterVertexRows(long mapId) {
            return count(
                    "SELECT COUNT(*) FROM dungeon_room_cluster_vertices WHERE cluster_id IN ("
                            + "SELECT cluster_id FROM dungeon_room_clusters WHERE dungeon_map_id=?)",
                    mapId);
        }

        private Set<Long> corridorIdsForMap(long mapId) {
            try (Connection connection = open();
                 PreparedStatement statement = connection.prepareStatement(
                         "SELECT corridor_id FROM dungeon_corridors WHERE dungeon_map_id=? ORDER BY corridor_id")) {
                bind(statement, mapId);
                try (ResultSet resultSet = statement.executeQuery()) {
                    Set<Long> ids = new LinkedHashSet<>();
                    while (resultSet.next()) {
                        ids.add(resultSet.getLong("corridor_id"));
                    }
                    return ids;
                }
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to read corridor ids.", exception);
            }
        }

        private long countClusterEdges(long clusterId) {
            return count("SELECT COUNT(*) FROM dungeon_room_cluster_edges WHERE cluster_id=?", clusterId);
        }

        private long countWallBoundariesForDirection(long mapId, String direction) {
            return count(
                    "SELECT COUNT(*) FROM dungeon_room_cluster_edges edge_row"
                            + " JOIN dungeon_room_clusters cluster_row ON cluster_row.cluster_id=edge_row.cluster_id"
                            + " WHERE cluster_row.dungeon_map_id=?"
                            + " AND edge_row.edge_direction=?"
                            + " AND edge_row.edge_type='WALL'",
                    mapId,
                    direction);
        }

        private long countWallBoundaryRows(long mapId) {
            return count(
                    "SELECT COUNT(*) FROM dungeon_room_cluster_edges edge_row"
                            + " JOIN dungeon_room_clusters cluster_row ON cluster_row.cluster_id=edge_row.cluster_id"
                            + " WHERE cluster_row.dungeon_map_id=?"
                            + " AND edge_row.edge_type='WALL'",
                    mapId);
        }

        private long countDistinctWallBoundaryTopologyRefs(long mapId) {
            return count(
                    "SELECT COUNT(DISTINCT edge_row.topology_element_id)"
                            + " FROM dungeon_room_cluster_edges edge_row"
                            + " JOIN dungeon_room_clusters cluster_row ON cluster_row.cluster_id=edge_row.cluster_id"
                            + " WHERE cluster_row.dungeon_map_id=?"
                            + " AND edge_row.edge_type='WALL'"
                            + " AND edge_row.topology_element_id IS NOT NULL",
                    mapId);
        }

        private long countUnreferencedWallTopologyElements(long mapId) {
            return count(
                    "SELECT COUNT(*) FROM dungeon_topology_elements topology_row"
                            + " WHERE topology_row.dungeon_map_id=?"
                            + " AND topology_row.element_kind='WALL'"
                            + " AND NOT EXISTS ("
                            + " SELECT 1 FROM dungeon_room_cluster_edges edge_row"
                            + " JOIN dungeon_room_clusters cluster_row"
                            + " ON cluster_row.cluster_id=edge_row.cluster_id"
                            + " WHERE cluster_row.dungeon_map_id=topology_row.dungeon_map_id"
                            + " AND edge_row.topology_element_id=topology_row.element_id"
                            + " AND edge_row.edge_type='WALL')",
                    mapId);
        }

        private Set<String> wallBoundaryAbsoluteRowsForDirection(long mapId, String direction) {
            try (Connection connection = open();
                 PreparedStatement statement = connection.prepareStatement(
                         "SELECT cluster_row.center_x + edge_row.cell_x AS absolute_x,"
                                 + " cluster_row.center_y + edge_row.cell_y AS absolute_y,"
                                 + " edge_row.level_z, edge_row.edge_direction, edge_row.edge_type"
                                 + " FROM dungeon_room_cluster_edges edge_row"
                                 + " JOIN dungeon_room_clusters cluster_row"
                                 + " ON cluster_row.cluster_id=edge_row.cluster_id"
                                 + " WHERE cluster_row.dungeon_map_id=?"
                                 + " AND edge_row.edge_direction=?"
                                 + " AND edge_row.edge_type='WALL'"
                                 + " ORDER BY edge_row.level_z, absolute_x, absolute_y")) {
                bind(statement, mapId, direction);
                try (ResultSet resultSet = statement.executeQuery()) {
                    Set<String> rows = new LinkedHashSet<>();
                    while (resultSet.next()) {
                        rows.add("cell=" + resultSet.getInt("absolute_x")
                                + ","
                                + resultSet.getInt("absolute_y")
                                + ","
                                + resultSet.getInt("level_z")
                                + ",direction=" + resultSet.getString("edge_direction")
                                + ",type=" + resultSet.getString("edge_type"));
                    }
                    return rows;
                }
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to read absolute wall boundary rows.", exception);
            }
        }

        private long countOpenBoundariesForDirection(long mapId, String direction) {
            return count(
                    "SELECT COUNT(*) FROM dungeon_room_cluster_edges edge_row"
                            + " JOIN dungeon_room_clusters cluster_row ON cluster_row.cluster_id=edge_row.cluster_id"
                            + " WHERE cluster_row.dungeon_map_id=?"
                            + " AND edge_row.edge_direction=?"
                            + " AND edge_row.edge_type='OPEN'"
                            + " AND edge_row.topology_element_id IS NULL",
                    mapId,
                    direction);
        }

        private long countInternalWallBoundaries(long clusterId) {
            return count(
                    "SELECT COUNT(*) FROM dungeon_room_cluster_edges"
                            + " WHERE cluster_id=?"
                            + " AND cell_x=-1"
                            + " AND cell_y IN (-1, 0, 1)"
                            + " AND edge_direction='EAST'"
                            + " AND edge_type='WALL'"
                            + " AND topology_element_id IS NOT NULL",
                    clusterId);
        }

        private List<String> openBoundaryRowsForDirection(long clusterId, String direction) {
            try (Connection connection = open();
                 PreparedStatement statement = connection.prepareStatement(
                         "SELECT level_z, cell_x, cell_y, edge_direction, edge_type, topology_element_id"
                                 + " FROM dungeon_room_cluster_edges"
                                 + " WHERE cluster_id=? AND edge_direction=? AND edge_type='OPEN'"
                                 + " ORDER BY level_z, cell_x, cell_y, edge_direction")) {
                bind(statement, clusterId, direction);
                try (ResultSet resultSet = statement.executeQuery()) {
                    List<String> rows = new ArrayList<>();
                    while (resultSet.next()) {
                        rows.add("level_z=" + resultSet.getInt("level_z")
                                + ",cell_x=" + resultSet.getInt("cell_x")
                                + ",cell_y=" + resultSet.getInt("cell_y")
                                + ",edge_direction=" + resultSet.getString("edge_direction")
                                + ",edge_type=" + resultSet.getString("edge_type")
                                + ",topology_element_id="
                                + Objects.toString(resultSet.getObject("topology_element_id"), "<null>"));
                    }
                    return rows;
                }
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to read open boundary rows.", exception);
            }
        }

        private long countWallTopologyElementsForDirection(long mapId, String direction) {
            List<Long> topologyElementIds = wallTopologyElementIdsForDirection(direction);
            return count(
                    "SELECT COUNT(*) FROM dungeon_topology_elements topology_row"
                            + " WHERE topology_row.dungeon_map_id=?"
                            + " AND topology_row.element_kind='WALL'"
                            + " AND topology_row.element_id IN (?, ?, ?)",
                    mapId,
                    topologyElementIds.get(0),
                    topologyElementIds.get(1),
                    topologyElementIds.get(2));
        }

        private long countInternalWallTopologyElements(long mapId) {
            return count(
                    "SELECT COUNT(*) FROM dungeon_topology_elements topology_row"
                            + " WHERE topology_row.dungeon_map_id=?"
                            + " AND topology_row.element_kind='WALL'"
                            + " AND topology_row.element_id IN (?, ?, ?)",
                    mapId,
                    wallTopologyElementId(2, 2, 0, -1, -1, "EAST"),
                    wallTopologyElementId(2, 2, 0, -1, 0, "EAST"),
                    wallTopologyElementId(2, 2, 0, -1, 1, "EAST"));
        }

        private static List<Long> wallTopologyElementIdsForDirection(String direction) {
            if ("NORTH".equals(direction) || "SOUTH".equals(direction)) {
                int relativeY = "NORTH".equals(direction) ? -1 : 1;
                return List.of(
                        wallTopologyElementId(2, 2, 0, -1, relativeY, direction),
                        wallTopologyElementId(2, 2, 0, 0, relativeY, direction),
                        wallTopologyElementId(2, 2, 0, 1, relativeY, direction));
            }
            if ("WEST".equals(direction) || "EAST".equals(direction)) {
                int relativeX = "WEST".equals(direction) ? -1 : 1;
                return List.of(
                        wallTopologyElementId(2, 2, 0, relativeX, -1, direction),
                        wallTopologyElementId(2, 2, 0, relativeX, 0, direction),
                        wallTopologyElementId(2, 2, 0, relativeX, 1, direction));
            }
            throw new IllegalArgumentException("Unsupported wall direction: " + direction);
        }

        private Set<String> roomFloorCells(long roomId) {
            try (Connection connection = open();
                 PreparedStatement statement = connection.prepareStatement(
                         "SELECT anchor_x, anchor_y, level_z"
                                 + " FROM dungeon_room_floors WHERE room_id=?"
                                 + " ORDER BY level_z, anchor_x, anchor_y")) {
                statement.setLong(1, roomId);
                try (ResultSet resultSet = statement.executeQuery()) {
                    Set<String> cells = new LinkedHashSet<>();
                    while (resultSet.next()) {
                        cells.add(resultSet.getInt("anchor_x")
                                + ","
                                + resultSet.getInt("anchor_y")
                                + ","
                                + resultSet.getInt("level_z"));
                    }
                    return cells;
                }
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to read room floor cells.", exception);
            }
        }

        private long clusterIdByCenter(long mapId, int centerX, int centerY, int level) {
            try (Connection connection = open();
                 PreparedStatement statement = connection.prepareStatement(
                         "SELECT cluster_id FROM dungeon_room_clusters"
                                 + " WHERE dungeon_map_id=? AND center_x=? AND center_y=? AND level_z=?")) {
                bind(statement, mapId, centerX, centerY, level);
                return scalar(statement);
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to find room cluster by center.", exception);
            }
        }

        private long countClustersAtCenter(long mapId, int centerX, int centerY, int level) {
            return count(
                    "SELECT COUNT(*) FROM dungeon_room_clusters"
                            + " WHERE dungeon_map_id=? AND center_x=? AND center_y=? AND level_z=?",
                    mapId,
                    centerX,
                    centerY,
                    level);
        }

        private RoomClusterIds roomByComponent(long mapId, int componentX, int componentY, int level) {
            try (Connection connection = open();
                 PreparedStatement statement = connection.prepareStatement(
                         "SELECT room_id, cluster_id FROM dungeon_rooms"
                                 + " WHERE dungeon_map_id=? AND component_x=? AND component_y=? AND level_z=?")) {
                bind(statement, mapId, componentX, componentY, level);
                try (ResultSet resultSet = statement.executeQuery()) {
                    if (!resultSet.next()) {
                        throw new SQLException("No room found by component cell.");
                    }
                    RoomClusterIds ids = new RoomClusterIds(resultSet.getLong("room_id"), resultSet.getLong("cluster_id"));
                    if (resultSet.next()) {
                        throw new SQLException("Multiple rooms found by component cell.");
                    }
                    return ids;
                }
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to find room by component cell.", exception);
            }
        }

        private List<String> roomClusterState(long mapId, String roomName) {
            RoomClusterIds ids = roomByName(mapId, roomName);
            try (Connection connection = open()) {
                List<String> state = new ArrayList<>();
                appendRows(
                        connection,
                        state,
                        "dungeon_rooms",
                        "SELECT room_id, dungeon_map_id, cluster_id, name, visual_description,"
                                + " component_x, component_y, level_z"
                                + " FROM dungeon_rooms WHERE room_id=? ORDER BY room_id",
                        ids.roomId());
                appendRows(
                        connection,
                        state,
                        "dungeon_room_clusters",
                        "SELECT cluster_id, dungeon_map_id, center_x, center_y, level_z"
                                + " FROM dungeon_room_clusters WHERE cluster_id=? ORDER BY cluster_id",
                        ids.clusterId());
                appendRows(
                        connection,
                        state,
                        "dungeon_room_floors",
                        "SELECT room_id, level_z, anchor_x, anchor_y"
                                + " FROM dungeon_room_floors WHERE room_id=? ORDER BY level_z",
                        ids.roomId());
                appendRows(
                        connection,
                        state,
                        "dungeon_room_cluster_vertices",
                        "SELECT cluster_id, level_z, vertex_index, relative_x, relative_y"
                                + " FROM dungeon_room_cluster_vertices WHERE cluster_id=?"
                                + " ORDER BY level_z, vertex_index",
                        ids.clusterId());
                appendRows(
                        connection,
                        state,
                        "dungeon_room_cluster_edges",
                        "SELECT cluster_id, level_z, cell_x, cell_y, edge_direction, edge_type, topology_element_id"
                                + " FROM dungeon_room_cluster_edges WHERE cluster_id=?"
                                + " ORDER BY level_z, cell_x, cell_y, edge_direction",
                        ids.clusterId());
                appendRows(
                        connection,
                        state,
                        "dungeon_topology_elements",
                        "SELECT dungeon_map_id, element_kind, element_id, cluster_id, corridor_id, label, sort_order"
                                + " FROM dungeon_topology_elements"
                                + " WHERE dungeon_map_id=? AND cluster_id=?"
                                + " ORDER BY element_kind, element_id",
                        mapId,
                        ids.clusterId());
                return state;
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to snapshot room/cluster state.", exception);
            }
        }

        private RoomClusterIds roomByName(long mapId, String roomName) {
            try (Connection connection = open();
                 PreparedStatement statement = connection.prepareStatement(
                         "SELECT room_id, cluster_id FROM dungeon_rooms WHERE dungeon_map_id=? AND name=?")) {
                bind(statement, mapId, roomName);
                try (ResultSet resultSet = statement.executeQuery()) {
                    if (!resultSet.next()) {
                        throw new SQLException("No room found by name: " + roomName);
                    }
                    RoomClusterIds ids = new RoomClusterIds(resultSet.getLong("room_id"), resultSet.getLong("cluster_id"));
                    if (resultSet.next()) {
                        throw new SQLException("Multiple rooms found by name: " + roomName);
                    }
                    return ids;
                }
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to find room by name.", exception);
            }
        }

        private Set<String> absoluteClusterVertices(long clusterId) {
            try (Connection connection = open();
                 PreparedStatement statement = connection.prepareStatement(
                         "SELECT cluster_row.center_x + vertex_row.relative_x AS absolute_x,"
                                 + " cluster_row.center_y + vertex_row.relative_y AS absolute_y,"
                                 + " vertex_row.level_z AS level_z"
                                 + " FROM dungeon_room_cluster_vertices vertex_row"
                                 + " JOIN dungeon_room_clusters cluster_row"
                                 + " ON cluster_row.cluster_id=vertex_row.cluster_id"
                                 + " WHERE vertex_row.cluster_id=?"
                                 + " ORDER BY vertex_row.level_z, vertex_row.vertex_index")) {
                statement.setLong(1, clusterId);
                try (ResultSet resultSet = statement.executeQuery()) {
                    Set<String> vertices = new LinkedHashSet<>();
                    while (resultSet.next()) {
                        vertices.add(resultSet.getInt("absolute_x")
                                + ","
                                + resultSet.getInt("absolute_y")
                                + ","
                                + resultSet.getInt("level_z"));
                    }
                    return vertices;
                }
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to read absolute cluster vertices.", exception);
            }
        }

        private long countRoomVisualDescription(long roomId, String visualDescription) {
            return count(
                    "SELECT COUNT(*) FROM dungeon_rooms WHERE room_id=? AND visual_description=?",
                    roomId,
                    visualDescription);
        }

        private long countRoomExitDescription(
                long roomId,
                int cellX,
                int cellY,
                String direction,
                String description
        ) {
            return count(
                    "SELECT COUNT(*) FROM dungeon_room_exit_descriptions"
                            + " WHERE room_id=? AND cell_x=? AND cell_y=? AND edge_direction=? AND description=?",
                    roomId,
                    cellX,
                    cellY,
                    direction,
                    description);
        }

        private long countDoorBoundariesAt(long mapId, int relativeCellX, int relativeCellY, String direction) {
            return count(
                    "SELECT COUNT(*) FROM dungeon_room_cluster_edges edge_row"
                            + " JOIN dungeon_room_clusters cluster_row ON cluster_row.cluster_id=edge_row.cluster_id"
                            + " JOIN dungeon_topology_elements topology_row"
                            + " ON topology_row.dungeon_map_id=cluster_row.dungeon_map_id"
                            + " AND topology_row.element_kind='DOOR'"
                            + " AND topology_row.element_id=edge_row.topology_element_id"
                            + " WHERE cluster_row.dungeon_map_id=?"
                            + " AND edge_row.cell_x=?"
                            + " AND edge_row.cell_y=?"
                            + " AND edge_row.edge_direction=?"
                            + " AND edge_row.edge_type='DOOR'",
                    mapId,
                    relativeCellX,
                    relativeCellY,
                    direction);
        }

        private List<String> authoredGeometryState(long mapId) {
            try (Connection connection = open()) {
                List<String> state = new ArrayList<>();
                appendRows(
                        connection,
                        state,
                        "dungeon_rooms",
                        "SELECT room_id, dungeon_map_id, cluster_id, name, visual_description,"
                                + " component_x, component_y, level_z"
                                + " FROM dungeon_rooms WHERE dungeon_map_id=? ORDER BY room_id",
                        mapId);
                appendRows(
                        connection,
                        state,
                        "dungeon_room_clusters",
                        "SELECT cluster_id, dungeon_map_id, center_x, center_y, level_z"
                                + " FROM dungeon_room_clusters WHERE dungeon_map_id=? ORDER BY cluster_id",
                        mapId);
                appendRows(
                        connection,
                        state,
                        "dungeon_room_floors",
                        "SELECT room_floor.room_id, room_floor.level_z, room_floor.anchor_x, room_floor.anchor_y"
                                + " FROM dungeon_room_floors room_floor"
                                + " JOIN dungeon_rooms room ON room.room_id=room_floor.room_id"
                                + " WHERE room.dungeon_map_id=?"
                                + " ORDER BY room_floor.room_id, room_floor.level_z",
                        mapId);
                appendRows(
                        connection,
                        state,
                        "dungeon_room_cluster_vertices",
                        "SELECT vertex_row.cluster_id, vertex_row.level_z, vertex_row.vertex_index,"
                                + " vertex_row.relative_x, vertex_row.relative_y"
                                + " FROM dungeon_room_cluster_vertices vertex_row"
                                + " JOIN dungeon_room_clusters cluster_row ON cluster_row.cluster_id=vertex_row.cluster_id"
                                + " WHERE cluster_row.dungeon_map_id=?"
                                + " ORDER BY vertex_row.cluster_id, vertex_row.level_z, vertex_row.vertex_index",
                        mapId);
                appendRows(
                        connection,
                        state,
                        "dungeon_room_cluster_edges",
                        "SELECT edge_row.cluster_id, edge_row.level_z, edge_row.cell_x, edge_row.cell_y,"
                                + " edge_row.edge_direction, edge_row.edge_type, edge_row.topology_element_id"
                                + " FROM dungeon_room_cluster_edges edge_row"
                                + " JOIN dungeon_room_clusters cluster_row ON cluster_row.cluster_id=edge_row.cluster_id"
                                + " WHERE cluster_row.dungeon_map_id=?"
                                + " ORDER BY edge_row.cluster_id, edge_row.level_z, edge_row.cell_x,"
                                + " edge_row.cell_y, edge_row.edge_direction",
                        mapId);
                appendRows(
                        connection,
                        state,
                        "dungeon_corridors",
                        "SELECT corridor_id, dungeon_map_id, level_z"
                                + " FROM dungeon_corridors WHERE dungeon_map_id=? ORDER BY corridor_id",
                        mapId);
                appendRows(
                        connection,
                        state,
                        "dungeon_corridor_members",
                        "SELECT member_row.corridor_id, member_row.room_id, member_row.member_order"
                                + " FROM dungeon_corridor_members member_row"
                                + " JOIN dungeon_corridors corridor_row"
                                + " ON corridor_row.corridor_id=member_row.corridor_id"
                                + " WHERE corridor_row.dungeon_map_id=?"
                                + " ORDER BY member_row.corridor_id, member_row.member_order, member_row.room_id",
                        mapId);
                appendRows(
                        connection,
                        state,
                        "dungeon_topology_elements",
                        "SELECT dungeon_map_id, element_kind, element_id, cluster_id,"
                                + " corridor_id, label, sort_order"
                                + " FROM dungeon_topology_elements WHERE dungeon_map_id=?"
                                + " ORDER BY element_kind, element_id",
                        mapId);
                appendRows(
                        connection,
                        state,
                        "dungeon_corridor_door_overrides",
                        "SELECT override_row.corridor_id, override_row.room_id, override_row.cluster_id,"
                                + " override_row.relative_cell_x, override_row.relative_cell_y,"
                                + " override_row.edge_direction, override_row.topology_element_id,"
                                + " override_row.sort_order"
                                + " FROM dungeon_corridor_door_overrides override_row"
                                + " JOIN dungeon_corridors corridor_row"
                                + " ON corridor_row.corridor_id=override_row.corridor_id"
                                + " WHERE corridor_row.dungeon_map_id=?"
                                + " ORDER BY override_row.corridor_id, override_row.sort_order,"
                                + " override_row.room_id",
                        mapId);
                appendRows(
                        connection,
                        state,
                        "dungeon_corridor_anchors",
                        "SELECT anchor_row.corridor_id, anchor_row.anchor_id,"
                                + " anchor_row.host_corridor_id, anchor_row.cell_x, anchor_row.cell_y,"
                                + " anchor_row.cell_z, anchor_row.topology_element_id, anchor_row.sort_order"
                                + " FROM dungeon_corridor_anchors anchor_row"
                                + " JOIN dungeon_corridors corridor_row"
                                + " ON corridor_row.corridor_id=anchor_row.corridor_id"
                                + " WHERE corridor_row.dungeon_map_id=?"
                                + " ORDER BY anchor_row.corridor_id, anchor_row.sort_order, anchor_row.anchor_id",
                        mapId);
                appendRows(
                        connection,
                        state,
                        "dungeon_corridor_anchor_refs",
                        "SELECT ref_row.corridor_id, ref_row.host_corridor_id,"
                                + " ref_row.topology_element_id"
                                + " FROM dungeon_corridor_anchor_refs ref_row"
                                + " JOIN dungeon_corridors corridor_row"
                                + " ON corridor_row.corridor_id=ref_row.corridor_id"
                                + " WHERE corridor_row.dungeon_map_id=?"
                                + " ORDER BY ref_row.corridor_id,"
                                + " ref_row.topology_element_id",
                        mapId);
                appendRows(
                        connection,
                        state,
                        "dungeon_corridor_waypoints",
                        "SELECT waypoint_row.corridor_id, waypoint_row.sort_order,"
                                + " waypoint_row.cluster_id, waypoint_row.relative_x,"
                                + " waypoint_row.relative_y, waypoint_row.relative_z"
                                + " FROM dungeon_corridor_waypoints waypoint_row"
                                + " JOIN dungeon_corridors corridor_row"
                                + " ON corridor_row.corridor_id=waypoint_row.corridor_id"
                                + " WHERE corridor_row.dungeon_map_id=?"
                                + " ORDER BY waypoint_row.corridor_id, waypoint_row.sort_order",
                        mapId);
                appendRows(
                        connection,
                        state,
                        "dungeon_room_exit_descriptions",
                        "SELECT exit_row.room_id, exit_row.cell_x, exit_row.cell_y,"
                                + " exit_row.edge_direction, exit_row.description, exit_row.sort_order"
                                + " FROM dungeon_room_exit_descriptions exit_row"
                                + " JOIN dungeon_rooms room_row ON room_row.room_id=exit_row.room_id"
                                + " WHERE room_row.dungeon_map_id=?"
                                + " ORDER BY exit_row.room_id, exit_row.sort_order, exit_row.cell_x,"
                                + " exit_row.cell_y, exit_row.edge_direction",
                        mapId);
                appendRows(
                        connection,
                        state,
                        "dungeon_stairs",
                        "SELECT stair_id, dungeon_map_id, name, shape, direction,"
                                + " dimension1, dimension2, corridor_id"
                                + " FROM dungeon_stairs WHERE dungeon_map_id=? ORDER BY stair_id",
                        mapId);
                appendRows(
                        connection,
                        state,
                        "dungeon_stair_path_nodes",
                        "SELECT path_node.stair_id, path_node.sort_order, path_node.cell_x,"
                                + " path_node.cell_y, path_node.cell_z"
                                + " FROM dungeon_stair_path_nodes path_node"
                                + " JOIN dungeon_stairs stair_row ON stair_row.stair_id=path_node.stair_id"
                                + " WHERE stair_row.dungeon_map_id=?"
                                + " ORDER BY path_node.stair_id, path_node.sort_order",
                        mapId);
                appendRows(
                        connection,
                        state,
                        "dungeon_stair_exits",
                        "SELECT stair_exit.stair_exit_id, stair_exit.stair_id,"
                                + " stair_exit.cell_x, stair_exit.cell_y, stair_exit.cell_z, stair_exit.label"
                                + " FROM dungeon_stair_exits stair_exit"
                                + " JOIN dungeon_stairs stair_row ON stair_row.stair_id=stair_exit.stair_id"
                                + " WHERE stair_row.dungeon_map_id=?"
                                + " ORDER BY stair_exit.stair_id, stair_exit.stair_exit_id",
                        mapId);
                appendRows(
                        connection,
                        state,
                        "dungeon_transitions",
                        "SELECT transition_id, dungeon_map_id, description, cell_x, cell_y,"
                                + " level_z, destination_type, target_overworld_map_id,"
                                + " target_overworld_tile_id, target_dungeon_map_id,"
                                + " target_transition_id, linked_transition_id"
                                + " FROM dungeon_transitions WHERE dungeon_map_id=? ORDER BY transition_id",
                        mapId);
                return state;
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to snapshot authored geometry DB state.", exception);
            }
        }

        private List<String> doorBoundaryState(long mapId) {
            try (Connection connection = open()) {
                List<String> state = new ArrayList<>();
                appendRows(
                        connection,
                        state,
                        "door_edges",
                        "SELECT edge_row.cluster_id, edge_row.level_z, edge_row.cell_x, edge_row.cell_y,"
                                + " edge_row.edge_direction, edge_row.edge_type, edge_row.topology_element_id"
                                + " FROM dungeon_room_cluster_edges edge_row"
                                + " JOIN dungeon_room_clusters cluster_row ON cluster_row.cluster_id=edge_row.cluster_id"
                                + " WHERE cluster_row.dungeon_map_id=? AND edge_row.edge_type='DOOR'"
                                + " ORDER BY edge_row.cluster_id, edge_row.cell_x, edge_row.cell_y,"
                                + " edge_row.edge_direction",
                        mapId);
                return state;
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to snapshot door boundary DB state.", exception);
            }
        }

        private List<String> roomBoundaryEdgeState(long mapId) {
            try (Connection connection = open()) {
                List<String> state = new ArrayList<>();
                appendRows(
                        connection,
                        state,
                        "dungeon_room_cluster_edges",
                        "SELECT edge_row.cluster_id, edge_row.level_z, edge_row.cell_x, edge_row.cell_y,"
                                + " edge_row.edge_direction, edge_row.edge_type, edge_row.topology_element_id"
                                + " FROM dungeon_room_cluster_edges edge_row"
                                + " JOIN dungeon_room_clusters cluster_row ON cluster_row.cluster_id=edge_row.cluster_id"
                                + " WHERE cluster_row.dungeon_map_id=?"
                                + " ORDER BY edge_row.cluster_id, edge_row.level_z, edge_row.cell_x,"
                                + " edge_row.cell_y, edge_row.edge_direction",
                        mapId);
                return state;
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to snapshot room boundary DB state.", exception);
            }
        }

        private List<String> corridorAnchorState(long mapId) {
            try (Connection connection = open()) {
                List<String> state = new ArrayList<>();
                appendRows(
                        connection,
                        state,
                        "dungeon_corridor_anchors",
                        "SELECT anchor_row.corridor_id, anchor_row.anchor_id,"
                                + " anchor_row.host_corridor_id, anchor_row.cell_x, anchor_row.cell_y,"
                                + " anchor_row.cell_z, anchor_row.topology_element_id, anchor_row.sort_order"
                                + " FROM dungeon_corridor_anchors anchor_row"
                                + " JOIN dungeon_corridors corridor_row"
                                + " ON corridor_row.corridor_id=anchor_row.corridor_id"
                                + " WHERE corridor_row.dungeon_map_id=?"
                                + " ORDER BY anchor_row.corridor_id, anchor_row.anchor_id",
                        mapId);
                return state;
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to snapshot corridor anchor DB state.", exception);
            }
        }

        private long countCorridorAnchorsAt(long mapId, int cellX, int cellY, int cellZ) {
            return count(
                    "SELECT COUNT(*) FROM dungeon_corridor_anchors anchor_row"
                            + " JOIN dungeon_corridors corridor_row"
                            + " ON corridor_row.corridor_id=anchor_row.corridor_id"
                            + " WHERE corridor_row.dungeon_map_id=?"
                            + " AND anchor_row.cell_x=? AND anchor_row.cell_y=? AND anchor_row.cell_z=?",
                    mapId,
                    cellX,
                    cellY,
                    cellZ);
        }

        private List<String> corridorWaypointAbsoluteState(long mapId) {
            try (Connection connection = open()) {
                List<String> state = new ArrayList<>();
                appendRows(
                        connection,
                        state,
                        "dungeon_corridor_waypoints",
                        "SELECT waypoint_row.corridor_id, waypoint_row.sort_order,"
                                + " cluster_row.center_x + waypoint_row.relative_x AS cell_x,"
                                + " cluster_row.center_y + waypoint_row.relative_y AS cell_y,"
                                + " waypoint_row.relative_z AS cell_z"
                                + " FROM dungeon_corridor_waypoints waypoint_row"
                                + " JOIN dungeon_corridors corridor_row"
                                + " ON corridor_row.corridor_id=waypoint_row.corridor_id"
                                + " JOIN dungeon_room_clusters cluster_row"
                                + " ON cluster_row.cluster_id=waypoint_row.cluster_id"
                                + " WHERE corridor_row.dungeon_map_id=?"
                                + " ORDER BY waypoint_row.corridor_id, waypoint_row.sort_order",
                        mapId);
                return state;
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to snapshot corridor waypoint absolute state.", exception);
            }
        }

        private List<String> corridorStableConnectionState(long mapId) {
            try (Connection connection = open()) {
                List<String> state = new ArrayList<>();
                appendRows(
                        connection,
                        state,
                        "dungeon_corridors",
                        "SELECT corridor_id, dungeon_map_id, level_z"
                                + " FROM dungeon_corridors WHERE dungeon_map_id=? ORDER BY corridor_id",
                        mapId);
                appendRows(
                        connection,
                        state,
                        "dungeon_corridor_members",
                        "SELECT member_row.corridor_id, member_row.room_id, member_row.member_order"
                                + " FROM dungeon_corridor_members member_row"
                                + " JOIN dungeon_corridors corridor_row"
                                + " ON corridor_row.corridor_id=member_row.corridor_id"
                                + " WHERE corridor_row.dungeon_map_id=?"
                                + " ORDER BY member_row.corridor_id, member_row.member_order, member_row.room_id",
                        mapId);
                appendRows(
                        connection,
                        state,
                        "dungeon_corridor_door_overrides",
                        "SELECT override_row.corridor_id, override_row.room_id, override_row.cluster_id,"
                                + " override_row.relative_cell_x, override_row.relative_cell_y,"
                                + " override_row.edge_direction, override_row.topology_element_id,"
                                + " override_row.sort_order"
                                + " FROM dungeon_corridor_door_overrides override_row"
                                + " JOIN dungeon_corridors corridor_row"
                                + " ON corridor_row.corridor_id=override_row.corridor_id"
                                + " WHERE corridor_row.dungeon_map_id=?"
                                + " ORDER BY override_row.corridor_id, override_row.sort_order,"
                                + " override_row.room_id",
                        mapId);
                appendRows(
                        connection,
                        state,
                        "dungeon_corridor_anchor_refs",
                        "SELECT ref_row.corridor_id, ref_row.host_corridor_id,"
                                + " ref_row.topology_element_id"
                                + " FROM dungeon_corridor_anchor_refs ref_row"
                                + " JOIN dungeon_corridors corridor_row"
                                + " ON corridor_row.corridor_id=ref_row.corridor_id"
                                + " WHERE corridor_row.dungeon_map_id=?"
                                + " ORDER BY ref_row.corridor_id,"
                                + " ref_row.topology_element_id",
                        mapId);
                appendRows(
                        connection,
                        state,
                        "dungeon_corridor_waypoints",
                        "SELECT waypoint_row.corridor_id, waypoint_row.sort_order,"
                                + " waypoint_row.cluster_id, waypoint_row.relative_x,"
                                + " waypoint_row.relative_y, waypoint_row.relative_z"
                                + " FROM dungeon_corridor_waypoints waypoint_row"
                                + " JOIN dungeon_corridors corridor_row"
                                + " ON corridor_row.corridor_id=waypoint_row.corridor_id"
                                + " WHERE corridor_row.dungeon_map_id=?"
                                + " ORDER BY waypoint_row.corridor_id, waypoint_row.sort_order",
                        mapId);
                appendRows(
                        connection,
                        state,
                        "dungeon_topology_elements",
                        "SELECT dungeon_map_id, element_kind, element_id, cluster_id,"
                                + " corridor_id, label"
                                + " FROM dungeon_topology_elements WHERE dungeon_map_id=?"
                                + " AND element_kind IN ('CORRIDOR', 'CORRIDOR_ANCHOR')"
                                + " ORDER BY element_kind, element_id",
                        mapId);
                return state;
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to snapshot stable corridor connection DB state.", exception);
            }
        }

        private List<String> stairStableState(long mapId) {
            try (Connection connection = open()) {
                List<String> state = new ArrayList<>();
                appendRows(
                        connection,
                        state,
                        "dungeon_stairs",
                        "SELECT stair_id, dungeon_map_id, name, shape, direction,"
                                + " dimension1, dimension2, corridor_id"
                                + " FROM dungeon_stairs WHERE dungeon_map_id=? ORDER BY stair_id",
                        mapId);
                appendRows(
                        connection,
                        state,
                        "dungeon_topology_elements",
                        "SELECT dungeon_map_id, element_kind, element_id, label"
                                + " FROM dungeon_topology_elements"
                                + " WHERE dungeon_map_id=? AND element_kind='STAIR'"
                                + " ORDER BY element_kind, element_id",
                        mapId);
                return state;
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to snapshot stair stable DB state.", exception);
            }
        }

        private List<String> stairPathState(long mapId) {
            try (Connection connection = open()) {
                List<String> state = new ArrayList<>();
                appendRows(
                        connection,
                        state,
                        "dungeon_stair_path_nodes",
                        "SELECT path_node.stair_id, path_node.sort_order, path_node.cell_x,"
                                + " path_node.cell_y, path_node.cell_z"
                                + " FROM dungeon_stair_path_nodes path_node"
                                + " JOIN dungeon_stairs stair_row ON stair_row.stair_id=path_node.stair_id"
                                + " WHERE stair_row.dungeon_map_id=?"
                                + " ORDER BY path_node.stair_id, path_node.sort_order",
                        mapId);
                return state;
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to snapshot stair path DB state.", exception);
            }
        }

        private long countStairPathRowsByStairId(long stairId) {
            return count(
                    "SELECT COUNT(*) FROM dungeon_stair_path_nodes WHERE stair_id=?",
                    stairId);
        }

        private List<String> stairExitState(long mapId) {
            try (Connection connection = open()) {
                List<String> state = new ArrayList<>();
                appendRows(
                        connection,
                        state,
                        "dungeon_stair_exits",
                        "SELECT stair_exit.stair_exit_id, stair_exit.stair_id,"
                                + " stair_exit.cell_x, stair_exit.cell_y, stair_exit.cell_z, stair_exit.label"
                                + " FROM dungeon_stair_exits stair_exit"
                                + " JOIN dungeon_stairs stair_row ON stair_row.stair_id=stair_exit.stair_id"
                                + " WHERE stair_row.dungeon_map_id=?"
                                + " ORDER BY stair_exit.stair_id, stair_exit.stair_exit_id",
                        mapId);
                return state;
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to snapshot stair exit DB state.", exception);
            }
        }

        private long countStairExitRowsByStairId(long stairId) {
            return count(
                    "SELECT COUNT(*) FROM dungeon_stair_exits WHERE stair_id=?",
                    stairId);
        }

        private List<String> transitionStableState(long mapId) {
            try (Connection connection = open()) {
                List<String> state = new ArrayList<>();
                appendRows(
                        connection,
                        state,
                        "dungeon_transitions",
                        "SELECT transition_id, dungeon_map_id, cell_x, cell_y,"
                                + " level_z, destination_type, target_overworld_map_id,"
                                + " target_overworld_tile_id, target_dungeon_map_id,"
                                + " target_transition_id, linked_transition_id"
                                + " FROM dungeon_transitions WHERE dungeon_map_id=? ORDER BY transition_id",
                        mapId);
                return state;
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to snapshot transition stable DB state.", exception);
            }
        }

        private long transitionIdByDescription(long mapId, String description) {
            try (Connection connection = open();
                 PreparedStatement statement = connection.prepareStatement(
                         "SELECT transition_id FROM dungeon_transitions"
                                 + " WHERE dungeon_map_id=? AND description=?")) {
                bind(statement, mapId, description);
                return scalar(statement);
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to find transition by description.", exception);
            }
        }

        private long transitionIdAt(long mapId, int cellX, int cellY, int level) {
            try (Connection connection = open();
                 PreparedStatement statement = connection.prepareStatement(
                         "SELECT transition_id FROM dungeon_transitions"
                                 + " WHERE dungeon_map_id=? AND cell_x=? AND cell_y=? AND level_z=?")) {
                bind(statement, mapId, cellX, cellY, level);
                return scalar(statement);
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to find transition by cell.", exception);
            }
        }

        private long maxStairId() {
            return count("SELECT COALESCE(MAX(stair_id), 0) FROM dungeon_stairs");
        }

        private long maxTransitionId() {
            return count("SELECT COALESCE(MAX(transition_id), 0) FROM dungeon_transitions");
        }

        private long countTransitionDescription(long mapId, long transitionId, String description) {
            return count(
                    "SELECT COUNT(*) FROM dungeon_transitions"
                            + " WHERE dungeon_map_id=? AND transition_id=? AND description=?",
                    mapId,
                    transitionId,
                    description);
        }

        private long countTransitionById(long mapId, long transitionId) {
            return count(
                    "SELECT COUNT(*) FROM dungeon_transitions WHERE dungeon_map_id=? AND transition_id=?",
                    mapId,
                    transitionId);
        }

        private long countTransitionTopologyElementById(long mapId, long transitionId) {
            return count(
                    "SELECT COUNT(*) FROM dungeon_topology_elements"
                            + " WHERE dungeon_map_id=? AND element_kind='TRANSITION' AND element_id=?",
                    mapId,
                    transitionId);
        }

        private void seedF6MultiLevelFloors(long mapId) {
            try (Connection connection = open()) {
                connection.setAutoCommit(false);
                insertRectangularRoom(connection, mapId, "R1", 0, 1, 1);
                insertRectangularRoom(connection, mapId, "R2", 1, 1, 1);
                insertRectangularRoom(connection, mapId, "R3", 2, 1, 1);
                connection.commit();
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to seed F6_MULTI_LEVEL_FLOORS fixture.", exception);
            }
        }

        private void seedTransitionDescriptionFixture(long mapId) {
            try (Connection connection = open()) {
                connection.setAutoCommit(false);
                insertRectangularRoom(connection, mapId, "R1", 0, 1, 1);
                insertRectangularRoom(connection, mapId, "R2", 1, 1, 1);
                insertRectangularRoom(connection, mapId, "R3", 2, 1, 1);
                insertTransition(connection, mapId, "Initial transition.", 5, 2, 0);
                connection.commit();
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to seed transition description fixture.", exception);
            }
        }

        private void seedTransitionLinkFixture(long sourceMapId, long targetMapId) {
            try (Connection connection = open()) {
                connection.setAutoCommit(false);
                insertRectangularRoom(connection, sourceMapId, "R1", 0, 1, 1);
                insertRectangularRoom(connection, sourceMapId, "R2", 1, 1, 1);
                insertRectangularRoom(connection, sourceMapId, "R3", 2, 1, 1);
                insertTransition(connection, sourceMapId, "Source transition.", 5, 2, 0);
                insertRectangularRoom(connection, targetMapId, "R1", 0, 1, 1);
                insertTransition(connection, targetMapId, "Target transition.", 6, 2, 0);
                connection.commit();
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to seed transition link fixture.", exception);
            }
        }

        private void seedSelectedLinkedTransitionFixture(long mapId) {
            try (Connection connection = open()) {
                connection.setAutoCommit(false);
                insertRectangularRoom(connection, mapId, "R1", 0, 1, 1);
                long selectedId = insertTransition(
                        connection,
                        mapId,
                        "Selected linked transition.",
                        5,
                        2,
                        0);
                long linkedId = insertTransition(
                        connection,
                        mapId,
                        "Selected linked target transition.",
                        6,
                        2,
                        0);
                updateLinkedTransition(connection, selectedId, linkedId);
                connection.commit();
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to seed selected linked transition fixture.", exception);
            }
        }

        private void seedReverseLinkedTransitionFixture(long mapId) {
            try (Connection connection = open()) {
                connection.setAutoCommit(false);
                insertRectangularRoom(connection, mapId, "R1", 0, 1, 1);
                long selectedId = insertTransition(
                        connection,
                        mapId,
                        "Reverse linked target transition.",
                        5,
                        2,
                        0);
                long sourceId = insertTransition(
                        connection,
                        mapId,
                        "Reverse linked source transition.",
                        6,
                        2,
                        0);
                updateLinkedTransition(connection, sourceId, selectedId);
                connection.commit();
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to seed reverse linked transition fixture.", exception);
            }
        }

        private void seedDestinationReferenceTransitionFixture(long mapId) {
            try (Connection connection = open()) {
                connection.setAutoCommit(false);
                insertRectangularRoom(connection, mapId, "R1", 0, 1, 1);
                long selectedId = insertTransition(
                        connection,
                        mapId,
                        "Destination target transition.",
                        5,
                        2,
                        0);
                long sourceId = insertTransition(
                        connection,
                        mapId,
                        "Destination source transition.",
                        6,
                        2,
                        0);
                updateDungeonMapDestination(connection, sourceId, mapId, selectedId);
                connection.commit();
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to seed transition destination reference fixture.", exception);
            }
        }

        private void seedF1SingleRoom(long mapId, String roomName, int level, int anchorX, int anchorY) {
            try (Connection connection = open()) {
                connection.setAutoCommit(false);
                insertRectangularRoom(connection, mapId, roomName, level, anchorX, anchorY);
                connection.commit();
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to seed F1_SINGLE_ROOM fixture.", exception);
            }
        }

        private void seedNarrationRoomWithEastExitLink(long mapId) {
            try (Connection connection = open()) {
                connection.setAutoCommit(false);
                long roomId = insertRectangularRoom(connection, mapId, "R1", 0, 1, 1);
                insertRectangularRoom(connection, mapId, "R2", 0, 4, 1);
                markDoorEdge(connection, mapId, roomId, 0, 1, 0, "EAST", "Door east", 200);
                connection.commit();
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to seed narration room with east exit link fixture.", exception);
            }
        }

        private void seedF4WalledRoomWithDoor(long mapId) {
            try (Connection connection = open()) {
                connection.setAutoCommit(false);
                long roomId = insertRectangularRoom(connection, mapId, "R1", 0, 1, 1);
                insertRectangularRoom(connection, mapId, "R2", 0, 4, 1);
                markDoorEdge(connection, mapId, roomId, 0, 1, 0, "EAST", "Door east", 200);
                connection.commit();
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to seed F4_WALLED_ROOM_WITH_DOOR fixture.", exception);
            }
        }

        private void seedF7StairAnchor(long mapId) {
            try (Connection connection = open()) {
                connection.setAutoCommit(false);
                insertRectangularRoom(connection, mapId, "R1", 0, 8, 8);
                long stairId = insertAndReturnId(
                        connection,
                        "INSERT INTO dungeon_stairs(dungeon_map_id, name, shape, direction, dimension1, dimension2)"
                                + " VALUES(?, ?, ?, ?, ?, ?)",
                        mapId,
                        "S1",
                        "STRAIGHT",
                        0,
                        3,
                        1);
                insertTopologyElement(connection, mapId, stairId, 0L, "STAIR", "S1", 400);
                insertStairPathNode(connection, stairId, 0, 2, 2, 0);
                insertStairPathNode(connection, stairId, 1, 2, 1, 0);
                insertStairPathNode(connection, stairId, 2, 2, 0, 0);
                insertStairExit(connection, stairId, 2, 2, 0, "Unterer Ausgang");
                insertStairExit(connection, stairId, 2, 0, 1, "Oberer Ausgang");
                connection.commit();
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to seed F7_STAIR_ANCHOR fixture.", exception);
            }
        }

        private void seedF7StairAnchorWithBlockingRoom(long mapId) {
            try (Connection connection = open()) {
                connection.setAutoCommit(false);
                insertRectangularRoom(connection, mapId, "R1", 0, 3, 1);
                long stairId = insertAndReturnId(
                        connection,
                        "INSERT INTO dungeon_stairs(dungeon_map_id, name, shape, direction, dimension1, dimension2)"
                                + " VALUES(?, ?, ?, ?, ?, ?)",
                        mapId,
                        "S1",
                        "STRAIGHT",
                        0,
                        3,
                        1);
                insertTopologyElement(connection, mapId, stairId, 0L, "STAIR", "S1", 400);
                insertStairPathNode(connection, stairId, 0, 2, 2, 0);
                insertStairPathNode(connection, stairId, 1, 2, 1, 0);
                insertStairPathNode(connection, stairId, 2, 2, 0, 0);
                insertStairExit(connection, stairId, 2, 2, 0, "Unterer Ausgang");
                insertStairExit(connection, stairId, 2, 0, 1, "Oberer Ausgang");
                connection.commit();
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to seed invalid stair recompute fixture.", exception);
            }
        }

        private void seedCorridorBoundStairAnchor(long mapId) {
            try (Connection connection = open()) {
                connection.setAutoCommit(false);
                long roomId = insertRectangularRoom(connection, mapId, "R1", 0, 1, 1);
                long clusterId = scalarLong(
                        connection,
                        "SELECT cluster_id FROM dungeon_rooms WHERE room_id=?",
                        roomId);
                long corridorId = insertAndReturnId(
                        connection,
                        "INSERT INTO dungeon_corridors(dungeon_map_id, level_z) VALUES(?, ?)",
                        mapId,
                        0);
                insertCorridorTopologyElement(connection, mapId, corridorId, corridorId, "CORRIDOR", "K1", 300);
                insertCorridorWaypoint(connection, corridorId, clusterId, 0, 2, 0, 0);
                long stairId = insertAndReturnId(
                        connection,
                        "INSERT INTO dungeon_stairs(dungeon_map_id, name, shape, direction, dimension1, dimension2, corridor_id)"
                                + " VALUES(?, ?, ?, ?, ?, ?, ?)",
                        mapId,
                        "S1",
                        "LADDER",
                        0,
                        1,
                        1,
                        corridorId);
                insertCorridorTopologyElement(connection, mapId, stairId, corridorId, "STAIR", "S1", 400);
                insertStairPathNode(connection, stairId, 0, 2, 2, 0);
                insertStairPathNode(connection, stairId, 1, 2, 2, 1);
                insertStairExit(connection, stairId, 2, 2, 0, "Unterer Ausgang");
                insertStairExit(connection, stairId, 2, 2, 1, "Oberer Ausgang");
                connection.commit();
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to seed corridor-bound stair fixture.", exception);
            }
        }

        private void seedGlobalStairIdentitySentinel(long mapId) {
            try (Connection connection = open()) {
                connection.setAutoCommit(false);
                long stairId = insertAndReturnId(
                        connection,
                        "INSERT INTO dungeon_stairs(dungeon_map_id, name, shape, direction, dimension1, dimension2)"
                                + " VALUES(?, ?, ?, ?, ?, ?)",
                        mapId,
                        "Global Stair Sentinel",
                        "STRAIGHT",
                        0,
                        1,
                        1);
                insertTopologyElement(connection, mapId, stairId, 0L, "STAIR", "Global Stair Sentinel", 900);
                connection.commit();
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to seed global stair identity sentinel.", exception);
            }
        }

        private void seedGlobalTransitionIdentitySentinel(long mapId) {
            try (Connection connection = open()) {
                connection.setAutoCommit(false);
                insertTransition(connection, mapId, "Global transition sentinel.", 1, 1, 0);
                connection.commit();
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to seed global transition identity sentinel.", exception);
            }
        }

        private void seedCorridorWithAnchor(long mapId) {
            try (Connection connection = open()) {
                connection.setAutoCommit(false);
                long roomOneId = insertRectangularRoom(connection, mapId, "R1", 0, 1, 1);
                long roomTwoId = insertRectangularRoom(connection, mapId, "R2", 0, 8, 1);
                long roomOneClusterId = scalarLong(
                        connection,
                        "SELECT cluster_id FROM dungeon_rooms WHERE room_id=?",
                        roomOneId);
                long roomTwoClusterId = scalarLong(
                        connection,
                        "SELECT cluster_id FROM dungeon_rooms WHERE room_id=?",
                        roomTwoId);
                long doorOneId = markDoorEdge(connection, mapId, roomOneId, 0, 1, 0, "EAST", "D1", 200);
                long doorTwoId = markDoorEdge(connection, mapId, roomTwoId, 0, -1, 0, "WEST", "D2", 201);
                long corridorId = insertAndReturnId(
                        connection,
                        "INSERT INTO dungeon_corridors(dungeon_map_id, level_z) VALUES(?, ?)",
                        mapId,
                        0);
                insertCorridorTopologyElement(connection, mapId, corridorId, corridorId, "CORRIDOR", "K1", 300);
                insertCorridorMember(connection, corridorId, roomOneId, 0);
                insertCorridorMember(connection, corridorId, roomTwoId, 1);
                insertCorridorDoorOverride(connection, corridorId, roomOneId, roomOneClusterId, 1, 0, "EAST", doorOneId, 0);
                insertCorridorDoorOverride(connection, corridorId, roomTwoId, roomTwoClusterId, -1, 0, "WEST", doorTwoId, 1);
                insertCorridorWaypoint(connection, corridorId, roomOneClusterId, 0, 2, 0, 0);
                insertCorridorWaypoint(connection, corridorId, roomOneClusterId, 2, 0, 0, 1);
                insertCorridorWaypoint(connection, corridorId, roomOneClusterId, 4, 0, 0, 2);
                insertCorridorWaypoint(connection, corridorId, roomOneClusterId, 4, 3, 0, 3);
                insertCorridorWaypoint(connection, corridorId, roomOneClusterId, 5, 3, 0, 4);
                insertCorridorWaypoint(connection, corridorId, roomOneClusterId, 5, 0, 0, 5);
                long anchorTopologyId = 70_000L + corridorId;
                insertCorridorTopologyElement(
                        connection,
                        mapId,
                        anchorTopologyId,
                        corridorId,
                        "CORRIDOR_ANCHOR",
                        "A1",
                        301);
                insertCorridorAnchor(connection, corridorId, 1, corridorId, 6, 5, 0, anchorTopologyId, 0);
                insertCorridorAnchorRef(connection, corridorId, corridorId, anchorTopologyId, 2);
                connection.commit();
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to seed F5_CORRIDOR_WITH_ANCHOR fixture.", exception);
            }
        }

        private void seedCorridorSplitRouteTarget(long mapId) {
            try (Connection connection = open()) {
                connection.setAutoCommit(false);
                long roomOneId = insertRectangularRoom(connection, mapId, "R1", 0, 1, 1);
                long roomTwoId = insertRectangularRoom(connection, mapId, "R2", 0, 8, 1);
                long roomThreeId = insertRectangularRoom(connection, mapId, "R3", 0, 5, 9);
                long roomOneClusterId = scalarLong(
                        connection,
                        "SELECT cluster_id FROM dungeon_rooms WHERE room_id=?",
                        roomOneId);
                long roomTwoClusterId = scalarLong(
                        connection,
                        "SELECT cluster_id FROM dungeon_rooms WHERE room_id=?",
                        roomTwoId);
                long doorOneId = markDoorEdge(connection, mapId, roomOneId, 0, 1, 0, "EAST", "D1", 200);
                long doorTwoId = markDoorEdge(connection, mapId, roomTwoId, 0, -1, 0, "WEST", "D2", 201);
                markDoorEdge(connection, mapId, roomThreeId, 0, 0, -1, "NORTH", "D3", 202);
                long corridorId = insertAndReturnId(
                        connection,
                        "INSERT INTO dungeon_corridors(dungeon_map_id, level_z) VALUES(?, ?)",
                        mapId,
                        0);
                insertCorridorTopologyElement(connection, mapId, corridorId, corridorId, "CORRIDOR", "K1", 300);
                insertCorridorMember(connection, corridorId, roomOneId, 0);
                insertCorridorMember(connection, corridorId, roomTwoId, 1);
                insertCorridorDoorOverride(connection, corridorId, roomOneId, roomOneClusterId, 1, 0, "EAST", doorOneId, 0);
                insertCorridorDoorOverride(connection, corridorId, roomTwoId, roomTwoClusterId, -1, 0, "WEST", doorTwoId, 1);
                insertCorridorWaypoint(connection, corridorId, roomOneClusterId, 0, 2, 0, 0);
                insertCorridorWaypoint(connection, corridorId, roomOneClusterId, 2, 0, 0, 1);
                insertCorridorWaypoint(connection, corridorId, roomOneClusterId, 4, 0, 0, 2);
                insertCorridorWaypoint(connection, corridorId, roomOneClusterId, 4, 3, 0, 3);
                insertCorridorWaypoint(connection, corridorId, roomOneClusterId, 5, 3, 0, 4);
                insertCorridorWaypoint(connection, corridorId, roomOneClusterId, 5, 0, 0, 5);
                long anchorTopologyId = 70_000L + corridorId;
                insertCorridorTopologyElement(
                        connection,
                        mapId,
                        anchorTopologyId,
                        corridorId,
                        "CORRIDOR_ANCHOR",
                        "A1",
                        301);
                insertCorridorAnchor(connection, corridorId, 1, corridorId, 6, 5, 0, anchorTopologyId, 0);
                insertCorridorAnchorRef(connection, corridorId, corridorId, anchorTopologyId, 2);
                connection.commit();
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to seed DE-COR-004 crossing split fixture.", exception);
            }
        }

        private void seedTwoDoorRouteTarget(long mapId) {
            try (Connection connection = open()) {
                connection.setAutoCommit(false);
                long roomOneId = insertRectangularRoom(connection, mapId, "R1", 0, 1, 1);
                long roomTwoId = insertRectangularRoom(connection, mapId, "R2", 0, 8, 1);
                markDoorEdge(connection, mapId, roomOneId, 0, 1, 0, "EAST", "D1", 200);
                markDoorEdge(connection, mapId, roomTwoId, 0, -1, 0, "WEST", "D2", 201);
                connection.commit();
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to seed F8_TWO_DOOR_ROUTE_TARGET fixture.", exception);
            }
        }

        private void seedRoomToDoorRouteTarget(long mapId) {
            try (Connection connection = open()) {
                connection.setAutoCommit(false);
                insertRectangularRoom(connection, mapId, "R1", 0, 1, 1);
                long roomTwoId = insertRectangularRoom(connection, mapId, "R2", 0, 8, 1);
                markDoorEdge(connection, mapId, roomTwoId, 0, -1, 0, "WEST", "D2", 201);
                connection.commit();
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to seed F12_ROOM_TO_DOOR_ROUTE_TARGET fixture.", exception);
            }
        }

        private void seedBlockedCorridorRouteTarget(long mapId) {
            try (Connection connection = open()) {
                connection.setAutoCommit(false);
                insertRectangularRoom(connection, mapId, "R1", 0, 1, 1);
                insertRectangularRoom(connection, mapId, "R2", 0, -3, 1);
                insertRectangularRoom(connection, mapId, "R3", 0, 5, 1);
                connection.commit();
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to seed blocked corridor route fixture.", exception);
            }
        }

        private void seedTwoAnchorRouteTarget(long mapId) {
            try (Connection connection = open()) {
                connection.setAutoCommit(false);
                long roomOneId = insertRectangularRoom(connection, mapId, "R1", 0, -4, 4);
                long roomTwoId = insertRectangularRoom(connection, mapId, "R2", 0, 10, 4);
                long roomOneClusterId = scalarLong(
                        connection,
                        "SELECT cluster_id FROM dungeon_rooms WHERE room_id=?",
                        roomOneId);
                long roomTwoClusterId = scalarLong(
                        connection,
                        "SELECT cluster_id FROM dungeon_rooms WHERE room_id=?",
                        roomTwoId);
                long corridorOneId = insertAndReturnId(
                        connection,
                        "INSERT INTO dungeon_corridors(dungeon_map_id, level_z) VALUES(?, ?)",
                        mapId,
                        0);
                insertCorridorTopologyElement(connection, mapId, corridorOneId, corridorOneId, "CORRIDOR", "K1", 300);
                insertCorridorWaypoint(connection, corridorOneId, roomOneClusterId, 5, 1, 0, 0);
                long anchorOneTopologyId = 70_000L + corridorOneId;
                insertCorridorTopologyElement(
                        connection,
                        mapId,
                        anchorOneTopologyId,
                        corridorOneId,
                        "CORRIDOR_ANCHOR",
                        "A1",
                        301);
                insertCorridorAnchor(connection, corridorOneId, 1, corridorOneId, 2, 6, 0, anchorOneTopologyId, 0);
                insertCorridorAnchorRef(connection, corridorOneId, corridorOneId, anchorOneTopologyId, 0);
                long corridorTwoId = insertAndReturnId(
                        connection,
                        "INSERT INTO dungeon_corridors(dungeon_map_id, level_z) VALUES(?, ?)",
                        mapId,
                        0);
                insertCorridorTopologyElement(connection, mapId, corridorTwoId, corridorTwoId, "CORRIDOR", "K2", 302);
                insertCorridorWaypoint(connection, corridorTwoId, roomTwoClusterId, -3, 1, 0, 0);
                long anchorTwoTopologyId = 70_000L + corridorTwoId;
                insertCorridorTopologyElement(
                        connection,
                        mapId,
                        anchorTwoTopologyId,
                        corridorTwoId,
                        "CORRIDOR_ANCHOR",
                        "A2",
                        303);
                insertCorridorAnchor(connection, corridorTwoId, 2, corridorTwoId, 8, 6, 0, anchorTwoTopologyId, 0);
                insertCorridorAnchorRef(connection, corridorTwoId, corridorTwoId, anchorTwoTopologyId, 0);
                connection.commit();
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to seed F10_TWO_ANCHOR_ROUTE_TARGET fixture.", exception);
            }
        }

        private void seedTwoByTwoRoom(long mapId, String roomName, int level, int anchorX, int anchorY) {
            try (Connection connection = open()) {
                connection.setAutoCommit(false);
                insertTwoByTwoRoom(connection, mapId, roomName, level, anchorX, anchorY);
                connection.commit();
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to seed two-by-two dungeon room fixture.", exception);
            }
        }

        private void seedLargePerCellLoopRoom(long mapId, int width, int height) {
            try (Connection connection = open()) {
                connection.setAutoCommit(false);
                long clusterId = insertAndReturnId(
                        connection,
                        "INSERT INTO dungeon_room_clusters(dungeon_map_id, center_x, center_y, level_z)"
                                + " VALUES(?, ?, ?, ?)",
                        mapId,
                        0,
                        0,
                        0);
                long roomId = insertAndReturnId(
                        connection,
                        "INSERT INTO dungeon_rooms(dungeon_map_id, cluster_id, name, visual_description,"
                                + " component_x, component_y, level_z) VALUES(?, ?, ?, ?, ?, ?, ?)",
                        mapId,
                        clusterId,
                        "Large Per-Cell Room",
                        "",
                        0,
                        0,
                        0);
                insertTopologyElement(connection, mapId, roomId, clusterId, "Large Per-Cell Room");
                int vertexIndex = 0;
                for (int q = 0; q < width; q++) {
                    for (int r = 0; r < height; r++) {
                        insertF6Vertex(connection, clusterId, 0, vertexIndex++, q, r);
                        insertF6Vertex(connection, clusterId, 0, vertexIndex++, q + 1, r);
                        insertF6Vertex(connection, clusterId, 0, vertexIndex++, q + 1, r + 1);
                        insertF6Vertex(connection, clusterId, 0, vertexIndex++, q, r + 1);
                        insertF6Vertex(
                                connection,
                                clusterId,
                                0,
                                vertexIndex++,
                                DungeonRoomCellProjection.LOOP_SEPARATOR.q(),
                                DungeonRoomCellProjection.LOOP_SEPARATOR.r());
                    }
                }
                connection.commit();
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed to seed large per-cell loop room fixture.", exception);
            }
        }

        private static void insertTwoByTwoRoom(
                Connection connection,
                long mapId,
                String roomName,
                int level,
                int anchorX,
                int anchorY
        ) throws SQLException {
            long clusterId = insertAndReturnId(
                    connection,
                    "INSERT INTO dungeon_room_clusters(dungeon_map_id, center_x, center_y, level_z) VALUES(?, ?, ?, ?)",
                    mapId,
                    anchorX + 1,
                    anchorY + 1,
                    level);
            long roomId = insertAndReturnId(
                    connection,
                    "INSERT INTO dungeon_rooms(dungeon_map_id, cluster_id, name, visual_description,"
                            + " component_x, component_y, level_z) VALUES(?, ?, ?, ?, ?, ?, ?)",
                    mapId,
                    clusterId,
                    roomName,
                    "",
                    anchorX + 1,
                    anchorY + 1,
                    level);
            insertTopologyElement(connection, mapId, roomId, clusterId, roomName);
            insertF6Vertex(connection, clusterId, level, 0, -1, -1);
            insertF6Vertex(connection, clusterId, level, 1, 1, -1);
            insertF6Vertex(connection, clusterId, level, 2, 1, 1);
            insertF6Vertex(connection, clusterId, level, 3, -1, 1);
            insertTwoByTwoPerimeterWalls(connection, mapId, clusterId, level, anchorX + 1, anchorY + 1);
        }

        private static long insertRectangularRoom(
                Connection connection,
                long mapId,
                String roomName,
                int level,
                int anchorX,
                int anchorY
        ) throws SQLException {
            long clusterId = insertAndReturnId(
                    connection,
                    "INSERT INTO dungeon_room_clusters(dungeon_map_id, center_x, center_y, level_z) VALUES(?, ?, ?, ?)",
                    mapId,
                    anchorX + 1,
                    anchorY + 1,
                    level);
            long roomId = insertAndReturnId(
                    connection,
                    "INSERT INTO dungeon_rooms(dungeon_map_id, cluster_id, name, visual_description,"
                            + " component_x, component_y, level_z) VALUES(?, ?, ?, ?, ?, ?, ?)",
                    mapId,
                    clusterId,
                    roomName,
                    "",
                    anchorX + 1,
                    anchorY + 1,
                    level);
            insertTopologyElement(connection, mapId, roomId, clusterId, roomName);
            insertF6Vertex(connection, clusterId, level, 0, -1, -1);
            insertF6Vertex(connection, clusterId, level, 1, 2, -1);
            insertF6Vertex(connection, clusterId, level, 2, 2, 2);
            insertF6Vertex(connection, clusterId, level, 3, -1, 2);
            insertPerimeterWalls(connection, mapId, clusterId, level, anchorX + 1, anchorY + 1);
            return roomId;
        }

        private static long markDoorEdge(
                Connection connection,
                long mapId,
                long roomId,
                int level,
                int relativeCellX,
                int relativeCellY,
                String direction,
                String label,
                int sortOrder
        ) throws SQLException {
            long clusterId = scalarLong(
                    connection,
                    "SELECT cluster_id FROM dungeon_rooms WHERE room_id=?",
                    roomId);
            long topologyElementId = scalarLong(
                    connection,
                    "SELECT topology_element_id FROM dungeon_room_cluster_edges"
                            + " WHERE cluster_id=? AND level_z=? AND cell_x=? AND cell_y=? AND edge_direction=?",
                    clusterId,
                    level,
                    relativeCellX,
                    relativeCellY,
                    direction);
            try (PreparedStatement statement = connection.prepareStatement(
                    "UPDATE dungeon_room_cluster_edges SET edge_type=?"
                            + " WHERE cluster_id=? AND level_z=? AND cell_x=? AND cell_y=? AND edge_direction=?")) {
                bind(statement, "DOOR", clusterId, level, relativeCellX, relativeCellY, direction);
                statement.executeUpdate();
            }
            insertTopologyElement(connection, mapId, topologyElementId, clusterId, "DOOR", label, sortOrder);
            return topologyElementId;
        }

        private static void insertCorridorMember(
                Connection connection,
                long corridorId,
                long roomId,
                int sortOrder
        ) throws SQLException {
            try (PreparedStatement statement = connection.prepareStatement(
                    "INSERT INTO dungeon_corridor_members(corridor_id, room_id, member_order) VALUES(?, ?, ?)")) {
                bind(statement, corridorId, roomId, sortOrder);
                statement.executeUpdate();
            }
        }

        private static void insertCorridorDoorOverride(
                Connection connection,
                long corridorId,
                long roomId,
                long clusterId,
                int relativeCellX,
                int relativeCellY,
                String direction,
                long topologyElementId,
                int sortOrder
        ) throws SQLException {
            try (PreparedStatement statement = connection.prepareStatement(
                    "INSERT INTO dungeon_corridor_door_overrides("
                            + "corridor_id, room_id, cluster_id, relative_cell_x, relative_cell_y,"
                            + " edge_direction, topology_element_id, sort_order"
                            + ") VALUES(?, ?, ?, ?, ?, ?, ?, ?)")) {
                bind(statement, corridorId, roomId, clusterId, relativeCellX, relativeCellY,
                        direction, topologyElementId, sortOrder);
                statement.executeUpdate();
            }
        }

        private static void insertCorridorWaypoint(
                Connection connection,
                long corridorId,
                long clusterId,
                int relativeX,
                int relativeY,
                int relativeZ,
                int sortOrder
        ) throws SQLException {
            try (PreparedStatement statement = connection.prepareStatement(
                    "INSERT INTO dungeon_corridor_waypoints("
                            + "corridor_id, sort_order, cluster_id, relative_x, relative_y, relative_z"
                            + ") VALUES(?, ?, ?, ?, ?, ?)")) {
                bind(statement, corridorId, sortOrder, clusterId, relativeX, relativeY, relativeZ);
                statement.executeUpdate();
            }
        }

        private static void insertCorridorAnchor(
                Connection connection,
                long corridorId,
                long anchorId,
                long hostCorridorId,
                int cellX,
                int cellY,
                int cellZ,
                long topologyElementId,
                int sortOrder
        ) throws SQLException {
            try (PreparedStatement statement = connection.prepareStatement(
                    "INSERT INTO dungeon_corridor_anchors("
                            + "corridor_id, anchor_id, host_corridor_id, cell_x, cell_y, cell_z,"
                            + " topology_element_id, sort_order"
                            + ") VALUES(?, ?, ?, ?, ?, ?, ?, ?)")) {
                bind(statement, corridorId, anchorId, hostCorridorId, cellX, cellY, cellZ,
                        topologyElementId, sortOrder);
                statement.executeUpdate();
            }
        }

        private static void insertCorridorAnchorRef(
                Connection connection,
                long corridorId,
                long hostCorridorId,
                long topologyElementId,
                int sortOrder
        ) throws SQLException {
            try (PreparedStatement statement = connection.prepareStatement(
                    "INSERT INTO dungeon_corridor_anchor_refs("
                            + "corridor_id, host_corridor_id, topology_element_id, sort_order"
                            + ") VALUES(?, ?, ?, ?)")) {
                bind(statement, corridorId, hostCorridorId, topologyElementId, sortOrder);
                statement.executeUpdate();
            }
        }

        private static void insertTwoByTwoPerimeterWalls(
                Connection connection,
                long mapId,
                long clusterId,
                int level,
                int centerX,
                int centerY
        ) throws SQLException {
            int sortOrder = 1;
            for (int relativeX = -1; relativeX <= 0; relativeX++) {
                insertClusterBoundary(connection, mapId, clusterId, level, centerX, centerY, relativeX, -1, "NORTH",
                        sortOrder);
                sortOrder++;
                insertClusterBoundary(connection, mapId, clusterId, level, centerX, centerY, relativeX, 0, "SOUTH",
                        sortOrder);
                sortOrder++;
            }
            for (int relativeY = -1; relativeY <= 0; relativeY++) {
                insertClusterBoundary(connection, mapId, clusterId, level, centerX, centerY, 0, relativeY, "EAST",
                        sortOrder);
                sortOrder++;
                insertClusterBoundary(connection, mapId, clusterId, level, centerX, centerY, -1, relativeY, "WEST",
                        sortOrder);
                sortOrder++;
            }
        }

        private static void insertPerimeterWalls(
                Connection connection,
                long mapId,
                long clusterId,
                int level,
                int centerX,
                int centerY
        ) throws SQLException {
            int sortOrder = 1;
            for (int relativeX = -1; relativeX <= 1; relativeX++) {
                insertClusterBoundary(connection, mapId, clusterId, level, centerX, centerY, relativeX, -1, "NORTH",
                        sortOrder);
                sortOrder++;
                insertClusterBoundary(connection, mapId, clusterId, level, centerX, centerY, relativeX, 1, "SOUTH",
                        sortOrder);
                sortOrder++;
            }
            for (int relativeY = -1; relativeY <= 1; relativeY++) {
                insertClusterBoundary(connection, mapId, clusterId, level, centerX, centerY, 1, relativeY, "EAST",
                        sortOrder);
                sortOrder++;
                insertClusterBoundary(connection, mapId, clusterId, level, centerX, centerY, -1, relativeY, "WEST",
                        sortOrder);
                sortOrder++;
            }
        }

        private static void insertClusterBoundary(
                Connection connection,
                long mapId,
                long clusterId,
                int level,
                int centerX,
                int centerY,
                int relativeX,
                int relativeY,
                String direction,
                int sortOrder
        ) throws SQLException {
            long topologyElementId = wallTopologyElementId(centerX, centerY, level, relativeX, relativeY, direction);
            try (PreparedStatement statement = connection.prepareStatement(
                    "INSERT INTO dungeon_room_cluster_edges("
                            + "cluster_id, level_z, cell_x, cell_y, edge_direction, edge_type, topology_element_id"
                            + ") VALUES(?, ?, ?, ?, ?, ?, ?)")) {
                bind(statement, clusterId, level, relativeX, relativeY, direction, "WALL", topologyElementId);
                statement.executeUpdate();
            }
            insertTopologyElement(connection, mapId, topologyElementId, clusterId, "WALL", "Wall", sortOrder);
        }

        private static void insertStairPathNode(
                Connection connection,
                long stairId,
                int sortOrder,
                int cellX,
                int cellY,
                int cellZ
        ) throws SQLException {
            try (PreparedStatement statement = connection.prepareStatement(
                    "INSERT INTO dungeon_stair_path_nodes(stair_id, sort_order, cell_x, cell_y, cell_z)"
                            + " VALUES(?, ?, ?, ?, ?)")) {
                bind(statement, stairId, sortOrder, cellX, cellY, cellZ);
                statement.executeUpdate();
            }
        }

        private static void insertStairExit(
                Connection connection,
                long stairId,
                int cellX,
                int cellY,
                int cellZ,
                String label
        ) throws SQLException {
            try (PreparedStatement statement = connection.prepareStatement(
                    "INSERT INTO dungeon_stair_exits(stair_id, cell_x, cell_y, cell_z, label)"
                            + " VALUES(?, ?, ?, ?, ?)")) {
                bind(statement, stairId, cellX, cellY, cellZ, label);
                statement.executeUpdate();
            }
        }

        private static long insertTransition(
                Connection connection,
                long mapId,
                String description,
                int cellX,
                int cellY,
                int level
        ) throws SQLException {
            long transitionId;
            try (PreparedStatement statement = connection.prepareStatement(
                    "INSERT INTO dungeon_transitions("
                            + "dungeon_map_id, description, cell_x, cell_y, level_z,"
                            + " destination_type, target_overworld_map_id, target_overworld_tile_id,"
                            + " target_dungeon_map_id, target_transition_id, linked_transition_id"
                            + ") VALUES(?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL)",
                    Statement.RETURN_GENERATED_KEYS)) {
                bind(statement, mapId, description, cellX, cellY, level, "OVERWORLD_TILE", 77L, 88L);
                statement.executeUpdate();
                try (ResultSet resultSet = statement.getGeneratedKeys()) {
                    if (!resultSet.next()) {
                        throw new SQLException("No generated key for transition insert.");
                    }
                    transitionId = resultSet.getLong(1);
                }
            }
            insertFeatureTopologyElement(connection, mapId, transitionId, "TRANSITION", "Übergang " + transitionId, 500);
            return transitionId;
        }

        private static void updateLinkedTransition(
                Connection connection,
                long transitionId,
                long linkedTransitionId
        ) throws SQLException {
            try (PreparedStatement statement = connection.prepareStatement(
                    "UPDATE dungeon_transitions SET linked_transition_id=? WHERE transition_id=?")) {
                bind(statement, linkedTransitionId, transitionId);
                statement.executeUpdate();
            }
        }

        private static void updateDungeonMapDestination(
                Connection connection,
                long transitionId,
                long targetMapId,
                long targetTransitionId
        ) throws SQLException {
            try (PreparedStatement statement = connection.prepareStatement(
                    "UPDATE dungeon_transitions SET destination_type='DUNGEON_MAP',"
                            + " target_overworld_map_id=NULL, target_overworld_tile_id=NULL,"
                            + " target_dungeon_map_id=?, target_transition_id=?"
                            + " WHERE transition_id=?")) {
                bind(statement, targetMapId, targetTransitionId, transitionId);
                statement.executeUpdate();
            }
        }

        private static void insertFeatureTopologyElement(
                Connection connection,
                long mapId,
                long elementId,
                String elementKind,
                String label,
                int sortOrder
        ) throws SQLException {
            try (PreparedStatement statement = connection.prepareStatement(
                    "INSERT OR IGNORE INTO dungeon_topology_elements("
                            + "dungeon_map_id, element_kind, element_id, cluster_id, corridor_id, label, sort_order"
                            + ") VALUES(?, ?, ?, NULL, NULL, ?, ?)")) {
                bind(statement, mapId, elementKind, elementId, label, sortOrder);
                statement.executeUpdate();
            }
        }

        private static long wallTopologyElementId(
                int centerX,
                int centerY,
                int level,
                int relativeX,
                int relativeY,
                String direction
        ) {
            DungeonCell absoluteCell = new DungeonCell(centerX + relativeX, centerY + relativeY, level);
            DungeonEdge edge = DungeonEdge.sideOf(absoluteCell, DungeonEdgeDirection.parse(direction));
            return DungeonBoundaryKey.from(edge).stableId();
        }

        private static void insertTopologyElement(
                Connection connection,
                long mapId,
                long roomId,
                long clusterId,
                String label
        ) throws SQLException {
            try (PreparedStatement statement = connection.prepareStatement(
                    "INSERT INTO dungeon_topology_elements("
                            + "dungeon_map_id, element_kind, element_id, cluster_id, corridor_id, label, sort_order"
                            + ") VALUES(?, ?, ?, ?, NULL, ?, ?)")) {
                bind(statement, mapId, "ROOM", roomId, clusterId, label, roomId);
                statement.executeUpdate();
            }
        }

        private static void insertTopologyElement(
                Connection connection,
                long mapId,
                long elementId,
                long clusterId,
                String elementKind,
                String label,
                int sortOrder
        ) throws SQLException {
            try (PreparedStatement statement = connection.prepareStatement(
                    "INSERT OR IGNORE INTO dungeon_topology_elements("
                            + "dungeon_map_id, element_kind, element_id, cluster_id, corridor_id, label, sort_order"
                            + ") VALUES(?, ?, ?, ?, NULL, ?, ?)")) {
                bind(statement, mapId, elementKind, elementId, clusterId, label, sortOrder);
                statement.executeUpdate();
            }
        }

        private static void insertCorridorTopologyElement(
                Connection connection,
                long mapId,
                long elementId,
                long corridorId,
                String elementKind,
                String label,
                int sortOrder
        ) throws SQLException {
            try (PreparedStatement statement = connection.prepareStatement(
                    "INSERT OR IGNORE INTO dungeon_topology_elements("
                            + "dungeon_map_id, element_kind, element_id, cluster_id, corridor_id, label, sort_order"
                            + ") VALUES(?, ?, ?, NULL, ?, ?, ?)")) {
                bind(statement, mapId, elementKind, elementId, corridorId, label, sortOrder);
                statement.executeUpdate();
            }
        }

        private long count(String sql, String value) {
            try (Connection connection = open();
                 PreparedStatement statement = connection.prepareStatement(sql)) {
                statement.setString(1, value);
                return scalar(statement);
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed DB assertion: " + sql, exception);
            }
        }

        private long count(String sql, long firstValue, String secondValue) {
            try (Connection connection = open();
                 PreparedStatement statement = connection.prepareStatement(sql)) {
                statement.setLong(1, firstValue);
                statement.setString(2, secondValue);
                return scalar(statement);
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed DB assertion: " + sql, exception);
            }
        }

        private long count(String sql, long value, int cellX, int cellY, String direction, String description) {
            try (Connection connection = open();
                 PreparedStatement statement = connection.prepareStatement(sql)) {
                bind(statement, value, cellX, cellY, direction, description);
                return scalar(statement);
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed DB assertion: " + sql, exception);
            }
        }

        private long count(String sql, Object... values) {
            try (Connection connection = open();
                 PreparedStatement statement = connection.prepareStatement(sql)) {
                bind(statement, values);
                return scalar(statement);
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed DB assertion: " + sql, exception);
            }
        }

        private long count(String sql, long value) {
            try (Connection connection = open();
                 PreparedStatement statement = connection.prepareStatement(sql)) {
                statement.setLong(1, value);
                return scalar(statement);
            } catch (SQLException exception) {
                throw new IllegalStateException("Failed DB assertion: " + sql, exception);
            }
        }

        private static void appendRows(
                Connection connection,
                List<String> state,
                String tableName,
                String sql,
                long mapId
        ) throws SQLException {
            appendRows(connection, state, tableName, sql, new Object[] {Long.valueOf(mapId)});
        }

        private static void appendRows(
                Connection connection,
                List<String> state,
                String tableName,
                String sql,
                Object... values
        ) throws SQLException {
            try (PreparedStatement statement = connection.prepareStatement(sql)) {
                bind(statement, values);
                try (ResultSet resultSet = statement.executeQuery()) {
                    ResultSetMetaData metaData = resultSet.getMetaData();
                    int columnCount = metaData.getColumnCount();
                    while (resultSet.next()) {
                        StringBuilder row = new StringBuilder(tableName);
                        for (int column = 1; column <= columnCount; column++) {
                            row.append('|')
                                    .append(metaData.getColumnName(column))
                                    .append('=')
                                    .append(Objects.toString(resultSet.getObject(column), "<null>"));
                        }
                        state.add(row.toString());
                    }
                }
            }
        }

        private static long insertAndReturnId(Connection connection, String sql, Object... values) throws SQLException {
            try (PreparedStatement statement = connection.prepareStatement(sql, Statement.RETURN_GENERATED_KEYS)) {
                bind(statement, values);
                statement.executeUpdate();
                try (ResultSet resultSet = statement.getGeneratedKeys()) {
                    if (!resultSet.next()) {
                        throw new SQLException("No generated key for insert: " + sql);
                    }
                    return resultSet.getLong(1);
                }
            }
        }

        private static void insertF6Vertex(
                Connection connection,
                long clusterId,
                int level,
                int vertexIndex,
                int relativeX,
                int relativeY
        ) throws SQLException {
            try (PreparedStatement statement = connection.prepareStatement(
                    "INSERT INTO dungeon_room_cluster_vertices("
                            + "cluster_id, level_z, vertex_index, relative_x, relative_y) VALUES(?, ?, ?, ?, ?)")) {
                bind(statement, clusterId, level, vertexIndex, relativeX, relativeY);
                statement.executeUpdate();
            }
        }

        private static void bind(PreparedStatement statement, Object... values) throws SQLException {
            for (int index = 0; index < values.length; index++) {
                Object value = values[index];
                if (value instanceof Long longValue) {
                    statement.setLong(index + 1, longValue);
                } else if (value instanceof Integer integerValue) {
                    statement.setInt(index + 1, integerValue);
                } else {
                    statement.setString(index + 1, String.valueOf(value));
                }
            }
        }

        private Connection open() throws SQLException {
            return DriverManager.getConnection("jdbc:sqlite:" + databasePath);
        }

        private static long scalar(PreparedStatement statement) throws SQLException {
            try (ResultSet resultSet = statement.executeQuery()) {
                if (!resultSet.next()) {
                    throw new SQLException("No result row.");
                }
                return resultSet.getLong(1);
            }
        }

        private static long scalarLong(Connection connection, String sql, Object... values) throws SQLException {
            try (PreparedStatement statement = connection.prepareStatement(sql)) {
                bind(statement, values);
                return scalar(statement);
            }
        }
    }
}
