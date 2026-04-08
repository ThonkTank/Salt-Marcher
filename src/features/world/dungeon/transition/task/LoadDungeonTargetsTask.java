package features.world.dungeon.transition.task;

public final class LoadDungeonTargetsTask {

    private LoadDungeonTargetsTask() {
    }

    public static java.util.List<features.world.dungeon.transition.input.LoadDungeonTargetsInput.TargetInput> loadDungeonTargets(
            features.world.dungeon.transition.input.LoadDungeonTargetsInput input
    ) throws java.sql.SQLException {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        long mapId = input.mapId();
        if (mapId <= 0) {
            return java.util.List.of();
        }
        try (java.sql.Connection conn = database.DatabaseManager.getConnection()) {
            features.world.dungeon.dungeonmap.repository.DungeonMapRepository mapRepository =
                    new features.world.dungeon.dungeonmap.repository.DungeonMapRepository();
            features.world.dungeon.dungeonmap.model.DungeonMap layout = mapRepository.loadMap(conn, mapId);
            if (layout == null) {
                return java.util.List.of();
            }
            return layout.placedTransitions().stream()
                    .map(transition -> transition.localConnection() != null && transition.localConnection().doorCarrier() != null
                            ? features.world.dungeon.transition.input.LoadDungeonTargetsInput.TargetInput.doorTarget(
                                    transition.transitionId(),
                                    transition.mapId(),
                                    transition.label(),
                                    transition.description(),
                                    transition.levelZ(),
                                    transition.localConnection().doorCarrier().doorRef().doorId())
                            : features.world.dungeon.transition.input.LoadDungeonTargetsInput.TargetInput.stairTarget(
                                    transition.transitionId(),
                                    transition.mapId(),
                                    transition.label(),
                                    transition.description(),
                                    transition.levelZ(),
                                    transition.localConnection() != null && transition.localConnection().stairCarrier() != null
                                            ? transition.localConnection().stairCarrier().anchorCell().x2() / 2
                                            : null,
                                    transition.localConnection() != null && transition.localConnection().stairCarrier() != null
                                            ? transition.localConnection().stairCarrier().anchorCell().y2() / 2
                                            : null,
                                    transition.localConnection() != null && transition.localConnection().stairCarrier() != null
                                            ? transition.localConnection().stairCarrier().anchorCell().z()
                                            : null,
                                    transition.localConnection() != null && transition.localConnection().stairCarrier() != null
                                            ? transition.localConnection().stairCarrier().anchorLevelZ()
                                            : null))
                    .toList();
        }
    }
}
