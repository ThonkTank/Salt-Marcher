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

final class DungeonEditorCorridorHarness {

    private static final String OWNER = "DungeonEditorCorridorHarness";

    private DungeonEditorCorridorHarness() {
    }

    static void run(List<String> results) throws Exception {
        route(results, () -> verifyCorridorAnchorMoveThroughMapView(results));
        route(results, () -> verifyCorridorPointEditThroughStateView(results));
        route(results, () -> verifyDoorToDoorCorridorCreateThroughMapView(results));
        route(results, () -> verifyDoorToAnchorCorridorCreateThroughMapView(results));
        route(results, () -> verifyAnchorToAnchorCorridorCreateThroughMapView(results));
        route(results, () -> verifyCorridorSplitAtCrossingThroughMapView(results));
        route(results, () -> verifyCorridorConnectionPointDeleteThroughMapView(results));
        route(results, () -> verifyCorridorDoorConnectionDeleteThroughMapView(results));
        route(results, () -> verifyGenericCorridorHitCreatesAnchorEndpointThroughMapView(results));
        route(results, () -> verifyGenericCorridorHitMaterializesAbsentAnchorEndpointThroughMapView(results));
        route(results, () -> verifyInvalidCorridorRouteRejectedThroughMapView(results));
        route(results, () -> verifyGenericRoomHitMaterializesFacingDoorThroughMapView(results));
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

}
