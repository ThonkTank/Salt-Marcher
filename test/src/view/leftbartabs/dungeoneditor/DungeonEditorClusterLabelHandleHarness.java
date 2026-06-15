package src.view.leftbartabs.dungeoneditor;

import java.util.List;
import java.util.Set;
import javafx.scene.control.TextField;
import javafx.scene.input.KeyCode;
import javafx.scene.input.MouseButton;
import javafx.scene.input.MouseEvent;
import src.domain.dungeon.DungeonEditorLabelNameApplicationService;
import src.domain.dungeon.published.DungeonEdgeRef;
import src.domain.dungeon.published.DungeonEditorHandleKind;
import src.domain.dungeon.published.DungeonEditorPreview;
import src.domain.dungeon.published.DungeonEditorHandleSnapshot;
import src.domain.dungeon.published.DungeonEditorMapSurfaceSnapshot;
import src.domain.dungeon.published.DungeonEditorMapSnapshot;
import src.domain.dungeon.published.DungeonEditorStateSnapshot;
import src.domain.dungeon.published.SaveDungeonEditorLabelNameCommand;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel;
import src.view.slotcontent.main.dungeonmap.DungeonMapView;
import static src.view.leftbartabs.dungeoneditor.DungeonEditorBehaviorHarnessSupport.*;

final class DungeonEditorClusterLabelHandleHarness {

    private static final String OWNER = "DungeonEditorClusterLabelHandleHarness";
    private static final String CLUSTER_CORNER_KIND = DungeonEditorHandleKind.CLUSTER_CORNER.name();
    private static final String CLUSTER_WALL_RUN_KIND = DungeonEditorHandleKind.CLUSTER_WALL_RUN.name();
    private static final String DOOR_KIND = DungeonEditorHandleKind.DOOR.name();
    private static final long DRAG_PREVIEW_LATENCY_BUDGET_MS = 250L;

    private DungeonEditorClusterLabelHandleHarness() {
    }

    static void run(List<String> results) throws Exception {
        runLabels(results);
        runSharedHandles(results);
        runDoorHandles(results);
        runClusterHandles(results);
    }

    static void runLabels(List<String> results) throws Exception {
        route(results, () -> verifyDefaultClusterLabelText(results));
        route(results, () -> verifyDefaultRoomLabelAndRenameRoutes(results));
        route(results, () -> verifyDirectRenderedLabelRenames(results));
        route(results, () -> verifyComplexClusterLabel(results));
    }

    static void runSharedHandles(List<String> results) throws Exception {
        route(results, () -> verifySharedHandleIdentityAndPassiveRefs(results));
    }

    static void runDoorHandles(List<String> results) throws Exception {
        route(results, () -> verifyDoorHandleDrag(results));
    }

    static void runClusterHandles(List<String> results) throws Exception {
        route(results, () -> verifyComplexClusterLabelAndHandles(results));
        route(results, () -> verifySelectedWallRunHandleStyle(results));
        route(results, () -> verifyComplexClusterTrueCornerDrag(results));
        route(results, () -> verifyComplexClusterWallRunDrag(results));
    }

    private static void route(
            List<String> results,
            DungeonEditorBehaviorHarnessSupport.ThrowingRunnable action
    ) throws Exception {
        DungeonEditorBehaviorHarnessSupport.runRouteProof(results, OWNER, action);
    }

    private static void verifyDefaultClusterLabelText(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();

        long mapId = createMapThroughControls(controls, runtime, "Default Cluster Label Map");
        runtime.database().seedF1SingleRoom(mapId, "R1", 0, 1, 1);
        createMapThroughControls(controls, runtime, "Default Cluster Label Reload Hop");
        selectMap(controls, "Default Cluster Label Map");

        DungeonEditorMapSurfaceSnapshot snapshot = runtime.mapSurfaceModel().current();
        DungeonEditorHandleSnapshot label = singleClusterLabel(snapshot, "DE-LABEL-001");
        assertEquals("Cluster " + label.ref().clusterId(), label.label(),
                "DE-LABEL-001 default cluster label text");
        assertTrue(!"R1".equals(label.label()),
                "DE-LABEL-001 cluster label does not reuse the first room name");
        assertEquals("LABEL", binding.mapContentModel()
                        .resolvePointerTarget(label.cell().q() + 0.5, label.cell().r() + 0.5)
                        .targetKind()
                        .name(),
                "DE-LABEL-001 cluster label hit remains a label target");
        results.add("DE-LABEL-001 Ready: F1_SINGLE_ROOM publishes default Cluster <clusterId> label text");
    }

    private static void verifyDefaultRoomLabelAndRenameRoutes(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();

        verifyDefaultRoomLabelAndClusterRename(runtime, binding, controls);
        verifySharedRoomLabelNameOperation(runtime, binding, controls);

        results.add("DE-LABEL-003 Ready: F1_SINGLE_ROOM publishes default Raum <roomId> room label text");
        results.add("DE-LABEL-004 Ready: Room label renders as subdued floor text from model-owned room floor cells "
                + "with view-owned longest-wall orientation, orientation-aware hit geometry,"
                + " and matching inline-editor presentation");
        results.add("DE-LABEL-005 Ready: State-panel cluster rename persists, reloads, renders, and preserves geometry");
        results.add("DE-LABEL-006 Ready: Shared room label-name save persists, reloads, renders, preserves geometry, "
                + "and works from state-panel room selection");
        results.add("DE-LABEL-007 Ready: Cluster labels select cluster-name targets; "
                + "F15 secondary room label selects a room target without cluster drag");
        results.add("DE-HANDLE-005 Ready: Label targets remain distinct from shared handle hit targets");
    }

    private static void verifyDefaultRoomLabelAndClusterRename(
            HarnessRuntime runtime,
            HarnessBinding binding,
            DungeonEditorControlsView controls
    ) {
        long mapId = createMapThroughControls(controls, runtime, "Room Label Rename Map");
        runtime.database().seedF1SingleRoom(mapId, "", 0, 1, 1);
        createMapThroughControls(controls, runtime, "Room Label Rename Reload Hop");
        selectMap(controls, "Room Label Rename Map");
        click(button(controls, "Auswahl"));

        RoomClusterIds ids = runtime.database().roomByComponent(mapId, 2, 2, 0);
        long geometryRowsBefore = runtime.database().countAuthoredGeometryRows(mapId);
        List<String> boundaryRowsBefore = runtime.database().roomBoundaryEdgeState(mapId);
        DungeonEditorMapSurfaceSnapshot initial = runtime.mapSurfaceModel().current();
        assertTrue(renderHasLabelAt(binding.mapContentModel(), "Raum " + ids.roomId(), 2.5, 2.5),
                "DE-LABEL-003 render scene publishes default room label text");
        assertEquals("LABEL", binding.mapContentModel()
                        .resolvePointerTarget(2.5, 2.5)
                        .targetKind()
                        .name(),
                "DE-HANDLE-005 room label hit remains label target");

        DungeonEditorHandleSnapshot clusterLabel = singleClusterLabel(initial, "DE-LABEL-005");
        clickMap(
                binding.mapView(),
                binding.mapContentModel(),
                clusterLabel.cell().q() + 0.5,
                clusterLabel.cell().r() + 0.5);
        assertClusterLabelSelection(runtime, ids.clusterId(), "DE-LABEL-007 cluster label selection target");
        TextField clusterName = textField(binding.stateView(), "Cluster-Name");
        clusterName.setText("   West Wing   ");
        click(buttonWithAccessibleText(binding.stateView(), "Cluster-Name speichern"));
        assertEquals("West Wing", runtime.database().clusterName(ids.clusterId()),
                "DE-LABEL-005 state panel trims and saves custom cluster label");
        assertEquals(geometryRowsBefore, runtime.database().countAuthoredGeometryRows(mapId),
                "DE-LABEL-005 cluster rename leaves authored geometry row count unchanged");
        assertEquals(boundaryRowsBefore, runtime.database().roomBoundaryEdgeState(mapId),
                "DE-LABEL-005 cluster rename leaves boundary geometry unchanged");
        assertTrue(renderHasLabelAt(binding.mapContentModel(), "West Wing", 2.5, 2.5),
                "DE-LABEL-005 render scene updates custom cluster label");

        selectMap(controls, "Room Label Rename Reload Hop");
        selectMap(controls, "Room Label Rename Map");
        assertTrue(renderHasLabelAt(binding.mapContentModel(), "West Wing", 2.5, 2.5),
                "DE-LABEL-005 reload keeps custom cluster label render");
        assertEquals("LABEL", binding.mapContentModel()
                        .resolvePointerTarget(2.5, 2.5)
                        .targetKind()
                        .name(),
                "DE-LABEL-007 rendered cluster label stays separate from generic handles");
        clickMap(
                binding.mapView(),
                binding.mapContentModel(),
                clusterLabel.cell().q() + 0.5,
                clusterLabel.cell().r() + 0.5);
        assertClusterLabelSelection(runtime, ids.clusterId(), "DE-LABEL-007 cluster label reload selection target");
    }

