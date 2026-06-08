package src.view.leftbartabs.dungeoneditor;

import java.util.List;
import java.util.Set;
import javafx.scene.control.TextField;
import javafx.scene.input.MouseButton;
import javafx.scene.input.MouseEvent;
import src.domain.dungeon.DungeonEditorLabelNameApplicationService;
import src.domain.dungeon.published.DungeonEditorHandleKind;
import src.domain.dungeon.published.DungeonEditorPreview;
import src.domain.dungeon.published.DungeonEditorHandleSnapshot;
import src.domain.dungeon.published.DungeonEditorMapSurfaceSnapshot;
import src.domain.dungeon.published.DungeonEditorStateSnapshot;
import src.domain.dungeon.published.SaveDungeonEditorLabelNameCommand;
import src.view.slotcontent.main.dungeonmap.DungeonMapContentModel;
import src.view.slotcontent.main.dungeonmap.DungeonMapView;
import static src.view.leftbartabs.dungeoneditor.DungeonEditorBehaviorHarnessSupport.*;

final class DungeonEditorClusterLabelHandleHarness {

    private static final String OWNER = "DungeonEditorClusterLabelHandleHarness";
    private static final String CLUSTER_CORNER_KIND = DungeonEditorHandleKind.CLUSTER_CORNER.name();
    private static final String CLUSTER_WALL_RUN_KIND = DungeonEditorHandleKind.CLUSTER_WALL_RUN.name();

    private DungeonEditorClusterLabelHandleHarness() {
    }

