package features.dungeon.application.editor;

import java.util.List;
import java.util.Set;
import features.dungeon.domain.core.geometry.DungeonTopology;
import features.dungeon.domain.core.graph.DungeonTopologyElementKind;
import features.dungeon.domain.core.graph.DungeonTopologyRef;
import features.dungeon.domain.core.projection.DungeonAreaType;
import features.dungeon.application.editor.interaction.DungeonEditorHandleType;
import features.dungeon.application.editor.session.DungeonEditorSessionEffect;
import features.dungeon.application.editor.session.DungeonEditorSessionValues;
import features.dungeon.application.editor.session.DungeonEditorWorkspaceValues;
import features.dungeon.api.editor.DungeonEditorToolFamily;
import features.dungeon.api.editor.DungeonEditorToolSelection;
import features.dungeon.application.editor.DungeonEditorInteractionValues.VertexKey;
import features.dungeon.application.editor.DungeonEditorInteractionValues.VertexTarget;
import features.dungeon.application.editor.DungeonEditorMainViewInteractionValues.BoundaryDraft;
import features.dungeon.application.editor.DungeonEditorMainViewInteractionValues.BoundaryTarget;
import features.dungeon.application.editor.DungeonEditorMainViewInteractionValues.EdgeKey;
import features.dungeon.application.editor.DungeonEditorMainViewInteractionValues.HitKind;
import features.dungeon.application.editor.DungeonEditorMainViewInteractionValues.HitTarget;
import features.dungeon.application.editor.DungeonEditorMainViewInteractionValues.InteractionState;
import features.dungeon.application.editor.DungeonEditorMainViewInteractionValues.PointerState;

public final class DungeonEditorRuntimeDraftOwnerProbe {
    private static final long CLUSTER_ID = 7L;
    private static final DungeonEditorToolAction WALL_ACTION = DungeonEditorToolAction.selected(
            DungeonEditorToolSelection.family(DungeonEditorToolFamily.WALL));
    private static final DungeonEditorToolAction CORRIDOR_ACTION = DungeonEditorToolAction.selected(
            DungeonEditorToolSelection.family(DungeonEditorToolFamily.CORRIDOR));

    private DungeonEditorRuntimeDraftOwnerProbe() {
    }

    public static void assertWallDraftPathOwner() {
        DungeonEditorWallBoundaryDraftUseCase useCase = new DungeonEditorWallBoundaryDraftUseCase();
        DungeonEditorWorkspaceValues.MapSnapshot snapshot = wallDraftSnapshot();
        DungeonEditorSessionValues.Selection selectedCluster = new DungeonEditorSessionValues.Selection(
                DungeonTopologyRef.empty(),
                CLUSTER_ID,
                true,
                DungeonEditorSessionValues.emptyHandleRef());

        DungeonEditorWallBoundaryDraftInterpretation started = useCase.pressOperation(
                vertexPress(1, 0, true, false),
                snapshot,
                selectedCluster,
                WALL_ACTION,
                InteractionState.empty());
        assertDraft(started.nextState().boundaryDraft(), new VertexKey(1, 0, 0), Set.of(),
                "wall draft owner starts session-only state at the first vertex");
        assertNoApply(started.effect(), "wall draft owner first click does not apply authored wall edges");
        assertTrue(started.commit() == null, "wall draft owner first click does not emit typed wall commit");

        EdgeKey firstEdge = EdgeKey.between(new VertexKey(1, 0, 0), new VertexKey(1, 1, 0));
        DungeonEditorWallBoundaryDraftInterpretation intermediate = useCase.pressOperation(
                vertexPress(1, 1, true, false),
                snapshot,
                selectedCluster,
                WALL_ACTION,
                started.nextState());
        assertDraft(intermediate.nextState().boundaryDraft(), new VertexKey(1, 1, 0), Set.of(firstEdge),
                "wall draft owner accumulates the first intermediate segment");
        assertNoApply(intermediate.effect(), "wall draft owner intermediate click stays preview-only");
        assertTrue(intermediate.commit() == null, "wall draft owner intermediate click does not emit typed wall commit");

        EdgeKey secondEdge = EdgeKey.between(new VertexKey(1, 1, 0), new VertexKey(2, 1, 0));
        DungeonEditorWallBoundaryDraftInterpretation completed = useCase.pressOperation(
                vertexPress(2, 1, false, true),
                snapshot,
                selectedCluster,
                WALL_ACTION,
                intermediate.nextState());
        assertTrue(!completed.nextState().boundaryDraft().present(),
                "wall draft owner clears draft state after explicit completion");
        assertTrue(completed.effect().getApplyPreview() instanceof DungeonEditorSessionValues.ClusterBoundariesPreview,
                "wall draft owner applies only on explicit completion");
        DungeonEditorSessionValues.ClusterBoundariesPreview applied =
                (DungeonEditorSessionValues.ClusterBoundariesPreview) completed.effect().getApplyPreview();
        assertEquals(List.of(firstEdge.toEdgeRef(), secondEdge.toEdgeRef()), applied.edges(),
                "wall draft owner applies deterministic accumulated segment order");
        DungeonEditorWallBoundaryDraftInterpretation.WallBoundaryCommit commit = completed.commit();
        assertTrue(commit != null, "wall draft owner emits typed wall commit on explicit completion");
        assertEquals(Set.of(firstEdge, secondEdge), commit.edges(),
                "wall draft owner emits typed wall commit edges");

        DungeonEditorWallBoundaryDraftInterpretation cancelled = useCase.releaseOperation(
                vertexPress(1, 0, true, false),
                snapshot,
                WALL_ACTION,
                InteractionState.empty());
        assertTrue(!cancelled.nextState().boundaryDraft().present(),
                "wall draft owner keeps cancel/no-op release as empty draft state");
        assertTrue(cancelled.effect().getApplyPreview() == null,
                "wall draft owner cancel/no-op does not apply authored wall edges");
        assertTrue(cancelled.commit() == null, "wall draft owner cancel/no-op does not emit typed wall commit");
    }

