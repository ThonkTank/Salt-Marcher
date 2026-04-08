package features.world.dungeon.transition.task;

public final class LoadOverworldTargetsTask {

    private LoadOverworldTargetsTask() {
    }

    public static java.util.List<features.world.dungeon.transition.input.LoadOverworldTargetsInput.TargetInput> loadOverworldTargets(
            features.world.dungeon.transition.input.LoadOverworldTargetsInput input
    ) throws java.sql.SQLException {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        return features.world.api.read.ReadObject.loadOverworldTransitionTargets().stream()
                .map(summary -> features.world.dungeon.transition.input.LoadOverworldTargetsInput.TargetInput.target(
                        summary.mapId(),
                        summary.tileId(),
                        summary.label()))
                .toList();
    }
}
