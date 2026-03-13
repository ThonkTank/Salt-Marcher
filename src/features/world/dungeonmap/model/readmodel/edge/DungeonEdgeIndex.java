package features.world.dungeonmap.model.readmodel.edge;

import java.util.Map;

public record DungeonEdgeIndex(
        Map<String, DungeonEdgeSummary> edgesByKey
) {
    public static DungeonEdgeIndex empty() {
        return new DungeonEdgeIndex(Map.of());
    }

    public DungeonEdgeSummary edgeAt(String edgeKey) {
        return edgeKey == null ? null : edgesByKey.get(edgeKey);
    }
}
