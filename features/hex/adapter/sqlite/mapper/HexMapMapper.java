package features.hex.adapter.sqlite.mapper;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import features.hex.adapter.sqlite.model.HexMapRecord;
import features.hex.adapter.sqlite.model.HexMapSnapshotRecord;
import features.hex.adapter.sqlite.model.HexMarkerRecord;
import features.hex.adapter.sqlite.model.HexTerrainOverrideRecord;
import features.hex.adapter.sqlite.model.HexTileRecord;
import features.hex.domain.map.HexCoordinate;
import features.hex.domain.map.HexMap;
import features.hex.domain.map.HexMapIdentity;
import features.hex.domain.map.HexMapSummary;
import features.hex.domain.map.HexMarker;
import features.hex.domain.map.HexMarkerIdentity;
import features.hex.domain.map.HexMarkerKind;
import features.hex.domain.map.HexTerrain;

public final class HexMapMapper {

    private HexMapMapper() {
    }

    public static HexMap toDomain(HexMapSnapshotRecord snapshot) {
        Objects.requireNonNull(snapshot, "snapshot");
        HexMapRecord map = snapshot.map();
        validateTiles(map, snapshot.tiles());
        return new HexMap(
                new HexMapIdentity(map.mapId()),
                map.displayName(),
                map.radius(),
                terrainOverrides(map, snapshot.terrainOverrides()),
                markers(map, snapshot.markers()));
    }

    public static HexMapSummary toSummary(HexMapRecord record) {
        Objects.requireNonNull(record, "record");
        return new HexMapSummary(
                new HexMapIdentity(record.mapId()),
                record.displayName(),
                record.radius());
    }

    public static HexMapSnapshotRecord toSnapshot(HexMap map) {
        Objects.requireNonNull(map, "map");
        long mapId = map.mapId().value();
        return new HexMapSnapshotRecord(
                new HexMapRecord(mapId, map.displayName(), map.radius()),
                map.coordinates().stream()
                        .map(coordinate -> new HexTileRecord(mapId, coordinate.q(), coordinate.r()))
                        .toList(),
                map.terrainOverrides().entrySet().stream()
                        .map(entry -> new HexTerrainOverrideRecord(
                                mapId,
                                entry.getKey().q(),
                                entry.getKey().r(),
                                entry.getValue().name()))
                        .toList(),
                map.markers().stream()
                        .map(marker -> new HexMarkerRecord(
                                mapId,
                                marker.markerId().value(),
                                marker.coordinate().q(),
                                marker.coordinate().r(),
                                marker.name(),
                                marker.type().name(),
                                marker.note()))
                        .toList());
    }

    public static HexMarkerRecord toMarkerRecord(HexMapIdentity mapId, HexMarker marker) {
        Objects.requireNonNull(mapId, "mapId");
        Objects.requireNonNull(marker, "marker");
        return new HexMarkerRecord(
                mapId.value(),
                marker.markerId().value(),
                marker.coordinate().q(),
                marker.coordinate().r(),
                marker.name(),
                marker.type().name(),
                marker.note());
    }

    private static void validateTiles(HexMapRecord map, List<HexTileRecord> tiles) {
        HexMap generatedMap = HexMap.create(new HexMapIdentity(map.mapId()), map.displayName(), map.radius());
        Set<HexCoordinate> expected = Set.copyOf(generatedMap.coordinates());
        Set<HexCoordinate> stored = tiles.stream()
                .map(tile -> {
                    requireMapId(map, tile.mapId(), "tile");
                    return new HexCoordinate(tile.q(), tile.r());
                })
                .collect(Collectors.toSet());
        if (!stored.equals(expected)) {
            throw new IllegalStateException("Stored Hex tile coordinates do not match map radius.");
        }
    }

    private static Map<HexCoordinate, HexTerrain> terrainOverrides(
            HexMapRecord map,
            List<HexTerrainOverrideRecord> records
    ) {
        Map<HexCoordinate, HexTerrain> terrainOverrides = new LinkedHashMap<>();
        for (HexTerrainOverrideRecord record : records) {
            requireMapId(map, record.mapId(), "terrain override");
            HexCoordinate coordinate = requireInside(map, record.q(), record.r(), "terrain override");
            terrainOverrides.put(coordinate, HexTerrain.valueOf(record.terrain()));
        }
        return Map.copyOf(terrainOverrides);
    }

    private static List<HexMarker> markers(HexMapRecord map, List<HexMarkerRecord> records) {
        return records.stream()
                .map(record -> marker(map, record))
                .toList();
    }

    private static HexMarker marker(HexMapRecord map, HexMarkerRecord record) {
        requireMapId(map, record.mapId(), "marker");
        return new HexMarker(
                new HexMarkerIdentity(record.markerId()),
                requireInside(map, record.q(), record.r(), "marker"),
                record.name(),
                HexMarkerKind.valueOf(record.markerType()),
                record.note());
    }

    private static HexCoordinate requireInside(
            HexMapRecord map,
            int q,
            int r,
            String recordType
    ) {
        HexCoordinate coordinate = new HexCoordinate(q, r);
        if (!coordinate.insideRadius(map.radius())) {
            throw new IllegalStateException("Stored Hex " + recordType + " coordinate is outside map radius.");
        }
        return coordinate;
    }

    private static void requireMapId(HexMapRecord map, long recordMapId, String recordType) {
        if (recordMapId != map.mapId()) {
            throw new IllegalStateException("Stored Hex " + recordType + " belongs to a different map.");
        }
    }
}
