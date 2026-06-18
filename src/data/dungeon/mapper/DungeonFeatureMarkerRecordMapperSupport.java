package src.data.dungeon.mapper;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import src.data.dungeon.model.DungeonFeatureMarkerRecord;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.structure.DungeonMapIdentity;
import src.domain.dungeon.model.core.structure.feature.FeatureMarker;
import src.domain.dungeon.model.core.structure.feature.FeatureMarkerCatalog;
import src.domain.dungeon.model.core.structure.feature.FeatureMarkerKind;

final class DungeonFeatureMarkerRecordMapperSupport {

    private DungeonFeatureMarkerRecordMapperSupport() {
    }

    static FeatureMarkerCatalog toFeatureMarkers(List<DungeonFeatureMarkerRecord> records) {
        List<FeatureMarker> result = new ArrayList<>();
        for (DungeonFeatureMarkerRecord record
                : records == null ? List.<DungeonFeatureMarkerRecord>of() : records) {
            FeatureMarkerKind kind = validMarkerKind(record);
            String label = validLabel(record);
            result.add(new FeatureMarker(
                    record.markerId(),
                    new DungeonMapIdentity(record.mapId()),
                    kind,
                    new Cell(record.cellX(), record.cellY(), record.levelZ()),
                    label,
                    validDescription(record)));
        }
        return new FeatureMarkerCatalog(result);
    }

    static List<DungeonFeatureMarkerRecord> toFeatureMarkerRecords(long mapId, FeatureMarkerCatalog featureMarkers) {
        List<DungeonFeatureMarkerRecord> result = new ArrayList<>();
        for (FeatureMarker marker
                : featureMarkers == null ? List.<FeatureMarker>of() : featureMarkers.markers()) {
            result.add(new DungeonFeatureMarkerRecord(
                    marker.markerId(),
                    mapId,
                    marker.kind().name(),
                    marker.anchor().q(),
                    marker.anchor().r(),
                    marker.anchor().level(),
                    marker.label(),
                    marker.description()));
        }
        return List.copyOf(result);
    }

    private static FeatureMarkerKind validMarkerKind(DungeonFeatureMarkerRecord record) {
        FeatureMarkerKind markerKind = markerKind(record.markerKind());
        if (markerKind == null) {
            throw malformed(record, "marker_kind");
        }
        return markerKind;
    }

    private static String validLabel(DungeonFeatureMarkerRecord record) {
        if (record.label() == null || record.label().isBlank()) {
            throw malformed(record, "label");
        }
        return record.label();
    }

    private static String validDescription(DungeonFeatureMarkerRecord record) {
        if (record.description() == null) {
            throw malformed(record, "description");
        }
        return record.description();
    }

    private static IllegalArgumentException malformed(DungeonFeatureMarkerRecord record, String fieldName) {
        long mapId = record == null ? 0L : record.mapId();
        long markerId = record == null ? 0L : record.markerId();
        return new IllegalArgumentException(
                "Malformed feature marker row: " + fieldName
                        + " mapId=" + mapId
                        + " markerId=" + markerId);
    }

    private static FeatureMarkerKind markerKind(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return FeatureMarkerKind.valueOf(value.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            return null;
        }
    }
}
