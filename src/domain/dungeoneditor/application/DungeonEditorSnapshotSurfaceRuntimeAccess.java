package src.domain.dungeoneditor.application;

import java.util.Objects;
import java.util.function.Function;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonAuthoredMutationCommand;
import src.domain.dungeon.published.DungeonAuthoredMutationResult;
import src.domain.dungeon.published.DungeonAuthoredReadCommand;
import src.domain.dungeon.published.DungeonAuthoredReadResult;
import src.domain.dungeon.published.DungeonEditorOperation;
import src.domain.dungeon.published.DungeonOperationResult;
import src.domain.dungeon.published.DungeonSnapshot;
import src.domain.dungeoneditor.session.value.DungeonEditorSessionSnapshot;
import src.domain.dungeoneditor.session.value.DungeonEditorSessionValues;
import src.domain.dungeoneditor.workspace.value.DungeonEditorWorkspaceValues;
import src.domain.dungeoneditor.workspace.value.DungeonEditorWorkspaceValues.Inspector;
import src.domain.dungeoneditor.workspace.value.DungeonEditorWorkspaceValues.MapId;
import src.domain.dungeoneditor.workspace.value.DungeonEditorWorkspaceValues.MapSnapshot;

final class DungeonEditorSnapshotSurfaceRuntimeAccess {
    private final Function<DungeonAuthoredMutationCommand, DungeonAuthoredMutationResult> mutateAuthored;
    private final Function<DungeonAuthoredReadCommand, DungeonAuthoredReadResult> loadAuthored;

    DungeonEditorSnapshotSurfaceRuntimeAccess(
            Function<DungeonAuthoredMutationCommand, DungeonAuthoredMutationResult> mutateAuthored,
            Function<DungeonAuthoredReadCommand, DungeonAuthoredReadResult> loadAuthored
    ) {
        this.mutateAuthored = mutateAuthored;
        this.loadAuthored = loadAuthored;
    }

    @Nullable MapSnapshot loadCommittedSnapshot(@Nullable MapId mapId) {
        DungeonSnapshot snapshot = loadCommittedSnapshotRecord(mapId);
        return snapshot == null ? null : DungeonEditorWorkspaceMapBoundaryTranslator.toWorkspaceMapSnapshot(snapshot.map());
    }

    DungeonEditorSessionSnapshot.@Nullable SurfaceData loadCurrentSurface(
            @Nullable MapId mapId,
            DungeonEditorSessionValues.Selection selection,
            DungeonEditorSessionValues.Preview preview
    ) {
        DungeonSnapshot committedSnapshot = loadCommittedSnapshotRecord(mapId);
        if (committedSnapshot == null) {
            return null;
        }
        MapSnapshot committedMap =
                DungeonEditorWorkspaceMapBoundaryTranslator.toWorkspaceMapSnapshot(committedSnapshot.map());
        @Nullable Inspector inspector = loadInspector(mapId, selection);
        DungeonOperationResult previewResult = previewMessages(mapId, preview);
        DungeonSnapshot previewSnapshot = previewResult == null ? null : previewResult.snapshot();
        @Nullable MapSnapshot previewMap =
                DungeonEditorWorkspaceMapBoundaryTranslator.toWorkspacePreviewMap(previewSnapshot);
        return new DungeonEditorSessionSnapshot.SurfaceData(
                committedSnapshot.mapName(),
                committedSnapshot.revision(),
                committedMap,
                previewMap != null && previewMap.equals(committedMap) ? null : previewMap,
                inspector);
    }

    @Nullable DungeonOperationResult previewMessages(@Nullable MapId mapId, DungeonEditorSessionValues.Preview preview) {
        if (mapId == null) {
            return null;
        }
        DungeonEditorOperation operation = DungeonEditorSessionOperationBoundaryTranslator.toDungeonOperation(preview);
        if (operation == null) {
            return null;
        }
        return ApplyDungeonEditorSessionUseCase.requireOperationResult(mutateAuthored.apply(
                new DungeonAuthoredMutationCommand.PreviewOperation(
                        Objects.requireNonNull(DungeonEditorWorkspaceMapBoundaryTranslator.toDomainMapId(mapId)),
                        operation)));
    }

    private @Nullable Inspector loadInspector(
            @Nullable MapId mapId,
            DungeonEditorSessionValues.Selection selection
    ) {
        if (mapId == null
                || (selection.topologyRef().equals(DungeonEditorWorkspaceValues.TopologyElementRef.empty())
                && !selection.clusterSelection())) {
            return null;
        }
        DungeonAuthoredReadResult result = loadAuthored.apply(new DungeonAuthoredReadCommand.DescribeSelection(
                Objects.requireNonNull(DungeonEditorWorkspaceMapBoundaryTranslator.toDomainMapId(mapId)),
                DungeonEditorWorkspaceTopologyBoundaryTranslator.toDomainTopologyRef(selection.topologyRef()),
                selection.clusterId(),
                selection.clusterSelection()));
        if (result instanceof DungeonAuthoredReadResult.SelectionInspector selectionInspector) {
            return DungeonEditorWorkspaceInspectorBoundaryTranslator.toWorkspaceInspector(selectionInspector.inspector());
        }
        throw new IllegalStateException("Dungeon-Read-Antwort enthielt keinen Inspektor.");
    }

    private @Nullable DungeonSnapshot loadCommittedSnapshotRecord(@Nullable MapId mapId) {
        if (mapId == null) {
            return null;
        }
        DungeonAuthoredReadResult result = loadAuthored.apply(new DungeonAuthoredReadCommand.LoadSnapshot(
                Objects.requireNonNull(DungeonEditorWorkspaceMapBoundaryTranslator.toDomainMapId(mapId))));
        if (result instanceof DungeonAuthoredReadResult.CommittedSnapshot committedSnapshot) {
            return committedSnapshot.snapshot();
        }
        throw new IllegalStateException("Dungeon-Read-Antwort enthielt keinen Snapshot.");
    }
}