    private static void verifySharedRoomLabelNameOperation(
            HarnessRuntime runtime,
            HarnessBinding binding,
            DungeonEditorControlsView controls
    ) {
        long roomMapId = createMapThroughControls(controls, runtime, "Room Label Rename Multi Map");
        runtime.database().seedF15ComplexCluster(roomMapId);
        createMapThroughControls(controls, runtime, "Room Label Rename Multi Reload Hop");
        selectMap(controls, "Room Label Rename Multi Map");
        click(button(controls, "Auswahl"));
        RoomClusterIds roomIds = runtime.database().roomByName(roomMapId, "R1");
        long roomGeometryRowsBefore = runtime.database().countAuthoredGeometryRows(roomMapId);
        List<String> roomBoundaryRowsBefore = runtime.database().roomBoundaryEdgeState(roomMapId);
        LabelCenter roomLabelCenter = labelCenter(binding.mapContentModel(), "R1", "DE-LABEL-004");
        LabelText roomLabelText = labelText(binding.mapContentModel(), "R1", "DE-LABEL-004");
        assertTrue(roomLabelText.style().fill() == null,
                "DE-LABEL-004 room label renders as subdued floor text without label box fill");
        assertTrue(roomLabelText.style().alpha() < 1.0,
                "DE-LABEL-004 room label text uses subdued opacity");
        assertRoomLabelHitAndEditorPresentation(binding, runtime, roomIds, roomLabelCenter, roomLabelText);
        runtime.context().services()
                .require(DungeonEditorLabelNameApplicationService.class)
                .saveLabelName(new SaveDungeonEditorLabelNameCommand(
                        SaveDungeonEditorLabelNameCommand.TARGET_ROOM,
                        roomIds.roomId(),
                        "   Lantern Room   "));
        assertEquals("Lantern Room", runtime.database().roomName(roomIds.roomId()),
                "DE-LABEL-006 shared label-name operation trims and saves custom room label");
        assertEquals(roomGeometryRowsBefore, runtime.database().countAuthoredGeometryRows(roomMapId),
                "DE-LABEL-006 room rename leaves authored geometry row count unchanged");
        assertEquals(roomBoundaryRowsBefore, runtime.database().roomBoundaryEdgeState(roomMapId),
                "DE-LABEL-006 room rename leaves boundary geometry unchanged");
        LabelCenter renamedRoomLabelCenter = labelCenter(binding.mapContentModel(), "Lantern Room", "DE-LABEL-006");
        assertDoubleEquals(roomLabelCenter.q(), renamedRoomLabelCenter.q(),
                "DE-LABEL-006 room rename keeps label q");
        assertDoubleEquals(roomLabelCenter.r(), renamedRoomLabelCenter.r(),
                "DE-LABEL-006 room rename keeps label r");
        assertTrue(renderHasLabelAt(
                        binding.mapContentModel(),
                        "Lantern Room",
                        renamedRoomLabelCenter.q(),
                        renamedRoomLabelCenter.r()),
                "DE-LABEL-006 render scene updates custom room label");

        selectMap(controls, "Room Label Rename Multi Reload Hop");
        selectMap(controls, "Room Label Rename Multi Map");
        LabelCenter reloadedRoomLabelCenter = labelCenter(
                binding.mapContentModel(),
                "Lantern Room",
                "DE-LABEL-006 reload");
        assertTrue(renderHasLabelAt(
                        binding.mapContentModel(),
                        "Lantern Room",
                        reloadedRoomLabelCenter.q(),
                        reloadedRoomLabelCenter.r()),
                "DE-LABEL-006 reload keeps custom room label render");
        assertTrue(binding.mapContentModel()
                        .resolveRoomLabelPointerTarget(reloadedRoomLabelCenter.q(), reloadedRoomLabelCenter.r())
                        .isRoomLabelTarget(),
                "DE-LABEL-007 rendered room label remains addressable through the room-label target resolver");
        RoomClusterIds secondaryRoomIds = runtime.database().roomByName(roomMapId, "R2");
        LabelCenter secondaryRoomLabelCenter = labelCenter(binding.mapContentModel(), "R2", "DE-LABEL-007 room label");
        assertRoomLabelSelectionAndNoClusterDrag(
                runtime,
                binding,
                roomMapId,
                secondaryRoomIds,
                secondaryRoomLabelCenter,
                roomGeometryRowsBefore,
                runtime.database().authoredGeometryState(roomMapId),
                roomBoundaryRowsBefore);
        TextField roomName = textField(binding.stateView(), "Raum-Name");
        roomName.setText("   Gallery Room   ");
        click(buttonWithAccessibleText(binding.stateView(), "Raum-Name speichern"));
        assertEquals("Gallery Room", runtime.database().roomName(secondaryRoomIds.roomId()),
                "DE-LABEL-006 state-panel room selection trims and saves custom room label");
        assertEquals(roomGeometryRowsBefore, runtime.database().countAuthoredGeometryRows(roomMapId),
                "DE-LABEL-006 state-panel room rename leaves authored geometry row count unchanged");
        assertEquals(roomBoundaryRowsBefore, runtime.database().roomBoundaryEdgeState(roomMapId),
                "DE-LABEL-006 state-panel room rename leaves boundary geometry unchanged");
        assertTrue(renderHasLabelAt(binding.mapContentModel(), "Gallery Room", secondaryRoomLabelCenter.q(), secondaryRoomLabelCenter.r()),
                "DE-LABEL-006 state-panel room rename updates rendered room label");
    }

