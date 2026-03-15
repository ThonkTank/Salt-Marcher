package features.world.dungeonmap.service.projection;

import features.world.dungeonmap.model.domain.DungeonConceptPartyProfile;
import features.world.dungeonmap.model.domain.DungeonMap;
import features.world.dungeonmap.model.projection.DungeonConceptState;
import features.world.dungeonmap.repository.concept.DungeonConceptConnectionRepository;
import features.world.dungeonmap.repository.concept.DungeonConceptLevelRepository;
import features.world.dungeonmap.repository.concept.DungeonConceptNodePositionRepository;
import features.world.dungeonmap.repository.concept.DungeonConceptPartyProfileRepository;
import features.world.dungeonmap.repository.map.DungeonMapRepository;

import java.sql.Connection;
import java.sql.SQLException;

public final class DungeonConceptStateLoader {

    private DungeonConceptStateLoader() {
        throw new AssertionError("No instances");
    }

    public static DungeonConceptState load(Connection conn, long mapId) throws SQLException {
        DungeonMap map = DungeonMapRepository.findMap(conn, mapId)
                .orElseThrow(() -> new IllegalArgumentException("Unknown dungeon map: " + mapId));
        DungeonConceptPartyProfile partyProfile = DungeonConceptPartyProfileRepository.findByMap(conn, mapId)
                .orElse(new DungeonConceptPartyProfile(mapId, 4));
        var levels = DungeonConceptLevelRepository.getLevels(conn, mapId);
        var connections = DungeonConceptConnectionRepository.getConnections(conn, mapId);
        return new DungeonConceptState(
                map,
                partyProfile,
                levels,
                connections,
                DungeonConceptCanvasProjector.project(
                        levels,
                        connections,
                        DungeonConceptNodePositionRepository.getPositions(conn, mapId)));
    }
}
