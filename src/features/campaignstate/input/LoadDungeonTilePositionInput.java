package features.campaignstate.input;

import java.sql.Connection;

@SuppressWarnings("unused")
public record LoadDungeonTilePositionInput(Connection connection) {

    public record LoadedDungeonTilePositionInput(
            boolean present,
            Long mapId,
            Integer levelZ,
            Integer cellX,
            Integer cellY,
            String heading
    ) {
    }
}
