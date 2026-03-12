package features.world.dungeonmap.model;

import java.util.List;

/**
 * `edges` is the canonical read model for wall/passage state on a specific edge.
 * Raw `walls` and `passages` remain available for entity-oriented workflows such as
 * selection restore and passage editing forms.
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
        List<DungeonEdgeSummary> edges
) {
    public long wallEdgeCount() {
        return edges.stream().filter(edge -> edge.wall() != null).count();
    }

    public long passageEdgeCount() {
        return edges.stream().filter(edge -> edge.passage() != null).count();
    }
}