    private static void verifyDirectRenderedLabelRenames(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();

        long mapId = createMapThroughControls(controls, runtime, "Direct Label Edit Map");
        runtime.database().seedF1SingleRoom(mapId, "R1", 0, 1, 1);
        createMapThroughControls(controls, runtime, "Direct Label Edit Reload Hop");
        selectMap(controls, "Direct Label Edit Map");
        click(button(controls, "Auswahl"));

        RoomClusterIds ids = runtime.database().roomByComponent(mapId, 2, 2, 0);
        LabelCenter overlappedLabelCenter = labelCenter(binding.mapContentModel(), "R1", "DE-LABEL-009 overlap");
        assertEquals("LABEL", binding.mapContentModel()
                        .resolvePointerTarget(overlappedLabelCenter.q(), overlappedLabelCenter.r())
                        .targetKind()
                        .name(),
                "DE-LABEL-008 overlapped label point resolves as a label target");

        doubleClickRenderedLabel(binding, overlappedLabelCenter, false);
        TextField inlineEditor = textField(binding.mapView(), "Dungeon map label editor");
        assertTrue(inlineEditor.isVisible(), "DE-LABEL-008 normal double-click opens inline label editor");
        assertEquals("Cluster " + ids.clusterId(), inlineEditor.getText(),
                "DE-LABEL-008 normal double-click uses cluster-label hit priority at overlap");
        inlineEditor.setText("   Inline Cluster   ");
        pressInlineEditorKey(inlineEditor, KeyCode.ENTER);
        assertTrue(!inlineEditor.isVisible(), "DE-LABEL-008 Enter commit hides inline cluster label editor");
        assertEquals("Inline Cluster", runtime.database().clusterName(ids.clusterId()),
                "DE-LABEL-008 inline cluster label edit trims and persists authored cluster name");
        assertEquals("R1", runtime.database().roomName(ids.roomId()),
                "DE-LABEL-008 inline cluster label edit does not mutate overlapped room name");
        assertTrue(renderHasLabelAt(binding.mapContentModel(), "Inline Cluster", overlappedLabelCenter.q(), overlappedLabelCenter.r()),
                "DE-LABEL-008 inline cluster label edit updates rendered label");

        doubleClickRenderedLabel(binding, overlappedLabelCenter, true);
        assertTrue(inlineEditor.isVisible(), "DE-LABEL-009 shifted double-click opens inline room label editor");
        assertEquals("R1", inlineEditor.getText(),
                "DE-LABEL-009 shifted double-click targets room label at the same overlapped point");
        inlineEditor.setText("   Cancelled Room   ");
        pressInlineEditorKey(inlineEditor, KeyCode.ESCAPE);
        assertTrue(!inlineEditor.isVisible(), "DE-LABEL-009 Escape cancel hides inline room label editor");
        assertEquals("R1", runtime.database().roomName(ids.roomId()),
                "DE-LABEL-009 Escape cancel does not persist room label text");
        fireMapShortcut(binding.mapView(), KeyCode.ESCAPE);
        assertTrue(!inlineEditor.isVisible(), "DE-LABEL-009 map keyboard route is ready after inline cancel");

        doubleClickRenderedLabel(binding, overlappedLabelCenter, true);
        assertTrue(inlineEditor.isVisible(), "DE-LABEL-009 shifted double-click reopens inline room label editor");
        typeInlineEditorTextSequentially(inlineEditor, "   Outside Draft   ");
        fireMapMouse(binding.mapView(), MouseEvent.MOUSE_MOVED, MouseButton.NONE, 12.0, 14.0, false);
        assertEquals("   Outside Draft   ", inlineEditor.getText(),
                "DE-LABEL-009 passive mouse move keeps inline room label draft");
        fireMapMouse(binding.mapView(), MouseEvent.MOUSE_DRAGGED, MouseButton.PRIMARY, 18.0, 22.0, false);
        assertEquals("   Outside Draft   ", inlineEditor.getText(),
                "DE-LABEL-009 passive map drag keeps inline room label draft");
        fireMapMouse(binding.mapView(), MouseEvent.MOUSE_RELEASED, MouseButton.PRIMARY, 18.0, 22.0, false);
        assertEquals("   Outside Draft   ", inlineEditor.getText(),
                "DE-LABEL-009 passive map release keeps inline room label draft");
        fireMapScroll(binding.mapView(), 18.0, 22.0, 64.0);
        assertEquals("   Outside Draft   ", inlineEditor.getText(),
                "DE-LABEL-009 passive map scroll keeps inline room label draft");
        assertEquals("R1", runtime.database().roomName(ids.roomId()),
                "DE-LABEL-009 passive outside input does not persist room label draft");
        fireMapMouse(binding.mapView(), MouseEvent.MOUSE_PRESSED, MouseButton.PRIMARY, 18.0, 22.0, false);
        fireMapMouse(binding.mapView(), MouseEvent.MOUSE_RELEASED, MouseButton.PRIMARY, 18.0, 22.0, false);
        assertTrue(!inlineEditor.isVisible(), "DE-LABEL-009 outside primary press cancels inline room label editor");
        assertEquals("R1", runtime.database().roomName(ids.roomId()),
                "DE-LABEL-009 outside primary press cancels without persisting room label draft");

        doubleClickRenderedLabel(binding, overlappedLabelCenter, true);
        assertTrue(inlineEditor.isVisible(), "DE-LABEL-009 shifted double-click reopens inline room label editor after outside cancel");
        typeInlineEditorTextSequentially(inlineEditor, "   Inline Room   ");
        assertEquals("   Inline Room   ", inlineEditor.getText(),
                "DE-LABEL-009 sequential typing accumulates inline room label text");
        binding.mapContentModel().panByPixels(8.0, 0.0);
        assertEquals("   Inline Room   ", inlineEditor.getText(),
                "DE-LABEL-009 redraw/resize update preserves in-progress room label text");
        pressInlineEditorKey(inlineEditor, KeyCode.ENTER);
        assertTrue(!inlineEditor.isVisible(), "DE-LABEL-009 Enter commit hides inline room label editor");
        assertEquals("Inline Room", runtime.database().roomName(ids.roomId()),
                "DE-LABEL-009 inline room label edit trims and persists authored room name");
        assertEquals("Inline Cluster", runtime.database().clusterName(ids.clusterId()),
                "DE-LABEL-009 inline room label edit does not mutate overlapped cluster name");
        assertTrue(renderHasLabelAt(binding.mapContentModel(), "Inline Room", overlappedLabelCenter.q(), overlappedLabelCenter.r()),
                "DE-LABEL-009 inline room label edit updates rendered label");

        selectMap(controls, "Direct Label Edit Reload Hop");
        selectMap(controls, "Direct Label Edit Map");
        assertEquals("Inline Cluster", runtime.database().clusterName(ids.clusterId()),
                "DE-LABEL-008 reload preserves inline cluster name");
        assertEquals("Inline Room", runtime.database().roomName(ids.roomId()),
                "DE-LABEL-009 reload preserves inline room name");
        assertTrue(renderHasLabelAt(binding.mapContentModel(), "Inline Cluster", overlappedLabelCenter.q(), overlappedLabelCenter.r()),
                "DE-LABEL-008 reload renders inline cluster name");
        assertTrue(renderHasLabelAt(binding.mapContentModel(), "Inline Room", overlappedLabelCenter.q(), overlappedLabelCenter.r()),
                "DE-LABEL-009 reload renders inline room name");

        results.add("DE-LABEL-008 Ready: DungeonMapView normal double-click on overlapped F1 cluster label "
                + "opens inline editor and saves through shared label-name service");
        results.add("DE-LABEL-009 Ready: DungeonMapView shifted double-click on overlapped F1 room label "
                + "proves sequential typing, redraw preservation, passive outside input preserves the draft, "
                + "deliberate outside primary press cancels without persistence, Enter commits, Escape cancels, "
                + "and reload persistence remains covered");
    }

    private static void assertRoomLabelHitAndEditorPresentation(
            HarnessBinding binding,
            HarnessRuntime runtime,
            RoomClusterIds roomIds,
            LabelCenter roomLabelCenter,
            LabelText roomLabelText
    ) {
        boolean vertical = Math.abs(roomLabelText.rotationDegrees() - 90.0) < 0.01;
        double visibleQ = vertical
                ? roomLabelCenter.q()
                : roomLabelCenter.q() + roomLabelText.width() / 2.0 - 0.05;
        double visibleR = vertical
                ? roomLabelCenter.r() + roomLabelText.width() / 2.0 - 0.05
                : roomLabelCenter.r();
        assertTrue(binding.mapContentModel()
                        .resolveRoomLabelPointerTarget(visibleQ, visibleR)
                        .isRoomLabelTarget(),
                "DE-LABEL-004 visible room label span resolves as room label target");

        doubleClickRenderedLabel(binding, new LabelCenter(visibleQ, visibleR), true);
        TextField inlineEditor = textField(binding.mapView(), "Dungeon map label editor");
        assertTrue(inlineEditor.isVisible(), "DE-LABEL-004 visible room label span opens inline editor");
        assertDoubleEquals(roomLabelText.rotationDegrees(), inlineEditor.getRotate(),
                "DE-LABEL-004 inline editor uses rendered room label rotation");
        inlineEditor.setText("   Label Cancel   ");
        binding.mapContentModel().panByPixels(6.0, 0.0);
        assertEquals("   Label Cancel   ", inlineEditor.getText(),
                "DE-LABEL-004 label editor redraw preserves in-progress text");
        pressInlineEditorKey(inlineEditor, KeyCode.ESCAPE);
        assertTrue(!inlineEditor.isVisible(), "DE-LABEL-004 Escape hides inline editor");
        assertEquals("R1", runtime.database().roomName(roomIds.roomId()),
                "DE-LABEL-004 editor Escape does not persist room label text");
        assertTrue(mapCanvasLayer(binding.mapView()).isFocused(),
                "DE-LABEL-004 canvas focus returns after rotated inline editor cancel");
    }

    private static void verifyComplexClusterLabel(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();

        long mapId = createMapThroughControls(controls, runtime, "Complex Cluster Handles Map");
        runtime.database().seedF15ComplexCluster(mapId);
        createMapThroughControls(controls, runtime, "Complex Cluster Handles Reload Hop");
        selectMap(controls, "Complex Cluster Handles Map");

        DungeonEditorMapSurfaceSnapshot snapshot = runtime.mapSurfaceModel().current();
        DungeonEditorHandleSnapshot label = singleClusterLabel(snapshot, "DE-LABEL-002");
        assertEquals(11, label.cell().q(), "DE-LABEL-002 label centroid q");
        assertEquals(11, label.cell().r(), "DE-LABEL-002 label centroid r");
        assertEquals(0, label.cell().level(), "DE-LABEL-002 label centroid level");
        assertTrue(!hasClusterLabelAt(snapshot, 10, 10, 0),
                "DE-LABEL-002 label does not use the authored cluster center");
        assertTrue(renderHasLabelAt(binding.mapContentModel(), label.label(), 11.5, 11.5),
                "DE-LABEL-002 render scene places the cluster label at the published centroid cell");
        results.add("DE-LABEL-002 Ready: F15_COMPLEX_CLUSTER label uses authored floor-cell centroid");
    }

