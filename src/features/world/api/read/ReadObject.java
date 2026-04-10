package features.world.api.read;

import features.world.api.input.OverworldTransitionTargetSummary;
import features.world.read.input.FindOverworldMapIdForTileInput;
import features.world.read.input.LoadOverworldTransitionTargetsInput;

import java.sql.SQLException;
import java.util.List;

@SuppressWarnings("unused")
public final class ReadObject {
    private static final features.world.read.ReadObject WORLD_READ_OBJECT = new features.world.read.ReadObject();

    private ReadObject() {
        throw new AssertionError("No instances");
    }

    public static List<OverworldTransitionTargetSummary> loadOverworldTransitionTargets() throws SQLException {
        return WORLD_READ_OBJECT.loadOverworldTransitionTargets(new LoadOverworldTransitionTargetsInput()).targets().stream()
                .map(summary -> new OverworldTransitionTargetSummary(
                        summary.mapId(),
                        summary.tileId(),
                        summary.label()))
                .toList();
    }

    public static Long findOverworldMapIdForTile(long tileId) throws SQLException {
        return WORLD_READ_OBJECT.findOverworldMapIdForTile(new FindOverworldMapIdForTileInput(tileId)).mapId();
    }
}
