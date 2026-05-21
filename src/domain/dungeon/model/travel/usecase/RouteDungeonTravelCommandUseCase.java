package src.domain.dungeon.model.travel.usecase;

import java.util.Objects;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.map.model.DungeonCell;
import src.domain.dungeon.model.map.model.DungeonMapIdentity;
import src.domain.dungeon.model.map.model.DungeonTravelHeading;
import src.domain.dungeon.model.map.model.DungeonTravelLocationKind;
import src.domain.dungeon.model.map.model.DungeonTravelPositionFacts;
import src.domain.dungeon.model.map.repository.DungeonAuthoredPublishedStateRepository;

public final class RouteDungeonTravelCommandUseCase {

    private static final int LOAD_SURFACE_OPERATION = 1;
    private static final int MOVE_ACTION_OPERATION = 2;

    private final LoadDungeonTravelSurfaceUseCase loadDungeonTravelSurfaceUseCase;
    private final MoveDungeonTravelActionUseCase moveDungeonTravelActionUseCase;
    private final DungeonAuthoredPublishedStateRepository publishedStateRepository;

    public RouteDungeonTravelCommandUseCase(
            LoadDungeonTravelSurfaceUseCase loadDungeonTravelSurfaceUseCase,
            MoveDungeonTravelActionUseCase moveDungeonTravelActionUseCase,
            DungeonAuthoredPublishedStateRepository publishedStateRepository
    ) {
        this.loadDungeonTravelSurfaceUseCase =
                Objects.requireNonNull(loadDungeonTravelSurfaceUseCase, "loadDungeonTravelSurfaceUseCase");
        this.moveDungeonTravelActionUseCase =
                Objects.requireNonNull(moveDungeonTravelActionUseCase, "moveDungeonTravelActionUseCase");
        this.publishedStateRepository =
                Objects.requireNonNull(publishedStateRepository, "publishedStateRepository");
    }

    public void execute(
            int operationKey,
            boolean hasPosition,
            long mapIdValue,
            String locationKindName,
            long ownerId,
            int tileQ,
            int tileR,
            int tileLevel,
            String headingName,
            String actionId
    ) {
        DungeonTravelPositionFacts position = travelPosition(
                hasPosition,
                mapIdValue,
                locationKindName,
                ownerId,
                tileQ,
                tileR,
                tileLevel,
                headingName);
        switch (operationKey) {
            case LOAD_SURFACE_OPERATION -> publishedStateRepository.publishSurface(
                    loadDungeonTravelSurfaceUseCase.execute(new LoadDungeonTravelSurfaceUseCase.Input(
                            position)));
            case MOVE_ACTION_OPERATION -> publishedStateRepository.publishMove(
                    moveDungeonTravelActionUseCase.execute(new MoveDungeonTravelActionUseCase.Input(
                            position,
                            actionId)));
            default -> throw new IllegalArgumentException("Unknown dungeon travel operation: " + operationKey);
        }
    }

    private static @Nullable DungeonTravelPositionFacts travelPosition(
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
        return name == null || name.isBlank()
                ? DungeonTravelLocationKind.TILE
                : DungeonTravelLocationKind.valueOf(name);
    }

    private static DungeonTravelHeading heading(String name) {
        return name == null || name.isBlank()
                ? DungeonTravelHeading.defaultHeading()
                : DungeonTravelHeading.valueOf(name);
    }
}
