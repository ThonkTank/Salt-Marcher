package src.domain.encounter.model.session;

import java.util.List;
import src.domain.encounter.model.plan.EncounterPlanSummary;

public record ListPlansOutcome(boolean success, List<EncounterPlanSummary> plans, String message) {
    public ListPlansOutcome {
        plans = plans == null ? List.of() : List.copyOf(plans);
        message = message == null ? "" : message;
    }
}
