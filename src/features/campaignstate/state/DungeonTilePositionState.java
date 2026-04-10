package features.campaignstate.state;

import features.campaignstate.input.ClearDungeonPositionInput;
import features.campaignstate.input.SetDungeonTilePositionInput;

@SuppressWarnings("unused")
public record DungeonTilePositionState(
        Long mapId,
        Integer levelZ,
        Integer cellX,
        Integer cellY,
        String heading
) {

    public static DungeonTilePositionState setDungeonTilePosition(SetDungeonTilePositionInput input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        return new DungeonTilePositionState(
                input.mapId(),
                input.levelZ(),
                input.cellX(),
                input.cellY(),
                input.heading());
    }

    public static DungeonTilePositionState clearDungeonPosition(ClearDungeonPositionInput input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        return new DungeonTilePositionState(null, null, null, null, null);
    }
}
