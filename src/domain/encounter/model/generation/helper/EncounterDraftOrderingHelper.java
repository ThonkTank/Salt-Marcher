package src.domain.encounter.model.generation.helper;

import java.util.Collection;
import java.util.Comparator;
import java.util.List;
import src.domain.encounter.model.generation.model.EncounterDraft;
import src.domain.encounter.model.generation.model.EncounterDraftMetrics;

public final class EncounterDraftOrderingHelper {

    private EncounterDraftOrderingHelper() {
    }

    public static List<EncounterDraft> topDrafts(Collection<EncounterDraft> drafts, int limit) {
        return drafts.stream()
                .sorted(Comparator.comparingInt(EncounterDraftOrderingHelper::score).reversed()
                        .thenComparingInt(EncounterDraftOrderingHelper::targetDistance)
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
