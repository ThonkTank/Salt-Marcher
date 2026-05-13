package src.domain.dungeon;

import java.util.Objects;
import src.domain.dungeon.application.ApplyDungeonAuthoredMutationUseCase;
import src.domain.dungeon.application.RefreshDungeonAuthoredUseCase;
import src.domain.dungeon.model.map.model.DungeonMapIdentity;
import src.domain.dungeon.model.map.model.DungeonTopologyRef;
import src.domain.dungeon.published.DungeonAuthoredMutationCommand;
import src.domain.dungeon.published.DungeonAuthoredReadCommand;
import src.domain.dungeon.published.DungeonMapId;
import src.domain.dungeon.published.DungeonTopologyElementRef;

/**
 * Public authored-dungeon backend boundary for reads and mutations.
 */
public final class DungeonAuthoredApplicationService {

    private final RefreshDungeonAuthoredUseCase refreshDungeonAuthoredUseCase;
    private final ApplyDungeonAuthoredMutationUseCase applyDungeonAuthoredMutationUseCase;

    public DungeonAuthoredApplicationService(
            RefreshDungeonAuthoredUseCase refreshDungeonAuthoredUseCase,
            ApplyDungeonAuthoredMutationUseCase applyDungeonAuthoredMutationUseCase
    ) {
        this.refreshDungeonAuthoredUseCase =
                Objects.requireNonNull(refreshDungeonAuthoredUseCase, "refreshDungeonAuthoredUseCase");
        this.applyDungeonAuthoredMutationUseCase =
                Objects.requireNonNull(applyDungeonAuthoredMutationUseCase, "applyDungeonAuthoredMutationUseCase");
    }

    public void refreshAuthored(DungeonAuthoredReadCommand command) {
        DungeonAuthoredReadCommand safeCommand = Objects.requireNonNull(command, "command");
        if (safeCommand instanceof DungeonAuthoredReadCommand.MapSelection mapSelection) {
            refreshDungeonAuthoredUseCase.refreshMap(domainMapId(mapSelection.mapId()));
            return;
        }
        DungeonAuthoredReadCommand.DescribeSelection describeSelection =
                (DungeonAuthoredReadCommand.DescribeSelection) safeCommand;
        refreshDungeonAuthoredUseCase.describeSelection(
                domainMapId(describeSelection.mapId()),
                domainTopologyRef(describeSelection.topologyRef()),
                describeSelection.clusterId(),
                describeSelection.clusterSelection());
    }

    public void mutateAuthored(DungeonAuthoredMutationCommand command) {
        DungeonAuthoredMutationCommand.Operation operation =
                (DungeonAuthoredMutationCommand.Operation) Objects.requireNonNull(command, "command");
        if (operation.action().isPreview()) {
            applyDungeonAuthoredMutationUseCase.preview(operation.mapId(), operation.operation());
            return;
        }
        applyDungeonAuthoredMutationUseCase.apply(operation.mapId(), operation.operation());
    }

    private static DungeonTopologyRef domainTopologyRef(DungeonTopologyElementRef ref) {
        if (ref == null) {
            return DungeonTopologyRef.empty();
        }
        return new DungeonTopologyRef(
                src.domain.dungeon.model.map.model.DungeonTopologyElementKind.valueOf(ref.kind().name()),
                ref.id());
    }

    private static DungeonMapIdentity domainMapId(DungeonMapId mapId) {
        return new DungeonMapIdentity(mapId == null ? 1L : mapId.value());
    }
}
