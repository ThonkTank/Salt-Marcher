package src.domain.sessionplanner.model.session.helper;

import java.util.List;
import src.domain.sessionplanner.model.session.model.EncounterDays;
import src.domain.sessionplanner.model.session.model.SessionPlan;

public final class SessionPlanSeedHelper {

    private SessionPlanSeedHelper() {
    }

    public static SessionPlan createSeeded(long sessionId, boolean activePartyAvailable, List<Long> participantRefs) {
        if (!activePartyAvailable) {
            return createSeeded(sessionId, List.of());
        }
        return createSeeded(sessionId, participantRefs);
    }

    public static SessionPlan createSeeded(long sessionId, List<Long> participantRefs) {
        return SessionPlan.seeded(sessionId, participantRefs == null ? List.of() : participantRefs, EncounterDays.one());
    }
}
