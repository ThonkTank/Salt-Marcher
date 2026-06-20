package src.features.dungeon.runtime;

import java.util.Locale;
import src.domain.dungeon.published.DungeonInspectorSnapshot;

final class DungeonEditorTransitionLinkCommitEvidence {
    private static final String DUNGEON_MAP_DESTINATION = "DUNGEON_MAP";
    private static final String DESTINATION_TYPE_FACT = "destinationtype";
    private static final String DESTINATION_MAP_ID_FACT = "destinationmapid";
    private static final String DESTINATION_TRANSITION_ID_FACT = "destinationtransitionid";

    private String destinationType = "";
    private String destinationMapId = "";
    private String destinationTransitionId = "";

    private DungeonEditorTransitionLinkCommitEvidence() {
    }

    static boolean matches(DungeonInspectorSnapshot inspector, long targetMapId, long targetTransitionId) {
        if (inspector == null || targetMapId <= 0L || targetTransitionId <= 0L) {
            return false;
        }
        return from(inspector).matches(targetMapId, targetTransitionId);
    }

    private static DungeonEditorTransitionLinkCommitEvidence from(DungeonInspectorSnapshot inspector) {
        DungeonEditorTransitionLinkCommitEvidence evidence = new DungeonEditorTransitionLinkCommitEvidence();
        for (String fact : inspector.facts()) {
            evidence.applyFact(fact);
        }
        return evidence;
    }

    private void applyFact(String fact) {
        if (fact == null) {
            return;
        }
        int separator = fact.indexOf(':');
        if (separator <= 0) {
            return;
        }
        applyFactValue(
                fact.substring(0, separator).strip().toLowerCase(Locale.ROOT),
                fact.substring(separator + 1).strip());
    }

    private void applyFactValue(String key, String value) {
        if (DESTINATION_TYPE_FACT.equals(key)) {
            destinationType = value;
        } else if (DESTINATION_MAP_ID_FACT.equals(key)) {
            destinationMapId = value;
        } else if (DESTINATION_TRANSITION_ID_FACT.equals(key)) {
            destinationTransitionId = value;
        }
    }

    private boolean matches(long targetMapId, long targetTransitionId) {
        return DUNGEON_MAP_DESTINATION.equals(destinationType)
                && Long.toString(targetMapId).equals(destinationMapId)
                && Long.toString(targetTransitionId).equals(destinationTransitionId);
    }
}
