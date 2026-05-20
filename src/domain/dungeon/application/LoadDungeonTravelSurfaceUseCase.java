package src.domain.dungeon.application;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.map.model.DungeonMap;
import src.domain.dungeon.model.map.model.DungeonTravelSurfaceProjection;
import src.domain.dungeon.model.map.model.DungeonTravelPositionFacts;
import src.domain.dungeon.model.map.model.DungeonTravelSurfaceFacts;
import src.domain.dungeon.model.map.usecase.BuildDungeonDerivedStateUseCase;
import src.domain.dungeon.model.map.usecase.LoadDungeonMapUseCase;

public final class LoadDungeonTravelSurfaceUseCase {

    public static final class Input {
        private final @Nullable DungeonTravelPositionFacts position;

        public Input(@Nullable DungeonTravelPositionFacts position) {
            this.position = position;
        }

        public @Nullable DungeonTravelPositionFacts position() {
            return position;
        }
    }

    private final LoadDungeonMapUseCase loadDungeonMap;
    private final BuildDungeonDerivedStateUseCase derive;
    private final DungeonTravelSurfaceProjection projector = new DungeonTravelSurfaceProjection();

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
