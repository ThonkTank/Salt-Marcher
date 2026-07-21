package features.dungeon.adapter.javafx.editor;
import features.dungeon.api.editor.DungeonEditorSelection;

import java.util.List;
import java.util.Locale;
import java.util.Set;
import javafx.scene.control.TextField;
import javafx.scene.input.KeyCode;
import javafx.scene.input.MouseButton;
import javafx.scene.input.MouseEvent;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.api.DungeonCellRef;
import features.dungeon.api.DungeonEdgeRef;
import features.dungeon.api.DungeonEditorHandleKind;
import features.dungeon.api.DungeonEditorPreview;
import features.dungeon.api.DungeonEditorHandleSnapshot;
import features.dungeon.api.editor.DungeonEditorState;
import features.dungeon.api.DungeonEditorMapSnapshot;
import features.dungeon.api.DungeonTopologyElementRef;
import features.dungeon.api.editor.DungeonEditorToolFamily;
import features.dungeon.api.editor.DungeonEditorToolSelection;
import features.dungeon.api.editor.DungeonEditorPointerInput.Target;
import features.dungeon.application.editor.DungeonEditorRuntimeLabelTarget;
import features.dungeon.adapter.javafx.map.DungeonMapContentModel;
import features.dungeon.adapter.javafx.map.DungeonMapView;
import static features.dungeon.adapter.javafx.editor.DungeonEditorTestSupport.*;

final class DungeonEditorClusterLabelHandleScenarios {

    private static final String CLUSTER_CORNER_KIND = DungeonEditorHandleKind.CLUSTER_CORNER.name();
    private static final String CLUSTER_WALL_RUN_KIND = DungeonEditorHandleKind.CLUSTER_WALL_RUN.name();
    private static final String DOOR_KIND = DungeonEditorHandleKind.DOOR.name();

    private DungeonEditorClusterLabelHandleScenarios() {
    }

    static void run() throws Exception {
        runLabels();
        runSharedHandles();
        runDoorHandles();
        runClusterHandles();
    }

    static void runLabels() throws Exception {
        route(() -> verifyDefaultClusterLabelText());
        route(() -> verifyDefaultRoomLabelAndRenameRoutes());
        route(() -> verifyDirectRenderedLabelRenames());
        route(() -> verifyComplexClusterLabel());
    }

    static void runSharedHandles() throws Exception {
        route(() -> verifySharedHandleIdentityAndPassiveRefs());
    }

    static void runDoorHandles() throws Exception {
        route(() -> verifyDoorHandleDrag());
        route(() -> verifyInvalidDoorHandleMoveRejectedThroughMapView());
    }

    static void runClusterHandles() throws Exception {
        route(() -> verifyComplexClusterLabelAndHandles());
        route(() -> verifyInteriorTWallRunHandleSplit());
        route(() -> verifySelectedWallRunHandleStyle());
        route(() -> verifyComplexClusterTrueCornerDrag());
        route(() -> verifyComplexClusterWallRunDrag());
    }

    private static void route(
            DungeonEditorTestSupport.ThrowingRunnable action
    ) throws Exception {
        DungeonEditorTestSupport.runRoute(action);
    }

