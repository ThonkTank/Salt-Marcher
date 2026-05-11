package src.domain.dungeoneditor.model.workspace.helper;

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
import src.domain.dungeoneditor.model.session.helper.DungeonEditorSessionOperationBoundaryTranslationHelper;
import src.domain.dungeoneditor.model.session.model.DungeonEditorSessionSnapshot;
import src.domain.dungeoneditor.model.session.model.DungeonEditorSessionValues;
import src.domain.dungeoneditor.model.workspace.model.DungeonEditorWorkspaceValues;
import src.domain.dungeoneditor.model.workspace.model.DungeonEditorWorkspaceValues.Inspector;
import src.domain.dungeoneditor.model.workspace.model.DungeonEditorWorkspaceValues.MapId;
import src.domain.dungeoneditor.model.workspace.model.DungeonEditorWorkspaceValues.MapSnapshot;

public final class DungeonEditorSnapshotSurfaceRuntimeReaderHelper {
    private final Function<DungeonAuthoredMutationCommand, DungeonAuthoredMutationResult> mutateAuthored;
    private final Function<DungeonAuthoredReadCommand, DungeonAuthoredReadResult> loadAuthored;

    public DungeonEditorSnapshotSurfaceRuntimeReaderHelper(
            Function<DungeonAuthoredMutationCommand, DungeonAuthoredMutationResult> mutateAuthored,
            Function<DungeonAuthoredReadCommand, DungeonAuthoredReadResult> loadAuthored
    ) {
        this.mutateAuthored = mutateAuthored;
        this.loadAuthored = loadAuthored;
    }

    public @Nullable MapSnapshot loadCommittedSnapshot(@Nullable MapId mapId) {
        DungeonSnapshot snapshot = loadCommittedSnapshotRecord(mapId);
        return snapshot == null ? null : DungeonEditorWorkspaceMapBoundaryTranslationHelper.toWorkspaceMapSnapshot(snapshot.map());
    }

    public DungeonEditorSessionSnapshot.@Nullable SurfaceData loadCurrentSurface(
            @Nullable MapId mapId,
            DungeonEditorSessionValues.Selection selection,
            DungeonEditorSessionValues.Preview preview
    ) {
        DungeonSnapshot committedSnapshot = loadCommittedSnapshotRecord(mapId);
        if (committedSnapshot == null) {
            return null;
        }
        MapSnapshot committedMap =
                DungeonEditorWorkspaceMapBoundaryTranslationHelper.toWorkspaceMapSnapshot(committedSnapshot.map());
        @Nullable Inspector inspector = loadInspector(mapId, selection);
        DungeonOperationResult previewResult = previewMessages(mapId, preview);
        DungeonSnapshot previewSnapshot = previewResult == null ? null : previewResult.snapshot();
        @Nullable MapSnapshot previewMap =
                DungeonEditorWorkspaceMapBoundaryTranslationHelper.toWorkspacePreviewMap(previewSnapshot);
        return new DungeonEditorSessionSnapshot.SurfaceData(
                committedSnapshot.mapName(),
                committedSnapshot.revision(),
                committedMap,
                previewMap != null && previewMap.equals(committedMap) ? null : previewMap,
                inspector);
    }

    public @Nullable DungeonOperationResult previewMessages(@Nullable MapId mapId, DungeonEditorSessionValues.Preview preview) {
        if (mapId == null) {
            return null;
        }
        DungeonEditorOperation operation = DungeonEditorSessionOperationBoundaryTranslationHelper.toDungeonOperation(preview);
        if (operation == null) {
            return null;
        }
        return requireOperationResult(mutateAuthored.apply(
                new DungeonAuthoredMutationCommand.Operation(
                        DungeonAuthoredMutationCommand.Action.PREVIEW,
                         Objects.requireNonNull(DungeonEditorWorkspaceMapBoundaryTranslationHelper.toDomainMapId(mapId)),
                        operation)));
    }

    private static @Nullable DungeonOperationResult requireOperationResult(@Nullable DungeonAuthoredMutationResult result) {
        if (result instanceof DungeonAuthoredMutationResult.Operation operation) {
            return operation.result();
        }
        return null;
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
                 Objects.requireNonNull(DungeonEditorWorkspaceMapBoundaryTranslationHelper.toDomainMapId(mapId)),
                DungeonEditorWorkspaceTopologyBoundaryTranslationHelper.toDomainTopologyRef(selection.topologyRef()),
                selection.clusterId(),
                selection.clusterSelection()));
        if (result instanceof DungeonAuthoredReadResult.SelectionInspector selectionInspector) {
            return DungeonEditorWorkspaceInspectorBoundaryTranslationHelper.toWorkspaceInspector(selectionInspector.inspector());
        }
        throw new IllegalStateException("Dungeon-Read-Antwort enthielt keinen Inspektor.");
    }

    private @Nullable DungeonSnapshot loadCommittedSnapshotRecord(@Nullable MapId mapId) {
        if (mapId == null) {
            return null;
        }
        DungeonAuthoredReadResult result = loadAuthored.apply(new DungeonAuthoredReadCommand.MapSelection(
                Objects.requireNonNull(DungeonEditorWorkspaceMapBoundaryTranslationHelper.toDomainMapId(mapId))));
        if (result instanceof DungeonAuthoredReadResult.CommittedSnapshot committedSnapshot) {
            return committedSnapshot.snapshot();
        }
        throw new IllegalStateException("Dungeon-Read-Antwort enthielt keinen Snapshot.");
    }
}
