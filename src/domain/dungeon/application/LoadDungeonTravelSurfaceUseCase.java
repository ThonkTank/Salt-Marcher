package src.domain.dungeon.application;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.map.aggregate.DungeonMap;
import src.domain.dungeon.map.port.DungeonMapRepository;
import src.domain.dungeon.map.port.DungeonMapSearch;
import src.domain.dungeon.map.service.DungeonTravelSurfaceProjector;
import src.domain.dungeon.map.value.DungeonMapIdentity;
import src.domain.dungeon.map.value.DungeonTravelPositionFacts;
import src.domain.dungeon.map.value.DungeonTravelSurfaceFacts;

public final class LoadDungeonTravelSurfaceUseCase {

    public record Input(@Nullable DungeonTravelPositionFacts position) {
    }

    private final DungeonMapRepository repository;
    private final DungeonMapSearch search;
    private final BuildDungeonDerivedStateUseCase derive;
    private final DungeonTravelSurfaceProjector projector = new DungeonTravelSurfaceProjector();

    public LoadDungeonTravelSurfaceUseCase(
            DungeonMapRepository repository,
            DungeonMapSearch search,
            BuildDungeonDerivedStateUseCase derive
    ) {
        this.repository = repository;
        this.search = search;
        this.derive = derive;
    }

    public DungeonTravelSurfaceFacts execute(Input input) {
        DungeonTravelPositionFacts position = input == null ? null : input.position();
        DungeonMap dungeonMap = loadMap(position);
        return projector.project(dungeonMap, derive.execute(dungeonMap), position, "Token auf der Karte ziehen");
    }

    private DungeonMap loadMap(@Nullable DungeonTravelPositionFacts position) {
        if (position != null) {
            DungeonMapIdentity mapId = position.mapId();
            return repository.findById(mapId).orElseGet(this::loadCurrentMap);
        }
        return loadCurrentMap();
    }

    private DungeonMap loadCurrentMap() {
        return search.firstMap()
                .orElseGet(() -> DungeonMap.empty(repository.nextMapId(), "Dungeon Bastion"));
    }
}
