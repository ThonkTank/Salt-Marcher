package features.encounter.application;

import features.encounter.domain.plan.EncounterPlanSummary;
import java.util.List;

/** Application-owned port for one bounded saved-plan chooser query. */
public interface SavedEncounterPlanSearchRepository {

    SearchRead searchSavedPlans(String normalizedQuery, int rootLimit);

    record SearchRead(List<EncounterPlanSummary> plans, int statementCount) {
        public SearchRead {
            plans = plans == null ? List.of() : List.copyOf(plans);
            if (statementCount < 0) {
                throw new IllegalArgumentException("statementCount must be nonnegative");
            }
        }
    }
}
