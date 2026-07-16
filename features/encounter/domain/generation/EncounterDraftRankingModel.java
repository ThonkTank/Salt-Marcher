package features.encounter.domain.generation;

import java.util.ArrayList;
import java.util.Collection;
import java.util.List;

final class EncounterDraftRankingModel {

    private EncounterDraftRankingModel() {
    }

    static List<EncounterDraft> topDrafts(Collection<EncounterDraft> drafts, int limit) {
        List<EncounterDraft> sortedDrafts = new ArrayList<>(drafts);
        sortedDrafts.sort(EncounterDraftRankingModel::compareDraftRanks);
        if (sortedDrafts.size() <= limit) {
            return List.copyOf(sortedDrafts);
        }
        return List.copyOf(sortedDrafts.subList(0, Math.max(0, limit)));
    }

    private static int score(EncounterDraft draft) {
        return draft.metrics().score();
    }

    private static int targetDistance(EncounterDraft draft) {
        EncounterDraftMetrics metrics = draft.metrics();
        return Math.abs(metrics.adjustedXp() - metrics.targetAdjustedXp());
    }

    private static int compareDraftRanks(EncounterDraft left, EncounterDraft right) {
        int scoreComparison = Integer.compare(score(right), score(left));
        if (scoreComparison != 0) {
            return scoreComparison;
        }
        int distanceComparison = Integer.compare(targetDistance(left), targetDistance(right));
        if (distanceComparison != 0) {
            return distanceComparison;
        }
        return String.CASE_INSENSITIVE_ORDER.compare(left.title(), right.title());
    }
}
