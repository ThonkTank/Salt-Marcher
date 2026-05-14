package src.domain.dungeon.model.editor.model.session.repository;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.DungeonAuthoredApplicationService;
import src.domain.dungeon.DungeonCatalogApplicationService;
import src.domain.dungeon.published.DungeonAuthoredMutationCommand;
import src.domain.dungeon.published.DungeonAuthoredReadCommand;
import src.domain.dungeon.published.DungeonEditorOperation;
import src.domain.dungeon.published.DungeonMapCatalogCommand;
import src.domain.dungeon.published.DungeonMapId;
import src.domain.dungeon.model.editor.model.session.helper.DungeonEditorSessionOperationBoundaryTranslationHelper;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionCommand;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionValues;
import src.domain.dungeon.model.editor.model.workspace.helper.DungeonEditorWorkspaceInspectorBoundaryTranslationHelper;
import src.domain.dungeon.model.editor.model.workspace.helper.DungeonEditorWorkspaceMapBoundaryTranslationHelper;
import src.domain.dungeon.model.editor.model.workspace.helper.DungeonEditorWorkspaceTopologyBoundaryTranslationHelper;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.MapId;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.TopologyElementRef;

public final class DungeonEditorDungeonRepository {

    private final DungeonCatalogApplicationService catalogService;
    private final DungeonAuthoredApplicationService authoredService;

    public DungeonEditorDungeonRepository(
            DungeonCatalogApplicationService catalogService,
            DungeonAuthoredApplicationService authoredService
    ) {
        this.catalogService = Objects.requireNonNull(catalogService, "catalogService");
        this.authoredService = Objects.requireNonNull(authoredService, "authoredService");
    }

    public void searchMaps(String query) {
        catalogService.catalog(new DungeonMapCatalogCommand.Search(query));
    }

    public void createMap(String mapName) {
        catalogService.catalog(new DungeonMapCatalogCommand.CreateMap(mapName));
    }

    public void renameMap(@Nullable MapId mapId, String mapName) {
        catalogService.catalog(new DungeonMapCatalogCommand.RenameMap(domainMapId(mapId), mapName));
    }

    public void deleteMap(@Nullable MapId mapId) {
        catalogService.catalog(new DungeonAuthoredReadCommand.MapSelection(domainMapId(mapId)));
    }

    public void loadMap(@Nullable MapId mapId) {
        if (mapId != null) {
            authoredService.refreshAuthored(new DungeonAuthoredReadCommand.MapSelection(domainMapId(mapId)));
        }
    }

    public void describeSelection(
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

    public void previewOperation(@Nullable MapId mapId, DungeonEditorSessionValues.Preview preview) {
        applyMutation(DungeonAuthoredMutationCommand.Action.PREVIEW, mapId, preview);
    }

    public void applyOperation(@Nullable MapId mapId, DungeonEditorSessionValues.Preview preview) {
        applyMutation(DungeonAuthoredMutationCommand.Action.APPLY, mapId, preview);
    }

    public void saveRoomNarration(@Nullable MapId mapId, DungeonEditorSessionCommand.RoomNarrationInput roomNarration) {
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

    private void applyMutation(
            DungeonAuthoredMutationCommand.Action action,
            @Nullable MapId mapId,
            DungeonEditorSessionValues.Preview preview
    ) {
        DungeonEditorOperation operation = DungeonEditorSessionOperationBoundaryTranslationHelper.toDungeonOperation(preview);
        if (mapId != null && operation != null) {
            authoredService.mutateAuthored(new DungeonAuthoredMutationCommand.Operation(action, domainMapId(mapId), operation));
        }
    }

    private static DungeonMapId domainMapId(@Nullable MapId mapId) {
        DungeonMapId domainId = DungeonEditorWorkspaceMapBoundaryTranslationHelper.toDomainMapId(mapId);
        return domainId == null ? new DungeonMapId(1L) : domainId;
    }
}
