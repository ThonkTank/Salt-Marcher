package src.view.leftbartabs.sessionplanner;

import java.math.BigDecimal;

public record SessionPlannerTimelineMainViewInputEvent(
        long selectedEncounterToken,
        long allocationEncounterToken,
        BigDecimal targetAllocationPercentage,
        long moveEncounterToken,
        int moveDirection,
        long encounterTokenToRemove,
        long restLeftEncounterId,
        long restRightEncounterId,
        String restSelection,
        long lootEncounterTokenToAdd,
        long lootTokenToRemove
) {

    public SessionPlannerTimelineMainViewInputEvent {
        selectedEncounterToken = Math.max(0L, selectedEncounterToken);
        allocationEncounterToken = Math.max(0L, allocationEncounterToken);
        targetAllocationPercentage = targetAllocationPercentage == null
                ? BigDecimal.ZERO
                : targetAllocationPercentage;
        moveEncounterToken = Math.max(0L, moveEncounterToken);
        moveDirection = Integer.compare(moveDirection, 0);
        encounterTokenToRemove = Math.max(0L, encounterTokenToRemove);
        restLeftEncounterId = Math.max(0L, restLeftEncounterId);
        restRightEncounterId = Math.max(0L, restRightEncounterId);
        restSelection = restSelection == null ? "" : restSelection.trim();
        lootEncounterTokenToAdd = Math.max(0L, lootEncounterTokenToAdd);
        lootTokenToRemove = Math.max(0L, lootTokenToRemove);
    }
}
