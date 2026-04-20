package src.domain.dungeon.published;

import java.util.List;

public record SearchMapsResult(List<DungeonMapSummary> maps) {

    public SearchMapsResult {
        maps = maps == null ? List.of() : List.copyOf(maps);
    }
}
