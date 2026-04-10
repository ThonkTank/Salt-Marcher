package features.world.dungeon.transition.task;

@SuppressWarnings("unused")
public final class LoadOverworldTargetsTask {
    private static final features.world.read.ReadObject WORLD_READ_OBJECT = new features.world.read.ReadObject();

    private LoadOverworldTargetsTask() {
    }

    public static java.util.List<features.world.dungeon.transition.input.LoadOverworldTargetsInput.TargetInput> loadOverworldTargets(
            features.world.dungeon.transition.input.LoadOverworldTargetsInput input
    ) throws java.sql.SQLException {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        return WORLD_READ_OBJECT.loadOverworldTransitionTargets(new features.world.read.input.LoadOverworldTransitionTargetsInput()).targets().stream()
                .map(summary -> features.world.dungeon.transition.input.LoadOverworldTargetsInput.TargetInput.target(
                        summary.mapId(),
                        summary.tileId(),
                        summary.label()))
                .toList();
    }
}
