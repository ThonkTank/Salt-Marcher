package src.domain.sessionplanner.session.aggregate;

import java.math.BigDecimal;
import java.util.List;

public record SessionPlan(
        long sessionId,
        List<Long> participantCharacterRefs,
        BigDecimal encounterDays,
        List<Long> orderedEncounterPlanRefs,
        List<BigDecimal> encounterBudgetPercentages,
        long selectedEncounterPlanRef,
        String selectionStatus
) {

    public SessionPlan {
        if (sessionId < 0L) {
            throw new IllegalArgumentException("sessionId must not be negative");
        }
        participantCharacterRefs = participantCharacterRefs == null ? List.of() : List.copyOf(participantCharacterRefs);
        orderedEncounterPlanRefs = orderedEncounterPlanRefs == null ? List.of() : List.copyOf(orderedEncounterPlanRefs);
        encounterBudgetPercentages =
                encounterBudgetPercentages == null ? List.of() : List.copyOf(encounterBudgetPercentages);
        encounterDays = encounterDays == null ? BigDecimal.ONE : encounterDays.stripTrailingZeros();
        if (encounterDays.signum() <= 0) {
            throw new IllegalArgumentException("encounterDays must be positive");
        }
        if (selectedEncounterPlanRef < 0L) {
            throw new IllegalArgumentException("selectedEncounterPlanRef must not be negative");
        }
        if (orderedEncounterPlanRefs.size() != encounterBudgetPercentages.size()) {
            throw new IllegalArgumentException("Encounter refs and budget percentages must align");
        }
        selectionStatus = selectionStatus == null ? "" : selectionStatus.trim();
    }
}