    static void run(List<String> results) throws Exception {
        route(results, () -> verifyDefaultClusterLabelText(results));
        route(results, () -> verifyDefaultRoomLabelAndRenameRoutes(results));
        route(results, () -> verifyComplexClusterLabelAndHandles(results));
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
        results.add("DE-LABEL-004 Partial: Room label renders as floor text derived from room floor cells; "
                + "longest-wall orientation remains unqualified");
        results.add("DE-LABEL-005 Ready: State-panel cluster rename persists, reloads, renders, and preserves geometry");
        results.add("DE-LABEL-006 Partial: Shared room label-name use case persists, reloads, renders, and preserves geometry");
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
        assertEquals("LABEL", binding.mapContentModel()
                        .resolvePointerTarget(reloadedRoomLabelCenter.q(), reloadedRoomLabelCenter.r())
                        .targetKind()
                        .name(),
                "DE-LABEL-007 rendered room label stays separate from generic handles");
        RoomClusterIds secondaryRoomIds = runtime.database().roomByName(roomMapId, "R2");
        LabelCenter secondaryRoomLabelCenter = labelCenter(binding.mapContentModel(), "R2", "DE-LABEL-007 room label");
        assertRoomLabelSelectionAndNoClusterDrag(
                runtime,
                binding,
                roomMapId,
                secondaryRoomIds,
                secondaryRoomLabelCenter,
                roomGeometryRowsBefore,
                roomBoundaryRowsBefore);
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
        DungeonEditorHandleSnapshot label = singleClusterLabel(snapshot, "DE-LABEL-002");
        assertEquals(11, label.cell().q(), "DE-LABEL-002 label centroid q");
        assertEquals(11, label.cell().r(), "DE-LABEL-002 label centroid r");
        assertEquals(0, label.cell().level(), "DE-LABEL-002 label centroid level");
        assertTrue(!hasClusterLabelAt(snapshot, 10, 10, 0),
                "DE-LABEL-002 label does not use the authored cluster center");
        assertTrue(renderHasLabelAt(binding.mapContentModel(), label.label(), 11.5, 11.5),
                "DE-LABEL-002 render scene places the cluster label at the published centroid cell");
        results.add("DE-LABEL-002 Ready: F15_COMPLEX_CLUSTER label uses authored floor-cell centroid");

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
                "11,11,0,EAST@11.0,11.0",
                "10,11,0,WEST@10.0,11.0"));
        assertTrue(renderHasWallRunMarkerAt(binding.mapContentModel(), 11.0, 10.0),
                "DE-CLUSTER-001 render scene places a smaller horizontal wall-run handle on the wall line");
        assertEquals("HANDLE", binding.mapContentModel().resolvePointerTarget(11.0, 10.0).targetKind().name(),
                "DE-HANDLE-002 cluster wall-run handle resolves as a handle target");
        results.add("DE-CLUSTER-001 Ready: F15_COMPLEX_CLUSTER publishes true corner handles and wall-run midpoint handles");
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

        DungeonEditorMapSurfaceSnapshot initialSurface = runtime.mapSurfaceModel().current();
        DungeonEditorHandleSnapshot cornerHandle =
                firstClusterCornerHandleAt(initialSurface, 13, 11, 0, "DE-CLUSTER-003");
        long clusterId = cornerHandle.ref().clusterId();
        long geometryRowsBefore = runtime.database().countAuthoredGeometryRows(mapId);
        List<String> boundaryRowsBefore = runtime.database().roomBoundaryEdgeState(mapId);
        Set<String> cellsBefore = surfaceCellSet(initialSurface);
        assertEquals(Set.of("10,10,0", "13,10,0", "13,11,0", "11,11,0", "11,13,0", "10,13,0"),
                runtime.database().absoluteClusterVertices(clusterId),
                "DE-CLUSTER-003 starts from F15 true authored vertices");
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
        Set<String> committedVertices = runtime.database().absoluteClusterVertices(clusterId);
        assertTrue(committedVertices.contains("14,12,0"),
                "DE-CLUSTER-003 persists the dragged true corner at the target point");
        assertTrue(!committedVertices.contains("13,13,0"),
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
        assertTrue(runtime.database().absoluteClusterVertices(clusterId).contains("14,12,0"),
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

        DungeonEditorMapSurfaceSnapshot initialSurface = runtime.mapSurfaceModel().current();
        DungeonEditorHandleSnapshot wallRunHandle =
                firstClusterWallRunHandleAt(initialSurface, 11, 10, 0, "NORTH", "DE-CLUSTER-002");
        long clusterId = wallRunHandle.ref().clusterId();
        long geometryRowsBefore = runtime.database().countAuthoredGeometryRows(mapId);
        List<String> boundaryRowsBefore = runtime.database().roomBoundaryEdgeState(mapId);
        RoomClusterIds roomIdsBefore = runtime.database().roomByName(mapId, "R1");
        assertEquals("HANDLE", binding.mapContentModel().resolvePointerTarget(11.0, 10.0).targetKind().name(),
                "DE-CLUSTER-002 wall-run midpoint resolves as handle before drag");

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
        assertEquals(boundaryRowsBefore, runtime.database().roomBoundaryEdgeState(mapId),
                "DE-HANDLE-003 wall-run drag preview leaves persisted boundary rows unchanged");
        assertTrue(previewSurface.preview() instanceof DungeonEditorPreview.MoveHandlePreview,
                "DE-HANDLE-003 wall-run drag publishes move-handle preview");
        DungeonEditorPreview.MoveHandlePreview preview =
                (DungeonEditorPreview.MoveHandlePreview) previewSurface.preview();
        assertEquals(wallRunHandle.ref().kind(), preview.handleRef().kind(),
                "DE-HANDLE-003 wall-run preview handle kind");
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
        assertTrue(runtime.database().absoluteClusterVertices(clusterId).contains("11,9,0"),
                "DE-CLUSTER-002 persists the dragged wall-run endpoint");

        selectMap(controls, "Complex Cluster Wall Run Move Reload Hop");
        selectMap(controls, "Complex Cluster Wall Run Move Map");
        assertEquals(roomIdsBefore, runtime.database().roomByName(mapId, "R1"),
                "DE-CLUSTER-002 reload keeps room and cluster identity");
        assertEquals(0L, runtime.database().countUnreferencedWallTopologyElements(mapId),
                "DE-CLUSTER-002 reload keeps no orphan wall topology rows");
        assertTrue(runtime.database().absoluteClusterVertices(clusterId).contains("11,9,0"),
                "DE-CLUSTER-002 reload keeps the dragged wall-run endpoint");

        results.add("DE-CLUSTER-002 Partial: F15_COMPLEX_CLUSTER wall-run drag previews, commits, "
                + "preserves identity, and reloads; invalid rejection remains unqualified");
        results.add("DE-HANDLE-002 Ready: Shared handle hit route includes cluster wall-run and cluster corner; "
                + "corridor and stair anchors are covered by their focused routes");
        results.add("DE-HANDLE-003 Ready: Cluster wall-run and true-corner drags publish preview before persistence");
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

    private static void assertRoomLabelSelectionAndNoClusterDrag(
            HarnessRuntime runtime,
            HarnessBinding binding,
            long mapId,
            RoomClusterIds roomIds,
            LabelCenter labelCenter,
            long geometryRowsBefore,
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

    private static LabelCenter labelCenter(DungeonMapContentModel mapContentModel, String text, String message) {
        return mapContentModel.canvasStateProperty().get().renderScene().texts().stream()
                .filter(label -> text.equals(label.text()))
                .map(label -> new LabelCenter(label.centerX(), label.centerY()))
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
                && glyphWidth(wallRun) < glyphWidth(corner)
                && !wallRun.style().equals(corner.style());
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

    private record LabelCenter(double q, double r) {
    }
}
