package features.world.dungeonmap.application.transition;

import database.DatabaseManager;
import features.world.api.OverworldTransitionTargetSummary;
import features.world.api.WorldReadApi;
import features.world.dungeonmap.model.structures.transition.DungeonTransition;
import features.world.dungeonmap.model.structures.transition.DungeonTransitionDestination;
import features.world.dungeonmap.repository.DungeonTransitionRepository;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;
import java.util.Objects;

public final class TransitionTargetCatalogApplicationService {

    private final DungeonTransitionRepository transitionRepository;

    public TransitionTargetCatalogApplicationService(DungeonTransitionRepository transitionRepository) {
        this.transitionRepository = Objects.requireNonNull(transitionRepository, "transitionRepository");
    }

    public List<TransitionDestinationOption> loadDungeonTargetOptions(long mapId) throws SQLException {
        if (mapId <= 0) {
            return List.of();
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            return transitionRepository.loadPlacedByMap(conn, mapId).stream()
                    .filter(transition -> transition != null && transition.transitionId() != null && transition.anchor() != null)
                    .map(transition -> new TransitionDestinationOption(
                            new DungeonTransitionDestination.DungeonMapDestination(mapId, transition.transitionId()),
                            dungeonTransitionLabel(transition)))
                    .toList();
        }
    }

    public List<TransitionDestinationOption> loadOverworldTargetOptions() throws SQLException {
        return WorldReadApi.loadOverworldTransitionTargets().stream()
                .filter(Objects::nonNull)
                .map(this::mapOverworldOption)
                .toList();
    }

    private TransitionDestinationOption mapOverworldOption(OverworldTransitionTargetSummary summary) {
        return new TransitionDestinationOption(
                new DungeonTransitionDestination.OverworldTileDestination(summary.mapId(), summary.tileId()),
                summary.label());
    }

    private static String dungeonTransitionLabel(DungeonTransition transition) {
        return "Übergang " + transition.transitionId()
                + (transition.description() == null || transition.description().isBlank() ? "" : " · " + transition.description())
                + " · "
                + transition.anchor().x() + ", " + transition.anchor().y() + ", z=" + transition.anchor().z();
    }
}
