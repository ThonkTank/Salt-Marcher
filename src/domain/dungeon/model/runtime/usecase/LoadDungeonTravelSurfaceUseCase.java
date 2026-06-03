package src.domain.dungeon.model.runtime.usecase;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.runtime.travel.projection.TravelSurfaceProjection;
import src.domain.dungeon.model.runtime.travel.projection.TravelPositionFacts;
import src.domain.dungeon.model.runtime.travel.projection.TravelSurfaceFacts;
import src.domain.dungeon.model.worldspace.DungeonMap;
import src.domain.dungeon.model.worldspace.DungeonMapIdentity;
import src.domain.dungeon.model.worldspace.usecase.BuildDungeonDerivedStateUseCase;
import src.domain.dungeon.model.worldspace.usecase.LoadDungeonMapUseCase;

public final class LoadDungeonTravelSurfaceUseCase {

    public static final class Input {
        private final @Nullable TravelPositionFacts position;

        public Input(@Nullable TravelPositionFacts position) {
            this.position = position;
        }

        public @Nullable TravelPositionFacts position() {
            return position;
        }
    }

    private final LoadDungeonMapUseCase loadDungeonMap;
    private final BuildDungeonDerivedStateUseCase derive;
    private final TravelSurfaceProjection projector = new TravelSurfaceProjection();

    public LoadDungeonTravelSurfaceUseCase(
            LoadDungeonMapUseCase loadDungeonMap,
            BuildDungeonDerivedStateUseCase derive
    ) {
        this.loadDungeonMap = loadDungeonMap;
        this.derive = derive;
    }

    public TravelSurfaceFacts execute(Input input) {
        TravelPositionFacts position = input == null ? null : input.position();
        DungeonMap dungeonMap = loadMap(position);
        return projector.project(
                dungeonMap,
                derive.execute(dungeonMap),
                position,
                "Token auf der Karte ziehen");
    }

    private DungeonMap loadMap(@Nullable TravelPositionFacts position) {
        if (position != null) {
            return loadDungeonMap.execute(new DungeonMapIdentity(position.mapId()));
        }
        return loadDungeonMap.execute();
    }
}
