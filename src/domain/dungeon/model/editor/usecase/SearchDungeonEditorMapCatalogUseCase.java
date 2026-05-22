package src.domain.dungeon.model.editor.usecase;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorDungeonState;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.MapId;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues.MapSummary;
import src.domain.dungeon.model.map.model.DungeonMapIdentity;
import src.domain.dungeon.model.map.repository.DungeonAuthoredPublishedStateRepository;
import src.domain.dungeon.model.map.usecase.ApplyDungeonMapCatalogUseCase;
import src.domain.dungeon.model.map.usecase.SearchDungeonMapsUseCase;

public final class SearchDungeonEditorMapCatalogUseCase {

    private final ApplyDungeonMapCatalogUseCase catalogUseCase;
    private final DungeonAuthoredPublishedStateRepository publishedStateRepository;
    private final DungeonEditorDungeonState state;

    public SearchDungeonEditorMapCatalogUseCase(
            ApplyDungeonMapCatalogUseCase catalogUseCase,
            DungeonAuthoredPublishedStateRepository publishedStateRepository,
            DungeonEditorDungeonState state
    ) {
        this.catalogUseCase = Objects.requireNonNull(catalogUseCase, "catalogUseCase");
        this.publishedStateRepository =
                Objects.requireNonNull(publishedStateRepository, "publishedStateRepository");
        this.state = Objects.requireNonNull(state, "state");
    }

    public void execute(String query) {
        ApplyDungeonMapCatalogUseCase.MapCatalogResult catalog = catalogUseCase.search(query);
        state.replaceCatalog(catalogFacts(catalog));
        publishedStateRepository.publishSearch(catalogPublication(catalog));
    }

    static List<MapSummary> catalogFacts(ApplyDungeonMapCatalogUseCase.MapCatalogResult catalog) {
        if (catalog == null) {
            return List.of();
        }
        List<MapSummary> result = new ArrayList<>();
        for (SearchDungeonMapsUseCase.MapSummary map : catalog.maps()) {
            result.add(mapSummary(map));
        }
        return List.copyOf(result);
    }

    static DungeonAuthoredPublishedStateRepository.CatalogPublication catalogPublication(
            ApplyDungeonMapCatalogUseCase.MapCatalogResult catalog
    ) {
        if (catalog == null) {
            return new DungeonAuthoredPublishedStateRepository.CatalogPublication(List.of());
        }
        List<DungeonAuthoredPublishedStateRepository.MapSummaryPublication> maps = new ArrayList<>();
        for (SearchDungeonMapsUseCase.MapSummary map : catalog.maps()) {
            maps.add(mapSummaryPublication(map));
        }
        return new DungeonAuthoredPublishedStateRepository.CatalogPublication(maps);
    }

    private static MapSummary mapSummary(SearchDungeonMapsUseCase.MapSummary map) {
        return map == null
                ? new MapSummary(new MapId(1L), "Dungeon Map", 0L)
                : new MapSummary(new MapId(map.mapId().value()), map.mapName(), map.revision());
    }

    private static DungeonAuthoredPublishedStateRepository.MapSummaryPublication mapSummaryPublication(
            SearchDungeonMapsUseCase.MapSummary map
    ) {
        return map == null
                ? new DungeonAuthoredPublishedStateRepository.MapSummaryPublication(
                        new DungeonMapIdentity(1L),
                        "Dungeon Map",
                        0L)
                : new DungeonAuthoredPublishedStateRepository.MapSummaryPublication(
                        map.mapId(),
                        map.mapName(),
                        map.revision());
    }
}
