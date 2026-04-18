package src.view.party.interactor;

import src.domain.party.partyAPI;
import src.view.party.Model.PartyViewData;
import src.view.party.Model.PartyToolbarState;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

final class PartyToolbarStateMapper {

    PartyToolbarState map(partyAPI.PartySnapshotResult snapshotResult, partyAPI.AdventuringDayResult dayResult) {
        Map<Long, PartyViewData.RestStatusViewData> restStatuses = mapRestStatuses(dayResult.summary().restCadenceStatuses());
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

    private List<PartyViewData.PartyMemberViewData> mapMembers(
            List<partyAPI.PartyMemberDetails> members,
            Map<Long, PartyViewData.RestStatusViewData> restStatuses
    ) {
        List<PartyViewData.PartyMemberViewData> viewData = new ArrayList<>();
        for (partyAPI.PartyMemberDetails member : members) {
            viewData.add(new PartyViewData.PartyMemberViewData(
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
                            ? PartyViewData.MembershipSelection.ACTIVE
                            : PartyViewData.MembershipSelection.RESERVE,
                    restStatuses.get(member.id())));
        }
        return viewData;
    }

    private Map<Long, PartyViewData.RestStatusViewData> mapRestStatuses(List<partyAPI.RestCadenceStatus> statuses) {
        Map<Long, PartyViewData.RestStatusViewData> viewData = new HashMap<>();
        for (partyAPI.RestCadenceStatus status : statuses) {
            viewData.put(status.characterId(), new PartyViewData.RestStatusViewData(
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

    private PartyViewData.RestIndicatorSeverity severityFor(partyAPI.RestCadenceUrgency urgency) {
        if (urgency == null) {
            return PartyViewData.RestIndicatorSeverity.NORMAL;
        }
        return switch (urgency) {
            case NORMAL -> PartyViewData.RestIndicatorSeverity.NORMAL;
            case SOON -> PartyViewData.RestIndicatorSeverity.SOON;
            case OVERDUE -> PartyViewData.RestIndicatorSeverity.OVERDUE;
        };
    }
}
