package src.data.dungeoneditor;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.DungeonAuthoredApplicationService;
import src.domain.dungeon.published.DungeonAuthoredMutationCommand;
import src.domain.dungeon.published.DungeonAuthoredReadCommand;
import src.domain.dungeon.published.DungeonEditorOperation;
import src.domain.dungeon.published.DungeonMapId;
import src.domain.dungeoneditor.model.session.helper.DungeonEditorSessionOperationBoundaryTranslationHelper;
import src.domain.dungeoneditor.model.session.model.DungeonEditorSessionCommand;
import src.domain.dungeoneditor.model.session.model.DungeonEditorSessionValues;
import src.domain.dungeoneditor.model.workspace.helper.DungeonEditorWorkspaceInspectorBoundaryTranslationHelper;
import src.domain.dungeoneditor.model.workspace.helper.DungeonEditorWorkspaceMapBoundaryTranslationHelper;
import src.domain.dungeoneditor.model.workspace.helper.DungeonEditorWorkspaceTopologyBoundaryTranslationHelper;
import src.domain.dungeoneditor.model.workspace.model.DungeonEditorWorkspaceValues;
import src.domain.dungeoneditor.model.workspace.model.DungeonEditorWorkspaceValues.MapId;
import src.domain.dungeoneditor.model.workspace.model.DungeonEditorWorkspaceValues.TopologyElementRef;

final class DungeonEditorDungeonCommands {

    private DungeonEditorDungeonCommands() {
        throw new AssertionError("No instances.");
    }

    static void loadMap(DungeonAuthoredApplicationService authoredService, @Nullable MapId mapId) {
        if (mapId != null) {
            authoredService.refreshAuthored(new DungeonAuthoredReadCommand.MapSelection(domainMapId(mapId)));
        }
    }

    static void describeSelection(
            DungeonAuthoredApplicationService authoredService,
            @Nullable MapId mapId,
            TopologyElementRef topologyRef,
            long clusterId,
            boolean clusterSelection
    ) {
        if (mapId == null || (TopologyElementRef.empty().equals(topologyRef) && !clusterSelection)) {
            return;
        }
        authoredService.refreshAuthored(new DungeonAuthoredReadCommand.DescribeSelection(
                domainMapId(mapId),
                DungeonEditorWorkspaceTopologyBoundaryTranslationHelper.toDomainTopologyRef(topologyRef),
                clusterId,
                clusterSelection));
    }

    static void applyMutation(
            DungeonAuthoredApplicationService authoredService,
            DungeonAuthoredMutationCommand.Action action,
            @Nullable MapId mapId,
            DungeonEditorSessionValues.Preview preview
    ) {
        DungeonEditorOperation operation = DungeonEditorSessionOperationBoundaryTranslationHelper.toDungeonOperation(preview);
        if (mapId != null && operation != null) {
            authoredService.mutateAuthored(new DungeonAuthoredMutationCommand.Operation(action, domainMapId(mapId), operation));
        }
    }

    static void saveRoomNarration(
            DungeonAuthoredApplicationService authoredService,
            @Nullable MapId mapId,
            DungeonEditorSessionCommand.RoomNarrationInput roomNarration
    ) {
        if (mapId == null || roomNarration == null || !DungeonEditorWorkspaceValues.hasId(roomNarration.roomId())) {
            return;
        }
        authoredService.mutateAuthored(new DungeonAuthoredMutationCommand.Operation(
                DungeonAuthoredMutationCommand.Action.APPLY,
                domainMapId(mapId),
                new DungeonEditorOperation.SaveRoomNarration(
                        roomNarration.roomId(),
                        roomNarration.visualDescription(),
                        roomNarration.exits().stream()
                                .map(DungeonEditorWorkspaceInspectorBoundaryTranslationHelper::toDomainRoomExit)
                                .toList())));
    }

    static DungeonMapId domainMapId(@Nullable MapId mapId) {
        DungeonMapId domainId = DungeonEditorWorkspaceMapBoundaryTranslationHelper.toDomainMapId(mapId);
        return domainId == null ? new DungeonMapId(1L) : domainId;
    }
}