    private static void verifyDefaultClusterLabelText() {
        TestRuntime runtime = TestRuntime.create();
        TestBinding binding = bindTest(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();

        long mapId = createMapThroughControls(controls, runtime, "Default Cluster Label Map");
        runtime.database().seedF1SingleRoom(mapId, "R1", 0, 1, 1);
        createMapThroughControls(controls, runtime, "Default Cluster Label Reload Hop");
        selectMap(controls, "Default Cluster Label Map");

        DungeonEditorState snapshot = runtime.editorApi().current();
        DungeonEditorHandleSnapshot label = singleClusterLabel(snapshot, "DE-LABEL-001");
        assertEquals("Cluster " + label.ref().clusterId(), label.label(),
                "DE-LABEL-001 default cluster label text");
        assertTrue(!"R1".equals(label.label()),
                "DE-LABEL-001 cluster label does not reuse the first room name");
        assertEquals(features.dungeon.api.editor.DungeonEditorPointerInput.TargetKind.LABEL, runtimePointerTarget(binding.mapContentModel(), label.cell().q() + 0.5, label.cell().r() + 0.5).targetKind(),
                "DE-LABEL-001 cluster label hit remains a label target");
        assertHoverHighlightsClusterLabel(
                binding.mapContentModel(),
                mapView,
                label.label(),
                label.cell().q() + 0.5,
                label.cell().r() + 0.5,
                "DE-LABEL-010 cluster label hover");

    }

    private static void verifyDefaultRoomLabelAndRenameRoutes() {
        TestRuntime runtime = TestRuntime.create();
        TestBinding binding = bindTest(runtime);
        DungeonEditorControlsView controls = binding.controls();

        verifyDefaultRoomLabelAndClusterRename(runtime, binding, controls);
        verifyClusterLabelSelectionAndStatePanelRename(runtime, binding, controls);
        verifySharedRoomLabelNameOperation(runtime, binding, controls);







    }

    private static void verifyDefaultRoomLabelAndClusterRename(
            TestRuntime runtime,
            TestBinding binding,
            DungeonEditorControlsView controls
    ) {
        long mapId = createMapThroughControls(controls, runtime, "Room Label Rename Map");
        runtime.database().seedF1SingleRoom(mapId, "", 0, 1, 1);
        createMapThroughControls(controls, runtime, "Room Label Rename Reload Hop");
        selectMap(controls, "Room Label Rename Map");
        click(button(controls, "Auswahl"));

        RoomClusterIds ids = runtime.database().roomByComponent(mapId, 2, 2, 0);
        String displayedDefaultLabel = displayRoomLabel("Raum " + ids.roomId());
        LabelCenter roomLabelCenter = labelCenter(binding.mapContentModel(), displayedDefaultLabel, "DE-LABEL-003");
        assertTrue(renderHasLabelAt(binding.mapContentModel(), displayedDefaultLabel, roomLabelCenter.q(), roomLabelCenter.r()),
                "DE-LABEL-003 render scene publishes uppercase default room label text");
        assertTrue(Math.abs(roomLabelCenter.r() - 2.5) > 0.3 || Math.abs(roomLabelCenter.q() - 2.5) > 0.3,
                "DE-LABEL-004 default room label moves off the cluster centroid toward a wall-adjacent floor span");
        assertTrue(roomLabelCenter.r() > 2.5,
                "DE-LABEL-004 equal-length room label placement prefers the south wall before other walls");
        assertEquals(features.dungeon.api.editor.DungeonEditorPointerInput.TargetKind.CELL, runtimePointerTarget(binding.mapContentModel(), roomLabelCenter.q(), roomLabelCenter.r()).targetKind(),
                "DE-HANDLE-005 room label point passes through to floor selection");
    }

    private static void verifyClusterLabelSelectionAndStatePanelRename(
            TestRuntime runtime,
            TestBinding binding,
            DungeonEditorControlsView controls
    ) {
        long mapId = createMapThroughControls(controls, runtime, "Cluster Label Rename Map");
        runtime.database().seedF15ComplexCluster(mapId);
        createMapThroughControls(controls, runtime, "Cluster Label Rename Reload Hop");
        selectMap(controls, "Cluster Label Rename Map");
        click(button(controls, "Auswahl"));

        DungeonEditorState initial = runtime.editorApi().current();
        DungeonEditorHandleSnapshot clusterLabel = singleClusterLabel(initial, "DE-LABEL-005");
        long clusterId = clusterLabel.ref().clusterId();
        String initialClusterName = runtime.database().clusterName(clusterId);
        long geometryRowsBefore = runtime.database().countAuthoredGeometryRows(mapId);
        List<String> boundaryRowsBefore = runtime.database().roomBoundaryEdgeState(mapId);
        double labelQ = clusterLabel.cell().q() + 0.5;
        double labelR = clusterLabel.cell().r() + 0.5;
        assertEquals(features.dungeon.api.editor.DungeonEditorPointerInput.TargetKind.LABEL, runtimePointerTarget(binding.mapContentModel(), labelQ, labelR).targetKind(),
                "DE-LABEL-007 rendered cluster label stays separate from generic handles");

        clickMap(binding.mapView(), binding.mapContentModel(), labelQ, labelR);
        assertClusterLabelSelection(runtime, clusterId, "DE-LABEL-007 cluster label selection target");
        TextField clusterName = textField(binding.stateView(), "Cluster-Name");
        clusterName.setText("   West Wing   ");
        TextField republishedClusterName = textField(binding.stateView(), "Cluster-Name");
        assertTrue(republishedClusterName != clusterName,
                "DE-LABEL-005 state panel draft is projected through a fresh runtime publication");
        assertEquals("   West Wing   ", republishedClusterName.getText(),
                "DE-LABEL-005 state panel publishes unsaved cluster name draft before save");
        assertEquals(initialClusterName, runtime.database().clusterName(clusterId),
                "DE-LABEL-005 unsaved cluster name draft does not persist before save");
        click(buttonWithAccessibleText(binding.stateView(), "Cluster-Name speichern"));
        assertEquals("West Wing", runtime.database().clusterName(clusterId),
                "DE-LABEL-005 state panel trims and saves custom cluster label");
        assertEquals(geometryRowsBefore, runtime.database().countAuthoredGeometryRows(mapId),
                "DE-LABEL-005 cluster rename leaves authored geometry row count unchanged");
        assertEquals(boundaryRowsBefore, runtime.database().roomBoundaryEdgeState(mapId),
                "DE-LABEL-005 cluster rename leaves boundary geometry unchanged");
        assertEquals(DungeonEditorPreview.none(), runtime.editorApi().current().preview(),
                "DE-LABEL-005 cluster rename keeps preview empty");
        assertTrue(renderHasLabelAt(binding.mapContentModel(), "West Wing", labelQ, labelR),
                "DE-LABEL-005 render scene updates custom cluster label");

        selectMap(controls, "Cluster Label Rename Reload Hop");
        selectMap(controls, "Cluster Label Rename Map");
        assertTrue(renderHasLabelAt(binding.mapContentModel(), "West Wing", labelQ, labelR),
                "DE-LABEL-005 reload keeps custom cluster label render");
        clickMap(binding.mapView(), binding.mapContentModel(), labelQ, labelR);
        assertClusterLabelSelection(runtime, clusterId, "DE-LABEL-007 cluster label reload selection target");
    }

    private static void verifySharedRoomLabelNameOperation(
            TestRuntime runtime,
            TestBinding binding,
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
        LabelCenter roomLabelCenter = labelCenter(binding.mapContentModel(), displayRoomLabel("R1"), "DE-LABEL-004");
        LabelText roomLabelText = labelText(binding.mapContentModel(), displayRoomLabel("R1"), "DE-LABEL-004");
        assertTrue(roomLabelText.style().fill() == null,
                "DE-LABEL-004 room label renders as subdued floor text without label box fill");
        assertTrue(roomLabelText.style().alpha() < 1.0,
                "DE-LABEL-004 room label text uses subdued opacity");
        assertTrue(roomLabelText.textColor().red() < 200 && roomLabelText.textColor().alphaUnit() < 1.0,
                "DE-LABEL-004 room label text color is a subtle grey instead of bright label text");
        assertTrue(roomLabelText.typography().fontFamily().equals("Monospaced")
                        && roomLabelText.typography().bold()
                        && roomLabelText.typography().fontSizePixels() > 13.0,
                "DE-LABEL-004 room label uses blockier bold typography scaled from available wall space");
        assertTrue(roomLabelText.width() > 56.0 / 32.0,
                "DE-LABEL-004 room label consumes more than the minimum label width when wall space allows");
        assertRoomLabelHoverRemainsPassive(
                binding,
                displayRoomLabel("R1"),
                roomLabelCenter,
                "DE-LABEL-010 passive room label hover");
        assertRoomLabelHitAndEditorPresentation(binding, runtime, roomIds, roomLabelCenter, roomLabelText);
        var editorApi = runtime.editorApi();
        editorApi.dispatch(new features.dungeon.api.editor.DungeonEditorIntent.SelectMap(
                new features.dungeon.api.DungeonMapId(roomMapId)));
        editorApi.dispatch(new features.dungeon.api.editor.DungeonEditorIntent.CommitLabelName(
                new features.dungeon.api.editor.DungeonEditorIntent.LabelTarget(
                        features.dungeon.api.editor.DungeonEditorIntent.LabelTargetKind.ROOM,
                        roomIds.roomId()),
                "   Lantern Room   "));
        assertEquals("Lantern Room", runtime.database().roomName(roomIds.roomId()),
                "DE-LABEL-006 shared label-name operation trims and saves custom room label");
        assertEquals(roomGeometryRowsBefore, runtime.database().countAuthoredGeometryRows(roomMapId),
                "DE-LABEL-006 room rename leaves authored geometry row count unchanged");
        assertEquals(roomBoundaryRowsBefore, runtime.database().roomBoundaryEdgeState(roomMapId),
                "DE-LABEL-006 room rename leaves boundary geometry unchanged");
        assertEquals("Lantern Room", editorApi.current().selectedWindow().map().areas().stream()
                        .filter(area -> area.id() == roomIds.roomId())
                        .map(features.dungeon.api.DungeonEditorMapSnapshot.Area::label)
                        .findFirst()
                        .orElse("missing"),
                "DE-LABEL-006 atomic editor state updates custom room label");
        assertEquals(editorApi.current().publicationRevision(), binding.mapContentModel().appliedPublicationRevision(),
                "DE-LABEL-006 JavaFX consumer receives latest atomic publication");
        LabelCenter renamedRoomLabelCenter = labelCenter(
                binding.mapContentModel(),
                displayRoomLabel("Lantern Room"),
                "DE-LABEL-006");
        assertDoubleEquals(roomLabelCenter.q(), renamedRoomLabelCenter.q(),
                "DE-LABEL-006 room rename keeps label q");
        assertDoubleEquals(roomLabelCenter.r(), renamedRoomLabelCenter.r(),
                "DE-LABEL-006 room rename keeps label r");
        assertTrue(renderHasLabelAt(
                        binding.mapContentModel(),
                        displayRoomLabel("Lantern Room"),
                        renamedRoomLabelCenter.q(),
                        renamedRoomLabelCenter.r()),
                "DE-LABEL-006 render scene updates custom room label");

        selectMap(controls, "Room Label Rename Multi Reload Hop");
        selectMap(controls, "Room Label Rename Multi Map");
        LabelCenter reloadedRoomLabelCenter = labelCenter(
                binding.mapContentModel(),
                displayRoomLabel("Lantern Room"),
                "DE-LABEL-006 reload");
        assertTrue(renderHasLabelAt(
                        binding.mapContentModel(),
                        displayRoomLabel("Lantern Room"),
                        reloadedRoomLabelCenter.q(),
                        reloadedRoomLabelCenter.r()),
                "DE-LABEL-006 reload keeps custom room label render");
        RoomClusterIds secondaryRoomIds = runtime.database().roomByName(roomMapId, "R2");
        LabelCenter secondaryRoomLabelCenter = labelCenter(
                binding.mapContentModel(),
                displayRoomLabel("R2"),
                "DE-LABEL-007 room label");
        assertRoomLabelDoesNotInterceptFloorSelection(
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
        TextField republishedRoomName = textField(binding.stateView(), "Raum-Name");
        assertTrue(republishedRoomName != roomName,
                "DE-LABEL-006 state panel draft is projected through a fresh runtime publication");
        assertEquals("   Gallery Room   ", republishedRoomName.getText(),
                "DE-LABEL-006 state panel publishes unsaved room name draft before save");
        assertEquals("R2", runtime.database().roomName(secondaryRoomIds.roomId()),
                "DE-LABEL-006 unsaved room name draft does not persist before save");
        click(buttonWithAccessibleText(binding.stateView(), "Raum-Name speichern"));
        assertEquals("Gallery Room", runtime.database().roomName(secondaryRoomIds.roomId()),
                "DE-LABEL-006 state-panel room selection trims and saves custom room label");
        assertEquals(roomGeometryRowsBefore, runtime.database().countAuthoredGeometryRows(roomMapId),
                "DE-LABEL-006 state-panel room rename leaves authored geometry row count unchanged");
        assertEquals(roomBoundaryRowsBefore, runtime.database().roomBoundaryEdgeState(roomMapId),
                "DE-LABEL-006 state-panel room rename leaves boundary geometry unchanged");
        assertTrue(renderHasLabelAt(
                        binding.mapContentModel(),
                        displayRoomLabel("Gallery Room"),
                        secondaryRoomLabelCenter.q(),
                        secondaryRoomLabelCenter.r()),
                "DE-LABEL-006 state-panel room rename updates rendered room label");
    }

    private static void verifyDirectRenderedLabelRenames() {
        TestRuntime runtime = TestRuntime.create();
        TestBinding binding = bindTest(runtime);
        DungeonEditorControlsView controls = binding.controls();

        long mapId = createMapThroughControls(controls, runtime, "Direct Label Edit Map");
        runtime.database().seedF1SingleRoom(mapId, "R1", 0, 1, 1);
        createMapThroughControls(controls, runtime, "Direct Label Edit Reload Hop");
        selectMap(controls, "Direct Label Edit Map");
        click(button(controls, "Auswahl"));

        RoomClusterIds ids = runtime.database().roomByComponent(mapId, 2, 2, 0);
        String initialClusterName = runtime.database().clusterName(ids.clusterId());
        LabelCenter clusterLabelCenter = labelCenter(
                binding.mapContentModel(),
                "Cluster " + ids.clusterId(),
                "DE-LABEL-008 cluster label");
        LabelCenter roomLabelCenter = labelCenter(
                binding.mapContentModel(),
                displayRoomLabel("R1"),
                "DE-LABEL-009 room label");
        assertEquals(features.dungeon.api.editor.DungeonEditorPointerInput.TargetKind.LABEL, runtimePointerTarget(binding.mapContentModel(), clusterLabelCenter.q(), clusterLabelCenter.r()).targetKind(),
                "DE-LABEL-008 cluster label point resolves as a label target");
        assertTrue(Math.abs(clusterLabelCenter.q() - roomLabelCenter.q()) > 0.3
                        || Math.abs(clusterLabelCenter.r() - roomLabelCenter.r()) > 0.3,
                "DE-LABEL-004 room floor label stays separated from the centered cluster label");
        assertTrue(runtimePointerTarget(binding.mapContentModel(), roomLabelCenter.q(), roomLabelCenter.r())
                        .targetKind() != features.dungeon.api.editor.DungeonEditorPointerInput.TargetKind.LABEL,
                "DE-LABEL-007 rendered room label is not a direct label target");

        doubleClickRenderedLabel(binding, clusterLabelCenter, false);
        TextField inlineEditor = textField(binding.mapView(), "Dungeon map label editor");
        assertTrue(inlineEditor.isVisible(), "DE-LABEL-008 normal double-click opens inline label editor");
        assertEquals("Cluster " + ids.clusterId(), inlineEditor.getText(),
                "DE-LABEL-008 normal double-click edits the centered cluster label");
        inlineEditor.selectRange(0, inlineEditor.getLength());
        DungeonMapContentModel.CanvasState canvasBeforeDraft = binding.mapContentModel().canvasStateProperty().get();
        typeInlineEditorTextSequentially(inlineEditor, "   Cancelled Cluster   ");
        pressInlineEditorKey(inlineEditor, KeyCode.ESCAPE);
        assertTrue(!inlineEditor.isVisible(), "DE-LABEL-008 Escape cancel hides inline cluster label editor");
        assertTrue(!binding.mapContentModel().currentInlineLabelEditState().active(),
                "DE-LABEL-008 Escape cancel clears runtime inline-label projection");
        assertEquals(initialClusterName, runtime.database().clusterName(ids.clusterId()),
                "DE-LABEL-008 cancelled inline draft does not persist");

        doubleClickRenderedLabel(binding, clusterLabelCenter, false);
        assertTrue(inlineEditor.isVisible(), "DE-LABEL-008 normal double-click reopens inline label editor after cancel");
        assertEquals("Cluster " + ids.clusterId(), inlineEditor.getText(),
                "DE-LABEL-008 cancel does not replay stale inline draft text");
        inlineEditor.selectRange(0, inlineEditor.getLength());
        canvasBeforeDraft = binding.mapContentModel().canvasStateProperty().get();
        DungeonMapStateProbe.Snapshot snapshotBeforeDraft =
                DungeonMapStateProbe.snapshot(binding.mapContentModel());
        typeInlineEditorTextSequentially(inlineEditor, "   Inline Cluster   ");
        DungeonMapStateProbe.Snapshot snapshotAfterDraft =
                DungeonMapStateProbe.snapshot(binding.mapContentModel());
        assertTrue(canvasBeforeDraft == binding.mapContentModel().canvasStateProperty().get(),
                "DE-LABEL-008 runtime draft publication does not remap or redraw the canvas per keystroke");
        assertTrue(
                snapshotAfterDraft.inlineLabelDraftLength() > snapshotBeforeDraft.inlineLabelDraftLength(),
                "DE-LABEL-008 inline label draft typing updates projected draft text");
        assertRenderAndHitSignaturesUnchanged(
                snapshotBeforeDraft,
                snapshotAfterDraft,
                "DE-LABEL-008 inline label draft typing keeps render and hit signatures stable");
        assertEquals(
                snapshotBeforeDraft.canvasStateIdentity(),
                snapshotAfterDraft.canvasStateIdentity(),
                "DE-LABEL-008 inline label draft typing keeps canvas state stable per keystroke");
        assertEquals("   Inline Cluster   ", inlineEditor.getText(),
                "DE-LABEL-008 typed inline draft keeps editor text through runtime publication");
        assertEquals(inlineEditor.getLength(), inlineEditor.getCaretPosition(),
                "DE-LABEL-008 typed inline draft preserves caret through runtime publication");
        assertEquals(inlineEditor.getLength(), inlineEditor.getAnchor(),
                "DE-LABEL-008 typed inline draft preserves collapsed selection through runtime publication");
        assertEquals("   Inline Cluster   ", binding.mapContentModel().currentInlineLabelEditState().text(),
                "DE-LABEL-008 inline draft is projected through runtime publication before commit");
        assertEquals(initialClusterName, runtime.database().clusterName(ids.clusterId()),
                "DE-LABEL-008 unsaved inline draft does not persist before Enter commit");
        assertEquals(ids.clusterId(), binding.mapContentModel().currentInlineLabelEditState().target().ownerId(),
                "DE-LABEL-008 inline cluster edit retains the cluster identity before commit");
        pressInlineEditorKey(inlineEditor, KeyCode.ENTER);
        assertTrue(!inlineEditor.isVisible(), "DE-LABEL-008 Enter commit hides inline cluster label editor");
        assertEquals("Inline Cluster", runtime.database().clusterName(ids.clusterId()),
                "DE-LABEL-008 inline cluster label edit trims and persists authored cluster name outcome="
                        + runtime.editorApi().current().commandStatus().message());
        assertEquals("R1", runtime.database().roomName(ids.roomId()),
                "DE-LABEL-008 inline cluster label edit does not mutate room name");
        assertTrue(renderHasLabelAt(binding.mapContentModel(), "Inline Cluster", clusterLabelCenter.q(), clusterLabelCenter.r()),
                "DE-LABEL-008 inline cluster label edit updates rendered label");

        doubleClickRenderedLabel(binding, roomLabelCenter, true);
        assertTrue(!inlineEditor.isVisible(), "DE-LABEL-009 shifted double-click on rendered room label stays passive");
        clickMap(binding.mapView(), binding.mapContentModel(), 1.5, 1.5);
        TextField roomName = textField(binding.stateView(), "Raum-Name");
        roomName.setText("   Inline Room   ");
        click(buttonWithAccessibleText(binding.stateView(), "Raum-Name speichern"));
        assertEquals("Inline Room", runtime.database().roomName(ids.roomId()),
                "DE-LABEL-009 room floor selection plus state panel trims and persists authored room name");
        assertEquals("Inline Cluster", runtime.database().clusterName(ids.clusterId()),
                "DE-LABEL-009 room floor/state-panel edit does not mutate cluster name");
        assertTrue(renderHasLabelAt(
                        binding.mapContentModel(),
                        displayRoomLabel("Inline Room"),
                        roomLabelCenter.q(),
                        roomLabelCenter.r()),
                "DE-LABEL-009 floor/state-panel room edit updates rendered label");

        selectMap(controls, "Direct Label Edit Reload Hop");
        selectMap(controls, "Direct Label Edit Map");
        assertEquals("Inline Cluster", runtime.database().clusterName(ids.clusterId()),
                "DE-LABEL-008 reload preserves inline cluster name");
        assertEquals("Inline Room", runtime.database().roomName(ids.roomId()),
                "DE-LABEL-009 reload preserves inline room name");
        assertTrue(renderHasLabelAt(binding.mapContentModel(), "Inline Cluster", clusterLabelCenter.q(), clusterLabelCenter.r()),
                "DE-LABEL-008 reload renders inline cluster name");
        assertTrue(renderHasLabelAt(
                        binding.mapContentModel(),
                        displayRoomLabel("Inline Room"),
                        roomLabelCenter.q(),
                        roomLabelCenter.r()),
                "DE-LABEL-009 reload renders inline room name");



    }

    private static void assertRoomLabelHitAndEditorPresentation(
            TestBinding binding,
            TestRuntime runtime,
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
        doubleClickRenderedLabel(binding, new LabelCenter(visibleQ, visibleR), true);
        TextField inlineEditor = textField(binding.mapView(), "Dungeon map label editor");
        assertTrue(!inlineEditor.isVisible(), "DE-LABEL-004 visible room label span does not open inline editor");
        assertEquals("R1", runtime.database().roomName(roomIds.roomId()),
                "DE-LABEL-004 passive room label does not persist room label text");
    }

    private static void assertRenderAndHitSignaturesUnchanged(
            DungeonMapStateProbe.Snapshot before,
            DungeonMapStateProbe.Snapshot after,
            String message
    ) {
        assertEquals(before.renderGeometrySignature(), after.renderGeometrySignature(),
                message + " renderGeometrySignature");
        assertEquals(before.hitTargetSignature(), after.hitTargetSignature(),
                message + " hitTargetSignature");
    }

    private static void verifyComplexClusterLabel() {
        TestRuntime runtime = TestRuntime.create();
        TestBinding binding = bindTest(runtime);
        DungeonEditorControlsView controls = binding.controls();

        long mapId = createMapThroughControls(controls, runtime, "Complex Cluster Handles Map");
        runtime.database().seedF15ComplexCluster(mapId);
        createMapThroughControls(controls, runtime, "Complex Cluster Handles Reload Hop");
        selectMap(controls, "Complex Cluster Handles Map");

        DungeonEditorState snapshot = runtime.editorApi().current();
        DungeonEditorHandleSnapshot label = singleClusterLabel(snapshot, "DE-LABEL-002");
        assertEquals(11, label.cell().q(), "DE-LABEL-002 label centroid q");
        assertEquals(11, label.cell().r(), "DE-LABEL-002 label centroid r");
        assertEquals(0, label.cell().level(), "DE-LABEL-002 label centroid level");
        assertTrue(!hasClusterLabelAt(snapshot, 10, 10, 0),
                "DE-LABEL-002 label does not use the derived minimum-cell anchor");
        assertTrue(renderHasLabelAt(binding.mapContentModel(), label.label(), 11.5, 11.5),
                "DE-LABEL-002 render scene places the cluster label at the published centroid cell");

    }

    private static void verifyComplexClusterLabelAndHandles() {
        TestRuntime runtime = TestRuntime.create();
        TestBinding binding = bindTest(runtime);
        DungeonEditorControlsView controls = binding.controls();

        long mapId = createMapThroughControls(controls, runtime, "Complex Cluster Handles Map");
        runtime.database().seedF15ComplexCluster(mapId);
        createMapThroughControls(controls, runtime, "Complex Cluster Handles Reload Hop");
        selectMap(controls, "Complex Cluster Handles Map");

        DungeonEditorState snapshot = runtime.editorApi().current();
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
        selectRoomFloorWithoutClusterMode(runtime, binding, 10.25, 10.25, "DE-HANDLE-002");
        assertNotHandleTarget(binding.mapContentModel(), 11.0, 10.0,
                "DE-HANDLE-002 plain room floor selection still does not expose cluster wall-run handles");
        selectClusterLabel(runtime, binding, "DE-HANDLE-002");
        DungeonEditorMapSnapshot.Area selectedRoom = roomAreaByLabel(
                runtime.editorApi().current(),
                "R1",
                "DE-LABEL-004 selected cluster");
        LabelText selectedRoomLabel = labelText(
                binding.mapContentModel(),
                displayRoomLabel("R1"),
                "DE-LABEL-004 selected cluster");
        DungeonMapContentModel.PaintStyle selectedRoomSurfaceStyle = surfaceStyleForSelectionRef(
                binding.mapContentModel(),
                selectedRoom.topologyRef(),
                "DE-LABEL-004 selected cluster");
        assertTrue(selectedRoomSurfaceStyle.strokeWidth() < 2.0 / 32.0,
                "DE-LABEL-004 selected cluster label does not flood room floor cells with selected styling");
        assertTrue(selectedRoomLabel.style().fill() == null && selectedRoomLabel.style().stroke() == null,
                "DE-LABEL-004 selected room label stays text-only without a label background box");
        assertTrue(selectedRoomLabel.style().alpha() > 0.95,
                "DE-LABEL-004 selected room label uses full text opacity for contrast");
        assertTrue(selectedRoomLabel.textColor().red() > 220
                        && selectedRoomLabel.textColor().alphaUnit() > 0.99,
                "DE-LABEL-004 selected room label text brightens to stay readable on selected clusters");
        assertTrue(renderHasWallRunMarkerAt(binding.mapContentModel(), 11.0, 10.0),
                "DE-CLUSTER-001 cluster-label-selected render scene places a smaller horizontal wall-run handle on the wall line");
        assertEquals(features.dungeon.api.editor.DungeonEditorPointerInput.TargetKind.HANDLE, runtimePointerTarget(binding.mapContentModel(), 11.0, 10.0).targetKind(),
                "DE-HANDLE-002 cluster-label-selected wall-run handle resolves as a handle target");
        assertEquals(features.dungeon.api.editor.DungeonEditorPointerInput.TargetKind.BOUNDARY, runtimePointerTarget(binding.mapContentModel(), 11.0, 10.0, true).targetKind(),
                "DE-HANDLE-002 boundary-preferred resolver chooses the wall under an overlapping handle");
        assertWallRunSourceEdgesPresent(snapshot, "DE-HANDLE-002");

    }

    private static void verifyInteriorTWallRunHandleSplit() {
        TestRuntime runtime = TestRuntime.create();
        TestBinding binding = bindTest(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();

        String mapName = "Interior T Wall Split Map";
        long mapId = createMapThroughControls(controls, runtime, mapName);
        paintRoomRectangle(runtime, binding, controls, mapView, 1.5, 1.5, 5.5, 5.5, "DE-CLUSTER-001 T fixture");
        createMapThroughControls(controls, runtime, mapName + " Room Reload Hop");
        selectMap(controls, mapName);
        drawCommittedWallRun(binding, controls, mapView, 3.0, 1.0, 3.0, 6.0);
        drawCommittedWallRun(binding, controls, mapView, 3.0, 3.0, 6.0, 3.0);
        createMapThroughControls(controls, runtime, mapName + " Reload Hop");
        selectMap(controls, mapName);

        DungeonEditorState snapshot = runtime.editorApi().current();
        assertTrue(mapHasBoundaryKindAt(
                        snapshot.selectedWindow().map(),
                        "WALL",
                        new Cell(3, 1, 0),
                        new Cell(3, 2, 0)),
                "DE-CLUSTER-001 T fixture publishes the vertical authored interior wall");
        assertTrue(mapHasBoundaryKindAt(
                        snapshot.selectedWindow().map(),
                        "WALL",
                        new Cell(3, 3, 0),
                        new Cell(4, 3, 0)),
                "DE-CLUSTER-001 T fixture publishes the horizontal authored branch wall");
        assertTrue(hasHandleAt(snapshot, CLUSTER_CORNER_KIND, 3, 3, 0),
                "DE-CLUSTER-001 T fixture publishes the authored T-junction corner handle");
        assertWallRunHandle(snapshot, 3, 2, 0, 3.0, 2.0, new Cell(3, 2, 0), new Cell(3, 3, 0),
                "DE-CLUSTER-001 T fixture upper split vertical");
        assertWallRunHandle(snapshot, 3, 4, 0, 3.0, 4.0, new Cell(3, 4, 0), new Cell(3, 5, 0),
                "DE-CLUSTER-001 T fixture lower split vertical");
        assertWallRunHandle(snapshot, 4, 3, 0, 4.0, 3.0, new Cell(4, 3, 0), new Cell(5, 3, 0),
                "DE-CLUSTER-001 T fixture horizontal branch");
        assertTrue(!hasWallRunMarkerAt(snapshot, 3.0, 3.5),
                "DE-CLUSTER-001 T fixture does not keep one unsplit vertical midpoint through the junction");
        assertNotHandleTarget(binding.mapContentModel(), 3.0, 2.0,
                "DE-HANDLE-002 T-split wall-run handle is not hittable before cluster selection");
        click(button(controls, "Auswahl"));
        selectRoomFloorWithoutClusterMode(runtime, binding, 2.5, 2.5, "DE-HANDLE-002 T fixture");
        assertNotHandleTarget(binding.mapContentModel(), 3.0, 2.0,
                "DE-HANDLE-002 T-split wall-run handle remains hidden after room-floor selection");
        selectClusterLabel(runtime, binding, "DE-HANDLE-002 T fixture");
        assertEquals(features.dungeon.api.editor.DungeonEditorPointerInput.TargetKind.HANDLE, runtimePointerTarget(binding.mapContentModel(), 3.0, 2.0).targetKind(),
                "DE-HANDLE-002 selected cluster exposes the upper split vertical run handle");
        assertEquals(features.dungeon.api.editor.DungeonEditorPointerInput.TargetKind.HANDLE, runtimePointerTarget(binding.mapContentModel(), 3.0, 4.0).targetKind(),
                "DE-HANDLE-002 selected cluster exposes the lower split vertical run handle");
        assertEquals(features.dungeon.api.editor.DungeonEditorPointerInput.TargetKind.HANDLE, runtimePointerTarget(binding.mapContentModel(), 4.0, 3.0).targetKind(),
                "DE-HANDLE-002 selected cluster exposes the horizontal branch run handle");
        assertEquals(features.dungeon.api.editor.DungeonEditorPointerInput.TargetKind.HANDLE, runtimePointerTarget(binding.mapContentModel(), 3.0, 3.0).targetKind(),
                "DE-HANDLE-002 selected cluster exposes the authored T-junction corner handle");
        selectMap(controls, mapName + " Reload Hop");
        selectMap(controls, mapName);

        DungeonEditorState reloadedSnapshot = runtime.editorApi().current();
        assertWallRunHandle(reloadedSnapshot, 3, 2, 0, 3.0, 2.0, new Cell(3, 2, 0), new Cell(3, 3, 0),
                "DE-CLUSTER-001 reload upper split vertical");
        assertWallRunHandle(reloadedSnapshot, 3, 4, 0, 3.0, 4.0, new Cell(3, 4, 0), new Cell(3, 5, 0),
                "DE-CLUSTER-001 reload lower split vertical");
        assertWallRunHandle(reloadedSnapshot, 4, 3, 0, 4.0, 3.0, new Cell(4, 3, 0), new Cell(5, 3, 0),
                "DE-CLUSTER-001 reload horizontal branch");
        assertTrue(!hasWallRunMarkerAt(reloadedSnapshot, 3.0, 3.5),
                "DE-CLUSTER-001 reload does not restore one unsplit vertical midpoint through the junction");
        assertNotHandleTarget(binding.mapContentModel(), 3.0, 2.0,
                "DE-HANDLE-002 reload keeps T-split wall-run handle hidden before cluster selection");
        click(button(controls, "Auswahl"));
        selectRoomFloorWithoutClusterMode(runtime, binding, 2.5, 2.5, "DE-HANDLE-002 T fixture reload");
        assertNotHandleTarget(binding.mapContentModel(), 3.0, 2.0,
                "DE-HANDLE-002 reload keeps T-split wall-run handle hidden after room-floor selection");
        selectClusterLabel(runtime, binding, "DE-HANDLE-002 T fixture reload");
        assertEquals(features.dungeon.api.editor.DungeonEditorPointerInput.TargetKind.HANDLE, runtimePointerTarget(binding.mapContentModel(), 3.0, 2.0).targetKind(),
                "DE-HANDLE-002 reload selected cluster exposes the upper split vertical run handle");
        assertEquals(features.dungeon.api.editor.DungeonEditorPointerInput.TargetKind.HANDLE, runtimePointerTarget(binding.mapContentModel(), 3.0, 4.0).targetKind(),
                "DE-HANDLE-002 reload selected cluster exposes the lower split vertical run handle");
        assertEquals(features.dungeon.api.editor.DungeonEditorPointerInput.TargetKind.HANDLE, runtimePointerTarget(binding.mapContentModel(), 4.0, 3.0).targetKind(),
                "DE-HANDLE-002 reload selected cluster exposes the horizontal branch run handle");

        dragUpperTWallRunAndAssertConnectorPreserved(runtime, binding, controls, mapView, mapId, mapName);



    }

    private static void dragUpperTWallRunAndAssertConnectorPreserved(
            TestRuntime runtime,
            TestBinding binding,
            DungeonEditorControlsView controls,
            DungeonMapView mapView,
            long mapId,
            String mapName
    ) {
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();
        List<String> boundaryRowsBefore = runtime.database().roomBoundaryEdgeState(mapId);
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_PRESSED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(3.0),
                viewport.sceneToScreenY(2.0),
                false);
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_DRAGGED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(2.0),
                viewport.sceneToScreenY(2.0),
                false);

        DungeonEditorState previewSurface = runtime.editorApi().current();
        assertTrue(previewSurface.preview() instanceof DungeonEditorPreview.MoveBoundaryStretchPreview,
                "DE-CLUSTER-002 T-split drag publishes boundary-stretch preview");
        DungeonEditorPreview.MoveBoundaryStretchPreview preview =
                (DungeonEditorPreview.MoveBoundaryStretchPreview) previewSurface.preview();
        assertEquals(
                Set.of(
                        edgeKey(new Cell(3, 1, 0), new Cell(3, 2, 0)),
                        edgeKey(new Cell(3, 2, 0), new Cell(3, 3, 0))),
                edgeKeys(preview.sourceEdges()),
                "DE-CLUSTER-002 T-split preview carries only the selected upper wall-run source edges");
        assertEquals(-1L, preview.deltaQ(), "DE-CLUSTER-002 T-split preview delta q");
        assertEquals(0L, preview.deltaR(), "DE-CLUSTER-002 T-split preview delta r");
        assertTrue(mapHasBoundaryKindAt(
                        previewSurface.selectedWindow().previewMap(),
                        "WALL",
                        new Cell(2, 3, 0),
                        new Cell(3, 3, 0)),
                "DE-CLUSTER-002 T-split preview shows the connector touching the moved wall run before release");
        assertTrue(mapHasBoundaryKindAt(
                        previewSurface.selectedWindow().previewMap(),
                        "WALL",
                        new Cell(3, 3, 0),
                        new Cell(3, 4, 0)),
                "DE-CLUSTER-002 T-split preview keeps the unselected lower vertical run in place");

        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_RELEASED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(2.0),
                viewport.sceneToScreenY(2.0),
                false);

        assertTConnectorMovedState(runtime, mapId, "DE-CLUSTER-002 T-split release");
        assertTrue(!boundaryRowsBefore.equals(runtime.database().roomBoundaryEdgeState(mapId)),
                "DE-CLUSTER-002 T-split release writes changed boundary rows");

        selectMap(controls, mapName + " Reload Hop");
        selectMap(controls, mapName);
        assertTConnectorMovedState(runtime, mapId, "DE-CLUSTER-002 T-split reload");
    }

