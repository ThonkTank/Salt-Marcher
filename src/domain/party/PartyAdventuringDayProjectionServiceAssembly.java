package src.domain.party;

import java.util.List;
import src.domain.party.model.roster.PartyAdventuringDayCalculation;
import src.domain.party.model.roster.PartyAdventuringDayPlan;
import src.domain.party.model.roster.PartyAdventuringDayProgress;
import src.domain.party.model.roster.usecase.LoadAdventuringDaySummaryUseCase;
import src.domain.party.published.AdventuringDayBudget;
import src.domain.party.published.AdventuringDayCalculationResult;
import src.domain.party.published.AdventuringDayPlanningSummary;
import src.domain.party.published.AdventuringDayResult;
import src.domain.party.published.AdventuringDaySummary;
import src.domain.party.published.ReadStatus;
import src.domain.party.published.RestCadenceStatus;
import src.domain.party.published.RestCadenceUrgency;
import src.domain.party.published.RestMilestone;

final class PartyAdventuringDayProjectionServiceAssembly {

    private PartyAdventuringDayProjectionServiceAssembly() {
    }

    static AdventuringDayResult failedAdventuringDaySummaryResult() {
        return new AdventuringDayResult(
                ReadStatus.STORAGE_ERROR,
                new AdventuringDaySummary(List.of(), 0, 0, 0, 0, 0, List.of()));
    }

    static AdventuringDayCalculationResult failedAdventuringDayCalculationResult() {
        return new AdventuringDayCalculationResult(
                ReadStatus.STORAGE_ERROR,
                new src.domain.party.published.AdventuringDayCalculation(
                        new AdventuringDayBudget(0, 0, 0, 0, 0),
                        new src.domain.party.published.AdventuringDayProgress(0, 0, 0, 0, 0.0, 0, 0, List.of(), List.of())),
                AdventuringDayPlanningSummary.empty());
    }

    static AdventuringDayResult mapAdventuringDaySummaryResult(
            LoadAdventuringDaySummaryUseCase.AdventuringDayStatus dayStatus
    ) {
        return new AdventuringDayResult(
                ReadStatus.SUCCESS,
                new AdventuringDaySummary(
                        dayStatus.activeLevels(),
                        dayStatus.remainingToShortRest(),
                        dayStatus.remainingToLongRest(),
                        dayStatus.consumedXp(),
                        dayStatus.totalBudgetXp(),
                        dayStatus.consumedPercent(),
                        dayStatus.restCadenceStatuses().stream()
                                .map(PartyAdventuringDayProjectionServiceAssembly::mapRestCadenceStatus)
                                .toList()));
    }

    static AdventuringDayCalculationResult mapAdventuringDayCalculationResult(
            PartyAdventuringDayCalculation calculation
    ) {
        src.domain.party.published.AdventuringDayCalculation publishedCalculation =
                new src.domain.party.published.AdventuringDayCalculation(
                        mapAdventuringDayBudget(calculation.plan()),
                        mapAdventuringDayProgress(calculation.progress()));
        return new AdventuringDayCalculationResult(
                ReadStatus.SUCCESS,
                publishedCalculation,
                new AdventuringDayPlanningSummary(
                        calculation.plan().totalBudgetXp(),
                        calculation.plan().firstShortRestXp(),
                        calculation.plan().secondShortRestXp(),
                        calculation.plannedShortRests(),
                        calculation.plannedLongRests()));
    }

    private static RestCadenceStatus mapRestCadenceStatus(LoadAdventuringDaySummaryUseCase.RestCadence status) {
        if (status == null) {
            return new RestCadenceStatus(
                    null,
                    RestMilestone.valueOf("LONG_REST"),
                    0,
                    RestCadenceUrgency.valueOf("NORMAL"));
        }
        return new RestCadenceStatus(
                status.characterId(),
                toPublishedRestMilestone(status.nextMilestone()),
                status.xpDelta(),
                toPublishedRestCadenceUrgency(status.urgency()));
    }

    private static AdventuringDayBudget mapAdventuringDayBudget(PartyAdventuringDayPlan plan) {
        return new AdventuringDayBudget(
                plan.totalBudgetXp(),
                plan.perThirdXp(),
                plan.firstShortRestXp(),
                plan.secondShortRestXp(),
                plan.characterCount());
    }

    private static src.domain.party.published.AdventuringDayProgress mapAdventuringDayProgress(
            PartyAdventuringDayProgress progress
    ) {
        return new src.domain.party.published.AdventuringDayProgress(
                progress.totals().totalGroupXp(),
                progress.totals().perCharacterAwardedXp(),
                progress.totals().partySize(),
                progress.longRests(),
                progress.totals().totalDays(),
                progress.shortRests(),
                progress.longRests(),
                progress.levelProgressions().stream()
                        .map(PartyAdventuringDayProgressProjectionServiceAssembly::mapLevelProgress)
                        .toList(),
                progress.events().stream()
                        .map(PartyAdventuringDayProgressProjectionServiceAssembly::mapProgressEvent)
                        .toList());
    }

    private static RestMilestone toPublishedRestMilestone(int milestone) {
        if (milestone == LoadAdventuringDaySummaryUseCase.RestCadence.SHORT_REST_ONE) {
            return RestMilestone.SHORT_REST_ONE;
        }
        if (milestone == LoadAdventuringDaySummaryUseCase.RestCadence.SHORT_REST_TWO) {
            return RestMilestone.SHORT_REST_TWO;
        }
        return RestMilestone.LONG_REST;
    }

    private static RestCadenceUrgency toPublishedRestCadenceUrgency(int urgency) {
        if (urgency == LoadAdventuringDaySummaryUseCase.RestCadence.OVERDUE) {
            return RestCadenceUrgency.OVERDUE;
        }
        if (urgency == LoadAdventuringDaySummaryUseCase.RestCadence.SOON) {
            return RestCadenceUrgency.SOON;
        }
        return RestCadenceUrgency.NORMAL;
    }
}