    public static void assertCorridorDraftSessionOwner() {
        DungeonEditorCorridorInteractionUseCase useCase = new DungeonEditorCorridorInteractionUseCase();
        PointerState firstClick = corridorDoorPress();
        DungeonEditorMainViewInterpretation started = useCase.press(
                firstClick,
                DungeonEditorWorkspaceValues.MapSnapshot.empty(),
                CORRIDOR_ACTION,
                InteractionState.empty());

        assertTrue(started.nextState().corridorDraft().present(),
                "corridor draft owner stores first click in session state");
        assertEquals("room:11:door:41", started.nextState().corridorDraft().start().targetKey(),
                "corridor draft owner keeps the selected start target key");
        assertTrue(started.effect().getSelection() != null,
                "corridor draft owner publishes selection feedback on first click");
        assertTrue(started.effect().getPreview() == null,
                "corridor draft owner does not publish a create preview on first click");
        assertTrue(started.effect().getApplyPreview() == null,
                "corridor draft owner does not apply endpoints on first click");
    }

    private static DungeonEditorWorkspaceValues.MapSnapshot wallDraftSnapshot() {
        return new DungeonEditorWorkspaceValues.MapSnapshot(
                DungeonTopology.SQUARE,
                3,
                3,
                List.of(new DungeonEditorWorkspaceValues.Area(
                        DungeonAreaType.ROOM,
                        11L,
                        CLUSTER_ID,
                        "R1",
                        List.of(
                                new DungeonEditorWorkspaceValues.Cell(0, 0, 0),
                                new DungeonEditorWorkspaceValues.Cell(1, 0, 0),
                                new DungeonEditorWorkspaceValues.Cell(0, 1, 0),
                                new DungeonEditorWorkspaceValues.Cell(1, 1, 0)),
                        new DungeonTopologyRef(DungeonTopologyElementKind.ROOM, 11L))),
                List.of(),
                List.of(),
                List.of());
    }

    private static PointerState vertexPress(
            int q,
            int r,
            boolean primary,
            boolean secondary
    ) {
        return new PointerState(
                q,
                r,
                0,
                primary,
                secondary,
                false,
                HitTarget.empty(),
                new VertexTarget(true, q, r, 0),
                BoundaryTarget.empty());
    }

    private static PointerState corridorDoorPress() {
        DungeonTopologyRef doorRef = new DungeonTopologyRef(DungeonTopologyElementKind.DOOR, 41L);
        DungeonEditorWorkspaceValues.HandleRef handle = new DungeonEditorWorkspaceValues.HandleRef(
                DungeonEditorHandleType.DOOR,
                doorRef,
                41L,
                CLUSTER_ID,
                0L,
                11L,
                0,
                new DungeonEditorWorkspaceValues.Cell(4, 2, 0),
                "EAST",
                null,
                List.of());
        return new PointerState(
                4,
                2,
                0,
                true,
                false,
                false,
                new HitTarget(
                        HitKind.HANDLE,
                        41L,
                        CLUSTER_ID,
                        DungeonEditorRuntimePointerTarget.TopologyKind.fromDomain(doorRef.kind()),
                        doorRef.id(),
                        DungeonEditorRuntimePointerTarget.LabelKind.defaultKind(),
                        handle,
                        BoundaryTarget.empty()),
                VertexTarget.empty(),
                BoundaryTarget.empty());
    }

    private static void assertDraft(
            BoundaryDraft draft,
            VertexKey currentVertex,
            Set<EdgeKey> edges,
            String message
    ) {
        assertTrue(draft.present(), message + " present");
        assertEquals(CLUSTER_ID, draft.clusterId(), message + " cluster");
        assertEquals(currentVertex, draft.currentVertex(), message + " current vertex");
        assertEquals(edges, draft.previewEdges(), message + " preview edges");
    }

    private static void assertNoApply(DungeonEditorSessionEffect effect, String message) {
        assertTrue(effect.getApplyPreview() == null, message);
    }

    private static void assertEquals(Object expected, Object actual, String message) {
        if (!java.util.Objects.equals(expected, actual)) {
            throw new IllegalStateException(message + " expected=" + expected + " actual=" + actual);
        }
    }

    private static void assertTrue(boolean value, String message) {
        if (!value) {
            throw new IllegalStateException(message);
        }
    }
}
