package features.world.dungeonmap.service.projection;

import features.world.dungeonmap.model.domain.DungeonArea;
import features.world.dungeonmap.model.domain.DungeonEndpoint;
import features.world.dungeonmap.model.domain.DungeonFeature;
import features.world.dungeonmap.model.domain.DungeonFeatureTile;
import features.world.dungeonmap.model.domain.DungeonLink;
import features.world.dungeonmap.model.domain.DungeonLinkAnchor;
import features.world.dungeonmap.model.domain.DungeonPassage;
import features.world.dungeonmap.model.domain.DungeonRoom;
import features.world.dungeonmap.model.domain.DungeonSquare;
import features.world.dungeonmap.model.domain.PassageDirection;
import features.world.dungeonmap.model.projection.DungeonMapState;
import features.world.dungeonmap.model.projection.index.DungeonMapIndex;

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
        Map<Long, DungeonEndpoint> endpointsById = indexById(state.endpoints(), DungeonEndpoint::endpointId);
        Map<Long, DungeonPassage> passagesById = indexById(state.passages(), DungeonPassage::passageId);

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

        Map<Long, List<DungeonEndpoint>> endpointsByRoomId = new LinkedHashMap<>();
        for (DungeonEndpoint endpoint : state.endpoints()) {
            DungeonSquare square = endpoint.squareId() == null
                    ? squaresByCoordinate.get(new DungeonMapIndex.SquareCoordinate(endpoint.x(), endpoint.y()))
                    : squaresById.get(endpoint.squareId());
            if (square != null) {
                addGrouped(endpointsByRoomId, square.roomId(), endpoint);
            }
        }

        Map<Long, List<DungeonPassage>> passagesByRoomId = new LinkedHashMap<>();
        for (DungeonPassage passage : state.passages()) {
            addPassageRoomGrouping(passagesByRoomId, squaresByCoordinate, passage, passage.x(), passage.y());
            if (passage.direction() == PassageDirection.EAST) {
                addPassageRoomGrouping(passagesByRoomId, squaresByCoordinate, passage, passage.x() + 1, passage.y());
            } else if (passage.direction() == PassageDirection.SOUTH) {
                addPassageRoomGrouping(passagesByRoomId, squaresByCoordinate, passage, passage.x(), passage.y() + 1);
            }
        }

        Map<DungeonLinkAnchor, List<DungeonLink>> linksByAnchor = new LinkedHashMap<>();
        for (DungeonLink link : state.links()) {
            addGrouped(linksByAnchor, link.fromAnchor(), link);
            addGrouped(linksByAnchor, link.toAnchor(), link);
        }

        return new DungeonMapIndex(
                Map.copyOf(squaresByCoordinate),
                Map.copyOf(squaresById),
                Map.copyOf(roomsById),
                Map.copyOf(areasById),
                Map.copyOf(featuresById),
                Map.copyOf(endpointsById),
                Map.copyOf(passagesById),
                immutableGroupedMap(featuresBySquareId),
                immutableGroupedMap(squaresByRoomId),
                immutableGroupedMap(roomsByAreaId),
                immutableGroupedMap(featureTilesByFeatureId),
                immutableGroupedMap(endpointsByRoomId),
                immutableGroupedMap(passagesByRoomId),
                immutableGroupedMap(linksByAnchor));
    }

    private static void addPassageRoomGrouping(
            Map<Long, List<DungeonPassage>> passagesByRoomId,
            Map<DungeonMapIndex.SquareCoordinate, DungeonSquare> squaresByCoordinate,
            DungeonPassage passage,
            int x,
            int y
    ) {
        DungeonSquare square = squaresByCoordinate.get(new DungeonMapIndex.SquareCoordinate(x, y));
        if (square != null) {
            addGroupedUnique(passagesByRoomId, square.roomId(), passage);
        }
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
