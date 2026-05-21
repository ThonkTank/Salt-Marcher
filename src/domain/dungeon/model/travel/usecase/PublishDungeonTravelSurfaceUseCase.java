package src.domain.dungeon.model.travel.usecase;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.map.model.DungeonCell;
import src.domain.dungeon.model.map.model.DungeonMapIdentity;
import src.domain.dungeon.model.map.model.DungeonTravelHeading;
import src.domain.dungeon.model.map.model.DungeonTravelLocationKind;
import src.domain.dungeon.model.map.model.DungeonTravelPositionFacts;
import src.domain.dungeon.model.map.repository.DungeonAuthoredPublishedStateRepository;

public final class PublishDungeonTravelSurfaceUseCase {

    private final LoadDungeonTravelSurfaceUseCase loadDungeonTravelSurfaceUseCase;
    private final DungeonAuthoredPublishedStateRepository publishedStateRepository;

    public PublishDungeonTravelSurfaceUseCase(
            LoadDungeonTravelSurfaceUseCase loadDungeonTravelSurfaceUseCase,
            DungeonAuthoredPublishedStateRepository publishedStateRepository
    ) {
        this.loadDungeonTravelSurfaceUseCase =
                Objects.requireNonNull(loadDungeonTravelSurfaceUseCase, "loadDungeonTravelSurfaceUseCase");
        this.publishedStateRepository =
                Objects.requireNonNull(publishedStateRepository, "publishedStateRepository");
    }

    public void execute(
            boolean hasPosition,
            long mapIdValue,
            String locationKindName,
            long ownerId,
            int tileQ,
            int tileR,
            int tileLevel,
            String headingName
    ) {
        publishedStateRepository.publishSurface(loadDungeonTravelSurfaceUseCase.execute(
                new LoadDungeonTravelSurfaceUseCase.Input(travelPosition(
                        hasPosition,
                        mapIdValue,
                        locationKindName,
                        ownerId,
                        tileQ,
                        tileR,
                        tileLevel,
                        headingName))));
    }

    static @Nullable DungeonTravelPositionFacts travelPosition(
            boolean hasPosition,
            long mapIdValue,
            String locationKindName,
            long ownerId,
            int tileQ,
            int tileR,
            int tileLevel,
            String headingName
    ) {
        if (!hasPosition) {
            return null;
        }
        return new DungeonTravelPositionFacts(
                new DungeonMapIdentity(mapIdValue),
                locationKind(locationKindName),
                ownerId,
                new DungeonCell(tileQ, tileR, tileLevel),
                heading(headingName));
    }

    private static DungeonTravelLocationKind locationKind(String name) {
        try {
            return DungeonTravelLocationKind.valueOf(name == null ? "" : name);
        } catch (IllegalArgumentException ignored) {
            return DungeonTravelLocationKind.TILE;
        }
    }

    private static DungeonTravelHeading heading(String name) {
        return DungeonTravelHeading.parse(name);
    }
}
