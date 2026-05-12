package src.domain.sessionplanner.model.session.port;

import java.util.List;
import src.domain.sessionplanner.model.session.model.SessionEncounterPlanFact;

public interface SessionEncounterFactsPort {

    EncounterPlanListFact encounterPlans();

    SessionEncounterPlanFact encounterPlan(long encounterPlanId);

    record EncounterPlanListFact(
            boolean available,
            List<SavedEncounterPlanFact> plans,
            String statusText
    ) {

        public EncounterPlanListFact {
            plans = plans == null ? List.of() : List.copyOf(plans);
            statusText = statusText == null ? "" : statusText.trim();
        }
    }

    record SavedEncounterPlanFact(
            long planId,
            String name,
            String summaryText
    ) {

        public SavedEncounterPlanFact {
            planId = Math.max(0L, planId);
            name = name == null ? "" : name.trim();
            summaryText = summaryText == null ? "" : summaryText.trim();
        }
    }

}
