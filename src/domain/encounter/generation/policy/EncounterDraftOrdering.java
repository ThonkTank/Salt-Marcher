package src.domain.encounter.generation.policy;

import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import src.domain.encounter.generation.value.EncounterDraft;
import src.domain.encounter.generation.value.EncounterDraftMetrics;

public final class EncounterDraftOrdering {

    private EncounterDraftOrdering() {
    }

    public static List<EncounterDraft> topDrafts(Collection<EncounterDraft> drafts, int limit) {
        return drafts.stream()
                .sorted(Comparator.comparingInt(EncounterDraftOrdering::score).reversed()
                        .thenComparingInt(EncounterDraftOrdering::targetDistance)
                        .thenComparing(EncounterDraft::title, String.CASE_INSENSITIVE_ORDER))
                .limit(limit)
                .toList();
    }

    private static int score(EncounterDraft draft) {
        return draft.metrics().score();
    }

    private static int targetDistance(EncounterDraft draft) {
        EncounterDraftMetrics metrics = draft.metrics();
        return Math.abs(metrics.adjustedXp() - metrics.targetAdjustedXp());
    }
}
