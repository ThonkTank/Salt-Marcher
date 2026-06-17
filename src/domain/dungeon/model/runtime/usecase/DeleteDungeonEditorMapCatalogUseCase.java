package src.domain.dungeon.model.runtime.usecase;

import java.util.Comparator;
import java.util.Objects;
import src.domain.dungeon.model.core.structure.DungeonMapIdentity;
import src.domain.dungeon.model.core.usecase.ApplyDungeonMapCatalogUseCase;
import src.domain.dungeon.model.core.usecase.SearchDungeonMapsUseCase;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorDungeonState;
import src.domain.dungeon.model.runtime.editor.session.DungeonEditorWorkspaceValues.MapId;
import src.domain.dungeon.model.runtime.repository.DungeonAuthoredPublishedStateRepository;

public final class DeleteDungeonEditorMapCatalogUseCase {

    private final ApplyDungeonMapCatalogUseCase catalogUseCase;
    private final DungeonAuthoredPublishedStateRepository publishedStateRepository;
    private final DungeonEditorDungeonState state;

    public DeleteDungeonEditorMapCatalogUseCase(
            ApplyDungeonMapCatalogUseCase catalogUseCase,
            DungeonAuthoredPublishedStateRepository publishedStateRepository,
            DungeonEditorDungeonState state
    ) {
        this.catalogUseCase = Objects.requireNonNull(catalogUseCase, "catalogUseCase");
        this.publishedStateRepository =
                Objects.requireNonNull(publishedStateRepository, "publishedStateRepository");
        this.state = Objects.requireNonNull(state, "state");
    }

    public void execute(MapId mapId) {
        DungeonMapIdentity deletedMapId = catalogUseCase.deleteMap(domainMapId(mapId));
        ApplyDungeonMapCatalogUseCase.MapCatalogResult catalog = catalogUseCase.search("");
        state.replaceCatalog(SearchDungeonEditorMapCatalogUseCase.catalogFacts(catalog));
        state.replaceMutationMapId(firstMapId(catalog));
        publishedStateRepository.publishDeleted(mapMutationPublication(deletedMapId));
        publishedStateRepository.publishSearch(SearchDungeonEditorMapCatalogUseCase.catalogPublication(catalog));
    }

    private static DungeonMapIdentity domainMapId(MapId mapId) {
        return new DungeonMapIdentity(mapId == null ? 1L : mapId.value());
    }

    private static MapId mapId(DungeonMapIdentity mapId) {
        return new MapId(mapId.value());
    }

    private static MapId firstMapId(ApplyDungeonMapCatalogUseCase.MapCatalogResult catalog) {
        if (catalog == null || catalog.maps().isEmpty()) {
            return null;
        }
        return mapId(catalog.maps().stream()
                .min(DeleteDungeonEditorMapCatalogUseCase::compareMapSummary)
                .orElseThrow()
                .mapId());
    }

    private static int compareMapSummary(
            SearchDungeonMapsUseCase.MapSummary left,
            SearchDungeonMapsUseCase.MapSummary right
    ) {
        int nameComparison = Comparator.nullsFirst(String.CASE_INSENSITIVE_ORDER)
                .compare(left.mapName(), right.mapName());
        if (nameComparison != 0) {
            return nameComparison;
        }
        return Long.compare(left.mapId().value(), right.mapId().value());
    }

    private static DungeonAuthoredPublishedStateRepository.MapMutationPublication mapMutationPublication(
            DungeonMapIdentity mapId
    ) {
        return new DungeonAuthoredPublishedStateRepository.MapMutationPublication(mapId);
    }
}
