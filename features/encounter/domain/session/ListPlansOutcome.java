package features.encounter.domain.session;

import java.util.List;
import features.encounter.domain.plan.EncounterPlanSummary;

public record ListPlansOutcome(boolean success, List<EncounterPlanSummary> plans, String message) {
    public ListPlansOutcome {
        plans = plans == null ? List.of() : List.copyOf(plans);
        message = message == null ? "" : message;
    }
}
