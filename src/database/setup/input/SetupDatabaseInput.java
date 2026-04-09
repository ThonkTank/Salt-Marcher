package database.setup.input;

import java.util.List;

@SuppressWarnings("unused")
public record SetupDatabaseInput(
        int analysisModelVersion,
        List<LevelXpFloorInput> levelXpFloors
) {

    public record LevelXpFloorInput(
            int level,
            int minimumXp
    ) {
    }
}