    private static void verifyComplexClusterLabelAndHandles(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();

        long mapId = createMapThroughControls(controls, runtime, "Complex Cluster Handles Map");
        runtime.database().seedF15ComplexCluster(mapId);
        createMapThroughControls(controls, runtime, "Complex Cluster Handles Reload Hop");
        selectMap(controls, "Complex Cluster Handles Map");

        DungeonEditorMapSurfaceSnapshot snapshot = runtime.mapSurfaceModel().current();
        assertClusterCorners(snapshot, Set.of(
                "10,10,0",
                "13,10,0",
                "13,11,0",
                "11,11,0",
                "11,13,0",
                "10,13,0"));
        assertTrue(!hasHandleAt(snapshot, CLUSTER_CORNER_KIND, 13, 13, 0),
                "DE-CLUSTER-001 does not publish the missing bounding-box corner");
        assertWallRunHandles(snapshot, Set.of(
                "11,10,0,NORTH@11.0,10.0",
                "12,11,0,SOUTH@12.0,11.0",
                "11,12,0,EAST@11.0,12.0",
                "10,11,0,WEST@10.0,11.0"));
        assertNotHandleTarget(binding.mapContentModel(), 11.0, 10.0,
                "DE-HANDLE-002 cluster wall-run handle is not hittable before cluster selection");
        click(button(controls, "Auswahl"));
        selectClusterArea(runtime, binding, 10.25, 10.25, "DE-HANDLE-002");
        assertTrue(renderHasWallRunMarkerAt(binding.mapContentModel(), 11.0, 10.0),
                "DE-CLUSTER-001 area-selected render scene places a smaller horizontal wall-run handle on the wall line");
        assertEquals("HANDLE", binding.mapContentModel().resolvePointerTarget(11.0, 10.0).targetKind().name(),
                "DE-HANDLE-002 area-selected cluster wall-run handle resolves as a handle target");
        assertWallRunSourceEdgesPresent(snapshot, "DE-HANDLE-002");
        results.add("DE-CLUSTER-001 Ready: F15_COMPLEX_CLUSTER publishes true corner handles and source-edged wall-run midpoint handles");
    }

    private static void verifySharedHandleIdentityAndPassiveRefs(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();

        long mapId = createMapThroughControls(controls, runtime, "Handle Variety Map");
        runtime.database().seedF15ComplexCluster(mapId);
        runtime.database().seedCorridorWithAnchor(mapId);
        runtime.database().seedF7StairAnchor(mapId);
        createMapThroughControls(controls, runtime, "Handle Variety Reload Hop");
        selectMap(controls, "Handle Variety Map");

        DungeonEditorMapSurfaceSnapshot snapshot = runtime.mapSurfaceModel().current();
        assertHandleIdentityShape(snapshot, DungeonEditorHandleKind.CLUSTER_CORNER, "DE-HANDLE-001 cluster corner");
        assertHandleIdentityShape(snapshot, DungeonEditorHandleKind.CLUSTER_WALL_RUN, "DE-HANDLE-001 cluster wall-run");
        assertHandleIdentityShape(snapshot, DungeonEditorHandleKind.DOOR, "DE-HANDLE-001 door");
        assertHandleIdentityShape(snapshot, DungeonEditorHandleKind.CORRIDOR_ANCHOR, "DE-HANDLE-001 corridor anchor");
        assertHandleIdentityShape(snapshot, DungeonEditorHandleKind.CORRIDOR_WAYPOINT, "DE-HANDLE-001 corridor waypoint");
        assertHandleIdentityShape(snapshot, DungeonEditorHandleKind.STAIR_ANCHOR, "DE-HANDLE-001 stair anchor");

        DungeonEditorHandleSnapshot doorHandle =
                firstDoorHandleForDirection(snapshot, "EAST", "DE-HANDLE-001 door");
        DungeonEditorHandleSnapshot corridorAnchor =
                firstHandle(snapshot, DungeonEditorHandleKind.CORRIDOR_ANCHOR, "DE-HANDLE-001 corridor anchor");
        DungeonEditorHandleSnapshot corridorWaypoint =
                firstHandle(snapshot, DungeonEditorHandleKind.CORRIDOR_WAYPOINT, "DE-HANDLE-001 corridor waypoint");
        assertEquals("HANDLE", binding.mapContentModel().resolvePointerTarget(doorHandle.markerQ(), doorHandle.markerR()).targetKind().name(),
                "DE-HANDLE-001 door handle ref is a canvas drag handle");
        assertNotHandleTarget(binding.mapContentModel(), corridorAnchor.markerQ(), corridorAnchor.markerR(),
                "DE-HANDLE-001 corridor anchor ref is not a canvas drag handle");
        assertNotHandleTarget(binding.mapContentModel(), corridorWaypoint.markerQ(), corridorWaypoint.markerR(),
                "DE-HANDLE-001 corridor waypoint ref is not a canvas drag handle");

        results.add("DE-HANDLE-001 Ready: F16_HANDLE_VARIETY publishes one common handle identity shape "
                + "while door refs are canvas handles and corridor refs remain passive outside their focused edit routes");
    }

    private static void verifyDoorHandleDrag(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();

        long mapId = createMapThroughControls(controls, runtime, "Door Handle Drag Map");
        runtime.database().seedF15ComplexCluster(mapId);
        runtime.database().seedCorridorWithAnchor(mapId);
        runtime.database().seedF7StairAnchor(mapId);
        createMapThroughControls(controls, runtime, "Door Handle Drag Reload Hop");
        selectMap(controls, "Door Handle Drag Map");

        DungeonEditorMapSurfaceSnapshot snapshot = runtime.mapSurfaceModel().current();
        DungeonEditorHandleSnapshot doorHandle =
                firstDoorHandleForDirection(snapshot, "EAST", "DE-DOOR-004 door");
        assertEquals("HANDLE", binding.mapContentModel().resolvePointerTarget(doorHandle.markerQ(), doorHandle.markerR()).targetKind().name(),
                "DE-DOOR-004 door handle resolves as canvas drag handle");
        assertDoorHandleDrag(runtime, binding, mapView, mapId, doorHandle);

        results.add("DE-DOOR-004 Ready: published door handle drag previews, commits the authored door boundary, and reloads");
        results.add("DE-HANDLE-006 Ready: door handle drag preview stays within the editor latency budget");
    }

    private static void verifySelectedWallRunHandleStyle(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();

        long mapId = createMapThroughControls(controls, runtime, "Wall Run Handle Style Map");
        runtime.database().seedF15ComplexCluster(mapId);
        runtime.database().seedCorridorWithAnchor(mapId);
        runtime.database().seedF7StairAnchor(mapId);
        createMapThroughControls(controls, runtime, "Wall Run Handle Style Reload Hop");
        selectMap(controls, "Wall Run Handle Style Map");

        DungeonEditorMapSurfaceSnapshot snapshot = runtime.mapSurfaceModel().current();
        firstHandle(snapshot, DungeonEditorHandleKind.CLUSTER_WALL_RUN, "DE-HANDLE-004 wall-run");
        click(button(controls, "Auswahl"));
        selectClusterArea(runtime, binding, 10.25, 10.25, "DE-HANDLE-004");
        assertTrue(renderHasWallRunMarkerAt(binding.mapContentModel(), 11.0, 10.0),
                "DE-HANDLE-004 area-selected F16 wall-run marker remains smaller and less obstructive than a cluster corner");

        results.add("DE-HANDLE-004 Ready: F16_HANDLE_VARIETY confirms wall-run handle style stays smaller "
                + "and less obstructive than cluster corner handles while selected");
    }

