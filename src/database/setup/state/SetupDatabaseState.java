package database.setup.state;

import database.setup.input.SetupDatabaseInput;

import java.util.ArrayList;
import java.util.List;

@SuppressWarnings("unused")
public record SetupDatabaseState(
        int analysisModelVersion,
        List<LevelXpFloorState> levelXpFloors
) {

    public SetupDatabaseState {
        if (analysisModelVersion <= 0) {
            throw new IllegalArgumentException("analysisModelVersion");
        }
        ArrayList<LevelXpFloorState> normalizedFloors = new ArrayList<>();
        List<SetupDatabaseState.LevelXpFloorState> floors = levelXpFloors == null ? List.of() : levelXpFloors;
        for (SetupDatabaseState.LevelXpFloorState floor : floors) {
            if (floor == null) {
                continue;
            }
            normalizedFloors.add(floor);
        }
        levelXpFloors = normalizedFloors.isEmpty() ? List.of() : List.copyOf(normalizedFloors);
    }

    public static SetupDatabaseState setupDatabase(SetupDatabaseInput input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        ArrayList<LevelXpFloorState> floors = new ArrayList<>();
        List<SetupDatabaseInput.LevelXpFloorInput> inputs = input.levelXpFloors() == null ? List.of() : input.levelXpFloors();
        for (SetupDatabaseInput.LevelXpFloorInput floor : inputs) {
            if (floor == null) {
                continue;
            }
            floors.add(new LevelXpFloorState(floor.level(), floor.minimumXp()));
        }
        return new SetupDatabaseState(input.analysisModelVersion(), floors);
    }

    public record LevelXpFloorState(
            int level,
            int minimumXp
    ) {

        public LevelXpFloorState {
            if (level <= 0) {
                throw new IllegalArgumentException("level");
            }
            if (minimumXp < 0) {
                throw new IllegalArgumentException("minimumXp");
            }
        }
    }
}
