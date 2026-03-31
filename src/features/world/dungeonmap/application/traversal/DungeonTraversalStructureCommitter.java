package features.world.dungeonmap.application.traversal;

import features.world.dungeonmap.model.structures.corridor.Corridor;
import features.world.dungeonmap.model.structures.stair.DungeonStair;
import features.world.dungeonmap.model.structures.traversal.Traversal;
import features.world.dungeonmap.model.structures.traversal.TraversalRoute;
import features.world.dungeonmap.model.structures.traversal.TraversalSegmentRefs;
import features.world.dungeonmap.persistence.DungeonCorridorWriteRepository;
import features.world.dungeonmap.persistence.DungeonStairWriteRepository;
import features.world.dungeonmap.persistence.DungeonTraversalWriteRepository;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

public final class DungeonTraversalStructureCommitter {

    private final DungeonTraversalWriteRepository traversalWriteRepository;
    private final DungeonCorridorWriteRepository corridorWriteRepository;
    private final DungeonStairWriteRepository stairWriteRepository;

    public DungeonTraversalStructureCommitter(
            DungeonTraversalWriteRepository traversalWriteRepository,
            DungeonCorridorWriteRepository corridorWriteRepository,
            DungeonStairWriteRepository stairWriteRepository
    ) {
        this.traversalWriteRepository = Objects.requireNonNull(traversalWriteRepository, "traversalWriteRepository");
        this.corridorWriteRepository = Objects.requireNonNull(corridorWriteRepository, "corridorWriteRepository");
        this.stairWriteRepository = Objects.requireNonNull(stairWriteRepository, "stairWriteRepository");
    }

    public TraversalSegmentRefs persistStructures(
            Connection conn,
            Traversal traversal,
            TraversalRoute traversalRoute
    ) throws SQLException {
        if (traversal == null || traversal.traversalId() == null) {
            return TraversalSegmentRefs.empty();
        }
        TraversalRoute routeToPersist = traversalRoute == null ? TraversalRoute.empty() : traversalRoute;
        Map<String, Long> corridorIdsBySegmentKey = persistCorridorSegments(conn, traversal, routeToPersist);
        Map<String, Long> stairIdsBySegmentKey = persistStairSegments(conn, traversal, routeToPersist);
        return TraversalSegmentRefs.ofCorridorAndStairIds(corridorIdsBySegmentKey, stairIdsBySegmentKey);
    }

    public void deleteStructuresForTraversal(Connection conn, long traversalId) throws SQLException {
        for (Long corridorId : traversalWriteRepository.deleteTraversalCorridorSegments(conn, traversalId)) {
            if (corridorId != null) {
                corridorWriteRepository.deleteCorridor(conn, corridorId);
            }
        }
        for (Long stairId : traversalWriteRepository.deleteTraversalStairSegments(conn, traversalId)) {
            if (stairId != null) {
                stairWriteRepository.deleteStair(conn, stairId);
            }
        }
    }

    private Map<String, Long> persistCorridorSegments(
            Connection conn,
            Traversal traversal,
            TraversalRoute traversalRoute
    ) throws SQLException {
        LinkedHashMap<String, Long> desiredSegmentRefs = new LinkedHashMap<>();
        for (TraversalRoute.CorridorSegment corridorSegment : traversalRoute.corridorSegments()) {
            if (corridorSegment == null || corridorSegment.corridor() == null) {
                continue;
            }
            Corridor corridor = corridorSegment.corridor();
            Long corridorId = corridor.corridorId();
            if (corridorId == null) {
                corridorId = corridorWriteRepository.insertCorridor(conn, traversal.mapId(), corridor);
            } else {
                corridorWriteRepository.updateCorridor(conn, corridorId, corridor);
            }
            corridorWriteRepository.replacePoints(conn, corridorId, corridor.points());
            corridorWriteRepository.replaceEndpointBindings(conn, corridorId, corridor.endpointBindings());
            desiredSegmentRefs.put(corridorSegment.segmentKey(), corridorId);
        }
        List<Long> removedCorridorIds = traversalWriteRepository.replaceTraversalCorridorSegments(
                conn,
                traversal.traversalId(),
                desiredSegmentRefs);
        for (Long corridorId : removedCorridorIds) {
            if (corridorId != null) {
                corridorWriteRepository.deleteCorridor(conn, corridorId);
            }
        }
        return desiredSegmentRefs.isEmpty() ? Map.of() : Map.copyOf(desiredSegmentRefs);
    }

    private Map<String, Long> persistStairSegments(
            Connection conn,
            Traversal traversal,
            TraversalRoute traversalRoute
    ) throws SQLException {
        LinkedHashMap<String, Long> desiredSegmentRefs = new LinkedHashMap<>();
        for (TraversalRoute.StairSegment stairSegment : traversalRoute.stairSegments()) {
            if (stairSegment == null || stairSegment.stair() == null) {
                continue;
            }
            DungeonStair stair = stairSegment.stair();
            Long stairId = stair.stairId();
            if (stairId == null) {
                stairId = stairWriteRepository.insertStair(conn, traversal.mapId(), stair);
            } else {
                stairWriteRepository.updateStair(conn, stairId, stair);
            }
            stairWriteRepository.replacePathNodes(conn, stairId, stair.path());
            stairWriteRepository.replaceExits(conn, stairId, stair.exits());
            desiredSegmentRefs.put(stairSegment.segmentKey(), stairId);
        }
        List<Long> removedStairIds = traversalWriteRepository.replaceTraversalStairSegments(
                conn,
                traversal.traversalId(),
                desiredSegmentRefs);
        for (Long stairId : removedStairIds) {
            if (stairId != null) {
                stairWriteRepository.deleteStair(conn, stairId);
            }
        }
        return desiredSegmentRefs.isEmpty() ? Map.of() : Map.copyOf(desiredSegmentRefs);
    }
}
