package src.domain.dungeon.model.worldspace;

import java.util.ArrayList;
import java.util.List;
import src.domain.dungeon.model.core.structure.stair.Stair;
import src.domain.dungeon.model.core.structure.stair.StairCollection;

final class DungeonStairCatalogCoreAdapter {
    private DungeonStairCatalogCoreAdapter() {
    }

    static StairCollection toCoreCollection(List<DungeonStair> source) {
        List<Stair> result = new ArrayList<>();
        for (DungeonStair stair : source == null ? List.<DungeonStair>of() : source) {
            if (stair != null) {
                result.add(stair.core());
            }
        }
        return new StairCollection(result);
    }

    static List<DungeonStair> fromCoreCollection(StairCollection source) {
        List<DungeonStair> result = new ArrayList<>();
        for (Stair stair : source == null ? List.<Stair>of() : source.stairs()) {
            if (stair != null) {
                result.add(DungeonStair.fromCore(stair));
            }
        }
        return List.copyOf(result);
    }
}
