package src.domain.encounter.model.session;

import java.util.Optional;
import src.domain.encounter.model.plan.EncounterPlan;

public record PlanOutcome(Optional<EncounterPlan> plan, String message) {
    public PlanOutcome {
        plan = plan == null ? Optional.empty() : plan;
        message = message == null ? "" : message;
    }

    public boolean success() {
        return plan.isPresent();
    }
}
