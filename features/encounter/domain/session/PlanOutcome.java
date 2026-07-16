package features.encounter.domain.session;

import java.util.Optional;
import features.encounter.domain.plan.EncounterPlan;

public record PlanOutcome(Optional<EncounterPlan> plan, String message) {
    public PlanOutcome {
        plan = plan == null ? Optional.empty() : plan;
        message = message == null ? "" : message;
    }

    public boolean success() {
        return plan.isPresent();
    }
}