    private static void assertTConnectorMovedState(
            TestRuntime runtime,
            long mapId,
            String message
    ) {
        DungeonEditorState snapshot = runtime.editorApi().current();
        assertEquals(DungeonEditorPreview.none(), snapshot.preview(), message + " clears preview");
        assertTrue(mapHasBoundaryKindAt(snapshot.selectedWindow().map(), "WALL", new Cell(2, 1, 0), new Cell(2, 2, 0)),
                message + " moved upper split segment 1");
        assertTrue(mapHasBoundaryKindAt(snapshot.selectedWindow().map(), "WALL", new Cell(2, 2, 0), new Cell(2, 3, 0)),
                message + " moved upper split segment 2");
        assertTrue(mapHasBoundaryKindAt(snapshot.selectedWindow().map(), "WALL", new Cell(2, 3, 0), new Cell(3, 3, 0)),
                message + " horizontal connector touches moved run");
        assertTrue(mapHasBoundaryKindAt(snapshot.selectedWindow().map(), "WALL", new Cell(3, 3, 0), new Cell(3, 4, 0)),
                message + " lower split run remains at the old line");
        assertTrue(mapHasBoundaryKindAt(snapshot.selectedWindow().map(), "WALL", new Cell(3, 3, 0), new Cell(4, 3, 0)),
                message + " original horizontal branch remains connected at the junction");
        assertTrue(!mapHasBoundaryKindAt(snapshot.selectedWindow().map(), "WALL", new Cell(2, 3, 0), new Cell(2, 4, 0)),
                message + " does not move the lower split run with the selected upper run");
        assertEquals(runtime.database().countWallBoundaryRows(mapId),
                runtime.database().countDistinctWallBoundaryTopologyRefs(mapId),
                message + " keeps no duplicate wall topology refs");
        assertEquals(0L, runtime.database().countUnreferencedWallTopologyElements(mapId),
                message + " keeps no orphan wall topology rows");
    }

    private static void verifySharedHandleIdentityAndPassiveRefs() {
        TestRuntime runtime = TestRuntime.create();
        TestBinding binding = bindTest(runtime);
        DungeonEditorControlsView controls = binding.controls();

        long standaloneMapId = createMapThroughControls(controls, runtime, "Standalone Door Handle Map");
        runtime.database().seedF4WalledRoomWithDoor(standaloneMapId);
        createMapThroughControls(controls, runtime, "Standalone Door Handle Reload Hop");
        selectMap(controls, "Standalone Door Handle Map");

        DungeonEditorState standaloneSnapshot = runtime.editorApi().current();
        assertEquals(1L, countHandles(standaloneSnapshot, DungeonEditorHandleKind.DOOR),
                "DE-HANDLE-001 standalone authored door publishes exactly one shared handle");
        DungeonEditorHandleSnapshot standaloneDoor =
                firstDoorHandleAt(standaloneSnapshot, 4, 2, 0, "DE-HANDLE-001 standalone door");
        assertHandleIdentityShape(standaloneSnapshot, DungeonEditorHandleKind.DOOR, "DE-HANDLE-001 standalone door");
        assertEquals(0L, standaloneDoor.ref().corridorId(),
                "DE-HANDLE-001 standalone authored door handle remains unbound from corridor routing");
        assertTrue(standaloneDoor.ref().roomId() > 0L,
                "DE-HANDLE-001 standalone authored door handle preserves room identity");
        assertEquals(features.dungeon.api.editor.DungeonEditorPointerInput.TargetKind.HANDLE, runtimePointerTarget(binding.mapContentModel(), doorHandleCenterQ(standaloneDoor), doorHandleCenterR(standaloneDoor)).targetKind(),
                "DE-HANDLE-001 standalone door handle is visible and hittable through the shared handle route");
        assertDoorHandleVisibleOnlyOnHover(
                binding,
                doorHandleCenterQ(standaloneDoor),
                doorHandleCenterR(standaloneDoor),
                sourceEdgeIsHorizontal(standaloneDoor),
                "DE-HANDLE-001 standalone door");

        long mapId = createMapThroughControls(controls, runtime, "Handle Variety Map");
        runtime.database().seedF15ComplexCluster(mapId);
        runtime.database().seedCorridorWithAnchor(mapId);
        runtime.database().seedF7StairAnchor(mapId);
        createMapThroughControls(controls, runtime, "Handle Variety Reload Hop");
        selectMap(controls, "Handle Variety Map");

        DungeonEditorState snapshot = runtime.editorApi().current();
        assertEquals(2L, countHandles(snapshot, DungeonEditorHandleKind.DOOR),
                "DE-HANDLE-001 corridor-bound authored doors still publish exactly one handle per bound door");
        assertEquals(2L, distinctTopologyIds(snapshot, DungeonEditorHandleKind.DOOR),
                "DE-HANDLE-001 corridor-bound authored door handles stay deduplicated by stable door topology");
        assertHandleIdentityShape(snapshot, DungeonEditorHandleKind.CLUSTER_CORNER, "DE-HANDLE-001 cluster corner");
        assertHandleIdentityShape(snapshot, DungeonEditorHandleKind.CLUSTER_WALL_RUN, "DE-HANDLE-001 cluster wall-run");
        assertHandleIdentityShape(snapshot, DungeonEditorHandleKind.DOOR, "DE-HANDLE-001 corridor-bound door");
        assertHandleIdentityShape(snapshot, DungeonEditorHandleKind.CORRIDOR_ANCHOR, "DE-HANDLE-001 corridor anchor");
        assertHandleIdentityShape(snapshot, DungeonEditorHandleKind.CORRIDOR_WAYPOINT, "DE-HANDLE-001 corridor waypoint");
        assertHandleIdentityShape(snapshot, DungeonEditorHandleKind.STAIR_ANCHOR, "DE-HANDLE-001 stair anchor");

        DungeonEditorHandleSnapshot doorHandle =
                firstDoorHandleForDirection(snapshot, "EAST", "DE-HANDLE-001 door");
        DungeonEditorHandleSnapshot corridorAnchor =
                firstHandle(snapshot, DungeonEditorHandleKind.CORRIDOR_ANCHOR, "DE-HANDLE-001 corridor anchor");
        DungeonEditorHandleSnapshot corridorWaypoint =
                firstHandle(snapshot, DungeonEditorHandleKind.CORRIDOR_WAYPOINT, "DE-HANDLE-001 corridor waypoint");
        assertEquals(features.dungeon.api.editor.DungeonEditorPointerInput.TargetKind.HANDLE, runtimePointerTarget(binding.mapContentModel(), doorHandleCenterQ(doorHandle), doorHandleCenterR(doorHandle)).targetKind(),
                "DE-HANDLE-001 door handle ref is a canvas drag handle");
        assertDoorHandleVisibleOnlyOnHover(
                binding,
                doorHandleCenterQ(doorHandle),
                doorHandleCenterR(doorHandle),
                sourceEdgeIsHorizontal(doorHandle),
                "DE-HANDLE-001 corridor-bound door");
        assertNotHandleTarget(binding.mapContentModel(), corridorAnchor.markerQ(), corridorAnchor.markerR(),
                "DE-HANDLE-001 corridor anchor ref is not a canvas drag handle");
        assertNotHandleTarget(binding.mapContentModel(), corridorWaypoint.markerQ(), corridorWaypoint.markerR(),
                "DE-HANDLE-001 corridor waypoint ref is not a canvas drag handle");


    }