    private static void verifyComplexClusterTrueCornerDrag(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();

        long mapId = createMapThroughControls(controls, runtime, "Complex Cluster Corner Move Map");
        runtime.database().seedF15ComplexCluster(mapId);
        createMapThroughControls(controls, runtime, "Complex Cluster Corner Move Reload Hop");
        selectMap(controls, "Complex Cluster Corner Move Map");
        click(button(controls, "Auswahl"));
        selectClusterLabel(runtime, binding, "DE-CLUSTER-003");

        DungeonEditorMapSurfaceSnapshot initialSurface = runtime.mapSurfaceModel().current();
        DungeonEditorHandleSnapshot cornerHandle =
                firstClusterCornerHandleAt(initialSurface, 13, 11, 0, "DE-CLUSTER-003");
        long clusterId = cornerHandle.ref().clusterId();
        long geometryRowsBefore = runtime.database().countAuthoredGeometryRows(mapId);
        List<String> authoredStateBefore = runtime.database().authoredGeometryState(mapId);
        List<String> boundaryRowsBefore = runtime.database().roomBoundaryEdgeState(mapId);
        Set<String> cellsBefore = surfaceCellSet(initialSurface);
        assertEquals(Set.of("10,10,0", "13,10,0", "13,11,0", "11,11,0", "11,13,0", "10,13,0"),
                runtime.database().authoredClusterBoundaryCorners(clusterId),
                "DE-CLUSTER-003 starts from F15 true authored boundary corners");
        assertEquals("HANDLE", binding.mapContentModel().resolvePointerTarget(13.0, 11.0).targetKind().name(),
                "DE-CLUSTER-003 resolves the true inner corner as a handle");

        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_PRESSED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(13.0),
                viewport.sceneToScreenY(11.0),
                false);
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_DRAGGED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(14.0),
                viewport.sceneToScreenY(12.0),
                false);

        DungeonEditorMapSurfaceSnapshot previewSurface = runtime.mapSurfaceModel().current();
        assertEquals(geometryRowsBefore, runtime.database().countAuthoredGeometryRows(mapId),
                "DE-CLUSTER-003 drag preview leaves authored DB row count unchanged");
        assertEquals(authoredStateBefore, runtime.database().authoredGeometryState(mapId),
                "DE-CLUSTER-003 drag preview leaves all authored geometry stores unchanged");
        assertEquals(boundaryRowsBefore, runtime.database().roomBoundaryEdgeState(mapId),
                "DE-CLUSTER-003 drag preview leaves persisted boundary rows unchanged");
        assertTrue(previewSurface.preview() instanceof DungeonEditorPreview.MoveHandlePreview,
                "DE-CLUSTER-003 publishes a move-handle preview during true-corner drag");
        DungeonEditorPreview.MoveHandlePreview preview =
                (DungeonEditorPreview.MoveHandlePreview) previewSurface.preview();
        assertEquals(cornerHandle.ref().kind(), preview.handleRef().kind(),
                "DE-CLUSTER-003 preview handle kind");
        assertEquals(1L, preview.deltaQ(), "DE-CLUSTER-003 preview delta q");
        assertEquals(1L, preview.deltaR(), "DE-CLUSTER-003 preview delta r");
        assertEquals(0L, preview.deltaLevel(), "DE-CLUSTER-003 preview delta level");

        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_RELEASED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(14.0),
                viewport.sceneToScreenY(12.0),
                false);

        DungeonEditorMapSurfaceSnapshot committedSurface = runtime.mapSurfaceModel().current();
        assertEquals(DungeonEditorPreview.none(), committedSurface.preview(),
                "DE-CLUSTER-003 clears true-corner move preview after release");
        Set<String> committedCorners = runtime.database().authoredClusterBoundaryCorners(clusterId);
        assertTrue(committedCorners.contains("14,12,0"),
                "DE-CLUSTER-003 persists the dragged true corner at the target point");
        assertTrue(!committedCorners.contains("13,13,0"),
                "DE-CLUSTER-003 still does not fall back to the missing bounding-box corner");
        assertTrue(!cellsBefore.equals(surfaceCellSet(committedSurface)),
                "DE-CLUSTER-003 committed surface cells change after true-corner move");
        assertTrue(!boundaryRowsBefore.equals(runtime.database().roomBoundaryEdgeState(mapId)),
                "DE-CLUSTER-003 recomputes persisted boundary rows after release");
        assertEquals(runtime.database().countWallBoundaryRows(mapId),
                runtime.database().countDistinctWallBoundaryTopologyRefs(mapId),
                "DE-CLUSTER-003 persists no duplicate wall topology refs on boundary rows");
        assertEquals(0L, runtime.database().countUnreferencedWallTopologyElements(mapId),
                "DE-CLUSTER-003 leaves no orphan wall topology rows");
        assertClusterCornerHandleAt(committedSurface, 14, 12, 0, "DE-CLUSTER-003");
        assertTrue(renderHasBoundaryNear(binding.mapContentModel(), "WALL", 14.0, 11.5),
                "DE-CLUSTER-003 render scene redraws the moved vertical wall span");
        assertTrue(renderHasBoundaryNear(binding.mapContentModel(), "WALL", 13.5, 12.0),
                "DE-CLUSTER-003 render scene redraws the moved horizontal wall span");

        selectMap(controls, "Complex Cluster Corner Move Reload Hop");
        selectMap(controls, "Complex Cluster Corner Move Map");
        assertTrue(runtime.database().authoredClusterBoundaryCorners(clusterId).contains("14,12,0"),
                "DE-CLUSTER-003 reload keeps the dragged true corner");
        assertClusterCornerHandleAt(runtime.mapSurfaceModel().current(), 14, 12, 0, "DE-CLUSTER-003 reload");
        assertTrue(renderHasBoundaryNear(binding.mapContentModel(), "WALL", 14.0, 11.5),
                "DE-CLUSTER-003 reload render keeps the moved vertical wall span");
        assertTrue(renderHasBoundaryNear(binding.mapContentModel(), "WALL", 13.5, 12.0),
                "DE-CLUSTER-003 reload render keeps the moved horizontal wall span");

        results.add("DE-CLUSTER-003 Ready: F15_COMPLEX_CLUSTER true-corner drag commits through SQLite and reload");
    }

    private static void verifyComplexClusterWallRunDrag(List<String> results) {
        HarnessRuntime runtime = HarnessRuntime.create();
        HarnessBinding binding = bindHarness(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();

        long mapId = createMapThroughControls(controls, runtime, "Complex Cluster Wall Run Move Map");
        runtime.database().seedF15ComplexCluster(mapId);
        createMapThroughControls(controls, runtime, "Complex Cluster Wall Run Move Reload Hop");
        selectMap(controls, "Complex Cluster Wall Run Move Map");
        click(button(controls, "Auswahl"));
        selectClusterArea(runtime, binding, 10.25, 10.25, "DE-CLUSTER-002");

        DungeonEditorMapSurfaceSnapshot initialSurface = runtime.mapSurfaceModel().current();
        assertWallRunHandleTargets(binding.mapContentModel(), "DE-CLUSTER-002");
        DungeonEditorHandleSnapshot wallRunHandle =
                firstClusterWallRunHandleAt(initialSurface, 11, 10, 0, "NORTH", "DE-CLUSTER-002");
        long clusterId = wallRunHandle.ref().clusterId();
        long geometryRowsBefore = runtime.database().countAuthoredGeometryRows(mapId);
        List<String> authoredStateBefore = runtime.database().authoredGeometryState(mapId);
        List<String> boundaryRowsBefore = runtime.database().roomBoundaryEdgeState(mapId);
        RoomClusterIds roomIdsBefore = runtime.database().roomByName(mapId, "R1");
        assertEquals("HANDLE", binding.mapContentModel().resolvePointerTarget(11.0, 10.0).targetKind().name(),
                "DE-CLUSTER-002 wall-run midpoint resolves as handle before drag");

        assertInvalidWallRunDragRejected(runtime, binding, mapId);

        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_PRESSED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(11.0),
                viewport.sceneToScreenY(10.0),
                false);
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_DRAGGED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(11.0),
                viewport.sceneToScreenY(9.0),
                false);

        DungeonEditorMapSurfaceSnapshot previewSurface = runtime.mapSurfaceModel().current();
        assertEquals(geometryRowsBefore, runtime.database().countAuthoredGeometryRows(mapId),
                "DE-HANDLE-003 wall-run drag preview leaves authored DB row count unchanged");
        assertEquals(authoredStateBefore, runtime.database().authoredGeometryState(mapId),
                "DE-HANDLE-003 wall-run drag preview leaves all authored geometry stores unchanged");
        assertEquals(boundaryRowsBefore, runtime.database().roomBoundaryEdgeState(mapId),
                "DE-HANDLE-003 wall-run drag preview leaves persisted boundary rows unchanged");
        assertTrue(previewSurface.preview() instanceof DungeonEditorPreview.MoveBoundaryStretchPreview,
                "DE-HANDLE-003 wall-run drag publishes boundary-stretch preview");
        DungeonEditorPreview.MoveBoundaryStretchPreview preview =
                (DungeonEditorPreview.MoveBoundaryStretchPreview) previewSurface.preview();
        assertEquals(clusterId, preview.clusterId(),
                "DE-HANDLE-003 wall-run preview cluster id");
        assertTrue(preview.sourceEdges().size() > 1,
                "DE-HANDLE-003 wall-run preview covers the contiguous wall run");
        assertEquals(0L, preview.deltaQ(), "DE-CLUSTER-002 preview delta q");
        assertEquals(-1L, preview.deltaR(), "DE-CLUSTER-002 preview delta r");
        assertEquals(0L, preview.deltaLevel(), "DE-CLUSTER-002 preview delta level");

        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_RELEASED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(11.0),
                viewport.sceneToScreenY(9.0),
                false);

        DungeonEditorMapSurfaceSnapshot committedSurface = runtime.mapSurfaceModel().current();
        assertEquals(DungeonEditorPreview.none(), committedSurface.preview(),
                "DE-CLUSTER-002 clears wall-run preview after release");
        assertEquals(roomIdsBefore, runtime.database().roomByName(mapId, "R1"),
                "DE-CLUSTER-002 wall-run drag keeps room and cluster identity");
        assertTrue(!boundaryRowsBefore.equals(runtime.database().roomBoundaryEdgeState(mapId)),
                "DE-CLUSTER-002 recomputes persisted boundary rows after wall-run release");
        assertEquals(runtime.database().countWallBoundaryRows(mapId),
                runtime.database().countDistinctWallBoundaryTopologyRefs(mapId),
                "DE-CLUSTER-002 persists no duplicate wall topology refs on boundary rows");
        assertEquals(0L, runtime.database().countUnreferencedWallTopologyElements(mapId),
                "DE-CLUSTER-002 leaves no orphan wall topology rows");
        assertTrue(runtime.database().authoredClusterBoundaryCorners(clusterId).containsAll(Set.of("10,9,0", "13,9,0")),
                "DE-CLUSTER-002 persists the dragged full wall-run endpoints");

        selectMap(controls, "Complex Cluster Wall Run Move Reload Hop");
        selectMap(controls, "Complex Cluster Wall Run Move Map");
        assertEquals(roomIdsBefore, runtime.database().roomByName(mapId, "R1"),
                "DE-CLUSTER-002 reload keeps room and cluster identity");
        assertEquals(0L, runtime.database().countUnreferencedWallTopologyElements(mapId),
                "DE-CLUSTER-002 reload keeps no orphan wall topology rows");
        assertTrue(runtime.database().authoredClusterBoundaryCorners(clusterId).containsAll(Set.of("10,9,0", "13,9,0")),
                "DE-CLUSTER-002 reload keeps the dragged full wall-run endpoints");

        results.add("DE-CLUSTER-002 Ready: F15_COMPLEX_CLUSTER wall-run drag previews, commits, reloads, "
                + "preserves identity, and rejects invalid geometry atomically");
        results.add("DE-HANDLE-002 Ready: Shared canvas handle hit route includes selected cluster wall-run and "
                + "selected cluster corner only");
        results.add("DE-HANDLE-003 Ready: Cluster wall-run drags publish boundary-stretch preview before persistence");
    }

    private static void assertInvalidWallRunDragRejected(
            HarnessRuntime runtime,
            HarnessBinding binding,
            long mapId
    ) {
        DungeonEditorMapSurfaceSnapshot before = runtime.mapSurfaceModel().current();
        DungeonEditorHandleSnapshot invalidHandle =
                firstClusterWallRunHandleAt(before, 11, 10, 0, "NORTH", "DE-CLUSTER-002 invalid");
        long geometryRowsBefore = runtime.database().countAuthoredGeometryRows(mapId);
        List<String> authoredStateBefore = runtime.database().authoredGeometryState(mapId);
        List<String> boundaryRowsBefore = runtime.database().roomBoundaryEdgeState(mapId);

        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();
        fireMapMouse(
                binding.mapView(),
                MouseEvent.MOUSE_PRESSED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(invalidHandle.markerQ()),
                viewport.sceneToScreenY(invalidHandle.markerR()),
                false);
        DungeonEditorMapSurfaceSnapshot afterPress = runtime.mapSurfaceModel().current();
        fireMapMouse(
                binding.mapView(),
                MouseEvent.MOUSE_DRAGGED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(invalidHandle.markerQ()),
                viewport.sceneToScreenY(invalidHandle.markerR() + 6.0),
                false);
        fireMapMouse(
                binding.mapView(),
                MouseEvent.MOUSE_RELEASED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(invalidHandle.markerQ()),
                viewport.sceneToScreenY(invalidHandle.markerR() + 6.0),
                false);

        DungeonEditorMapSurfaceSnapshot after = runtime.mapSurfaceModel().current();
        assertEquals(geometryRowsBefore, runtime.database().countAuthoredGeometryRows(mapId),
                "DE-CLUSTER-002 invalid wall-run drag leaves authored DB row count unchanged");
        assertEquals(authoredStateBefore, runtime.database().authoredGeometryState(mapId),
                "DE-CLUSTER-002 invalid wall-run drag leaves all authored geometry stores unchanged");
        assertEquals(boundaryRowsBefore, runtime.database().roomBoundaryEdgeState(mapId),
                "DE-CLUSTER-002 invalid wall-run drag leaves persisted boundary rows unchanged");
        assertEquals(before.surface().map(), after.surface().map(),
                "DE-CLUSTER-002 invalid wall-run drag keeps published map unchanged");
        assertEquals(afterPress.selection(), after.selection(),
                "DE-CLUSTER-002 invalid wall-run drag keeps post-press selection unchanged");
        assertEquals(DungeonEditorPreview.none(), after.preview(),
                "DE-CLUSTER-002 invalid wall-run drag clears preview without committing");
    }

    private static void assertClusterLabelSelection(
            HarnessRuntime runtime,
            long clusterId,
            String message
    ) {
        DungeonEditorStateSnapshot.Selection selection = runtime.stateModel().current().selection();
        assertEquals(clusterId, selection.clusterId(), message + " cluster id");
        assertTrue(selection.clusterSelection(), message + " selects cluster-name target");
        assertTrue(selection.handleRef() != null
                        && selection.handleRef().kind() == DungeonEditorHandleKind.CLUSTER_LABEL,
                message + " keeps cluster-label handle identity");
    }

    private static DungeonEditorHandleSnapshot selectClusterLabel(
            HarnessRuntime runtime,
            HarnessBinding binding,
            String message
    ) {
        DungeonEditorMapSurfaceSnapshot snapshot = runtime.mapSurfaceModel().current();
        DungeonEditorHandleSnapshot label = singleClusterLabel(snapshot, message);
        return selectClusterLabel(runtime, binding, label, message);
    }

    private static DungeonEditorHandleSnapshot selectClusterLabel(
            HarnessRuntime runtime,
            HarnessBinding binding,
            long clusterId,
            String message
    ) {
        DungeonEditorMapSurfaceSnapshot snapshot = runtime.mapSurfaceModel().current();
        DungeonEditorHandleSnapshot label = snapshot.surface().map().editorHandles().stream()
                .filter(handle -> handle.ref().kind() == DungeonEditorHandleKind.CLUSTER_LABEL)
                .filter(handle -> handle.ref().clusterId() == clusterId)
                .findFirst()
                .orElseThrow(() -> new AssertionError(message + " cluster label not published for " + clusterId));
        return selectClusterLabel(runtime, binding, label, message);
    }

    private static DungeonEditorHandleSnapshot selectClusterLabel(
            HarnessRuntime runtime,
            HarnessBinding binding,
            DungeonEditorHandleSnapshot label,
            String message
    ) {
        clickMap(
                binding.mapView(),
                binding.mapContentModel(),
                label.cell().q() + 0.5,
                label.cell().r() + 0.5);
        assertClusterLabelSelection(runtime, label.ref().clusterId(), message + " selected cluster label");
        return label;
    }

    private static void selectClusterArea(
            HarnessRuntime runtime,
            HarnessBinding binding,
            double q,
            double r,
            String message
    ) {
        clickMap(binding.mapView(), binding.mapContentModel(), q, r);
        DungeonEditorStateSnapshot.Selection selection = runtime.stateModel().current().selection();
        assertEquals("ROOM", selection.topologyRef().kind(), message + " area selection topology kind");
        assertTrue(selection.clusterId() > 0L, message + " area selection keeps cluster id");
        assertTrue(selection.clusterSelection(), message + " area selection activates cluster handles");
        assertEquals(null, selection.handleRef(), message + " area selection does not fake a cluster-label handle");
    }

    private static void assertNotHandleTarget(
            DungeonMapContentModel mapContentModel,
            double q,
            double r,
            String message
    ) {
        assertTrue(!"HANDLE".equals(mapContentModel.resolvePointerTarget(q, r).targetKind().name()), message);
    }

    private static void assertDoorHandleDrag(
            HarnessRuntime runtime,
            HarnessBinding binding,
            DungeonMapView mapView,
            long mapId,
            DungeonEditorHandleSnapshot doorHandle
    ) {
        long doorRowsBefore = runtime.database().countDoorBoundariesAt(mapId, 1, 0, "EAST");
        List<String> authoredStateBefore = runtime.database().authoredGeometryState(mapId);
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_PRESSED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(doorHandle.markerQ()),
                viewport.sceneToScreenY(doorHandle.markerR()),
                false);
        long previewStartNanos = System.nanoTime();
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_DRAGGED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(doorHandle.markerQ()),
                viewport.sceneToScreenY(doorHandle.markerR() + 1.0),
                false);
        long previewElapsedMillis = (System.nanoTime() - previewStartNanos) / 1_000_000L;
        assertTrue(previewElapsedMillis <= DRAG_PREVIEW_LATENCY_BUDGET_MS,
                "DE-HANDLE-006 door drag preview stays within latency budget: " + previewElapsedMillis + "ms");

        DungeonEditorMapSurfaceSnapshot previewSurface = runtime.mapSurfaceModel().current();
        assertTrue(previewSurface.preview() instanceof DungeonEditorPreview.MoveHandlePreview,
                "DE-HANDLE-006 door drag publishes a move-handle preview");
        DungeonEditorPreview.MoveHandlePreview preview =
                (DungeonEditorPreview.MoveHandlePreview) previewSurface.preview();
        assertEquals(DungeonEditorHandleKind.DOOR, preview.handleRef().kind(),
                "DE-HANDLE-006 preview handle kind");
        assertEquals(0L, preview.deltaQ(), "DE-HANDLE-006 preview delta q");
        assertEquals(1L, preview.deltaR(), "DE-HANDLE-006 preview delta r");
        assertTrue(renderHasDoorMarkerAt(
                        binding.mapContentModel(),
                        movedDoorMarkerQ(doorHandle, 0),
                        movedDoorMarkerR(doorHandle, 1)),
                "DE-HANDLE-006 render scene shows door preview marker at the moved boundary midpoint; actual door glyphs "
                        + renderedDoorMarkers(binding.mapContentModel()));
        assertEquals(doorRowsBefore, runtime.database().countDoorBoundariesAt(mapId, 1, 0, "EAST"),
                "DE-HANDLE-006 door preview keeps persisted source door row");
        assertEquals(authoredStateBefore, runtime.database().authoredGeometryState(mapId),
                "DE-HANDLE-006 door preview leaves authored stores unchanged");

        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_RELEASED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(doorHandle.markerQ()),
                viewport.sceneToScreenY(doorHandle.markerR() + 1.0),
                false);

        assertEquals(0L, runtime.database().countDoorBoundariesAt(mapId, 1, 0, "EAST"),
                "DE-DOOR-004 release moves the source door row away");
        assertEquals(1L, runtime.database().countDoorBoundariesAt(mapId, 1, 1, "EAST"),
                "DE-DOOR-004 release persists the moved door row");
        assertEquals(DungeonEditorPreview.none(), runtime.mapSurfaceModel().current().preview(),
                "DE-DOOR-004 release clears door preview");
    }

    private static void assertRoomLabelSelectionAndNoClusterDrag(
            HarnessRuntime runtime,
            HarnessBinding binding,
            long mapId,
            RoomClusterIds roomIds,
            LabelCenter labelCenter,
            long geometryRowsBefore,
            List<String> authoredStateBefore,
            List<String> boundaryRowsBefore
    ) {
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();
        fireMapMouse(
                binding.mapView(),
                MouseEvent.MOUSE_PRESSED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(labelCenter.q()),
                viewport.sceneToScreenY(labelCenter.r()),
                false);

        DungeonEditorStateSnapshot.Selection selectedRoom = runtime.stateModel().current().selection();
        assertEquals("ROOM", selectedRoom.topologyRef().kind(),
                "DE-LABEL-007 room label selects room topology");
        assertEquals(roomIds.roomId(), selectedRoom.topologyRef().id(),
                "DE-LABEL-007 room label selects room id");
        assertEquals(roomIds.clusterId(), selectedRoom.clusterId(),
                "DE-LABEL-007 room label preserves owning cluster id without cluster selection");
        assertTrue(!selectedRoom.clusterSelection(),
                "DE-LABEL-007 room label does not select cluster-name target");
        assertEquals(null, selectedRoom.handleRef(),
                "DE-LABEL-007 room label does not publish a draggable cluster-label handle");

        fireMapMouse(
                binding.mapView(),
                MouseEvent.MOUSE_DRAGGED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(labelCenter.q() + 1.0),
                viewport.sceneToScreenY(labelCenter.r()),
                false);
        assertEquals(DungeonEditorPreview.none(), runtime.mapSurfaceModel().current().preview(),
                "DE-LABEL-007 room label drag does not publish a cluster move preview");

        fireMapMouse(
                binding.mapView(),
                MouseEvent.MOUSE_RELEASED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(labelCenter.q() + 1.0),
                viewport.sceneToScreenY(labelCenter.r()),
                false);
        assertEquals(DungeonEditorPreview.none(), runtime.mapSurfaceModel().current().preview(),
                "DE-LABEL-007 room label drag release keeps preview clear");
        assertEquals(geometryRowsBefore, runtime.database().countAuthoredGeometryRows(mapId),
                "DE-LABEL-007 room label drag leaves authored geometry row count unchanged");
        assertEquals(authoredStateBefore, runtime.database().authoredGeometryState(mapId),
                "DE-LABEL-007 room label drag leaves all authored geometry stores unchanged");
        assertEquals(boundaryRowsBefore, runtime.database().roomBoundaryEdgeState(mapId),
                "DE-LABEL-007 room label drag leaves boundary geometry unchanged");
    }

    private static DungeonEditorHandleSnapshot singleClusterLabel(
            DungeonEditorMapSurfaceSnapshot snapshot,
            String message
    ) {
        List<DungeonEditorHandleSnapshot> labels = snapshot.surface().map().editorHandles().stream()
                .filter(handle -> "CLUSTER_LABEL".equals(handle.ref().kind().name()))
                .toList();
        assertEquals(1, labels.size(), message + " publishes one cluster label");
        return labels.getFirst();
    }

    private static boolean hasClusterLabelAt(
            DungeonEditorMapSurfaceSnapshot snapshot,
            int q,
            int r,
            int level
    ) {
        return hasHandleAt(snapshot, "CLUSTER_LABEL", q, r, level);
    }

    private static boolean hasHandleAt(
            DungeonEditorMapSurfaceSnapshot snapshot,
            String kind,
            int q,
            int r,
            int level
    ) {
        return snapshot.surface().map().editorHandles().stream()
                .anyMatch(handle -> kind.equals(handle.ref().kind().name())
                        && handle.cell().q() == q
                        && handle.cell().r() == r
                        && handle.cell().level() == level);
    }

    private static void assertClusterCorners(
            DungeonEditorMapSurfaceSnapshot snapshot,
            Set<String> expected
    ) {
        Set<String> actual = snapshot.surface().map().editorHandles().stream()
                .filter(handle -> CLUSTER_CORNER_KIND.equals(handle.ref().kind().name()))
                .map(DungeonEditorClusterLabelHandleHarness::handleCellKey)
                .collect(java.util.stream.Collectors.toCollection(java.util.LinkedHashSet::new));
        assertEquals(expected, actual, "DE-CLUSTER-001 authored corner handle set");
    }

    private static void assertWallRunHandles(
            DungeonEditorMapSurfaceSnapshot snapshot,
            Set<String> expected
    ) {
        Set<String> actual = snapshot.surface().map().editorHandles().stream()
                .filter(handle -> CLUSTER_WALL_RUN_KIND.equals(handle.ref().kind().name()))
                .map(handle -> handleCellKey(handle)
                        + "," + handle.ref().direction()
                        + "@" + handle.markerQ()
                        + "," + handle.markerR())
                .collect(java.util.stream.Collectors.toCollection(java.util.LinkedHashSet::new));
        assertEquals(expected, actual, "DE-CLUSTER-001 wall-run geometric marker set");
    }

    private static void assertWallRunSourceEdgesPresent(
            DungeonEditorMapSurfaceSnapshot snapshot,
            String message
    ) {
        List<DungeonEditorHandleSnapshot> wallRuns = snapshot.surface().map().editorHandles().stream()
                .filter(handle -> CLUSTER_WALL_RUN_KIND.equals(handle.ref().kind().name()))
                .toList();
        assertTrue(!wallRuns.isEmpty(), message + " wall-run handles published");
        for (DungeonEditorHandleSnapshot handle : wallRuns) {
            assertTrue(handle.ref().sourceEdge() != null, message + " wall-run source edge present " + handle.label());
            assertTrue(!handle.ref().sourceEdge().from().equals(handle.ref().sourceEdge().to()),
                    message + " wall-run source edge has extent " + handle.label());
        }
    }

    private static void assertWallRunHandleTargets(
            DungeonMapContentModel mapContentModel,
            String message
    ) {
        assertEquals("HANDLE", mapContentModel.resolvePointerTarget(11.0, 10.0).targetKind().name(),
                message + " north wall-run is hittable");
        assertEquals("HANDLE", mapContentModel.resolvePointerTarget(12.0, 11.0).targetKind().name(),
                message + " south wall-run is hittable");
        assertEquals("HANDLE", mapContentModel.resolvePointerTarget(11.0, 12.0).targetKind().name(),
                message + " east wall-run is hittable");
        assertEquals("HANDLE", mapContentModel.resolvePointerTarget(10.0, 11.0).targetKind().name(),
                message + " west wall-run is hittable");
    }

    private static void assertHandleIdentityShape(
            DungeonEditorMapSurfaceSnapshot snapshot,
            DungeonEditorHandleKind kind,
            String message
    ) {
        DungeonEditorHandleSnapshot handle = firstHandle(snapshot, kind, message);
        assertEquals(kind, handle.ref().kind(), message + " kind");
        assertTrue(handle.ref().topologyRef().id() > 0L, message + " topology id present");
        assertTrue(!handle.ref().topologyRef().kind().name().isBlank(), message + " topology kind present");
        assertEquals(handle.ref().cell(), handle.cell(), message + " ref cell matches snapshot cell");
        assertTrue(handle.ref().index() >= 0, message + " non-negative index");
        assertTrue(handle.ref().direction() != null, message + " direction carrier present");
        assertTrue(Double.isFinite(handle.markerQ()) && Double.isFinite(handle.markerR()),
                message + " finite render marker coordinates");
        assertTrue(!handle.label().isBlank(), message + " label carrier present");
        if (kind == DungeonEditorHandleKind.CLUSTER_WALL_RUN) {
            assertTrue(handle.ref().sourceEdge() != null, message + " source edge present");
        }
    }

    private static DungeonEditorHandleSnapshot firstHandle(
            DungeonEditorMapSurfaceSnapshot snapshot,
            DungeonEditorHandleKind kind,
            String message
    ) {
        return snapshot.surface().map().editorHandles().stream()
                .filter(handle -> kind == handle.ref().kind())
                .findFirst()
                .orElseThrow(() -> new AssertionError(message + " handle not published"));
    }

    private static DungeonEditorHandleSnapshot firstDoorHandleForDirection(
            DungeonEditorMapSurfaceSnapshot snapshot,
            String direction,
            String message
    ) {
        return snapshot.surface().map().editorHandles().stream()
                .filter(handle -> DungeonEditorHandleKind.DOOR == handle.ref().kind())
                .filter(handle -> handle.ref().sourceEdge() != null)
                .filter(handle -> direction.equals(handle.ref().direction()))
                .findFirst()
                .orElseThrow(() -> new AssertionError(message + " source-edged door handle not published for "
                        + direction));
    }

    private static String handleCellKey(DungeonEditorHandleSnapshot handle) {
        return handle.cell().q() + "," + handle.cell().r() + "," + handle.cell().level();
    }

    private static boolean renderHasLabelAt(
            DungeonMapContentModel mapContentModel,
            String text,
            double q,
            double r
    ) {
        return mapContentModel.canvasStateProperty().get().renderScene().texts().stream()
                .anyMatch(label -> text.equals(label.text())
                        && Math.abs(label.centerX() - q) < 0.000_001
                        && Math.abs(label.centerY() - r) < 0.000_001);
    }

    private static void doubleClickRenderedLabel(
            HarnessBinding binding,
            LabelCenter center,
            boolean shiftDown
    ) {
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();
        double canvasX = viewport.sceneToScreenX(center.q());
        double canvasY = viewport.sceneToScreenY(center.r());
        if (shiftDown) {
            fireMapMouseClickCountWithShift(
                    binding.mapView(),
                    MouseEvent.MOUSE_PRESSED,
                    MouseButton.PRIMARY,
                    canvasX,
                    canvasY,
                    2);
            return;
        }
        fireMapMouseClickCount(
                binding.mapView(),
                MouseEvent.MOUSE_PRESSED,
                MouseButton.PRIMARY,
                canvasX,
                canvasY,
                2);
    }

    private static void pressInlineEditorKey(TextField inlineEditor, KeyCode keyCode) {
        fireControlsShortcut(inlineEditor, keyCode);
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

    private static LabelText labelText(DungeonMapContentModel mapContentModel, String text, String message) {
        return mapContentModel.canvasStateProperty().get().renderScene().texts().stream()
                .filter(label -> text.equals(label.text()))
                .map(label -> new LabelText(label.width(), label.rotationDegrees(), label.style()))
                .findFirst()
                .orElseThrow(() -> new AssertionError(message + " label not rendered: " + text));
    }

    private static boolean glyphMatchesHandleKind(DungeonMapContentModel.GlyphPrimitive glyph, String handleKind) {
        return glyph.hitRef().startsWith("marker:" + handleKind + ":");
    }

    private static double glyphCenterQ(DungeonMapContentModel.GlyphPrimitive glyph) {
        return glyph.polygon().stream()
                .mapToDouble(DungeonMapContentModel.MapCanvasPoint::x)
                .average()
                .orElseThrow();
    }

    private static double glyphCenterR(DungeonMapContentModel.GlyphPrimitive glyph) {
        return glyph.polygon().stream()
                .mapToDouble(DungeonMapContentModel.MapCanvasPoint::y)
                .average()
                .orElseThrow();
    }

    private static boolean renderHasWallRunMarkerAt(
            DungeonMapContentModel mapContentModel,
            double q,
            double r
    ) {
        List<DungeonMapContentModel.GlyphPrimitive> glyphs = mapContentModel.canvasStateProperty()
                .get()
                .renderScene()
                .glyphs();
        return glyphs.stream()
                .filter(glyph -> glyphMatchesHandleKind(glyph, CLUSTER_WALL_RUN_KIND)
                        && Math.abs(glyphCenterQ(glyph) - q) < 0.000_001
                        && Math.abs(glyphCenterR(glyph) - r) < 0.000_001)
                .anyMatch(wallRun -> glyphs.stream()
                        .filter(glyph -> glyphMatchesHandleKind(glyph, CLUSTER_CORNER_KIND))
                        .anyMatch(corner -> lowerAffordanceThanInteractiveCorner(wallRun, corner)));
    }

    private static boolean renderHasDoorMarkerAt(
            DungeonMapContentModel mapContentModel,
            double q,
            double r
    ) {
        return mapContentModel.canvasStateProperty()
                .get()
                .renderScene()
                .glyphs()
                .stream()
                .filter(glyph -> glyphMatchesHandleKind(glyph, DOOR_KIND) || "D".equals(glyph.label()))
                .anyMatch(glyph -> Math.abs(glyphCenterQ(glyph) - q) < 0.000_001
                        && Math.abs(glyphCenterR(glyph) - r) < 0.000_001);
    }

    private static double movedDoorMarkerQ(DungeonEditorHandleSnapshot doorHandle, int deltaQ) {
        DungeonEdgeRef sourceEdge = doorHandle.ref().sourceEdge();
        if (sourceEdge == null) {
            return doorHandle.markerQ() + deltaQ;
        }
        return midpoint(sourceEdge.from().q() + deltaQ, sourceEdge.to().q() + deltaQ);
    }

    private static double movedDoorMarkerR(DungeonEditorHandleSnapshot doorHandle, int deltaR) {
        DungeonEdgeRef sourceEdge = doorHandle.ref().sourceEdge();
        if (sourceEdge == null) {
            return doorHandle.markerR() + deltaR;
        }
        return midpoint(sourceEdge.from().r() + deltaR, sourceEdge.to().r() + deltaR);
    }

    private static double midpoint(int first, int second) {
        return (first + second) / 2.0;
    }

    private static List<String> renderedDoorMarkers(DungeonMapContentModel mapContentModel) {
        return mapContentModel.canvasStateProperty()
                .get()
                .renderScene()
                .glyphs()
                .stream()
                .filter(glyph -> glyphMatchesHandleKind(glyph, DOOR_KIND) || "D".equals(glyph.label()))
                .map(glyph -> glyphCenterQ(glyph) + "," + glyphCenterR(glyph)
                        + " hit=" + glyph.hitRef()
                        + " label=" + glyph.label())
                .toList();
    }

    private static DungeonEditorHandleSnapshot firstClusterWallRunHandleAt(
            DungeonEditorMapSurfaceSnapshot snapshot,
            int cellQ,
            int cellR,
            int level,
            String direction,
            String message
    ) {
        return snapshot.surface().map().editorHandles().stream()
                .filter(handle -> CLUSTER_WALL_RUN_KIND.equals(handle.ref().kind().name()))
                .filter(handle -> handle.cell().q() == cellQ)
                .filter(handle -> handle.cell().r() == cellR)
                .filter(handle -> handle.cell().level() == level)
                .filter(handle -> direction.equals(handle.ref().direction()))
                .findFirst()
                .orElseThrow(() -> new AssertionError(message + " cluster wall-run handle not published"));
    }

    private static void clickMap(
            DungeonMapView mapView,
            DungeonMapContentModel mapContentModel,
            double q,
            double r
    ) {
        DungeonMapContentModel.Viewport viewport = mapContentModel.currentViewport();
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_PRESSED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(q),
                viewport.sceneToScreenY(r),
                false);
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_RELEASED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(q),
                viewport.sceneToScreenY(r),
                false);
    }

    private static boolean lowerAffordanceThanInteractiveCorner(
            DungeonMapContentModel.GlyphPrimitive wallRun,
            DungeonMapContentModel.GlyphPrimitive corner
    ) {
        return wallRun.style().alpha() < corner.style().alpha()
                && glyphMinorAxis(wallRun) < glyphMinorAxis(corner)
                && !wallRun.style().equals(corner.style());
    }

    private static double glyphMinorAxis(DungeonMapContentModel.GlyphPrimitive glyph) {
        return Math.min(glyphWidth(glyph), glyphHeight(glyph));
    }

    private static double glyphWidth(DungeonMapContentModel.GlyphPrimitive glyph) {
        double min = glyph.polygon().stream()
                .mapToDouble(DungeonMapContentModel.MapCanvasPoint::x)
                .min()
                .orElseThrow();
        double max = glyph.polygon().stream()
                .mapToDouble(DungeonMapContentModel.MapCanvasPoint::x)
                .max()
                .orElseThrow();
        return max - min;
    }

    private static double glyphHeight(DungeonMapContentModel.GlyphPrimitive glyph) {
        double min = glyph.polygon().stream()
                .mapToDouble(DungeonMapContentModel.MapCanvasPoint::y)
                .min()
                .orElseThrow();
        double max = glyph.polygon().stream()
                .mapToDouble(DungeonMapContentModel.MapCanvasPoint::y)
                .max()
                .orElseThrow();
        return max - min;
    }

    private record LabelCenter(double q, double r) {
    }

    private record LabelText(double width, double rotationDegrees, DungeonMapContentModel.PaintStyle style) {
    }
}
