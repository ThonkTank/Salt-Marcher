package features.world.dungeonmap.model.projection;

import features.world.dungeonmap.model.domain.DungeonConnection;
import features.world.dungeonmap.model.domain.DungeonConnectionPoint;
import features.world.dungeonmap.model.domain.DungeonArea;
import features.world.dungeonmap.model.domain.DungeonFeature;
import features.world.dungeonmap.model.domain.DungeonFeatureTile;
import features.world.dungeonmap.model.domain.DungeonMap;
import features.world.dungeonmap.model.domain.DungeonRoom;
import features.world.dungeonmap.model.domain.DungeonSquare;
import features.world.dungeonmap.model.domain.DungeonWall;
import features.world.dungeonmap.model.projection.edge.DungeonEdgeIndex;
import features.world.dungeonmap.model.projection.edge.DungeonEdgeSummary;
import features.world.dungeonmap.model.projection.index.DungeonMapIndex;

import java.util.List;

/**
 * `edgeIndex` is the canonical derived edge read model for canvas/editor lookups.
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
        List<DungeonConnection> connections,
        List<DungeonConnectionPoint> connectionPoints,
        List<DungeonMapConnectionPath> roomConnections,
        List<DungeonWall> walls,
        DungeonMapIndex index,
        DungeonEdgeIndex edgeIndex
) {
    public DungeonMapIndex index() {
        return index == null ? DungeonMapIndex.empty() : index;
    }

    public DungeonMapState withIndex(DungeonMapIndex updatedIndex) {
        return new DungeonMapState(
                map,
                squares,
                rooms,
                areas,
                features,
                featureTiles,
                connections,
                connectionPoints,
                roomConnections,
                walls,
                updatedIndex,
                edgeIndex);
    }

    public DungeonEdgeSummary edgeAt(String edgeKey) {
        return edgeIndex == null ? null : edgeIndex.edgeAt(edgeKey);
    }

    public long wallEdgeCount() {
        return walls().size();
    }
}
