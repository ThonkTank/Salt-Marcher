package src.view.party.ViewModel;

import src.domain.party.PartyApplicationService;
import src.domain.party.api.AdventuringDayResult;
import src.domain.party.api.MembershipState;
import src.domain.party.api.MutationResult;
import src.domain.party.api.MutationStatus;
import src.domain.party.api.PartyMemberDetails;
import src.domain.party.api.PartySnapshotResult;
import src.domain.party.api.ReadStatus;
import src.domain.party.api.RestCadenceStatus;
import src.domain.party.api.RestCadenceUrgency;
import src.domain.party.api.RestMilestone;
import src.domain.party.api.RestType;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@SuppressWarnings("PMD.TooManyMethods")
public final class PartyToolbarViewModel {

    private final PartyApplicationService party;
    private final List<Runnable> listeners = new ArrayList<>();

    private PartyToolbarSnapshot snapshot = PartyToolbarSnapshot.empty();

    public PartyToolbarViewModel(PartyApplicationService party) {
        this.party = Objects.requireNonNull(party, "party");
    }

    public PartyToolbarSnapshot snapshot() {
        return snapshot;
    }

    public void addChangeListener(Runnable listener) {
        listeners.add(Objects.requireNonNull(listener, "listener"));
    }

    public void initialize() {
        refreshState();
        clearStatus();
    }

    public void onPopupOpened() {
        refresh();
    }

    public void refresh() {
        refreshState();
    }

    public void createCharacter(PartyCharacterMutationRequest request) {
        applyMutation(
                party.createCharacter(
                        request.toDomainDraft(),
                        request.activeMembership() ? MembershipState.ACTIVE : MembershipState.RESERVE),
                "Character created.");
    }

    public void updateCharacter(long id, PartyCharacterMutationRequest request) {
        applyMutation(
                party.updateCharacter(
                        id,
                        request.toDomainDraft()),
                "Character updated.");
    }

    public void deleteCharacter(long id) {
        applyMutation(party.deleteCharacter(id), "Character deleted.");
    }

    public void moveToActive(long id) {
        applyMutation(party.setMembership(id, MembershipState.ACTIVE), "Character moved to active party.");
    }

    public void moveToReserve(long id) {
        applyMutation(party.setMembership(id, MembershipState.RESERVE), "Character moved to reserve.");
    }

    public void awardXp(long id, int xpPerCharacter) {
        applyMutation(party.awardXp(List.of(id), xpPerCharacter), "XP awarded.");
    }

    public void performShortRest() {
        applyMutation(party.performRest(RestType.SHORT_REST), "Short rest applied.");
    }

    public void performLongRest() {
        applyMutation(party.performRest(RestType.LONG_REST), "Long rest applied.");
    }

    private void applyMutation(MutationResult result, String successMessage) {
        if (result == null) {
            updateStatus("Party update failed.", true);
            return;
        }
        if (result.status() != MutationStatus.SUCCESS) {
            updateStatus(errorFor(result.status()), true);
            return;
        }
        if (refreshState()) {
            updateStatus(successMessage, false);
        }
    }

    private boolean refreshState() {
        PartySnapshotResult snapshotResult = party.loadSnapshot();
        AdventuringDayResult dayResult = party.loadAdventuringDaySummary();
        if (snapshotResult.status() != ReadStatus.SUCCESS || dayResult.status() != ReadStatus.SUCCESS) {
            updateStatus("Party data could not be loaded.", true);
            return false;
        }
        snapshot = mapSnapshot(snapshotResult, dayResult, snapshot.status());
        notifyListeners();
        return true;
    }

    private void clearStatus() {
        snapshot = snapshot.withStatus(PartyToolbarSnapshot.Status.hidden());
        notifyListeners();
    }

    private void updateStatus(String text, boolean error) {
        snapshot = snapshot.withStatus(new PartyToolbarSnapshot.Status(
                text == null ? "" : text,
                text != null && !text.isBlank(),
                error));
        notifyListeners();
    }

