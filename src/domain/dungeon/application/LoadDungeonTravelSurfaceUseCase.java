package src.domain.dungeon.application;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.map.aggregate.DungeonMap;
import src.domain.dungeon.map.service.DungeonTravelSurfaceProjector;
import src.domain.dungeon.map.value.DungeonTravelPositionFacts;
import src.domain.dungeon.map.value.DungeonTravelSurfaceFacts;

public final class LoadDungeonTravelSurfaceUseCase {

    public record Input(@Nullable DungeonTravelPositionFacts position) {
    }

    private final LoadDungeonMapUseCase loadDungeonMap;
    private final BuildDungeonDerivedStateUseCase derive;
    private final DungeonTravelSurfaceProjector projector = new DungeonTravelSurfaceProjector();

    public LoadDungeonTravelSurfaceUseCase(
            LoadDungeonMapUseCase loadDungeonMap,
            BuildDungeonDerivedStateUseCase derive
    ) {
        this.loadDungeonMap = loadDungeonMap;
        this.derive = derive;
    }

    public DungeonTravelSurfaceFacts execute(Input input) {
        DungeonTravelPositionFacts position = input == null ? null : input.position();
        DungeonMap dungeonMap = loadMap(position);
        return projector.project(dungeonMap, derive.execute(dungeonMap), position, "Token auf der Karte ziehen");
    }

    private DungeonMap loadMap(@Nullable DungeonTravelPositionFacts position) {
        if (position != null) {
            return loadDungeonMap.execute(position.mapId());
        }
        return loadDungeonMap.execute();
    }
}
