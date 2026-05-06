package src.domain.dungeon.application;

import src.domain.dungeon.map.port.DungeonMapRepository;
import src.domain.dungeon.map.port.DungeonMapSearch;

final class DungeonTravelRuntimeAccess {

    private DungeonTravelRuntimeAccess() {
    }

    static DungeonTravelRuntimeAdapter create(
            DungeonMapRepository repository,
            DungeonMapSearch search
    ) {
        BuildDungeonDerivedStateUseCase derive = new BuildDungeonDerivedStateUseCase();
        LoadDungeonMapUseCase loadDungeonMapUseCase = new LoadDungeonMapUseCase(repository, search);
        return new DungeonTravelRuntimeAdapter(
                new LoadDungeonTravelSurfaceUseCase(loadDungeonMapUseCase, derive),
                new MoveDungeonTravelActionUseCase(
                        loadDungeonMapUseCase,
                        repository::findById,
                        derive::execute));
    }
}
