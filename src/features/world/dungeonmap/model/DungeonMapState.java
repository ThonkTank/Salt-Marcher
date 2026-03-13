package features.world.dungeonmap.model;

import features.world.dungeonmap.model.index.DungeonMapIndex;

import java.util.List;

/**
 * `edgeIndex` is the canonical derived edge read model for canvas/editor lookups.
 * Raw `walls` and `passages` remain entity-oriented views for workflows that restore
 * selection or edit a specific persisted row by id.
 * Raw entity lists remain the canonical loaded entities, while `index` is the
 * canonical shared lookup surface for read-side in-memory queries.
 */
public record DungeonMapState(
        DungeonMap map,
        List<DungeonSquare> squares,
        List<DungeonRoom> rooms,
        List<DungeonArea> areas,
        List<DungeonFeature> features,
        List<DungeonFeatureTile> featureTiles,
        List<DungeonEndpoint> endpoints,
        List<DungeonLink> links,
        List<DungeonWall> walls,
        List<DungeonPassage> passages,
        DungeonMapIndex index,
        DungeonEdgeIndex edgeIndex
) {
    public DungeonMapIndex index() {
        return index == null ? DungeonMapIndex.empty() : index;
    }

    public DungeonEdgeSummary edgeAt(String edgeKey) {
        return edgeIndex == null ? null : edgeIndex.edgeAt(edgeKey);
    }

    public long wallEdgeCount() {
        return walls().size();
    }

    public long passageEdgeCount() {
        return passages().size();
    }
}
