package src.domain.dungeon.application;

import java.util.function.Function;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.map.value.DungeonMapIdentity;
import src.domain.dungeon.map.value.DungeonTopologyRef;
import src.domain.dungeon.published.DungeonAuthoredMutationCommand;
import src.domain.dungeon.published.DungeonAuthoredMutationResult;
import src.domain.dungeon.published.DungeonAuthoredReadQuery;
import src.domain.dungeon.published.DungeonAuthoredReadResult;

public final class DungeonAuthoredRuntimeAdapter {

    private final Function<DungeonMapIdentity, LoadDungeonSnapshotUseCase.DungeonSnapshotData> loadSnapshotPath;
    private final EditorOperationPath applyOperationPath;
    private final EditorOperationPath previewOperationPath;
    private final SelectionDescriptionPath describeSelectionPath;

    public DungeonAuthoredRuntimeAdapter(
            LoadDungeonSnapshotUseCase loadDungeonSnapshotUseCase,
            ApplyDungeonEditorOperationUseCase applyDungeonEditorOperationUseCase
    ) {
        this.loadSnapshotPath = loadDungeonSnapshotUseCase::execute;
        this.applyOperationPath = applyDungeonEditorOperationUseCase::execute;
        this.previewOperationPath = applyDungeonEditorOperationUseCase::preview;
        this.describeSelectionPath = loadDungeonSnapshotUseCase::describeSelection;
    }

    public DungeonAuthoredReadResult load(@Nullable DungeonAuthoredReadQuery query) {
        DungeonAuthoredReadQuery effectiveQuery = query == null
                ? new DungeonAuthoredReadQuery.LoadSnapshot(null)
                : query;
        if (effectiveQuery instanceof DungeonAuthoredReadQuery.LoadSnapshot loadSnapshot) {
            return new DungeonAuthoredReadResult.CommittedSnapshot(DungeonAuthoredProjector.committedSnapshot(
                    loadSnapshotPath.apply(DungeonIdentityBoundaryTranslator.domainId(loadSnapshot.mapId()))));
        }
        DungeonAuthoredReadQuery.DescribeSelection describeSelection =
                (DungeonAuthoredReadQuery.DescribeSelection) effectiveQuery;
        return new DungeonAuthoredReadResult.SelectionInspector(DungeonAuthoredProjector.selectionInspector(
                describeSelectionPath.load(
                        DungeonIdentityBoundaryTranslator.domainId(describeSelection.mapId()),
                        DungeonTopologyBoundaryTranslator.domainTopologyRef(describeSelection.topologyRef()),
                        describeSelection.clusterId(),
                        describeSelection.clusterSelection())));
    }

    public DungeonAuthoredMutationResult mutate(@Nullable DungeonAuthoredMutationCommand command) {
        DungeonAuthoredMutationCommand effectiveCommand = command == null
                ? new DungeonAuthoredMutationCommand.ApplyOperation(null, null)
                : command;
        if (effectiveCommand instanceof DungeonAuthoredMutationCommand.PreviewOperation previewOperation) {
            return new DungeonAuthoredMutationResult.Operation(DungeonAuthoredProjector.operationResult(
                    previewOperationPath.execute(
                            DungeonIdentityBoundaryTranslator.domainId(previewOperation.mapId()),
                            DungeonOperationBoundaryTranslator.operationInput(previewOperation.operation()))));
        }
        DungeonAuthoredMutationCommand.ApplyOperation applyOperation =
                (DungeonAuthoredMutationCommand.ApplyOperation) effectiveCommand;
        return new DungeonAuthoredMutationResult.Operation(DungeonAuthoredProjector.operationResult(
                applyOperationPath.execute(
                        DungeonIdentityBoundaryTranslator.domainId(applyOperation.mapId()),
                        DungeonOperationBoundaryTranslator.operationInput(applyOperation.operation()))));
    }

    @FunctionalInterface
    private interface EditorOperationPath {
        ApplyDungeonEditorOperationUseCase.OperationResultData execute(
                @Nullable DungeonMapIdentity mapId,
                ApplyDungeonEditorOperationUseCase.OperationInput input
        );
    }

    @FunctionalInterface
    private interface SelectionDescriptionPath {
        LoadDungeonSnapshotUseCase.InspectorSnapshotData load(
                DungeonMapIdentity mapId,
                DungeonTopologyRef topologyRef,
                long clusterId,
                boolean clusterSelection
        );
    }
}
