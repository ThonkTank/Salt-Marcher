package src.features.dungeon.runtime;

import java.util.List;
import java.util.Set;
import src.domain.dungeon.model.core.geometry.DungeonTopology;
import src.domain.dungeon.model.core.graph.DungeonTopologyElementKind;
import src.domain.dungeon.model.core.graph.DungeonTopologyRef;
import src.domain.dungeon.model.core.projection.DungeonAreaType;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorHandleType;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionEffect;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorSessionValues;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues;
import src.features.dungeon.runtime.DungeonEditorInteractionValues.VertexKey;
import src.features.dungeon.runtime.DungeonEditorInteractionValues.VertexTarget;
import src.features.dungeon.runtime.DungeonEditorMainViewInteractionValues.BoundaryDraft;
import src.features.dungeon.runtime.DungeonEditorMainViewInteractionValues.BoundaryTarget;
import src.features.dungeon.runtime.DungeonEditorMainViewInteractionValues.EdgeKey;
import src.features.dungeon.runtime.DungeonEditorMainViewInteractionValues.HandleTarget;
import src.features.dungeon.runtime.DungeonEditorMainViewInteractionValues.HitKind;
import src.features.dungeon.runtime.DungeonEditorMainViewInteractionValues.HitTarget;
import src.features.dungeon.runtime.DungeonEditorMainViewInteractionValues.InteractionState;
import src.features.dungeon.runtime.DungeonEditorMainViewInteractionValues.PointerState;

public final class DungeonEditorRuntimeDraftOwnerProbe {
    private static final long CLUSTER_ID = 7L;

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
                DungeonEditorSessionValues.Tool.WALL_CREATE,
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
                DungeonEditorSessionValues.Tool.WALL_CREATE,
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
                DungeonEditorSessionValues.Tool.WALL_CREATE,
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
                DungeonEditorSessionValues.Tool.WALL_CREATE,
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
                DungeonEditorSessionValues.Tool.CORRIDOR_CREATE,
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
        HandleTarget handle = new HandleTarget(
                DungeonEditorHandleType.DOOR.name(),
                doorRef.kind().name(),
                doorRef.id(),
                41L,
                CLUSTER_ID,
                0L,
                11L,
                0,
                new src.features.dungeon.runtime.DungeonEditorInteractionValues.CellTarget(4, 2, 0),
                "EAST",
                null);
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
                        doorRef.kind().name(),
                        doorRef.id(),
                        "",
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
