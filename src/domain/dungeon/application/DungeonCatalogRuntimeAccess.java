package src.domain.dungeon.application;

import src.domain.dungeon.map.port.DungeonMapRepository;
import src.domain.dungeon.map.port.DungeonMapSearch;

final class DungeonCatalogRuntimeAccess {

    private DungeonCatalogRuntimeAccess() {
    }

    static DungeonCatalogRuntimeAdapter create(
            DungeonMapRepository repository,
            DungeonMapSearch search
    ) {
        return new DungeonCatalogRuntimeAdapter(
                new SearchDungeonMapsUseCase(search),
                new CreateDungeonMapUseCase(repository::nextMapId, repository::save),
                new RenameDungeonMapUseCase(repository::findById, repository::save),
                new DeleteDungeonMapUseCase(repository::delete));
    }
}
