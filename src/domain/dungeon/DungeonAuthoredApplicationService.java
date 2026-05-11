package src.domain.dungeon;

import java.util.Objects;
import src.domain.dungeon.application.ApplyDungeonEditorOperationUseCase;
import src.domain.dungeon.application.AssembleDungeonSnapshotUseCase;
import src.domain.dungeon.application.BuildDungeonDerivedStateUseCase;
import src.domain.dungeon.application.InspectDungeonSelectionUseCase;
import src.domain.dungeon.application.LoadDungeonMapUseCase;
import src.domain.dungeon.application.LoadDungeonSnapshotUseCase;
import src.domain.dungeon.application.PublishDungeonAuthoredResultUseCase;
import src.domain.dungeon.application.PublishDungeonEditorHandlesUseCase;
import src.domain.dungeon.application.TranslateDungeonAuthoredInputUseCase;
import src.domain.dungeon.application.TranslateDungeonEditorOperationUseCase;
import src.domain.dungeon.model.map.repository.DungeonMapRepository;
import src.domain.dungeon.model.map.repository.DungeonPublishedStateRepository;
import src.domain.dungeon.published.DungeonAuthoredMutationCommand;
import src.domain.dungeon.published.DungeonAuthoredMutationResult;
import src.domain.dungeon.published.DungeonAuthoredReadCommand;
import src.domain.dungeon.published.DungeonAuthoredReadResult;

/**
 * Public authored-dungeon backend boundary for reads and mutations.
 */
public final class DungeonAuthoredApplicationService {

    private final DungeonPublishedStateRepository publishedStateRepository;
    private final LoadDungeonSnapshotUseCase loadDungeonSnapshotUseCase;
    private final ApplyDungeonEditorOperationUseCase applyDungeonEditorOperationUseCase;
    private final PublishDungeonAuthoredResultUseCase publishResultUseCase = new PublishDungeonAuthoredResultUseCase();
    private final TranslateDungeonAuthoredInputUseCase translateInputUseCase =
            new TranslateDungeonAuthoredInputUseCase();
    private final TranslateDungeonEditorOperationUseCase translateOperationUseCase =
            new TranslateDungeonEditorOperationUseCase(translateInputUseCase);

    public DungeonAuthoredApplicationService(
            DungeonMapRepository mapRepository,
            DungeonPublishedStateRepository publishedStateRepository
    ) {
        DungeonMapRepository repository = Objects.requireNonNull(mapRepository, "mapRepository");
        this.publishedStateRepository = Objects.requireNonNull(publishedStateRepository, "publishedStateRepository");
        BuildDungeonDerivedStateUseCase derive = new BuildDungeonDerivedStateUseCase();
        LoadDungeonMapUseCase loadDungeonMapUseCase = new LoadDungeonMapUseCase(repository);
        PublishDungeonEditorHandlesUseCase publishDungeonEditorHandlesUseCase = new PublishDungeonEditorHandlesUseCase();
        AssembleDungeonSnapshotUseCase assembleDungeonSnapshotUseCase = new AssembleDungeonSnapshotUseCase(derive);
        InspectDungeonSelectionUseCase inspectDungeonSelectionUseCase = new InspectDungeonSelectionUseCase(derive);
        this.loadDungeonSnapshotUseCase = new LoadDungeonSnapshotUseCase(
                loadDungeonMapUseCase,
                assembleDungeonSnapshotUseCase,
                publishDungeonEditorHandlesUseCase,
                inspectDungeonSelectionUseCase);
        this.applyDungeonEditorOperationUseCase = new ApplyDungeonEditorOperationUseCase(
                loadDungeonMapUseCase,
                repository::save,
                derive::execute,
                assembleDungeonSnapshotUseCase,
                publishDungeonEditorHandlesUseCase);
    }

    public void refreshAuthored(DungeonAuthoredReadCommand command) {
        DungeonAuthoredReadResult result = authoredReadResult(Objects.requireNonNull(command, "command"));
        publishedStateRepository.publishAuthoredRead(result);
    }

    public void mutateAuthored(DungeonAuthoredMutationCommand command) {
        ApplyDungeonEditorOperationUseCase.OperationResultData result = authoredMutationResult(
                Objects.requireNonNull(command, "command"));
        publishedStateRepository.publishAuthoredMutation(
                new DungeonAuthoredMutationResult.Operation(publishResultUseCase.operationResult(result)));
    }

    private DungeonAuthoredReadResult authoredReadResult(DungeonAuthoredReadCommand command) {
        if (command instanceof DungeonAuthoredReadCommand.LoadSnapshot loadSnapshot) {
            return new DungeonAuthoredReadResult.CommittedSnapshot(
                    publishResultUseCase.committedSnapshot(
                            loadDungeonSnapshotUseCase.execute(
                                    translateInputUseCase.domainMapId(loadSnapshot.mapId()))));
        }
        DungeonAuthoredReadCommand.DescribeSelection describeSelection =
                (DungeonAuthoredReadCommand.DescribeSelection) command;
        return new DungeonAuthoredReadResult.SelectionInspector(
                publishResultUseCase.selectionInspector(
                        loadDungeonSnapshotUseCase.describeSelection(
                                translateInputUseCase.domainMapId(describeSelection.mapId()),
                                translateInputUseCase.domainTopologyRef(describeSelection.topologyRef()),
                                describeSelection.clusterId(),
                                describeSelection.clusterSelection())));
    }

    private ApplyDungeonEditorOperationUseCase.OperationResultData authoredMutationResult(
            DungeonAuthoredMutationCommand command
    ) {
        if (command instanceof DungeonAuthoredMutationCommand.PreviewOperation previewOperation) {
            return applyDungeonEditorOperationUseCase.preview(
                    translateInputUseCase.domainMapId(previewOperation.mapId()),
                    translateOperationUseCase.operationMutation(previewOperation.operation()));
        }
        DungeonAuthoredMutationCommand.ApplyOperation applyOperation =
                (DungeonAuthoredMutationCommand.ApplyOperation) command;
        return applyDungeonEditorOperationUseCase.execute(
                translateInputUseCase.domainMapId(applyOperation.mapId()),
                translateOperationUseCase.operationMutation(applyOperation.operation()));
    }
}
