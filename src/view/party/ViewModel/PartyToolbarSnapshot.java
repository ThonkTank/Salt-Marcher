package src.view.party.ViewModel;

import java.util.List;

public record PartyToolbarSnapshot(
        Display display,
        Budget budget,
        Status status,
        RestControls restControls,
        List<PartyViewData.PartyMemberViewData> activeMembers,
        List<PartyViewData.PartyMemberViewData> reserveMembers
) {
    public PartyToolbarSnapshot {
        display = display == null ? Display.empty() : display;
        budget = budget == null ? Budget.empty() : budget;
        status = status == null ? Status.hidden() : status;
        restControls = restControls == null ? RestControls.disabled() : restControls;
        activeMembers = activeMembers == null ? List.of() : List.copyOf(activeMembers);
        reserveMembers = reserveMembers == null ? List.of() : List.copyOf(reserveMembers);
    }

    public static PartyToolbarSnapshot empty() {
        return new PartyToolbarSnapshot(
                Display.empty(),
                Budget.empty(),
                Status.hidden(),
                RestControls.disabled(),
                List.of(),
                List.of());
    }

    public PartyToolbarSnapshot withStatus(Status nextStatus) {
        return new PartyToolbarSnapshot(display, budget, nextStatus, restControls, activeMembers, reserveMembers);
    }

    public record Display(
            String triggerText,
            String summaryText,
            String daySummaryText
    ) {
        static Display empty() {
            return new Display("Party", "No active party", "Adventuring day: no active party");
        }
    }

    public record Budget(
            String budgetPercentText,
            double budgetProgress,
            boolean budgetVisible
    ) {
        static Budget empty() {
            return new Budget("0%", 0.0, false);
        }
    }

    public record Status(
            String text,
            boolean visible,
            boolean error
    ) {
        public static Status hidden() {
            return new Status("", false, false);
        }
    }

    public record RestControls(
            boolean shortRestDisabled,
            boolean longRestDisabled
    ) {
        static RestControls disabled() {
            return new RestControls(true, true);
        }
    }
}
