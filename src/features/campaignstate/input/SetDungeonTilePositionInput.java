package features.campaignstate.input;

import java.sql.Connection;

@SuppressWarnings("unused")
public record SetDungeonTilePositionInput(
        Connection connection,
        Long mapId,
        Integer levelZ,
        Integer cellX,
        Integer cellY,
        String heading
) {
}
