package src.domain.dungeon.model.runtime.usecase;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.runtime.travel.projection.TravelAuthoredSurfaceProjectionMapper;
import src.domain.dungeon.model.runtime.travel.projection.TravelSurfaceProjection;
import src.domain.dungeon.model.runtime.travel.projection.TravelPositionFacts;
import src.domain.dungeon.model.runtime.travel.projection.TravelSurfaceFacts;
import src.domain.dungeon.model.core.structure.DungeonMap;
import src.domain.dungeon.model.core.structure.DungeonMapIdentity;
import src.domain.dungeon.model.core.usecase.BuildDungeonDerivedStateUseCase;
import src.domain.dungeon.model.core.usecase.LoadDungeonMapUseCase;

public final class LoadDungeonTravelSurfaceUseCase {

    public static final class Input {
        private final @Nullable Long mapId;
        private final @Nullable TravelPositionFacts position;

        public Input(@Nullable TravelPositionFacts position) {
            this(position == null ? null : position.mapId(), position);
        }

        public Input(long mapId) {
            this(mapId, null);
        }

        private Input(@Nullable Long mapId, @Nullable TravelPositionFacts position) {
            this.mapId = mapId == null || mapId <= 0L ? null : mapId;
            this.position = position;
        }

        public @Nullable Long mapId() {
            return mapId;
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
        Long mapId = input == null ? null : input.mapId();
        DungeonMap dungeonMap = loadMap(mapId, position);
        return projector.project(
                TravelAuthoredSurfaceProjectionMapper.from(dungeonMap, derive.execute(dungeonMap)),
                position,
                "Token auf der Karte ziehen");
    }

    private DungeonMap loadMap(@Nullable Long requestedMapId, @Nullable TravelPositionFacts position) {
        if (position != null) {
            return loadDungeonMap.execute(new DungeonMapIdentity(position.mapId()));
        }
        if (requestedMapId != null) {
            return loadDungeonMap.execute(new DungeonMapIdentity(requestedMapId));
        }
        return loadDungeonMap.execute();
    }
}
