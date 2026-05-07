package src.view.leftbartabs.sessionplanner;

import java.math.BigDecimal;
import org.jspecify.annotations.Nullable;

final class SessionPlannerPublishedEventFactory {

    private SessionPlannerPublishedEventFactory() {
    }

    static @Nullable SessionPlannerPublishedEvent fromInput(@Nullable SessionPlannerViewInputEvent event) {
        return event == null ? null : fromInput(event.input());
    }

    private static @Nullable SessionPlannerPublishedEvent fromInput(SessionPlannerViewInputEvent.Input input) {
        return switch (input) {
            case SessionPlannerViewInputEvent.SimpleActionInput simple -> new SessionPlannerPublishedEvent(simple);
            case SessionPlannerViewInputEvent.ParticipantInput participant ->
                    participant.change().hasCharacterId() ? new SessionPlannerPublishedEvent(participant) : null;
            case SessionPlannerViewInputEvent.EncounterDaysInput encounterDays ->
                    encounterDaysEvent(encounterDays.encounterDaysText());
            case SessionPlannerViewInputEvent.AttachPlanInput attachPlan ->
                    attachPlan.plan().isResolved() ? new SessionPlannerPublishedEvent(attachPlan) : null;
            case SessionPlannerViewInputEvent.EncounterActionInput encounter ->
                    encounter.encounter().isResolved() ? new SessionPlannerPublishedEvent(encounter) : null;
            case SessionPlannerViewInputEvent.EncounterAllocationInput allocation ->
                    allocation.change().hasResolvedEncounter() && allocation.change().budgetPercentage() != null
                            ? new SessionPlannerPublishedEvent(allocation)
                            : null;
            case SessionPlannerViewInputEvent.MoveEncounterInput move ->
                    move.change().hasResolvedEncounter() ? new SessionPlannerPublishedEvent(move) : null;
            case SessionPlannerViewInputEvent.RestGapInput restGap ->
                    restGap.change().isResolvedGap() ? new SessionPlannerPublishedEvent(restGap) : null;
            case SessionPlannerViewInputEvent.LootRemovalInput removeLoot ->
                    removeLoot.loot().isResolved() ? new SessionPlannerPublishedEvent(removeLoot) : null;
        };
    }

    private static @Nullable SessionPlannerPublishedEvent encounterDaysEvent(String raw) {
        BigDecimal encounterDays = parsePositiveDecimal(raw);
        return encounterDays == null
                ? null
                : new SessionPlannerPublishedEvent(new SessionPlannerPublishedEvent.SetEncounterDaysMutation(encounterDays));
    }

    private static @Nullable BigDecimal parsePositiveDecimal(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        try {
            BigDecimal parsed = new BigDecimal(raw.trim().replace(',', '.'));
            return parsed.signum() <= 0 ? null : parsed;
        } catch (NumberFormatException exception) {
            return null;
        }
    }
}
