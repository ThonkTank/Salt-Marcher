package src.view.leftbartabs.dungeoneditor;

import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.published.DungeonEditorTopologyElementRef;
import src.domain.dungeon.published.DungeonInspectorSnapshot;
import src.features.dungeon.runtime.DungeonEditorPreparedFrameFacts;
import src.features.dungeon.runtime.DungeonEditorStatePanelStairGeometryDrafts;

final class DungeonEditorStateStairGeometryContentPartModel {
    private static final String STAIR_KIND = "STAIR";

    DungeonEditorStateContentModel.@Nullable StairGeometryProjection stairGeometryProjection(
            DungeonEditorPreparedFrameFacts.StatePanelFrame frame
    ) {
        DungeonEditorPreparedFrameFacts.StatePanelFrame safeFrame = frame == null
                ? DungeonEditorPreparedFrameFacts.StatePanelFrame.empty()
                : frame;
        DungeonEditorTopologyElementRef topologyRef = safeFrame.selectionTopologyRef() == null
                ? DungeonEditorTopologyElementRef.empty()
                : safeFrame.selectionTopologyRef();
        DungeonInspectorSnapshot inspector = safeFrame.inspector();
        long stairId = selectedStairId(topologyRef);
        if (stairId <= 0L || inspector == null) {
            return null;
        }
        StairGeometryFacts facts = StairGeometryFacts.from(inspector.facts());
        if (facts == null) {
            return null;
        }
        StairGeometryFacts draft = currentStairGeometryFacts(safeFrame.stairGeometryDraft(), stairId, facts);
        String label = inspector.title().isBlank() ? "Treppe " + stairId : inspector.title();
        return new DungeonEditorStateContentModel.StairGeometryProjection(
                stairId,
                label,
                draft.shapeName(),
                draft.directionName(),
                draft.dimension1(),
                draft.dimension2());
    }

    private static long selectedStairId(DungeonEditorTopologyElementRef topologyRef) {
        DungeonEditorTopologyElementRef safeTopologyRef = topologyRef == null
                ? DungeonEditorTopologyElementRef.empty()
                : topologyRef;
        return STAIR_KIND.equals(safeTopologyRef.kind()) ? safeTopologyRef.id() : 0L;
    }

    private static StairGeometryFacts currentStairGeometryFacts(
            DungeonEditorStatePanelStairGeometryDrafts.Draft runtimeDraft,
            long stairId,
            StairGeometryFacts fallback
    ) {
        DungeonEditorStatePanelStairGeometryDrafts.Draft safeDraft = runtimeDraft == null
                ? DungeonEditorStatePanelStairGeometryDrafts.Draft.empty()
                : runtimeDraft;
        if (!runtimeStairDraftMatches(safeDraft, stairId)) {
            return fallback;
        }
        return new StairGeometryFacts(
                safeDraft.shapeName(),
                safeDraft.directionName(),
                safeDraft.dimension1(),
                safeDraft.dimension2());
    }

    private static boolean runtimeStairDraftMatches(
            DungeonEditorStatePanelStairGeometryDrafts.Draft runtimeDraft,
            long stairId
    ) {
        return runtimeDraft.present() && runtimeDraft.targetPresent() && runtimeDraft.stairId() == stairId;
    }

    private static Map<String, String> factMap(List<String> facts) {
        Map<String, String> values = new HashMap<>();
        for (String fact : facts == null ? List.<String>of() : facts) {
            int separator = fact.indexOf(':');
            if (separator > 0) {
                values.put(
                        fact.substring(0, separator).strip().toLowerCase(Locale.ROOT),
                        fact.substring(separator + 1).strip());
            }
        }
        return values;
    }

    private record StairGeometryFacts(
            String shapeName,
            String directionName,
            String dimension1,
            String dimension2
    ) {
        StairGeometryFacts {
            shapeName = shapeName == null || shapeName.isBlank() ? "STRAIGHT" : shapeName.strip();
            directionName = directionName == null || directionName.isBlank() ? "NORTH" : directionName.strip();
            dimension1 = dimension1 == null ? "" : dimension1.strip();
            dimension2 = dimension2 == null ? "" : dimension2.strip();
        }

        private static @Nullable StairGeometryFacts from(List<String> facts) {
            Map<String, String> values = factMap(facts);
            String shape = values.get("shape");
            String direction = values.get("direction");
            String dimension1 = values.get("dimension1");
            String dimension2 = values.get("dimension2");
            if (shape == null || direction == null || dimension1 == null || dimension2 == null) {
                return null;
            }
            return new StairGeometryFacts(shape, direction, dimension1, dimension2);
        }
    }
}
