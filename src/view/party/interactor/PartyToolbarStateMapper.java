package src.view.party.interactor;

import src.domain.party.partyAPI;
import src.view.party.Model.PartyToolbarState;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

final class PartyToolbarStateMapper {

    PartyToolbarState map(partyAPI.PartySnapshotResult snapshotResult, partyAPI.AdventuringDayResult dayResult) {
        Map<Long, PartyInteractor.RestStatusViewData> restStatuses = mapRestStatuses(dayResult.summary().restCadenceStatuses());
        return new PartyToolbarState(
                mapMembers(snapshotResult.snapshot().activeMembers(), restStatuses),
                mapMembers(snapshotResult.snapshot().reserveMembers(), Map.of()),
                snapshotResult.snapshot().summary().averageLevel(),
                dayResult.summary().remainingToShortRest(),
                dayResult.summary().remainingToLongRest(),
                dayResult.summary().totalBudgetXp() <= 0
                        ? 0.0
                        : dayResult.summary().consumedXp() / (double) dayResult.summary().totalBudgetXp(),
                dayResult.summary().consumedPercent());
    }

    private List<PartyInteractor.PartyMemberViewData> mapMembers(
            List<partyAPI.PartyMemberDetails> members,
            Map<Long, PartyInteractor.RestStatusViewData> restStatuses
    ) {
        List<PartyInteractor.PartyMemberViewData> viewData = new ArrayList<>();
        for (partyAPI.PartyMemberDetails member : members) {
            viewData.add(new PartyInteractor.PartyMemberViewData(
                    member.id(),
                    member.name(),
                    member.playerName(),
                    member.level(),
                    member.currentXp(),
                    member.xpToNextLevel(),
                    member.readyToLevel(),
                    member.passivePerception(),
                    member.armorClass(),
                    member.xpSinceShortRest(),
                    member.xpSinceLongRest(),
                    member.shortRestsTakenSinceLongRest(),
                    member.membership() == partyAPI.MembershipState.ACTIVE
                            ? PartyInteractor.MembershipSelection.ACTIVE
                            : PartyInteractor.MembershipSelection.RESERVE,
                    restStatuses.get(member.id())));
        }
        return viewData;
    }

    private Map<Long, PartyInteractor.RestStatusViewData> mapRestStatuses(List<partyAPI.RestCadenceStatus> statuses) {
        Map<Long, PartyInteractor.RestStatusViewData> viewData = new HashMap<>();
        for (partyAPI.RestCadenceStatus status : statuses) {
            viewData.put(status.characterId(), new PartyInteractor.RestStatusViewData(
                    shortLabelFor(status.nextMilestone()),
                    tooltipFor(status.nextMilestone(), status.xpDelta()),
                    severityFor(status.urgency())));
        }
        return viewData;
    }

    private String shortLabelFor(partyAPI.RestMilestone milestone) {
        return switch (milestone) {
            case SHORT_REST_ONE -> "SR1";
            case SHORT_REST_TWO -> "SR2";
            case LONG_REST -> "LR";
        };
    }

    private String tooltipFor(partyAPI.RestMilestone milestone, int xpDelta) {
        String label = switch (milestone) {
            case SHORT_REST_ONE -> "Short Rest 1";
            case SHORT_REST_TWO -> "Short Rest 2";
            case LONG_REST -> "Long Rest";
        };
        if (xpDelta > 0) {
            return label + " in " + xpDelta + " XP";
        }
        if (xpDelta == 0) {
            return label + " due now";
        }
        return label + " " + Math.abs(xpDelta) + " XP overdue";
    }

    private PartyInteractor.RestIndicatorSeverity severityFor(partyAPI.RestCadenceUrgency urgency) {
        if (urgency == null) {
            return PartyInteractor.RestIndicatorSeverity.NORMAL;
        }
        return switch (urgency) {
            case NORMAL -> PartyInteractor.RestIndicatorSeverity.NORMAL;
            case SOON -> PartyInteractor.RestIndicatorSeverity.SOON;
            case OVERDUE -> PartyInteractor.RestIndicatorSeverity.OVERDUE;
        };
    }
}