    private static void verifyDoorHandleDrag() {
        TestRuntime standaloneRuntime = TestRuntime.create();
        TestBinding standaloneBinding = bindTest(standaloneRuntime);
        DungeonEditorControlsView standaloneControls = standaloneBinding.controls();
        DungeonMapView standaloneMapView = standaloneBinding.mapView();

        long standaloneMapId = createMapThroughControls(standaloneControls, standaloneRuntime, "Standalone Door Drag Map");
        standaloneRuntime.database().seedF4WalledRoomWithDoor(standaloneMapId);
        createMapThroughControls(standaloneControls, standaloneRuntime, "Standalone Door Drag Reload Hop");
        selectMap(standaloneControls, "Standalone Door Drag Map");

        DungeonEditorState standaloneSnapshot = standaloneRuntime.editorApi().current();
        DungeonEditorHandleSnapshot standaloneDoor =
                firstDoorHandleAt(standaloneSnapshot, 4, 2, 0, "DE-DOOR-004 standalone door");
        assertEquals(features.dungeon.api.editor.DungeonEditorPointerInput.TargetKind.HANDLE, runtimePointerTarget(standaloneBinding.mapContentModel(), doorHandleCenterQ(standaloneDoor), doorHandleCenterR(standaloneDoor)).targetKind(),
                "DE-DOOR-004 standalone door handle resolves as canvas drag handle");
        assertStandaloneDoorHandleDrag(
                standaloneRuntime,
                standaloneBinding,
                standaloneControls,
                standaloneMapView,
                standaloneMapId,
                standaloneDoor);

        TestRuntime runtime = TestRuntime.create();
        TestBinding binding = bindTest(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();

        long mapId = createMapThroughControls(controls, runtime, "Door Handle Drag Map");
        runtime.database().seedF15ComplexCluster(mapId);
        runtime.database().seedCorridorWithAnchor(mapId);
        runtime.database().seedF7StairAnchor(mapId);
        createMapThroughControls(controls, runtime, "Door Handle Drag Reload Hop");
        selectMap(controls, "Door Handle Drag Map");

        DungeonEditorState snapshot = runtime.editorApi().current();
        DungeonEditorHandleSnapshot doorHandle =
                firstDoorHandleForDirection(snapshot, "EAST", "DE-DOOR-004 door");
        assertEquals(features.dungeon.api.editor.DungeonEditorPointerInput.TargetKind.HANDLE, runtimePointerTarget(binding.mapContentModel(), doorHandleCenterQ(doorHandle), doorHandleCenterR(doorHandle)).targetKind(),
                "DE-DOOR-004 door handle resolves as canvas drag handle");
        assertDoorHandleVisibleOnlyOnHover(
                binding,
                doorHandleCenterQ(doorHandle),
                doorHandleCenterR(doorHandle),
                sourceEdgeIsHorizontal(doorHandle),
                "DE-DOOR-004 source door");
        assertDoorHandleDrag(runtime, binding, controls, mapView, mapId, doorHandle);



    }

    private static void verifyInvalidDoorHandleMoveRejectedThroughMapView() {
        TestRuntime standaloneRuntime = TestRuntime.create();
        TestBinding standaloneBinding = bindTest(standaloneRuntime);
        DungeonEditorControlsView standaloneControls = standaloneBinding.controls();
        DungeonMapView standaloneMapView = standaloneBinding.mapView();

        long standaloneMapId = createMapThroughControls(
                standaloneControls,
                standaloneRuntime,
                "Standalone Door Invalid Move Map");
        standaloneRuntime.database().seedF4WalledRoomWithDoor(standaloneMapId);
        createMapThroughControls(standaloneControls, standaloneRuntime, "Standalone Door Invalid Reload Hop");
        selectMap(standaloneControls, "Standalone Door Invalid Move Map");
        DungeonEditorHandleSnapshot standaloneDoor =
                firstDoorHandleAt(standaloneRuntime.editorApi().current(), 4, 2, 0, "DE-DOOR-005 standalone");
        assertInvalidStandaloneDoorHandleMoveRejected(
                standaloneRuntime,
                standaloneBinding,
                standaloneControls,
                standaloneMapView,
                standaloneMapId,
                standaloneDoor);

        TestRuntime runtime = TestRuntime.create();
        TestBinding binding = bindTest(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();

        long mapId = createMapThroughControls(controls, runtime, "Door Handle Invalid Move Map");
        runtime.database().seedCorridorWithAnchor(mapId);
        createMapThroughControls(controls, runtime, "Door Handle Invalid Move Reload Hop");
        selectMap(controls, "Door Handle Invalid Move Map");
        DungeonEditorHandleSnapshot doorHandle =
                firstDoorHandleAt(runtime.editorApi().current(), 4, 2, 0, "DE-DOOR-005 invalid");
        List<String> authoredStateBefore = runtime.database().authoredGeometryState(mapId);
        List<String> doorRowsBefore = runtime.database().doorBoundaryState(mapId);
        List<String> corridorRowsBefore = runtime.database().corridorStableConnectionState(mapId);
        DungeonEditorState surfaceBefore = runtime.editorApi().current();
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();

        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_PRESSED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(doorHandleCenterQ(doorHandle)),
                viewport.sceneToScreenY(doorHandleCenterR(doorHandle)),
                false);
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_DRAGGED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(doorHandleCenterQ(doorHandle)),
                viewport.sceneToScreenY(doorHandleCenterR(doorHandle) + 4.0),
                false);
        assertTrue(runtime.editorApi().current().preview() instanceof DungeonEditorPreview.MoveHandlePreview,
                "DE-DOOR-005 invalid still publishes transient drag preview before rejected release");

        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_RELEASED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(doorHandleCenterQ(doorHandle)),
                viewport.sceneToScreenY(doorHandleCenterR(doorHandle) + 4.0),
                false);

