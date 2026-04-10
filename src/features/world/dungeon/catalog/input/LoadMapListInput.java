package features.world.dungeon.catalog.input;

import java.sql.Connection;
import java.util.List;

@SuppressWarnings("unused")
public record LoadMapListInput(
        Connection connection
) {
    public record LoadedMapListInput(
            List<features.world.dungeon.catalog.application.DungeonMapCatalogEntry> maps
    ) {
        public LoadedMapListInput {
            maps = maps == null ? List.of() : List.copyOf(maps);
        }
    }
}
