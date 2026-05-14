package src.data.dungeoneditor;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.DungeonAuthoredApplicationService;
import src.domain.dungeon.DungeonCatalogApplicationService;
import src.domain.dungeon.published.DungeonAuthoredMutationCommand;
import src.domain.dungeon.published.DungeonAuthoredReadCommand;
import src.domain.dungeon.published.DungeonMapCatalogCommand;
import src.domain.dungeoneditor.model.session.model.DungeonEditorSessionCommand;
import src.domain.dungeoneditor.model.session.model.DungeonEditorSessionValues;
import src.domain.dungeoneditor.model.session.repository.DungeonEditorDungeonRepository;
import src.domain.dungeoneditor.model.workspace.model.DungeonEditorWorkspaceValues.MapId;
import src.domain.dungeoneditor.model.workspace.model.DungeonEditorWorkspaceValues.TopologyElementRef;

final class ApplicationDungeonEditorDungeonRepository implements DungeonEditorDungeonRepository {

    private final DungeonCatalogApplicationService catalogService;
    private final DungeonAuthoredApplicationService authoredService;

    ApplicationDungeonEditorDungeonRepository(
            DungeonCatalogApplicationService catalogService,
            DungeonAuthoredApplicationService authoredService
    ) {
        this.catalogService = catalogService;
        this.authoredService = authoredService;
    }

    @Override
    public void searchMaps(String query) {
        catalogService.catalog(new DungeonMapCatalogCommand.Search(query));
    }

    @Override
    public void createMap(String mapName) {
        catalogService.catalog(new DungeonMapCatalogCommand.CreateMap(mapName));
    }

    @Override
    public void renameMap(@Nullable MapId mapId, String mapName) {
        catalogService.catalog(new DungeonMapCatalogCommand.RenameMap(DungeonEditorDungeonCommands.domainMapId(mapId), mapName));
    }

    @Override
    public void deleteMap(@Nullable MapId mapId) {
        catalogService.catalog(new DungeonAuthoredReadCommand.MapSelection(DungeonEditorDungeonCommands.domainMapId(mapId)));
    }

    @Override
    public void loadMap(@Nullable MapId mapId) {
        DungeonEditorDungeonCommands.loadMap(authoredService, mapId);
    }

    @Override
    public void describeSelection(
            @Nullable MapId mapId,
            TopologyElementRef topologyRef,
            long clusterId,
            boolean clusterSelection
    ) {
        DungeonEditorDungeonCommands.describeSelection(authoredService, mapId, topologyRef, clusterId, clusterSelection);
    }

    @Override
    public void previewOperation(@Nullable MapId mapId, DungeonEditorSessionValues.Preview preview) {
        DungeonEditorDungeonCommands.applyMutation(authoredService, DungeonAuthoredMutationCommand.Action.PREVIEW, mapId, preview);
    }

    @Override
    public void applyOperation(@Nullable MapId mapId, DungeonEditorSessionValues.Preview preview) {
        DungeonEditorDungeonCommands.applyMutation(authoredService, DungeonAuthoredMutationCommand.Action.APPLY, mapId, preview);
    }

    @Override
    public void saveRoomNarration(@Nullable MapId mapId, DungeonEditorSessionCommand.RoomNarrationInput roomNarration) {
        DungeonEditorDungeonCommands.saveRoomNarration(authoredService, mapId, roomNarration);
    }
}