        assertEquals(authoredStateBefore, runtime.database().authoredGeometryState(mapId),
                "DE-DOOR-005 invalid release leaves authored DB unchanged");
        assertEquals(doorRowsBefore, runtime.database().doorBoundaryState(mapId),
                "DE-DOOR-005 invalid release leaves door boundary rows unchanged");
        assertEquals(corridorRowsBefore, runtime.database().corridorStableConnectionState(mapId),
                "DE-DOOR-005 invalid release leaves corridor bindings unchanged");
        DungeonEditorState rejectedSurface = runtime.editorApi().current();
        assertEquals(DungeonEditorPreview.none(), rejectedSurface.preview(),
                "DE-DOOR-005 invalid release clears preview");
        assertTrue(!runtime.editorApi().current().commandStatus().message().isBlank(),
                "DE-DOOR-005 invalid release publishes user-visible rejection feedback");
        assertEquals(surfaceBefore.selectedWindow().map(), rejectedSurface.selectedWindow().map(),
                "DE-DOOR-005 invalid release keeps published map unchanged");
        assertTrue(renderHasBoundaryNear(binding.mapContentModel(), "DOOR", 4.0, 2.5),
                "DE-DOOR-005 invalid render keeps source door boundary");
        assertTrue(!renderHasBoundaryNear(binding.mapContentModel(), "DOOR", 4.0, 6.5),
                "DE-DOOR-005 invalid render does not leave an orphan moved handle");
        selectMap(controls, "Door Handle Invalid Move Reload Hop");
        selectMap(controls, "Door Handle Invalid Move Map");
        assertEquals(doorRowsBefore, runtime.database().doorBoundaryState(mapId),
                "DE-DOOR-005 invalid reload keeps original door boundary rows");
        assertEquals(corridorRowsBefore, runtime.database().corridorStableConnectionState(mapId),
                "DE-DOOR-005 invalid reload keeps original corridor binding rows");


    }

    private static void verifySelectedWallRunHandleStyle() {
        TestRuntime runtime = TestRuntime.create();
        TestBinding binding = bindTest(runtime);
        DungeonEditorControlsView controls = binding.controls();

        long mapId = createMapThroughControls(controls, runtime, "Wall Run Handle Style Map");
        runtime.database().seedF15ComplexCluster(mapId);
        runtime.database().seedCorridorWithAnchor(mapId);
        runtime.database().seedF7StairAnchor(mapId);
        createMapThroughControls(controls, runtime, "Wall Run Handle Style Reload Hop");
        selectMap(controls, "Wall Run Handle Style Map");

        DungeonEditorState snapshot = runtime.editorApi().current();
        firstHandle(snapshot, DungeonEditorHandleKind.CLUSTER_WALL_RUN, "DE-HANDLE-004 wall-run");
        click(button(controls, "Auswahl"));
        selectClusterLabel(runtime, binding, "DE-HANDLE-004");
        DungeonEditorMapSnapshot.Area selectedRoom = roomAreaByLabel(
                runtime.editorApi().current(),
                "R1",
                "DE-HANDLE-004 selected floor");
        DungeonMapContentModel.PaintStyle selectedRoomSurfaceStyle = surfaceStyleForSelectionRef(
                binding.mapContentModel(),
                selectedRoom.topologyRef(),
                "DE-HANDLE-004 selected floor");
        DungeonMapContentModel.GlyphPrimitive wallRunGlyph = glyphAt(
                binding.mapContentModel(),
                CLUSTER_WALL_RUN_KIND,
                11.0,
                10.0,
                "DE-HANDLE-004 wall-run");
        DungeonEditorHandleSnapshot doorHandle =
                firstDoorHandleForDirection(runtime.editorApi().current(), "EAST", "DE-HANDLE-004 door");
        assertDoorHandleVisibleOnlyOnHover(
                binding,
                doorHandleCenterQ(doorHandle),
                doorHandleCenterR(doorHandle),
                sourceEdgeIsHorizontal(doorHandle),
                "DE-HANDLE-004 door");
        DungeonMapContentModel.GlyphPrimitive doorGlyph = doorGlyphAt(
                binding.mapContentModel(),
                doorHandleCenterQ(doorHandle),
                doorHandleCenterR(doorHandle))
                .orElseThrow(() -> new AssertionError("DE-HANDLE-004 hovered door glyph not rendered"));
        assertTrue(renderHasWallRunMarkerAt(binding.mapContentModel(), 11.0, 10.0),
                "DE-HANDLE-004 cluster-label-selected F16 wall-run marker remains smaller and less obstructive than a cluster corner");
        assertTrue(handleGlyphDistinctFromSelectedFloor(wallRunGlyph, selectedRoomSurfaceStyle),
                "DE-HANDLE-004 selected wall-run handle keeps a distinct fill/stroke role from selected floor cells");
        assertTrue(handleGlyphDistinctFromSelectedFloor(doorGlyph, selectedRoomSurfaceStyle),
                "DE-HANDLE-004 door handle keeps a distinct fill/stroke role from selected floor cells");


    }

    private static void verifyComplexClusterTrueCornerDrag() {
        TestRuntime runtime = TestRuntime.create();
        TestBinding binding = bindTest(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();

        long mapId = createMapThroughControls(controls, runtime, "Complex Cluster Corner Move Map");
        runtime.database().seedF15ComplexCluster(mapId);
        createMapThroughControls(controls, runtime, "Complex Cluster Corner Move Reload Hop");
        selectMap(controls, "Complex Cluster Corner Move Map");
        click(button(controls, "Auswahl"));
        selectClusterLabel(runtime, binding, "DE-CLUSTER-003");

        DungeonEditorState initialSurface = runtime.editorApi().current();
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
        assertEquals(features.dungeon.api.editor.DungeonEditorPointerInput.TargetKind.HANDLE, runtimePointerTarget(binding.mapContentModel(), 13.0, 11.0).targetKind(),
                "DE-CLUSTER-003 resolves the true inner corner as a handle");

        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_PRESSED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(13.0),
                viewport.sceneToScreenY(11.0),
                false);
        exercisePreviewInteractions(
                "DE-CLUSTER-003 cluster corner drag preview stream",
                () -> fireMapMouse(
                        mapView,
                        MouseEvent.MOUSE_DRAGGED,
                        MouseButton.PRIMARY,
                        viewport.sceneToScreenX(14.0),
                        viewport.sceneToScreenY(11.0),
                        false),
                () -> fireMapMouse(
                        mapView,
                        MouseEvent.MOUSE_DRAGGED,
                        MouseButton.PRIMARY,
                        viewport.sceneToScreenX(14.0),
                        viewport.sceneToScreenY(12.0),
                        false),
                () -> fireMapMouse(
                        mapView,
                        MouseEvent.MOUSE_DRAGGED,
                        MouseButton.PRIMARY,
                        viewport.sceneToScreenX(14.0),
                        viewport.sceneToScreenY(11.0),
                        false),
                () -> fireMapMouse(
                        mapView,
                        MouseEvent.MOUSE_DRAGGED,
                        MouseButton.PRIMARY,
                        viewport.sceneToScreenX(14.0),
                        viewport.sceneToScreenY(12.0),
                        false));

        DungeonEditorState previewSurface = runtime.editorApi().current();
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
        assertTrue(previewSurface.selectedWindow().previewMap() != null,
                "DE-CLUSTER-003 publishes a preview map during true-corner drag");
        assertTrue(!mapSnapshotCellSet(previewSurface.selectedWindow().previewMap()).equals(cellsBefore),
                "DE-CLUSTER-003 preview map changes affected cluster cells before release");
        PreviewDiff previewRenderDiff = PreviewDiff.from(previewSurface);
        assertTrue(previewRenderDiff.changedHandles().stream().anyMatch(handle ->
                        handle.ref().kind() == cornerHandle.ref().kind()
                                && handle.cell().q() == 14
                                && handle.cell().r() == 12
                                && handle.cell().level() == 0),
                "DE-CLUSTER-003 structured preview diff carries the moved corner handle");
        assertTrue(labelTexts(binding.mapContentModel(), displayRoomLabel("R1")).stream()
                        .allMatch(label -> label.style().fill() == null
                                && label.style().stroke() == null
                                && label.style().alpha() > 0.7
                                && label.textColor().alphaUnit() > 0.8),
                "DE-LABEL-004 preview keeps rendered room labels text-only with visible contrast");

        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_RELEASED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(14.0),
                viewport.sceneToScreenY(12.0),
                false);

        DungeonEditorState committedSurface = runtime.editorApi().current();
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
        assertClusterCornerHandleAt(runtime.editorApi().current(), 14, 12, 0, "DE-CLUSTER-003 reload");
        assertTrue(renderHasBoundaryNear(binding.mapContentModel(), "WALL", 14.0, 11.5),
                "DE-CLUSTER-003 reload render keeps the moved vertical wall span");
        assertTrue(renderHasBoundaryNear(binding.mapContentModel(), "WALL", 13.5, 12.0),
                "DE-CLUSTER-003 reload render keeps the moved horizontal wall span");


    }

    private static void verifyComplexClusterWallRunDrag() {
        TestRuntime runtime = TestRuntime.create();
        TestBinding binding = bindTest(runtime);
        DungeonEditorControlsView controls = binding.controls();
        DungeonMapView mapView = binding.mapView();

        long mapId = createMapThroughControls(controls, runtime, "Complex Cluster Wall Run Move Map");
        runtime.database().seedF15ComplexCluster(mapId);
        createMapThroughControls(controls, runtime, "Complex Cluster Wall Run Move Reload Hop");
        selectMap(controls, "Complex Cluster Wall Run Move Map");
        click(button(controls, "Auswahl"));
        selectClusterLabel(runtime, binding, "DE-CLUSTER-002");

        DungeonEditorState initialSurface = runtime.editorApi().current();
        assertWallRunHandleTargets(binding.mapContentModel(), "DE-CLUSTER-002");
        DungeonEditorHandleSnapshot wallRunHandle =
                firstClusterWallRunHandleAt(initialSurface, 11, 10, 0, "NORTH", "DE-CLUSTER-002");
        long clusterId = wallRunHandle.ref().clusterId();
        long geometryRowsBefore = runtime.database().countAuthoredGeometryRows(mapId);
        List<String> authoredStateBefore = runtime.database().authoredGeometryState(mapId);
        List<String> boundaryRowsBefore = runtime.database().roomBoundaryEdgeState(mapId);
        RoomClusterIds roomIdsBefore = runtime.database().roomByName(mapId, "R1");
        assertEquals(features.dungeon.api.editor.DungeonEditorPointerInput.TargetKind.HANDLE, runtimePointerTarget(binding.mapContentModel(), 11.0, 10.0).targetKind(),
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
        exercisePreviewInteractions(
                "DE-HANDLE-003 wall-run drag preview stream",
                () -> fireMapMouse(
                        mapView,
                        MouseEvent.MOUSE_DRAGGED,
                        MouseButton.PRIMARY,
                        viewport.sceneToScreenX(11.0),
                        viewport.sceneToScreenY(9.0),
                        false),
                () -> fireMapMouse(
                        mapView,
                        MouseEvent.MOUSE_DRAGGED,
                        MouseButton.PRIMARY,
                        viewport.sceneToScreenX(11.0),
                        viewport.sceneToScreenY(8.0),
                        false),
                () -> fireMapMouse(
                        mapView,
                        MouseEvent.MOUSE_DRAGGED,
                        MouseButton.PRIMARY,
                        viewport.sceneToScreenX(11.0),
                        viewport.sceneToScreenY(9.0),
                        false));

        DungeonEditorState previewSurface = runtime.editorApi().current();
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
        assertEquals(
                Set.of(
                        edgeKey(new Cell(10, 10, 0), new Cell(11, 10, 0)),
                        edgeKey(new Cell(11, 10, 0), new Cell(12, 10, 0)),
                        edgeKey(new Cell(12, 10, 0), new Cell(13, 10, 0))),
                edgeKeys(preview.sourceEdges()),
                "DE-HANDLE-003 wall-run preview carries the full contiguous authored run");
        assertEquals(0L, preview.deltaQ(), "DE-CLUSTER-002 preview delta q");
        assertEquals(-1L, preview.deltaR(), "DE-CLUSTER-002 preview delta r");
        assertEquals(0L, preview.deltaLevel(), "DE-CLUSTER-002 preview delta level");
        assertTrue(previewSurface.selectedWindow().previewMap() != null,
                "DE-HANDLE-003 publishes a preview map during wall-run drag");
        assertTrue(!mapSnapshotCellSet(previewSurface.selectedWindow().previewMap())
                        .equals(mapSnapshotCellSet(previewSurface.selectedWindow().map())),
                "DE-HANDLE-003 preview map differs from the committed cluster cells");
        PreviewDiff previewRenderDiff = PreviewDiff.from(previewSurface);
        assertTrue(previewRenderDiff.changedBoundaries().stream()
                        .map(boundary -> boundary.edge())
                        .collect(java.util.stream.Collectors.toSet())
                        .containsAll(Set.of(
                                edge(new Cell(10, 9, 0), new Cell(11, 9, 0)),
                                edge(new Cell(11, 9, 0), new Cell(12, 9, 0)),
                                edge(new Cell(12, 9, 0), new Cell(13, 9, 0)))),
                "DE-HANDLE-003 structured preview diff carries every moved segment of the dragged wall run");
        assertTrue(previewRenderDiff.changedAreas().stream().anyMatch(area ->
                        !area.cells().isEmpty()),
                "DE-HANDLE-003 structured preview diff carries affected room cells");

        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_RELEASED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(11.0),
                viewport.sceneToScreenY(8.0),
                false);

        DungeonEditorState committedSurface = runtime.editorApi().current();
        assertEquals(DungeonEditorPreview.none(), committedSurface.preview(),
                "DE-CLUSTER-002 clears wall-run preview after release");
        assertEquals(roomIdsBefore, runtime.database().roomByName(mapId, "R1"),
                "DE-CLUSTER-002 wall-run drag keeps room and cluster identity");
        assertEquals(1L, runtime.database().countRoomsForMap(mapId),
                "DE-CLUSTER-002 wall-run drag coalesces the open closed-boundary component to one room row");
        assertEquals(1L, committedSurface.selectedWindow().map().areas().stream()
                        .filter(area -> "ROOM".equalsIgnoreCase(area.kind()))
                        .count(),
                "DE-CLUSTER-002 wall-run drag publishes one room area for one closed-boundary component");
        assertTrue(!boundaryRowsBefore.equals(runtime.database().roomBoundaryEdgeState(mapId)),
                "DE-CLUSTER-002 recomputes persisted boundary rows after wall-run release");
        assertEquals(runtime.database().countWallBoundaryRows(mapId),
                runtime.database().countDistinctWallBoundaryTopologyRefs(mapId),
                "DE-CLUSTER-002 persists no duplicate wall topology refs on boundary rows");
        assertEquals(0L, runtime.database().countUnreferencedWallTopologyElements(mapId),
                "DE-CLUSTER-002 leaves no orphan wall topology rows");
        assertTrue(runtime.database().authoredClusterBoundaryCorners(clusterId).containsAll(Set.of("10,9,0", "13,9,0")),
                "DE-CLUSTER-002 persists the last previewed full wall-run endpoints despite divergent release coordinates");

        selectMap(controls, "Complex Cluster Wall Run Move Reload Hop");
        selectMap(controls, "Complex Cluster Wall Run Move Map");
        assertEquals(roomIdsBefore, runtime.database().roomByName(mapId, "R1"),
                "DE-CLUSTER-002 reload keeps room and cluster identity");
        assertEquals(1L, runtime.database().countRoomsForMap(mapId),
                "DE-CLUSTER-002 reload keeps one room row for one closed-boundary component");
        assertEquals(1L, runtime.editorApi().current().selectedWindow().map().areas().stream()
                        .filter(area -> "ROOM".equalsIgnoreCase(area.kind()))
                        .count(),
                "DE-CLUSTER-002 reload publishes one room area for one closed-boundary component");
        assertEquals(0L, runtime.database().countUnreferencedWallTopologyElements(mapId),
                "DE-CLUSTER-002 reload keeps no orphan wall topology rows");
        assertTrue(runtime.database().authoredClusterBoundaryCorners(clusterId).containsAll(Set.of("10,9,0", "13,9,0")),
                "DE-CLUSTER-002 reload keeps the dragged full wall-run endpoints");




    }

    private static void assertInvalidWallRunDragRejected(
            TestRuntime runtime,
            TestBinding binding,
            long mapId
    ) {
        DungeonEditorState before = runtime.editorApi().current();
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
        DungeonEditorState afterPress = runtime.editorApi().current();
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

        DungeonEditorState after = runtime.editorApi().current();
        assertEquals(geometryRowsBefore, runtime.database().countAuthoredGeometryRows(mapId),
                "DE-CLUSTER-002 invalid wall-run drag leaves authored DB row count unchanged");
        assertEquals(authoredStateBefore, runtime.database().authoredGeometryState(mapId),
                "DE-CLUSTER-002 invalid wall-run drag leaves all authored geometry stores unchanged");
        assertEquals(boundaryRowsBefore, runtime.database().roomBoundaryEdgeState(mapId),
                "DE-CLUSTER-002 invalid wall-run drag leaves persisted boundary rows unchanged");
        assertEquals(before.selectedWindow().map(), after.selectedWindow().map(),
                "DE-CLUSTER-002 invalid wall-run drag keeps published map unchanged");
        assertEquals(afterPress.selection(), after.selection(),
                "DE-CLUSTER-002 invalid wall-run drag keeps post-press selection unchanged");
        assertEquals(DungeonEditorPreview.none(), after.preview(),
                "DE-CLUSTER-002 invalid wall-run drag clears preview without committing");
    }

    private static void assertClusterLabelSelection(
            TestRuntime runtime,
            long clusterId,
            String message
    ) {
        DungeonEditorSelection stateSelection = runtime.editorApi().current().selection();
        DungeonEditorSelection surfaceSelection = runtime.editorApi().current().selection();
        assertClusterLabelSelection(stateSelection, clusterId, message + " state model");
        assertClusterLabelSelection(surfaceSelection, clusterId, message + " map surface");
        assertEquals(DungeonEditorPreview.none(), runtime.editorApi().current().preview(),
                message + " keeps preview empty");
    }

    private static void assertClusterLabelSelection(
            DungeonEditorSelection selection,
            long clusterId,
            String message
    ) {
        assertEquals(clusterId, selection.clusterId(), message + " cluster id");
        assertTrue(selection.clusterSelection(), message + " selects cluster-name target");
        assertTrue(selection.handleRef() != null
                        && selection.handleRef().kind() == DungeonEditorHandleKind.CLUSTER_LABEL,
                message + " keeps cluster-label handle identity");
    }

    private static DungeonEditorHandleSnapshot selectClusterLabel(
            TestRuntime runtime,
            TestBinding binding,
            String message
    ) {
        DungeonEditorState snapshot = runtime.editorApi().current();
        DungeonEditorHandleSnapshot label = snapshot.selectedWindow().map().editorHandles().stream()
                .filter(handle -> handle.ref().kind() == DungeonEditorHandleKind.CLUSTER_LABEL)
                .findFirst()
                .orElseThrow(() -> new AssertionError(message + " cluster label not published"));
        return selectClusterLabel(runtime, binding, label, message);
    }

    private static DungeonEditorHandleSnapshot selectClusterLabel(
            TestRuntime runtime,
            TestBinding binding,
            long clusterId,
            String message
    ) {
        DungeonEditorState snapshot = runtime.editorApi().current();
        DungeonEditorHandleSnapshot label = snapshot.selectedWindow().map().editorHandles().stream()
                .filter(handle -> handle.ref().kind() == DungeonEditorHandleKind.CLUSTER_LABEL)
                .filter(handle -> handle.ref().clusterId() == clusterId)
                .findFirst()
                .orElseThrow(() -> new AssertionError(message + " cluster label not published for " + clusterId));
        return selectClusterLabel(runtime, binding, label, message);
    }

    private static DungeonEditorHandleSnapshot selectClusterLabel(
            TestRuntime runtime,
            TestBinding binding,
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

    private static void selectRoomFloorWithoutClusterMode(
            TestRuntime runtime,
            TestBinding binding,
            double q,
            double r,
            String message
    ) {
        clickMap(binding.mapView(), binding.mapContentModel(), q, r);
        DungeonEditorSelection stateSelection = runtime.editorApi().current().selection();
        DungeonEditorSelection surfaceSelection = runtime.editorApi().current().selection();
        assertEquals(features.dungeon.api.DungeonTopologyElementKind.ROOM, stateSelection.topologyRef().kind(),
                message + " state model room floor selection topology kind");
        assertTrue(stateSelection.clusterId() > 0L, message + " state model room floor selection keeps cluster id");
        assertTrue(!stateSelection.clusterSelection(),
                message + " state model room floor selection stays out of cluster mode");
        assertEquals(null, stateSelection.handleRef(),
                message + " state model room floor selection does not fake a cluster-label handle");
        assertEquals(features.dungeon.api.DungeonTopologyElementKind.ROOM, surfaceSelection.topologyRef().kind(),
                message + " map surface room floor selection topology kind");
        assertTrue(surfaceSelection.clusterId() > 0L, message + " map surface room floor selection keeps cluster id");
        assertTrue(!surfaceSelection.clusterSelection(),
                message + " map surface room floor selection stays out of cluster mode");
        assertEquals(null, surfaceSelection.handleRef(),
                message + " map surface room floor selection does not fake a cluster-label handle");
        assertEquals(DungeonEditorPreview.none(), runtime.editorApi().current().preview(),
                message + " room floor selection keeps preview empty");
    }

    private static void assertNotHandleTarget(
            DungeonMapContentModel mapContentModel,
            double q,
            double r,
            String message
    ) {
        assertTrue(runtimePointerTarget(mapContentModel, q, r).targetKind()
                != features.dungeon.api.editor.DungeonEditorPointerInput.TargetKind.HANDLE, message);
    }

    private static void assertDoorHandleDrag(
            TestRuntime runtime,
            TestBinding binding,
            DungeonEditorControlsView controls,
            DungeonMapView mapView,
            long mapId,
            DungeonEditorHandleSnapshot doorHandle
    ) {
        long doorRowsBefore = runtime.database().countDoorBoundariesAt(mapId, 1, 0, "EAST");
        List<String> authoredStateBefore = runtime.database().authoredGeometryState(mapId);
        List<String> corridorRowsBefore = runtime.database().corridorStableConnectionState(mapId);
        long corridorId = runtime.database().corridorIdsForMap(mapId).iterator().next();
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_PRESSED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(doorHandleCenterQ(doorHandle)),
                viewport.sceneToScreenY(doorHandleCenterR(doorHandle)),
                false);
        exercisePreviewInteractions(
                "DE-HANDLE-006 door drag preview stream",
                () -> fireMapMouse(
                        mapView,
                        MouseEvent.MOUSE_DRAGGED,
                        MouseButton.PRIMARY,
                        viewport.sceneToScreenX(doorHandleCenterQ(doorHandle)),
                        viewport.sceneToScreenY(doorHandleCenterR(doorHandle) + 1.0),
                        false),
                () -> fireMapMouse(
                        mapView,
                        MouseEvent.MOUSE_DRAGGED,
                        MouseButton.PRIMARY,
                        viewport.sceneToScreenX(doorHandleCenterQ(doorHandle)),
                        viewport.sceneToScreenY(doorHandleCenterR(doorHandle) + 2.0),
                        false),
                () -> fireMapMouse(
                        mapView,
                        MouseEvent.MOUSE_DRAGGED,
                        MouseButton.PRIMARY,
                        viewport.sceneToScreenX(doorHandleCenterQ(doorHandle)),
                        viewport.sceneToScreenY(doorHandleCenterR(doorHandle) + 1.0),
                        false));

        DungeonEditorState previewSurface = runtime.editorApi().current();
        assertTrue(previewSurface.preview() instanceof DungeonEditorPreview.MoveHandlePreview,
                "DE-HANDLE-006 door drag publishes a move-handle preview");
        DungeonEditorPreview.MoveHandlePreview preview =
                (DungeonEditorPreview.MoveHandlePreview) previewSurface.preview();
        assertEquals(DungeonEditorHandleKind.DOOR, preview.handleRef().kind(),
                "DE-HANDLE-006 preview handle kind");
        assertEquals(0L, preview.deltaQ(), "DE-HANDLE-006 preview delta q");
        assertEquals(1L, preview.deltaR(), "DE-HANDLE-006 preview delta r");
        assertTrue(renderedDoorMarkersHaveBlankLabels(binding.mapContentModel()),
                "DE-HANDLE-006 render scene keeps door preview markers on the handle affordance path without a D glyph: "
                        + renderedDoorMarkers(binding.mapContentModel()));
        assertEquals(0L,
                countDoorMarkersAt(binding.mapContentModel(), doorHandleCenterQ(doorHandle), doorHandleCenterR(doorHandle)),
                "DE-HANDLE-006 render scene hides stale source door marker during drag preview: "
                        + renderedDoorMarkers(binding.mapContentModel()));
        assertTrue(previewSurface.selectedWindow().previewMap() != null,
                "DE-HANDLE-006 door drag publishes an authoritative preview map");
        assertTrue(mapHasBoundaryKindAt(
                        previewSurface.selectedWindow().previewMap(),
                        "door",
                        new Cell(4, 3, 0),
                        new Cell(4, 4, 0)),
                "DE-HANDLE-006 door drag preview map contains the moved door boundary");
        PreviewDiff previewRenderDiff = PreviewDiff.from(previewSurface);
        assertTrue(previewRenderDiff.changedBoundaries().stream()
                        .anyMatch(boundary -> "door".equalsIgnoreCase(boundary.kind())
                                && sameEdge(boundary.edge(), new Cell(4, 3, 0), new Cell(4, 4, 0))),
                "DE-HANDLE-006 structured preview diff carries the moved door boundary");
        assertTrue(previewRenderDiff.changedHandles().stream()
                        .anyMatch(handle -> handle.ref().kind() == DungeonEditorHandleKind.DOOR
                                && handle.ref().corridorId() == corridorId
                                && handle.ref().topologyRef().id() == doorHandle.ref().topologyRef().id()
                                && sameCell(handle.cell(), new Cell(4, 3, 0))),
                "DE-HANDLE-006 structured preview diff carries the moved corridor-bound door handle");
        assertEquals(doorRowsBefore, runtime.database().countDoorBoundariesAt(mapId, 1, 0, "EAST"),
                "DE-HANDLE-006 door preview keeps persisted source door row");
        assertEquals(authoredStateBefore, runtime.database().authoredGeometryState(mapId),
                "DE-HANDLE-006 door preview leaves authored stores unchanged");
        assertEquals(corridorRowsBefore, runtime.database().corridorStableConnectionState(mapId),
                "DE-HANDLE-006 door preview leaves corridor binding stores unchanged");

        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_RELEASED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(doorHandleCenterQ(doorHandle)),
                viewport.sceneToScreenY(doorHandleCenterR(doorHandle) + 1.0),
                false);

        assertEquals(0L, runtime.database().countDoorBoundariesAt(mapId, 1, 0, "EAST"),
                "DE-DOOR-004 release moves the source door row away");
        assertEquals(1L, runtime.database().countDoorBoundariesAt(mapId, 1, 1, "EAST"),
                "DE-DOOR-004 release persists the moved door row");
        List<String> stableRowsAfter = runtime.database().corridorStableConnectionState(mapId);
        assertTrue(stableRowsAfter.stream().anyMatch(row ->
                        row.startsWith("dungeon_corridor_door_overrides|")
                                && row.contains("|relative_cell_x=3|")
                                && row.contains("|relative_cell_y=3|")
                                && row.contains("|edge_direction=EAST|")
                                && row.contains("|topology_element_id=" + doorHandle.ref().topologyRef().id())),
                "DE-DOOR-004 release moves the bound corridor endpoint with the door: " + stableRowsAfter);
        assertTrue(stableRowsAfter.stream().noneMatch(row ->
                        row.startsWith("dungeon_corridor_door_overrides|")
                                && row.contains("|relative_cell_x=3|")
                                && row.contains("|relative_cell_y=2|")
                                && row.contains("|edge_direction=EAST|")
                                && row.contains("|topology_element_id=" + doorHandle.ref().topologyRef().id())),
                "DE-DOOR-004 release leaves no stale source corridor binding: " + stableRowsAfter);
        DungeonEditorState committedSurface = runtime.editorApi().current();
        assertEquals(DungeonEditorPreview.none(), committedSurface.preview(),
                "DE-DOOR-004 release clears door preview");
        assertTrue(surfaceHasBoundaryKindAt(
                        committedSurface,
                        "door",
                        new Cell(4, 3, 0),
                        new Cell(4, 4, 0)),
                "DE-DOOR-004 release publishes moved door boundary");
        assertTrue(renderHasBoundaryNear(binding.mapContentModel(), "DOOR", 4.0, 3.5),
                "DE-DOOR-004 release renders moved door boundary");
        selectMap(controls, "Door Handle Drag Reload Hop");
        selectMap(controls, "Door Handle Drag Map");
        assertEquals(1L, runtime.database().countDoorBoundariesAt(mapId, 1, 1, "EAST"),
                "DE-DOOR-004 reload preserves moved door boundary");
        assertTrue(renderHasBoundaryNear(binding.mapContentModel(), "DOOR", 4.0, 3.5),
                "DE-DOOR-004 reload renders moved door boundary");
    }

    private static void assertStandaloneDoorHandleDrag(
            TestRuntime runtime,
            TestBinding binding,
            DungeonEditorControlsView controls,
            DungeonMapView mapView,
            long mapId,
            DungeonEditorHandleSnapshot doorHandle
    ) {
        List<String> doorRowsBefore = runtime.database().doorBoundaryState(mapId);
        List<String> authoredStateBefore = runtime.database().authoredGeometryState(mapId);
        List<String> corridorRowsBefore = runtime.database().corridorStableConnectionState(mapId);
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_PRESSED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(doorHandleCenterQ(doorHandle)),
                viewport.sceneToScreenY(doorHandleCenterR(doorHandle)),
                false);
        exercisePreviewInteractions(
                "DE-HANDLE-006 standalone door drag preview stream",
                () -> fireMapMouse(
                        mapView,
                        MouseEvent.MOUSE_DRAGGED,
                        MouseButton.PRIMARY,
                        viewport.sceneToScreenX(doorHandleCenterQ(doorHandle)),
                        viewport.sceneToScreenY(doorHandleCenterR(doorHandle) + 1.0),
                        false),
                () -> fireMapMouse(
                        mapView,
                        MouseEvent.MOUSE_DRAGGED,
                        MouseButton.PRIMARY,
                        viewport.sceneToScreenX(doorHandleCenterQ(doorHandle)),
                        viewport.sceneToScreenY(doorHandleCenterR(doorHandle) + 2.0),
                        false),
                () -> fireMapMouse(
                        mapView,
                        MouseEvent.MOUSE_DRAGGED,
                        MouseButton.PRIMARY,
                        viewport.sceneToScreenX(doorHandleCenterQ(doorHandle)),
                        viewport.sceneToScreenY(doorHandleCenterR(doorHandle) + 1.0),
                        false));

        DungeonEditorState previewSurface = runtime.editorApi().current();
        assertTrue(previewSurface.preview() instanceof DungeonEditorPreview.MoveHandlePreview,
                "DE-HANDLE-006 standalone door drag publishes a move-handle preview");
        DungeonEditorPreview.MoveHandlePreview preview =
                (DungeonEditorPreview.MoveHandlePreview) previewSurface.preview();
        assertEquals(DungeonEditorHandleKind.DOOR, preview.handleRef().kind(),
                "DE-HANDLE-006 standalone preview handle kind");
        assertEquals(0L, preview.handleRef().corridorId(),
                "DE-HANDLE-006 standalone preview stays on the unbound door route");
        assertEquals(0L, preview.deltaQ(), "DE-HANDLE-006 standalone preview delta q");
        assertEquals(1L, preview.deltaR(), "DE-HANDLE-006 standalone preview delta r");
        assertTrue(renderedDoorMarkersHaveBlankLabels(binding.mapContentModel()),
                "DE-HANDLE-006 standalone render scene keeps door preview markers on the handle affordance path "
                        + "without a D glyph: " + renderedDoorMarkers(binding.mapContentModel()));
        assertEquals(0L,
                countDoorMarkersAt(binding.mapContentModel(), doorHandleCenterQ(doorHandle), doorHandleCenterR(doorHandle)),
                "DE-HANDLE-006 standalone render scene hides the stale source door marker during drag preview: "
                        + renderedDoorMarkers(binding.mapContentModel()));
        assertTrue(previewSurface.selectedWindow().previewMap() != null,
                "DE-HANDLE-006 standalone door drag publishes an authoritative preview map");
        assertTrue(mapHasBoundaryKindAt(
                        previewSurface.selectedWindow().previewMap(),
                        "door",
                        new Cell(4, 3, 0),
                        new Cell(4, 4, 0)),
                "DE-HANDLE-006 standalone door drag preview map contains the moved door boundary");
        PreviewDiff previewRenderDiff = PreviewDiff.from(previewSurface);
        assertTrue(previewRenderDiff.changedBoundaries().stream()
                        .anyMatch(boundary -> "door".equalsIgnoreCase(boundary.kind())
                                && sameEdge(boundary.edge(), new Cell(4, 3, 0), new Cell(4, 4, 0))),
                "DE-HANDLE-006 standalone structured preview diff carries the moved door boundary");
        assertTrue(previewRenderDiff.changedHandles().stream()
                        .anyMatch(handle -> handle.ref().kind() == DungeonEditorHandleKind.DOOR
                                && handle.ref().corridorId() == 0L
                                && handle.ref().topologyRef().id() == doorHandle.ref().topologyRef().id()
                                && sameCell(handle.cell(), new Cell(4, 3, 0))),
                "DE-HANDLE-006 standalone structured preview diff carries the moved unbound door handle");
        assertEquals(doorRowsBefore, runtime.database().doorBoundaryState(mapId),
                "DE-HANDLE-006 standalone door preview leaves door boundary rows unchanged");
        assertEquals(authoredStateBefore, runtime.database().authoredGeometryState(mapId),
                "DE-HANDLE-006 standalone door preview leaves authored stores unchanged");
        assertEquals(corridorRowsBefore, runtime.database().corridorStableConnectionState(mapId),
                "DE-HANDLE-006 standalone door preview leaves corridor stores unchanged");

        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_RELEASED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(doorHandleCenterQ(doorHandle)),
                viewport.sceneToScreenY(doorHandleCenterR(doorHandle) + 1.0),
                false);

        List<String> doorRowsAfter = runtime.database().doorBoundaryState(mapId);
        assertTrue(doorRowsAfter.stream().anyMatch(row ->
                row.startsWith("door_edges|cluster_id=" + doorHandle.ref().clusterId() + "|")
                                && row.contains("|cell_x=3|")
                                && row.contains("|cell_y=3|")
                                && row.contains("|edge_direction=EAST|")
                                && row.contains("|edge_type=DOOR|")
                                && row.contains("|topology_element_id=" + doorHandle.ref().topologyRef().id())),
                "DE-DOOR-004 standalone release moves the authored door row: " + doorRowsAfter);
        assertTrue(doorRowsAfter.stream().noneMatch(row ->
                row.startsWith("door_edges|cluster_id=" + doorHandle.ref().clusterId() + "|")
                                && row.contains("|cell_x=3|")
                                && row.contains("|cell_y=2|")
                                && row.contains("|edge_direction=EAST|")
                                && row.contains("|edge_type=DOOR|")
                                && row.contains("|topology_element_id=" + doorHandle.ref().topologyRef().id())),
                "DE-DOOR-004 standalone release leaves no stale source door row: " + doorRowsAfter);
        assertEquals(corridorRowsBefore, runtime.database().corridorStableConnectionState(mapId),
                "DE-DOOR-004 standalone release keeps corridor rows unchanged");
        DungeonEditorState committedSurface = runtime.editorApi().current();
        assertEquals(DungeonEditorPreview.none(), committedSurface.preview(),
                "DE-DOOR-004 standalone release clears door preview");
        assertTrue(surfaceHasBoundaryKindAt(
                        committedSurface,
                        "door",
                        new Cell(4, 3, 0),
                        new Cell(4, 4, 0)),
                "DE-DOOR-004 standalone release publishes moved door boundary");
        assertTrue(renderHasBoundaryNear(binding.mapContentModel(), "DOOR", 4.0, 3.5),
                "DE-DOOR-004 standalone release renders moved door boundary");
        selectMap(controls, "Standalone Door Drag Reload Hop");
        selectMap(controls, "Standalone Door Drag Map");
        List<String> reloadedDoorRows = runtime.database().doorBoundaryState(mapId);
        assertTrue(reloadedDoorRows.stream().anyMatch(row ->
                        row.startsWith("door_edges|cluster_id=" + doorHandle.ref().clusterId() + "|")
                                && row.contains("|cell_x=3|")
                                && row.contains("|cell_y=3|")
                                && row.contains("|edge_direction=EAST|")
                                && row.contains("|edge_type=DOOR|")
                                && row.contains("|topology_element_id=" + doorHandle.ref().topologyRef().id())),
                "DE-DOOR-004 standalone reload preserves moved door topology identity: " + reloadedDoorRows);
        assertTrue(renderHasBoundaryNear(binding.mapContentModel(), "DOOR", 4.0, 3.5),
                "DE-DOOR-004 standalone reload renders moved door boundary");
    }

    private static void assertInvalidStandaloneDoorHandleMoveRejected(
            TestRuntime runtime,
            TestBinding binding,
            DungeonEditorControlsView controls,
            DungeonMapView mapView,
            long mapId,
            DungeonEditorHandleSnapshot doorHandle
    ) {
        List<String> authoredStateBefore = runtime.database().authoredGeometryState(mapId);
        List<String> doorRowsBefore = runtime.database().doorBoundaryState(mapId);
        List<String> corridorRowsBefore = runtime.database().corridorStableConnectionState(mapId);
        DungeonEditorState surfaceBefore = runtime.editorApi().current();
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();

        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_PRESSED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(doorHandleCenterQ(doorHandle)),
                viewport.sceneToScreenY(doorHandleCenterR(doorHandle)),
                false);
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_DRAGGED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(doorHandleCenterQ(doorHandle)),
                viewport.sceneToScreenY(doorHandleCenterR(doorHandle) + 4.0),
                false);
        assertTrue(runtime.editorApi().current().preview() instanceof DungeonEditorPreview.MoveHandlePreview,
                "DE-DOOR-005 standalone invalid still publishes transient drag preview before rejected release");

        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_RELEASED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(doorHandleCenterQ(doorHandle)),
                viewport.sceneToScreenY(doorHandleCenterR(doorHandle) + 4.0),
                false);

        assertEquals(authoredStateBefore, runtime.database().authoredGeometryState(mapId),
                "DE-DOOR-005 standalone invalid release leaves authored DB unchanged");
        assertEquals(doorRowsBefore, runtime.database().doorBoundaryState(mapId),
                "DE-DOOR-005 standalone invalid release leaves door boundary rows unchanged");
        assertEquals(corridorRowsBefore, runtime.database().corridorStableConnectionState(mapId),
                "DE-DOOR-005 standalone invalid release leaves corridor rows unchanged");
        DungeonEditorState rejectedSurface = runtime.editorApi().current();
        assertEquals(DungeonEditorPreview.none(), rejectedSurface.preview(),
                "DE-DOOR-005 standalone invalid release clears preview");
        assertTrue(!runtime.editorApi().current().commandStatus().message().isBlank(),
                "DE-DOOR-005 standalone invalid release publishes user-visible rejection feedback");
        assertEquals(surfaceBefore.selectedWindow().map(), rejectedSurface.selectedWindow().map(),
                "DE-DOOR-005 standalone invalid release keeps published map unchanged outcome="
                        + runtime.editorApi().current().commandStatus().outcome());
        assertTrue(renderHasBoundaryNear(binding.mapContentModel(), "DOOR", 4.0, 2.5),
                "DE-DOOR-005 standalone invalid render keeps the source door boundary");
        assertTrue(!renderHasBoundaryNear(binding.mapContentModel(), "DOOR", 4.0, 6.5),
                "DE-DOOR-005 standalone invalid render does not leave an orphan moved handle");
        selectMap(controls, "Standalone Door Invalid Reload Hop");
        selectMap(controls, "Standalone Door Invalid Move Map");
        assertEquals(doorRowsBefore, runtime.database().doorBoundaryState(mapId),
                "DE-DOOR-005 standalone invalid reload keeps the original door boundary rows");
        assertEquals(corridorRowsBefore, runtime.database().corridorStableConnectionState(mapId),
                "DE-DOOR-005 standalone invalid reload keeps the original corridor rows");
    }

    private static void assertRoomLabelDoesNotInterceptFloorSelection(
            TestRuntime runtime,
            TestBinding binding,
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

        DungeonEditorSelection selectedRoom = runtime.editorApi().current().selection();
        DungeonEditorSelection selectedSurfaceRoom = runtime.editorApi().current().selection();
        assertEquals(features.dungeon.api.DungeonTopologyElementKind.ROOM, selectedRoom.topologyRef().kind(),
                "DE-LABEL-007 state model room label point passes through to room floor topology");
        assertEquals(roomIds.roomId(), selectedRoom.topologyRef().id(),
                "DE-LABEL-007 state model room label point passes through to room floor id");
        assertEquals(roomIds.clusterId(), selectedRoom.clusterId(),
                "DE-LABEL-007 state model room label point preserves owning cluster id without cluster selection");
        assertTrue(!selectedRoom.clusterSelection(),
                "DE-LABEL-007 state model room label point does not select cluster-name target");
        assertEquals(null, selectedRoom.handleRef(),
                "DE-LABEL-007 state model room label point does not publish a draggable cluster-label handle");
        assertEquals(features.dungeon.api.DungeonTopologyElementKind.ROOM, selectedSurfaceRoom.topologyRef().kind(),
                "DE-LABEL-007 map surface room label point passes through to room floor topology");
        assertEquals(roomIds.roomId(), selectedSurfaceRoom.topologyRef().id(),
                "DE-LABEL-007 map surface room label point passes through to room floor id");
        assertEquals(roomIds.clusterId(), selectedSurfaceRoom.clusterId(),
                "DE-LABEL-007 map surface room label point preserves owning cluster id without cluster selection");
        assertTrue(!selectedSurfaceRoom.clusterSelection(),
                "DE-LABEL-007 map surface room label point does not select cluster-name target");
        assertEquals(null, selectedSurfaceRoom.handleRef(),
                "DE-LABEL-007 map surface room label point does not publish a draggable cluster-label handle");

        fireMapMouse(
                binding.mapView(),
                MouseEvent.MOUSE_DRAGGED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(labelCenter.q() + 1.0),
                viewport.sceneToScreenY(labelCenter.r()),
                false);
        assertEquals(DungeonEditorPreview.none(), runtime.editorApi().current().preview(),
                "DE-LABEL-007 room label point drag does not publish a cluster move preview");

        fireMapMouse(
                binding.mapView(),
                MouseEvent.MOUSE_RELEASED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(labelCenter.q() + 1.0),
                viewport.sceneToScreenY(labelCenter.r()),
                false);
        assertEquals(DungeonEditorPreview.none(), runtime.editorApi().current().preview(),
                "DE-LABEL-007 room label point drag release keeps preview clear");
        assertEquals(geometryRowsBefore, runtime.database().countAuthoredGeometryRows(mapId),
                "DE-LABEL-007 room label point drag leaves authored geometry row count unchanged");
        assertEquals(authoredStateBefore, runtime.database().authoredGeometryState(mapId),
                "DE-LABEL-007 room label point drag leaves all authored geometry stores unchanged");
        assertEquals(boundaryRowsBefore, runtime.database().roomBoundaryEdgeState(mapId),
                "DE-LABEL-007 room label point drag leaves boundary geometry unchanged");
    }

    private static DungeonEditorHandleSnapshot singleClusterLabel(
            DungeonEditorState snapshot,
            String message
    ) {
        List<DungeonEditorHandleSnapshot> labels = snapshot.selectedWindow().map().editorHandles().stream()
                .filter(handle -> "CLUSTER_LABEL".equals(handle.ref().kind().name()))
                .toList();
        assertEquals(1, labels.size(), message + " publishes one cluster label");
        return labels.getFirst();
    }

    private static boolean hasClusterLabelAt(
            DungeonEditorState snapshot,
            int q,
            int r,
            int level
    ) {
        return hasHandleAt(snapshot, "CLUSTER_LABEL", q, r, level);
    }

    private static boolean hasHandleAt(
            DungeonEditorState snapshot,
            String kind,
            int q,
            int r,
            int level
    ) {
        return snapshot.selectedWindow().map().editorHandles().stream()
                .anyMatch(handle -> kind.equals(handle.ref().kind().name())
                        && handle.cell().q() == q
                        && handle.cell().r() == r
                        && handle.cell().level() == level);
    }

    private static boolean hasWallRunHandle(
            DungeonEditorState snapshot,
            int cellQ,
            int cellR,
            int level,
            double markerQ,
            double markerR
    ) {
        return snapshot.selectedWindow().map().editorHandles().stream()
                .filter(handle -> CLUSTER_WALL_RUN_KIND.equals(handle.ref().kind().name()))
                .anyMatch(handle -> handle.cell().q() == cellQ
                        && handle.cell().r() == cellR
                        && handle.cell().level() == level
                        && handle.markerQ() == markerQ
                        && handle.markerR() == markerR);
    }

    private static boolean hasWallRunMarkerAt(
            DungeonEditorState snapshot,
            double markerQ,
            double markerR
    ) {
        return snapshot.selectedWindow().map().editorHandles().stream()
                .filter(handle -> CLUSTER_WALL_RUN_KIND.equals(handle.ref().kind().name()))
                .anyMatch(handle -> handle.markerQ() == markerQ && handle.markerR() == markerR);
    }

    private static void assertWallRunHandle(
            DungeonEditorState snapshot,
            int cellQ,
            int cellR,
            int level,
            double markerQ,
            double markerR,
            Cell sourceFrom,
            Cell sourceTo,
            String message
    ) {
        DungeonEditorHandleSnapshot handle = snapshot.selectedWindow().map().editorHandles().stream()
                .filter(candidate -> CLUSTER_WALL_RUN_KIND.equals(candidate.ref().kind().name()))
                .filter(candidate -> candidate.cell().q() == cellQ)
                .filter(candidate -> candidate.cell().r() == cellR)
                .filter(candidate -> candidate.cell().level() == level)
                .filter(candidate -> candidate.markerQ() == markerQ)
                .filter(candidate -> candidate.markerR() == markerR)
                .findFirst()
                .orElseThrow(() -> new AssertionError(message + " handle not published: " + wallRunHandleSummary(snapshot)));
        assertEquals(sourceFrom.q(), handle.ref().sourceEdge().from().q(), message + " source edge from q");
        assertEquals(sourceFrom.r(), handle.ref().sourceEdge().from().r(), message + " source edge from r");
        assertEquals(sourceFrom.level(), handle.ref().sourceEdge().from().level(), message + " source edge from level");
        assertEquals(sourceTo.q(), handle.ref().sourceEdge().to().q(), message + " source edge to q");
        assertEquals(sourceTo.r(), handle.ref().sourceEdge().to().r(), message + " source edge to r");
        assertEquals(sourceTo.level(), handle.ref().sourceEdge().to().level(), message + " source edge to level");
    }

    private static String wallRunHandleSummary(DungeonEditorState snapshot) {
        return snapshot.selectedWindow().map().editorHandles().stream()
                .filter(handle -> CLUSTER_WALL_RUN_KIND.equals(handle.ref().kind().name()))
                .map(handle -> handleCellKey(handle)
                        + "," + handle.ref().direction()
                        + "@" + handle.markerQ()
                        + "," + handle.markerR())
                .collect(java.util.stream.Collectors.joining(" | "));
    }

    private static boolean mapHasBoundaryKindAt(
            DungeonEditorMapSnapshot map,
            String kind,
            Cell from,
            Cell to
    ) {
        return map.boundaries().stream()
                .filter(boundary -> kind.equalsIgnoreCase(boundary.kind()))
                .map(DungeonEditorMapSnapshot.Boundary::edge)
                .anyMatch(edge -> sameEdge(edge, from, to));
    }

    private static Set<String> edgeKeys(List<DungeonEdgeRef> edges) {
        return edges.stream()
                .map(edge -> edgeKey(cell(edge.from()), cell(edge.to())))
                .collect(java.util.stream.Collectors.toSet());
    }

    private static String edgeKey(Cell from, Cell to) {
        return from.q() + "," + from.r() + "," + from.level()
                + "->"
                + to.q() + "," + to.r() + "," + to.level();
    }

    private static DungeonEdgeRef edge(Cell from, Cell to) {
        return new DungeonEdgeRef(
                new DungeonCellRef(from.q(), from.r(), from.level()),
                new DungeonCellRef(to.q(), to.r(), to.level()));
    }

    private static Cell cell(DungeonCellRef cell) {
        return new Cell(cell.q(), cell.r(), cell.level());
    }

    private static void assertClusterCorners(
            DungeonEditorState snapshot,
            Set<String> expected
    ) {
        Set<String> actual = snapshot.selectedWindow().map().editorHandles().stream()
                .filter(handle -> CLUSTER_CORNER_KIND.equals(handle.ref().kind().name()))
                .map(DungeonEditorClusterLabelHandleScenarios::handleCellKey)
                .collect(java.util.stream.Collectors.toCollection(java.util.LinkedHashSet::new));
        assertEquals(expected, actual, "DE-CLUSTER-001 authored corner handle set");
    }

    private static void assertWallRunHandles(
            DungeonEditorState snapshot,
            Set<String> expected
    ) {
        Set<String> actual = snapshot.selectedWindow().map().editorHandles().stream()
                .filter(handle -> CLUSTER_WALL_RUN_KIND.equals(handle.ref().kind().name()))
                .map(handle -> handleCellKey(handle)
                        + "," + handle.ref().direction()
                        + "@" + handle.markerQ()
                        + "," + handle.markerR())
                .collect(java.util.stream.Collectors.toCollection(java.util.LinkedHashSet::new));
        assertEquals(expected, actual, "DE-CLUSTER-001 wall-run geometric marker set");
    }

    private static void assertWallRunSourceEdgesPresent(
            DungeonEditorState snapshot,
            String message
    ) {
        List<DungeonEditorHandleSnapshot> wallRuns = snapshot.selectedWindow().map().editorHandles().stream()
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
        assertEquals(features.dungeon.api.editor.DungeonEditorPointerInput.TargetKind.HANDLE, runtimePointerTarget(mapContentModel, 11.0, 10.0).targetKind(),
                message + " north wall-run is hittable");
        assertEquals(features.dungeon.api.editor.DungeonEditorPointerInput.TargetKind.HANDLE, runtimePointerTarget(mapContentModel, 12.0, 11.0).targetKind(),
                message + " south wall-run is hittable");
        assertEquals(features.dungeon.api.editor.DungeonEditorPointerInput.TargetKind.HANDLE, runtimePointerTarget(mapContentModel, 11.0, 12.0).targetKind(),
                message + " east wall-run is hittable");
        assertEquals(features.dungeon.api.editor.DungeonEditorPointerInput.TargetKind.HANDLE, runtimePointerTarget(mapContentModel, 10.0, 11.0).targetKind(),
                message + " west wall-run is hittable");
    }

    private static void assertHandleIdentityShape(
            DungeonEditorState snapshot,
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
            DungeonEditorState snapshot,
            DungeonEditorHandleKind kind,
            String message
    ) {
        return snapshot.selectedWindow().map().editorHandles().stream()
                .filter(handle -> kind == handle.ref().kind())
                .findFirst()
                .orElseThrow(() -> new AssertionError(message + " handle not published"));
    }

    private static long countHandles(
            DungeonEditorState snapshot,
            DungeonEditorHandleKind kind
    ) {
        return snapshot.selectedWindow().map().editorHandles().stream()
                .filter(handle -> kind == handle.ref().kind())
                .count();
    }

    private static long distinctTopologyIds(
            DungeonEditorState snapshot,
            DungeonEditorHandleKind kind
    ) {
        return snapshot.selectedWindow().map().editorHandles().stream()
                .filter(handle -> kind == handle.ref().kind())
                .map(handle -> handle.ref().topologyRef().id())
                .distinct()
                .count();
    }

    private static void paintRoomRectangle(
            TestRuntime runtime,
            TestBinding binding,
            DungeonEditorControlsView controls,
            DungeonMapView mapView,
            double startQ,
            double startR,
            double endQ,
            double endR,
            String message
    ) {
        click(button(controls, "Raum"));
        assertEquals(DungeonEditorToolSelection.family(DungeonEditorToolFamily.ROOM),
                runtime.editorApi().current().toolSelection(),
                message + " selects room paint");
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_PRESSED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(startQ),
                viewport.sceneToScreenY(startR),
                false);
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_DRAGGED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(endQ),
                viewport.sceneToScreenY(endR),
                false);
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_RELEASED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(endQ),
                viewport.sceneToScreenY(endR),
                false);
    }

    private static void drawCommittedWallRun(
            TestBinding binding,
            DungeonEditorControlsView controls,
            DungeonMapView mapView,
            double startQ,
            double startR,
            double endQ,
            double endR
    ) {
        click(button(controls, "Wand"));
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_PRESSED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(startQ),
                viewport.sceneToScreenY(startR),
                false);
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_RELEASED,
                MouseButton.PRIMARY,
                viewport.sceneToScreenX(startQ),
                viewport.sceneToScreenY(startR),
                false);
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_MOVED,
                MouseButton.NONE,
                viewport.sceneToScreenX(endQ),
                viewport.sceneToScreenY(endR),
                false);
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_PRESSED,
                MouseButton.SECONDARY,
                viewport.sceneToScreenX(endQ),
                viewport.sceneToScreenY(endR),
                false);
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_RELEASED,
                MouseButton.SECONDARY,
                viewport.sceneToScreenX(endQ),
                viewport.sceneToScreenY(endR),
                false);
    }

    private static DungeonEditorHandleSnapshot firstDoorHandleForDirection(
            DungeonEditorState snapshot,
            String direction,
            String message
    ) {
        return snapshot.selectedWindow().map().editorHandles().stream()
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
            TestBinding binding,
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

    private static String displayRoomLabel(String text) {
        return text.toUpperCase(Locale.ROOT);
    }

    private static LabelCenter labelCenter(DungeonMapContentModel mapContentModel, String text, String message) {
        return mapContentModel.canvasStateProperty().get().renderScene().texts().stream()
                .filter(label -> text.equals(label.text()))
                .map(label -> new LabelCenter(label.centerX(), label.centerY()))
                .findFirst()
                .orElseThrow(() -> new AssertionError(message + " label not rendered: " + text
                        + "; rendered labels=" + mapContentModel.canvasStateProperty().get().renderScene().texts().stream()
                                .map(label -> label.text())
                                .toList()));
    }

    private static LabelText labelText(DungeonMapContentModel mapContentModel, String text, String message) {
        return labelTexts(mapContentModel, text).stream()
                .findFirst()
                .orElseThrow(() -> new AssertionError(message + " label not rendered: " + text));
    }

    private static List<LabelText> labelTexts(DungeonMapContentModel mapContentModel, String text) {
        return mapContentModel.canvasStateProperty().get().renderScene().texts().stream()
                .filter(label -> text.equals(label.text()))
                .map(label -> new LabelText(
                        label.width(),
                        label.rotationDegrees(),
                        label.typography(),
                        label.style(),
                        label.textColor()))
                .toList();
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

    private static boolean renderedDoorMarkersHaveBlankLabels(
            DungeonMapContentModel mapContentModel
    ) {
        return mapContentModel.canvasStateProperty()
                .get()
                .renderScene()
                .glyphs()
                .stream()
                .filter(glyph -> glyphMatchesHandleKind(glyph, DOOR_KIND))
                .allMatch(glyph -> glyph.label().isBlank());
    }

    private static long countDoorMarkersAt(
            DungeonMapContentModel mapContentModel,
            double q,
            double r
    ) {
        return mapContentModel.canvasStateProperty()
                .get()
                .renderScene()
                .glyphs()
                .stream()
                .filter(glyph -> glyphMatchesHandleKind(glyph, DOOR_KIND))
                .filter(glyph -> glyph.style().alpha() > 0.001)
                .filter(glyph -> Math.abs(glyphCenterQ(glyph) - q) < 0.000_001
                        && Math.abs(glyphCenterR(glyph) - r) < 0.000_001)
                .count();
    }

    private static List<String> renderedDoorMarkers(DungeonMapContentModel mapContentModel) {
        return mapContentModel.canvasStateProperty()
                .get()
                .renderScene()
                .glyphs()
                .stream()
                .filter(glyph -> glyphMatchesHandleKind(glyph, DOOR_KIND))
                .map(glyph -> glyphCenterQ(glyph) + "," + glyphCenterR(glyph)
                        + " hit=" + glyph.hitRef()
                        + " label=" + glyph.label())
                .toList();
    }

    private static void assertDoorHandleVisibleOnlyOnHover(
            TestBinding binding,
            double q,
            double r,
            boolean horizontal,
            String message
    ) {
        DungeonMapContentModel.GlyphPrimitive hiddenGlyph = doorGlyphAt(binding.mapContentModel(), q, r)
                .orElseThrow(() -> new AssertionError(message + " door glyph primitive not retained for hit routing"));
        assertTrue(hiddenGlyph.style().alpha() == 0.0,
                message + " door glyph is visually hidden before hover proximity");
        assertEquals(features.dungeon.api.editor.DungeonEditorPointerInput.TargetKind.HANDLE, runtimePointerTarget(binding.mapContentModel(), q, r).targetKind(),
                message + " hidden door glyph center remains a shared handle hit target");
        double hitQ = horizontal ? q : q + 0.14;
        double hitR = horizontal ? r + 0.14 : r;
        assertEquals(features.dungeon.api.editor.DungeonEditorPointerInput.TargetKind.HANDLE, runtimePointerTarget(binding.mapContentModel(), hitQ, hitR).targetKind(),
                message + " door-specific enlarged proximity hit resolves without global hit tolerance");

        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();
        fireMapMouse(
                binding.mapView(),
                MouseEvent.MOUSE_MOVED,
                MouseButton.NONE,
                viewport.sceneToScreenX(hitQ),
                viewport.sceneToScreenY(hitR),
                false);
        assertDoorHandlePillPresentation(binding.mapContentModel(), q, r, horizontal, message + " hovered");
        assertTrue(doorGlyphAt(binding.mapContentModel(), q, r)
                        .orElseThrow(() -> new AssertionError(message + " hovered door glyph not retained"))
                        .style()
                        .alpha() > 0.9,
                message + " door glyph becomes visible on hover proximity");
    }

    private static void assertDoorHandlePillPresentation(
            DungeonMapContentModel mapContentModel,
            double q,
            double r,
            boolean horizontal,
            String message
    ) {
        DungeonMapContentModel.GlyphPrimitive glyph = doorGlyphAt(mapContentModel, q, r)
                .orElseThrow(() -> new AssertionError(message + " door glyph not rendered at " + q + "," + r));
        assertTrue(glyph.label().isBlank(), message + " door glyph omits the obsolete D marker");
        assertTrue(doorGlyphMatchesOrientation(glyph, horizontal),
                message + " door glyph follows the authored door edge orientation");
        assertTrue(glyphMajorAxis(glyph) > glyphMinorAxis(glyph),
                message + " door glyph remains a pill affordance");
    }

    private static java.util.Optional<DungeonMapContentModel.GlyphPrimitive> doorGlyphAt(
            DungeonMapContentModel mapContentModel,
            double q,
            double r
    ) {
        return mapContentModel.canvasStateProperty()
                .get()
                .renderScene()
                .glyphs()
                .stream()
                .filter(glyph -> glyphMatchesHandleKind(glyph, DOOR_KIND))
                .filter(glyph -> Math.abs(glyphCenterQ(glyph) - q) < 0.000_001
                        && Math.abs(glyphCenterR(glyph) - r) < 0.000_001)
                .max(java.util.Comparator.comparingDouble(glyph -> glyph.style().alpha()));
    }

    private static DungeonMapContentModel.GlyphPrimitive glyphAt(
            DungeonMapContentModel mapContentModel,
            String handleKind,
            double q,
            double r,
            String message
    ) {
        return mapContentModel.canvasStateProperty()
                .get()
                .renderScene()
                .glyphs()
                .stream()
                .filter(glyph -> glyphMatchesHandleKind(glyph, handleKind))
                .filter(glyph -> Math.abs(glyphCenterQ(glyph) - q) < 0.000_001
                        && Math.abs(glyphCenterR(glyph) - r) < 0.000_001)
                .max(java.util.Comparator.comparingDouble(glyph -> glyph.style().alpha()))
                .orElseThrow(() -> new AssertionError(message + " glyph not rendered at " + q + "," + r));
    }

    private static DungeonMapContentModel.PaintStyle surfaceStyleForSelectionRef(
            DungeonMapContentModel mapContentModel,
            DungeonTopologyElementRef ref,
            String message
    ) {
        String selectionRef = ref.kind() + ":" + ref.id();
        return mapContentModel.canvasStateProperty().get().renderScene().surfaces().stream()
                .filter(surface -> selectionRef.equals(surface.selectionRef()))
                .map(DungeonMapContentModel.MapCanvasPolygonPrimitive::style)
                .findFirst()
                .orElseThrow(() -> new AssertionError(message + " surface style not rendered for " + selectionRef));
    }

    private static boolean doorGlyphMatchesOrientation(
            DungeonMapContentModel.GlyphPrimitive glyph,
            boolean horizontal
    ) {
        return horizontal ? glyphWidth(glyph) > glyphHeight(glyph) : glyphHeight(glyph) > glyphWidth(glyph);
    }

    private static boolean handleGlyphDistinctFromSelectedFloor(
            DungeonMapContentModel.GlyphPrimitive glyph,
            DungeonMapContentModel.PaintStyle selectedFloorStyle
    ) {
        return glyph.style().fill() != null
                && glyph.style().stroke() != null
                && selectedFloorStyle.fill() != null
                && selectedFloorStyle.stroke() != null
                && !glyph.style().fill().equals(selectedFloorStyle.fill())
                && !glyph.style().stroke().equals(selectedFloorStyle.stroke())
                && glyph.style().strokeWidth() != selectedFloorStyle.strokeWidth();
    }

    private static double glyphMajorAxis(DungeonMapContentModel.GlyphPrimitive glyph) {
        return Math.max(glyphWidth(glyph), glyphHeight(glyph));
    }

    private static boolean sourceEdgeIsHorizontal(DungeonEditorHandleSnapshot handle) {
        DungeonEdgeRef sourceEdge = handle.ref().sourceEdge();
        if (sourceEdge != null) {
            return sourceEdge.from().r() == sourceEdge.to().r();
        }
        String direction = handle.ref().direction();
        return !"EAST".equals(direction) && !"WEST".equals(direction);
    }

    private static double doorHandleCenterQ(DungeonEditorHandleSnapshot handle) {
        DungeonEdgeRef sourceEdge = handle.ref().sourceEdge();
        if (sourceEdge != null) {
            return (sourceEdge.from().q() + sourceEdge.to().q()) / 2.0;
        }
        return handle.markerQ();
    }

    private static double doorHandleCenterR(DungeonEditorHandleSnapshot handle) {
        DungeonEdgeRef sourceEdge = handle.ref().sourceEdge();
        if (sourceEdge != null) {
            return (sourceEdge.from().r() + sourceEdge.to().r()) / 2.0;
        }
        return handle.markerR();
    }

    private static DungeonEditorHandleSnapshot firstClusterWallRunHandleAt(
            DungeonEditorState snapshot,
            int cellQ,
            int cellR,
            int level,
            String direction,
            String message
    ) {
        return snapshot.selectedWindow().map().editorHandles().stream()
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

    private static void assertHoverHighlightsClusterLabel(
            DungeonMapContentModel mapContentModel,
            DungeonMapView mapView,
            String label,
            double q,
            double r,
            String message
    ) {
        double normalStroke = labelStrokeWidth(mapContentModel, label, q, r);
        DungeonMapContentModel.Viewport viewport = mapContentModel.currentViewport();
        fireMapMouse(
                mapView,
                MouseEvent.MOUSE_MOVED,
                MouseButton.NONE,
                viewport.sceneToScreenX(q),
                viewport.sceneToScreenY(r),
                false);
        double hoverStroke = labelStrokeWidth(mapContentModel, label, q, r);
        assertTrue(hoverStroke > normalStroke && hoverStroke < 2.0 / DEFAULT_GRID_SIZE,
                message + " uses label hover styling distinct from normal and selected styling");
    }

    private static void assertRoomLabelHoverRemainsPassive(
            TestBinding binding,
            String label,
            LabelCenter center,
            String message
    ) {
        LabelText before = labelText(binding.mapContentModel(), label, message + " before");
        DungeonMapContentModel.Viewport viewport = binding.mapContentModel().currentViewport();
        fireMapMouse(
                binding.mapView(),
                MouseEvent.MOUSE_MOVED,
                MouseButton.NONE,
                viewport.sceneToScreenX(center.q()),
                viewport.sceneToScreenY(center.r()),
                false);
        LabelText after = labelText(binding.mapContentModel(), label, message + " after");
        assertTrue(after.style().fill() == null && after.style().stroke() == null,
                message + " keeps the room label text-only without a hover label target box");
        assertDoubleEquals(before.style().strokeWidth(), after.style().strokeWidth(),
                message + " keeps passive room label stroke width unchanged");
    }

    private static double labelStrokeWidth(
            DungeonMapContentModel mapContentModel,
            String label,
            double q,
            double r
    ) {
        return mapContentModel.canvasStateProperty().get().renderScene().texts().stream()
                .filter(text -> label.equals(text.text()))
                .filter(text -> Math.abs(text.centerX() - q) < 0.01)
                .filter(text -> Math.abs(text.centerY() - r) < 0.01)
                .map(DungeonMapContentModel.TextPrimitive::style)
                .mapToDouble(DungeonMapContentModel.PaintStyle::strokeWidth)
                .max()
                .orElseThrow(() -> new AssertionError("Label primitive not found for " + label));
    }

    private record LabelCenter(double q, double r) {
    }

    private record LabelText(
            double width,
            double rotationDegrees,
            DungeonMapContentModel.LabelTypography typography,
            DungeonMapContentModel.PaintStyle style,
            DungeonMapContentModel.RenderColor textColor
    ) {
    }
}
