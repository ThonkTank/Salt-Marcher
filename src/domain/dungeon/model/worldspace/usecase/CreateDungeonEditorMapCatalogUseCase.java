package src.domain.dungeon.model.worldspace.usecase;

import java.util.Objects;
import src.domain.dungeon.model.worldspace.session.model.DungeonEditorDungeonState;
import src.domain.dungeon.model.worldspace.workspace.model.DungeonEditorWorkspaceValues.MapId;
import src.domain.dungeon.model.worldspace.DungeonMapIdentity;
import src.domain.dungeon.model.worldspace.repository.DungeonAuthoredPublishedStateRepository;

public final class CreateDungeonEditorMapCatalogUseCase {

    private final ApplyDungeonMapCatalogUseCase catalogUseCase;
    private final DungeonAuthoredPublishedStateRepository publishedStateRepository;
    private final DungeonEditorDungeonState state;

    public CreateDungeonEditorMapCatalogUseCase(
            ApplyDungeonMapCatalogUseCase catalogUseCase,
            DungeonAuthoredPublishedStateRepository publishedStateRepository,
            DungeonEditorDungeonState state
    ) {
        this.catalogUseCase = Objects.requireNonNull(catalogUseCase, "catalogUseCase");
        this.publishedStateRepository =
                Objects.requireNonNull(publishedStateRepository, "publishedStateRepository");
        this.state = Objects.requireNonNull(state, "state");
    }

    public void execute(String mapName) {
        DungeonMapIdentity mapId = catalogUseCase.createMap(mapName);
        state.replaceMutationMapId(mapId(mapId));
        publishedStateRepository.publishCreated(mapMutationPublication(mapId));
    }

    private static MapId mapId(DungeonMapIdentity mapId) {
        return new MapId(mapId.value());
    }

    private static DungeonAuthoredPublishedStateRepository.MapMutationPublication mapMutationPublication(
            DungeonMapIdentity mapId
    ) {
        return new DungeonAuthoredPublishedStateRepository.MapMutationPublication(mapId);
    }
}
