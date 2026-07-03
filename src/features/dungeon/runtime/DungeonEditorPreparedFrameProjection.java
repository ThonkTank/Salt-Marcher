package src.features.dungeon.runtime;

import java.util.List;
import java.util.Objects;
import src.domain.dungeon.published.DungeonMapId;
import src.domain.dungeon.published.DungeonMapSummary;

final class DungeonEditorPreparedFrameProjection {
    private DungeonEditorPreparedFrameProjection() {
    }

    static DungeonEditorSelector<List<DungeonEditorPreparedFrameFacts.MapEntry>> mapEntriesSelector() {
        return DungeonEditorSelector.of(state -> toPreparedMapEntries(state.mapSummaries()));
    }

    static String statusTextFor(
            boolean surfaceLoaded,
            List<DungeonEditorPreparedFrameFacts.MapEntry> mapEntries,
            DungeonMapId selectedMapId,
            String selectedStatusText
    ) {
        String safeStatusText = selectedStatusText == null ? "" : selectedStatusText;
        if (surfaceLoaded) {
            return safeStatusText;
        }
        if (mapEntries.isEmpty()) {
            return "Keine Dungeon-Maps vorhanden.";
        }
        if (selectedMapId == null) {
            return "Kein Dungeon ausgewählt.";
        }
        return safeStatusText;
    }

    private static List<DungeonEditorPreparedFrameFacts.MapEntry> toPreparedMapEntries(
            List<DungeonMapSummary> mapSummaries
    ) {
        return mapSummaries.stream()
                .map(DungeonEditorPreparedFrameProjection::toPreparedMapEntry)
                .toList();
    }

    private static DungeonEditorPreparedFrameFacts.MapEntry toPreparedMapEntry(DungeonMapSummary summary) {
        DungeonMapSummary safeSummary = Objects.requireNonNull(summary, "summary");
        DungeonMapId mapId = safeSummary.mapId();
        return new DungeonEditorPreparedFrameFacts.MapEntry(
                keyOf(mapId),
                mapId == null ? 0L : mapId.value(),
                safeSummary.mapName(),
                safeSummary.revision());
    }

    private static String keyOf(DungeonMapId mapId) {
        return mapId == null ? "" : Long.toString(mapId.value());
    }
}
