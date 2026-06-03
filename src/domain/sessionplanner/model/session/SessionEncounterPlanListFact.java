package src.domain.sessionplanner.model.session;

import java.util.List;

public record SessionEncounterPlanListFact(
        boolean available,
        List<SessionSavedEncounterPlanFact> plans,
        String statusText
) {

    public SessionEncounterPlanListFact {
        plans = plans == null ? List.of() : List.copyOf(plans);
        statusText = statusText == null ? "" : statusText.trim();
    }
}
