package src.domain.dungeon.model.editor.usecase;

import java.util.Objects;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorDungeonState;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.MapId;
import src.domain.dungeon.model.map.model.DungeonMapIdentity;
import src.domain.dungeon.model.map.repository.DungeonAuthoredPublishedStateRepository;
import src.domain.dungeon.model.map.usecase.ApplyDungeonMapCatalogUseCase;

public final class RenameDungeonEditorMapCatalogUseCase {

    private final ApplyDungeonMapCatalogUseCase catalogUseCase;
    private final DungeonAuthoredPublishedStateRepository publishedStateRepository;
    private final DungeonEditorDungeonState state;

    public RenameDungeonEditorMapCatalogUseCase(
            ApplyDungeonMapCatalogUseCase catalogUseCase,
            DungeonAuthoredPublishedStateRepository publishedStateRepository,
            DungeonEditorDungeonState state
    ) {
        this.catalogUseCase = Objects.requireNonNull(catalogUseCase, "catalogUseCase");
        this.publishedStateRepository =
                Objects.requireNonNull(publishedStateRepository, "publishedStateRepository");
        this.state = Objects.requireNonNull(state, "state");
    }

    public void execute(MapId mapId, String mapName) {
        DungeonMapIdentity mutationMapId = catalogUseCase.renameMap(domainMapId(mapId), mapName);
        state.replaceMutationMapId(DungeonEditorAuthoredFactsUseCase.mapId(mutationMapId));
        publishedStateRepository.publishRenamed(DungeonEditorAuthoredFactsUseCase.mapMutationPublication(mutationMapId));
    }

    private static DungeonMapIdentity domainMapId(MapId mapId) {
        return new DungeonMapIdentity(mapId == null ? 1L : mapId.value());
    }
}
