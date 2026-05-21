package src.domain.dungeon.model.editor.usecase;

import java.util.Objects;
import src.domain.dungeon.model.editor.model.session.model.DungeonEditorDungeonState;
import src.domain.dungeon.model.map.repository.DungeonAuthoredPublishedStateRepository;
import src.domain.dungeon.model.map.usecase.ApplyDungeonMapCatalogUseCase;

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
        state.replaceCatalog(DungeonEditorAuthoredFactsUseCase.catalogFacts(catalog));
        publishedStateRepository.publishSearch(DungeonEditorAuthoredFactsUseCase.catalogPublication(catalog));
    }
}
