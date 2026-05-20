package src.domain.dungeon.model.editor.repository;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.DungeonAuthoredApplicationService;
import src.domain.dungeon.DungeonCatalogApplicationService;
import src.domain.dungeon.published.DeleteDungeonMapCommand;
import src.domain.dungeon.published.DungeonAuthoredMutationCommand;
import src.domain.dungeon.published.DungeonAuthoredReadCommand;
import src.domain.dungeon.published.DungeonEditorOperation;
import src.domain.dungeon.published.DungeonMapCatalogCommand;
import src.domain.dungeon.published.DungeonMapId;
import src.domain.dungeon.model.editor.helper.DungeonEditorSessionOperationBoundaryTranslationHelper;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorRoomNarrationInput;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorSessionValues;
import src.domain.dungeon.model.editor.helper.DungeonEditorWorkspaceInspectorBoundaryTranslationHelper;
import src.domain.dungeon.model.editor.helper.DungeonEditorWorkspaceMapBoundaryTranslationHelper;
import src.domain.dungeon.model.editor.helper.DungeonEditorWorkspaceTopologyBoundaryTranslationHelper;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.MapId;
import src.domain.dungeon.model.map.model.DungeonTopologyRef;

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
        DungeonMapId domainId = domainMapId(mapId);
        if (domainId != null) {
            catalogService.catalog(new DungeonMapCatalogCommand.RenameMap(domainId, mapName));
        }
    }

    public void deleteMap(@Nullable MapId mapId) {
        DungeonMapId domainId = domainMapId(mapId);
        if (domainId != null) {
            catalogService.catalog(new DeleteDungeonMapCommand(domainId));
        }
    }

    public void loadMap(@Nullable MapId mapId) {
        DungeonMapId domainId = domainMapId(mapId);
        if (domainId != null) {
            authoredService.refreshAuthored(new DungeonAuthoredReadCommand.MapSelection(domainId));
        }
    }

    public void describeSelection(
            @Nullable MapId mapId,
            DungeonTopologyRef topologyRef,
            long clusterId,
            boolean clusterSelection
    ) {
        if (mapId == null || (!topologyRef.present() && !clusterSelection)) {
            return;
        }
        DungeonMapId domainId = domainMapId(mapId);
        if (domainId == null) {
            return;
        }
        authoredService.refreshAuthored(new DungeonAuthoredReadCommand.DescribeSelection(
                domainId,
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

    public void saveRoomNarration(@Nullable MapId mapId, DungeonEditorRoomNarrationInput roomNarration) {
        DungeonMapId domainId = domainMapId(mapId);
        if (domainId == null || roomNarration == null || !DungeonEditorWorkspaceValues.hasId(roomNarration.roomId())) {
            return;
        }
        authoredService.mutateAuthored(new DungeonAuthoredMutationCommand.Operation(
                DungeonAuthoredMutationCommand.Action.APPLY,
                domainId,
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
        DungeonMapId domainId = domainMapId(mapId);
        if (domainId != null && operation != null) {
            authoredService.mutateAuthored(new DungeonAuthoredMutationCommand.Operation(action, domainId, operation));
        }
    }

    private static @Nullable DungeonMapId domainMapId(@Nullable MapId mapId) {
        return DungeonEditorWorkspaceMapBoundaryTranslationHelper.toDomainMapId(mapId);
    }
}
