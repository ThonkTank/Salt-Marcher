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

    private final ApplyDungeonTravelUseCase applyDungeonTravelUseCase;
    private final DungeonAuthoredPublishedStateRepository publishedStateRepository;

    public RouteDungeonTravelCommandUseCase(
            ApplyDungeonTravelUseCase applyDungeonTravelUseCase,
            DungeonAuthoredPublishedStateRepository publishedStateRepository
    ) {
        this.applyDungeonTravelUseCase =
                Objects.requireNonNull(applyDungeonTravelUseCase, "applyDungeonTravelUseCase");
        this.publishedStateRepository =
                Objects.requireNonNull(publishedStateRepository, "publishedStateRepository");
    }

    public void execute(
            boolean loadSurface,
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
                mapIdValue,
                locationKindName,
                ownerId,
                tileQ,
                tileR,
                tileLevel,
                headingName);
        if (loadSurface) {
            publishedStateRepository.publishSurface(applyDungeonTravelUseCase.loadSurface(position));
            return;
        }
        publishedStateRepository.publishMove(applyDungeonTravelUseCase.move(position, actionId));
    }

    private static @Nullable DungeonTravelPositionFacts travelPosition(
            long mapIdValue,
            String locationKindName,
            long ownerId,
            int tileQ,
            int tileR,
            int tileLevel,
            String headingName
    ) {
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
