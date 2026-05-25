package src.domain.dungeon.model.worldspace.usecase;

import java.util.Objects;
import src.domain.dungeon.model.worldspace.model.DungeonTravelPositionFacts;
import src.domain.dungeon.model.worldspace.repository.DungeonAuthoredPublishedStateRepository;

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

    public void execute(PositionInput position) {
        publishedStateRepository.publishSurface(loadDungeonTravelSurfaceUseCase.execute(
                new LoadDungeonTravelSurfaceUseCase.Input(position == null ? null : position.toFacts())));
    }

    public static final class PositionInput {
        private final DungeonTravelPublicationPosition position;

        public PositionInput(
                long mapId,
                String locationKind,
                long ownerId,
                int q,
                int r,
                int level,
                String heading
        ) {
            this.position = DungeonTravelPublicationPosition.fromNames(
                    mapId,
                    locationKind,
                    ownerId,
                    q,
                    r,
                    level,
                    heading);
        }

        DungeonTravelPositionFacts toFacts() {
            return position.toFacts();
        }
    }
}