    private PartyToolbarSnapshot mapSnapshot(
            PartySnapshotResult snapshotResult,
            AdventuringDayResult dayResult,
            PartyToolbarSnapshot.Status currentStatus
    ) {
        Map<Long, PartyViewData.RestStatusViewData> restStatuses = mapRestStatuses(dayResult.summary().restCadenceStatuses());
        List<PartyViewData.PartyMemberViewData> activeMembers = mapMembers(snapshotResult.snapshot().activeMembers(), restStatuses);
        List<PartyViewData.PartyMemberViewData> reserveMembers = mapMembers(snapshotResult.snapshot().reserveMembers(), Map.of());
        int activeCount = activeMembers.size();
        int reserveCount = reserveMembers.size();
        boolean noActiveParty = activeCount == 0;

        PartyToolbarSnapshot.Display display;
        if (noActiveParty) {
            display = new PartyToolbarSnapshot.Display(
                    "Party",
                    "No active party. Reserve: " + reserveCount,
                    "Adventuring day: no active party");
        } else {
            display = new PartyToolbarSnapshot.Display(
                    "Party (" + activeCount + ", avg Lv " + snapshotResult.snapshot().summary().averageLevel() + ")",
                    "Active: " + activeCount
                            + " | Reserve: " + reserveCount
                            + " | Avg Lv " + snapshotResult.snapshot().summary().averageLevel(),
                    "SR " + dayResult.summary().remainingToShortRest()
                            + " XP | LR " + dayResult.summary().remainingToLongRest() + " XP");
        }

        double progress = dayResult.summary().totalBudgetXp() <= 0
                ? 0.0
                : dayResult.summary().consumedXp() / (double) dayResult.summary().totalBudgetXp();

        return new PartyToolbarSnapshot(
                display,
                new PartyToolbarSnapshot.Budget(
                        Math.max(0, dayResult.summary().consumedPercent()) + "%",
                        Math.max(0.0, Math.min(1.0, progress)),
                        !noActiveParty),
                currentStatus,
                new PartyToolbarSnapshot.RestControls(noActiveParty, noActiveParty),
                activeMembers,
                reserveMembers);
    }

    private List<PartyViewData.PartyMemberViewData> mapMembers(
            List<PartyMemberDetails> members,
            Map<Long, PartyViewData.RestStatusViewData> restStatuses
    ) {
        List<PartyViewData.PartyMemberViewData> viewData = new ArrayList<>();
        for (PartyMemberDetails member : members) {
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
                    member.membership() == MembershipState.ACTIVE
                            ? PartyViewData.MembershipSelection.active()
                            : PartyViewData.MembershipSelection.reserve(),
                    restStatuses.get(member.id())));
        }
        return viewData;
    }

    private Map<Long, PartyViewData.RestStatusViewData> mapRestStatuses(List<RestCadenceStatus> statuses) {
        Map<Long, PartyViewData.RestStatusViewData> viewData = new HashMap<>();
        for (RestCadenceStatus status : statuses) {
            viewData.put(status.characterId(), new PartyViewData.RestStatusViewData(
                    shortLabelFor(status.nextMilestone()),
                    tooltipFor(status.nextMilestone(), status.xpDelta()),
                    severityFor(status.urgency())));
        }
        return viewData;
    }

    private String shortLabelFor(RestMilestone milestone) {
        return switch (milestone) {
            case SHORT_REST_ONE -> "SR1";
            case SHORT_REST_TWO -> "SR2";
            case LONG_REST -> "LR";
        };
    }

    private String tooltipFor(RestMilestone milestone, int xpDelta) {
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

    private PartyViewData.RestIndicatorSeverity severityFor(RestCadenceUrgency urgency) {
        if (urgency == null) {
            return PartyViewData.RestIndicatorSeverity.normal();
        }
        return switch (urgency) {
            case NORMAL -> PartyViewData.RestIndicatorSeverity.normal();
            case SOON -> PartyViewData.RestIndicatorSeverity.soon();
            case OVERDUE -> PartyViewData.RestIndicatorSeverity.overdue();
        };
    }

    private String errorFor(MutationStatus status) {
        return switch (status) {
            case NOT_FOUND -> "Character no longer exists.";
            case INVALID_INPUT -> "Party update was rejected.";
            case STORAGE_ERROR -> "Party update failed.";
            case SUCCESS -> "";
        };
    }

    private void notifyListeners() {
        for (Runnable listener : List.copyOf(listeners)) {
            listener.run();
        }
    }
}
