package features.world.dungeonmap.service.projection;

import features.world.dungeonmap.model.domain.DungeonConnection;
import features.world.dungeonmap.model.domain.DungeonArea;
import features.world.dungeonmap.model.domain.DungeonFeature;
import features.world.dungeonmap.model.domain.DungeonFeatureTile;
import features.world.dungeonmap.model.domain.DungeonRoom;
import features.world.dungeonmap.model.domain.DungeonSquare;
import features.world.dungeonmap.model.projection.DungeonMapConnectionPath;
import features.world.dungeonmap.model.projection.DungeonMapState;
import features.world.dungeonmap.model.projection.index.DungeonMapIndex;
import features.world.dungeonmap.model.projection.index.DungeonRoomConnectionSummary;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class DungeonMapIndexBuilder {

    private DungeonMapIndexBuilder() {
        throw new AssertionError("No instances");
    }

    public static DungeonMapIndex build(DungeonMapState state) {
        if (state == null) {
            return DungeonMapIndex.empty();
        }

        Map<DungeonMapIndex.SquareCoordinate, DungeonSquare> squaresByCoordinate = new LinkedHashMap<>();
        Map<Long, DungeonSquare> squaresById = new LinkedHashMap<>();
        Map<Long, DungeonRoom> roomsById = indexById(state.rooms(), DungeonRoom::roomId);
        Map<Long, DungeonArea> areasById = indexById(state.areas(), DungeonArea::areaId);
        Map<Long, DungeonFeature> featuresById = indexById(state.features(), DungeonFeature::featureId);
        Map<Long, DungeonConnection> connectionsById = indexById(state.connections(), DungeonConnection::connectionId);

        Map<Long, List<DungeonSquare>> squaresByRoomId = new LinkedHashMap<>();
        for (DungeonSquare square : state.squares()) {
            squaresByCoordinate.put(new DungeonMapIndex.SquareCoordinate(square.x(), square.y()), square);
            if (square.squareId() != null) {
                squaresById.put(square.squareId(), square);
            }
            addGrouped(squaresByRoomId, square.roomId(), square);
        }

        Map<Long, List<DungeonRoom>> roomsByAreaId = new LinkedHashMap<>();
        for (DungeonRoom room : state.rooms()) {
            addGrouped(roomsByAreaId, room.areaId(), room);
        }

        Map<Long, List<DungeonFeatureTile>> featureTilesByFeatureId = new LinkedHashMap<>();
        Map<Long, List<DungeonFeature>> featuresBySquareId = new LinkedHashMap<>();
        for (DungeonFeatureTile tile : state.featureTiles()) {
            addGrouped(featureTilesByFeatureId, tile.featureId(), tile);
            DungeonFeature feature = featuresById.get(tile.featureId());
            if (feature != null) {
                addGrouped(featuresBySquareId, tile.squareId(), feature);
            }
        }

        Map<Long, List<DungeonRoomConnectionSummary>> roomConnectionsByRoomId = new LinkedHashMap<>();
        for (DungeonMapConnectionPath connectionPath : state.roomConnections()) {
            addRoomConnectionGrouping(roomConnectionsByRoomId, connectionPath.fromRoomId(), connectionPath);
            addRoomConnectionGrouping(roomConnectionsByRoomId, connectionPath.toRoomId(), connectionPath);
        }

        return new DungeonMapIndex(
                Map.copyOf(squaresByCoordinate),
                Map.copyOf(squaresById),
                Map.copyOf(roomsById),
                Map.copyOf(areasById),
                Map.copyOf(featuresById),
                Map.copyOf(connectionsById),
                immutableGroupedMap(featuresBySquareId),
                immutableGroupedMap(squaresByRoomId),
                immutableGroupedMap(roomsByAreaId),
                immutableGroupedMap(featureTilesByFeatureId),
                immutableGroupedMap(roomConnectionsByRoomId));
    }

    private static void addRoomConnectionGrouping(
            Map<Long, List<DungeonRoomConnectionSummary>> roomConnectionsByRoomId,
            Long roomId,
            DungeonMapConnectionPath connectionPath
    ) {
        if (roomId == null || connectionPath == null || connectionPath.connectionId() == null) {
            return;
        }
        Long counterpartRoomId = roomId.equals(connectionPath.fromRoomId())
                ? connectionPath.toRoomId()
                : connectionPath.fromRoomId();
        addGroupedUnique(roomConnectionsByRoomId, roomId, new DungeonRoomConnectionSummary(connectionPath.connectionId(), counterpartRoomId));
    }

    private static <K, V> void addGrouped(Map<K, List<V>> grouped, K key, V value) {
        if (key == null || value == null) {
            return;
        }
        grouped.computeIfAbsent(key, ignored -> new ArrayList<>()).add(value);
    }

    private static <K, V> void addGroupedUnique(Map<K, List<V>> grouped, K key, V value) {
        if (key == null || value == null) {
            return;
        }
        List<V> values = grouped.computeIfAbsent(key, ignored -> new ArrayList<>());
        if (!values.contains(value)) {
            values.add(value);
        }
    }

    private static <K, V> Map<K, List<V>> immutableGroupedMap(Map<K, List<V>> grouped) {
        Map<K, List<V>> immutable = new LinkedHashMap<>();
        for (Map.Entry<K, List<V>> entry : grouped.entrySet()) {
            immutable.put(entry.getKey(), List.copyOf(entry.getValue()));
        }
        return Map.copyOf(immutable);
    }

    private static <T> Map<Long, T> indexById(List<T> items, java.util.function.Function<T, Long> idExtractor) {
        Map<Long, T> indexed = new LinkedHashMap<>();
        for (T item : items) {
            Long id = idExtractor.apply(item);
            if (id != null) {
                indexed.put(id, item);
            }
        }
        return indexed;
    }
}
