package src.view.dropdowns.party;

import java.util.List;
import java.util.Locale;
import org.jspecify.annotations.Nullable;
import src.domain.party.published.AdventuringDayResult;
import src.domain.party.published.AdventuringDaySummary;
import src.domain.party.published.MutationResult;
import src.domain.party.published.MutationStatus;
import src.domain.party.published.PartyMemberDetails;
import src.domain.party.published.PartySnapshot;
import src.domain.party.published.PartySnapshotResult;
import src.domain.party.published.ReadStatus;
import src.domain.party.published.RestCadenceStatus;

public final class PartyTopBarContributionModel {

    private final PartyTopBarContentModel topBarContentModel = new PartyTopBarContentModel();
    private final PartyRosterTopBarContentModel rosterContentModel = new PartyRosterTopBarContentModel();
    private final PartyEditorTopBarContentModel editorContentModel = new PartyEditorTopBarContentModel();
    private final MutationState mutationState = new MutationState();
    private final SnapshotPresenter snapshotPresenter = new SnapshotPresenter(
            topBarContentModel,
            rosterContentModel,
            editorContentModel,
            mutationState);

    PartyTopBarContentModel topBarContentModel() {
        return topBarContentModel;
    }

    PartyRosterTopBarContentModel rosterContentModel() {
        return rosterContentModel;
    }

    PartyEditorTopBarContentModel editorContentModel() {
        return editorContentModel;
    }

    MutationState mutationState() {
        return mutationState;
    }

    void applyLoadResult(PanelData data) {
        snapshotPresenter.applyLoadResult(data);
    }

    void applyMutationResult(MutationAndLoadResult result) {
        snapshotPresenter.applyMutationResult(result);
    }

    record PanelData(
            @Nullable PartySnapshotResult snapshotResult,
            @Nullable AdventuringDayResult dayResult
    ) {
    }

    record MutationAndLoadResult(
            @Nullable MutationResult mutationResult,
            @Nullable PanelData panelData
    ) {
    }

    private static final class SnapshotPresenter {

        private final PartyTopBarContentModel topBarContentModel;
        private final PartyRosterTopBarContentModel rosterContentModel;
        private final PartyEditorTopBarContentModel editorContentModel;
        private final MutationState mutationState;

        private SnapshotPresenter(
                PartyTopBarContentModel topBarContentModel,
                PartyRosterTopBarContentModel rosterContentModel,
                PartyEditorTopBarContentModel editorContentModel,
                MutationState mutationState
        ) {
            this.topBarContentModel = topBarContentModel;
            this.rosterContentModel = rosterContentModel;
            this.editorContentModel = editorContentModel;
            this.mutationState = mutationState;
        }

        private void applyLoadResult(PanelData data) {
            PartySnapshotResult snapshotResult = data == null ? null : data.snapshotResult();
            if (snapshotResult == null || snapshotResult.status() != ReadStatus.SUCCESS) {
                if (mutationState.inFlight()) {
                    rosterContentModel.showPending("Speichere...");
                    editorContentModel.showActionsDisabled(true);
                    return;
                }
                applyStorageError(editorContentModel.currentEditorPanel());
                return;
            }
            applySnapshot(
                    snapshotResult.snapshot(),
                    data.dayResult(),
                    "",
                    false,
                    editorContentModel.currentEditorPanel());
        }

        private void applyMutationResult(MutationAndLoadResult result) {
            boolean hideEditorOnSuccess = mutationState.hideEditorOnSuccess();
            String successMessage = mutationState.successMessage();
            mutationState.clear();
            MutationStatus status = result == null || result.mutationResult() == null
                    ? MutationStatus.STORAGE_ERROR
                    : result.mutationResult().status();
            if (status != MutationStatus.SUCCESS) {
                editorContentModel.showActionsDisabled(false);
                rosterContentModel.showReadyStatus(mutationMessage(status), true);
                return;
            }
            PanelData data = result.panelData();
            if (!hasSuccessfulSnapshot(data)) {
                applyStorageError(editorContentModel.currentEditorPanel());
                rosterContentModel.showStatus("Party konnte nach der Änderung nicht neu geladen werden.", true);
                return;
            }
            applySnapshot(
                    data.snapshotResult().snapshot(),
                    data.dayResult(),
                    successMessage,
                    false,
                    hideEditorOnSuccess
                            ? PartyEditorTopBarContentModel.EditorPanelModel.hidden()
                            : editorContentModel.currentEditorPanel().withActionsDisabled(false));
        }

        private void applySnapshot(
                @Nullable PartySnapshot snapshot,
                @Nullable AdventuringDayResult dayResult,
                String statusMessage,
                boolean statusError,
                PartyEditorTopBarContentModel.EditorPanelModel editorPanel
        ) {
            SnapshotPresentation presentation = SnapshotPresentation.from(
                    snapshot,
                    dayResult,
                    rosterContentModel.reserveSearchText(),
                    mutationState.inFlight());
            topBarContentModel.showTriggerText(presentation.triggerText);
            rosterContentModel.showPanel(new PartyRosterTopBarContentModel.PanelContent(
                    false,
                    false,
                    "",
                    presentation.activeMembers,
                    presentation.reserveMembers,
                    presentation.reserveSearchText,
                    presentation.summaryText,
                    presentation.restSummaryText,
                    statusMessage,
                    statusError,
                    presentation.restActionsDisabled,
                    presentation.actionsDisabled));
            if (mutationState.inFlight()) {
                rosterContentModel.showPending("Speichere...");
            }
            editorContentModel.showEditor(editorPanel);
        }

        private void applyStorageError(PartyEditorTopBarContentModel.EditorPanelModel editorPanel) {
            mutationState.clear();
            topBarContentModel.showTriggerText("Keine _Party ▼");
            rosterContentModel.showPanel(new PartyRosterTopBarContentModel.PanelContent(
                    false,
                    true,
                    "Party konnte nicht geladen werden.",
                    List.of(),
                    List.of(),
                    rosterContentModel.reserveSearchText(),
                    "Keine Party-Mitglieder",
                    "",
                    "Party konnte nicht geladen werden.",
                    true,
                    true,
                    true));
            editorContentModel.showEditor(editorPanel.withActionsDisabled(false));
        }

        private static boolean hasSuccessfulSnapshot(@Nullable PanelData data) {
            return data != null && data.snapshotResult() != null && data.snapshotResult().status() == ReadStatus.SUCCESS;
        }

        private static String mutationMessage(@Nullable MutationStatus status) {
            if (status == MutationStatus.NOT_FOUND) {
                return "Charakter konnte nicht gefunden werden.";
            }
            if (status == MutationStatus.INVALID_INPUT) {
                return "Eingaben sind ungültig.";
            }
            return "Party-Aktion konnte nicht gespeichert werden.";
        }
    }

    private static final class SnapshotPresentation {

        private final String triggerText;
        private final List<PartyRosterTopBarContentModel.MemberModel> activeMembers;
        private final List<PartyRosterTopBarContentModel.MemberModel> reserveMembers;
        private final String reserveSearchText;
        private final String summaryText;
        private final String restSummaryText;
        private final boolean restActionsDisabled;
        private final boolean actionsDisabled;

        private SnapshotPresentation(
                String triggerText,
                List<PartyRosterTopBarContentModel.MemberModel> activeMembers,
                List<PartyRosterTopBarContentModel.MemberModel> reserveMembers,
                String reserveSearchText,
                String summaryText,
                String restSummaryText,
                boolean restActionsDisabled,
                boolean actionsDisabled
        ) {
            this.triggerText = triggerText;
            this.activeMembers = activeMembers;
            this.reserveMembers = reserveMembers;
            this.reserveSearchText = reserveSearchText;
            this.summaryText = summaryText;
            this.restSummaryText = restSummaryText;
            this.restActionsDisabled = restActionsDisabled;
            this.actionsDisabled = actionsDisabled;
        }

        private static SnapshotPresentation from(
                @Nullable PartySnapshot snapshot,
                @Nullable AdventuringDayResult dayResult,
                String reserveSearchText,
                boolean mutationInFlight
        ) {
            @Nullable AdventuringDaySummary daySummary = daySummary(dayResult);
            List<PartyRosterTopBarContentModel.MemberModel> activeMembers =
                    memberModels(snapshot == null ? null : snapshot.activeMembers(), daySummary);
            List<PartyRosterTopBarContentModel.MemberModel> reserveMembers =
                    memberModels(snapshot == null ? null : snapshot.reserveMembers(), daySummary);
            int activeCount = activeMembers.size();
            int averageLevel = snapshot == null || snapshot.summary() == null
                    ? averageLevel(activeMembers)
                    : snapshot.summary().averageLevel();
            return new SnapshotPresentation(
                    triggerText(activeCount, averageLevel),
                    activeMembers,
                    reserveMembers,
                    reserveSearchText,
                    summaryText(activeMembers, averageLevel),
                    restSummary(daySummary),
                    mutationInFlight || activeMembers.isEmpty(),
                    mutationInFlight);
        }

        private static List<PartyRosterTopBarContentModel.MemberModel> memberModels(
                @Nullable List<PartyMemberDetails> members,
                @Nullable AdventuringDaySummary daySummary
        ) {
            return safeMembers(members).stream()
                    .map(member -> PartyRosterTopBarContentModel.MemberPresentation.memberModel(
                            member,
                            restStatusFor(daySummary, member.id())))
                    .toList();
        }

        private static @Nullable RestCadenceStatus restStatusFor(
                @Nullable AdventuringDaySummary summary,
                @Nullable Long memberId
        ) {
            if (summary == null || memberId == null) {
                return null;
            }
            for (RestCadenceStatus status : summary.restCadenceStatuses()) {
                if (status != null && memberId.equals(status.characterId())) {
                    return status;
                }
            }
            return null;
        }

        private static String summaryText(
                List<PartyRosterTopBarContentModel.MemberModel> activeMembers,
                int averageLevel
        ) {
            if (activeMembers.isEmpty()) {
                return "Keine Party-Mitglieder";
            }
            double exactAverage = activeMembers.stream()
                    .mapToInt(PartyRosterTopBarContentModel.MemberModel::level)
                    .average()
                    .orElse(1.0);
            return activeMembers.size() + " Charaktere  .  Schnitt Lv " + String.format(Locale.ROOT, "%.1f", exactAverage)
                    + "  .  Rundung " + averageLevel;
        }

        private static String restSummary(@Nullable AdventuringDaySummary summary) {
            if (summary == null || summary.activePartyLevels().isEmpty()) {
                return "";
            }
            return "Short Rest in " + summary.remainingToShortRest()
                    + " XP  .  Long Rest in " + summary.remainingToLongRest()
                    + " XP  .  " + summary.consumedPercent() + "% Tagesbudget";
        }

        private static @Nullable AdventuringDaySummary daySummary(@Nullable AdventuringDayResult dayResult) {
            return dayResult == null || dayResult.status() != ReadStatus.SUCCESS ? null : dayResult.summary();
        }

        private static String triggerText(int activeCount, int averageLevel) {
            return activeCount == 0 ? "Keine _Party ▼" : activeCount + " Charaktere, Ø Lv " + averageLevel + " ▼";
        }
    }

    static final class MutationState {

        private boolean mutationInFlight;
        private boolean pendingHideEditorOnSuccess;
        private String pendingSuccessMessage = "";

        boolean begin(String successMessage, boolean hideEditorOnSuccess) {
            if (mutationInFlight) {
                return false;
            }
            mutationInFlight = true;
            pendingHideEditorOnSuccess = hideEditorOnSuccess;
            pendingSuccessMessage = safe(successMessage);
            return true;
        }

        void clear() {
            mutationInFlight = false;
            pendingHideEditorOnSuccess = false;
            pendingSuccessMessage = "";
        }

        boolean inFlight() {
            return mutationInFlight;
        }

        boolean hideEditorOnSuccess() {
            return pendingHideEditorOnSuccess;
        }

        String successMessage() {
            return pendingSuccessMessage;
        }
    }

    private static List<PartyMemberDetails> safeMembers(@Nullable List<PartyMemberDetails> members) {
        return members == null ? List.of() : List.copyOf(members);
    }

    private static int averageLevel(List<PartyRosterTopBarContentModel.MemberModel> activeMembers) {
        if (activeMembers.isEmpty()) {
            return 1;
        }
        return (int) Math.round(activeMembers.stream()
                .mapToInt(PartyRosterTopBarContentModel.MemberModel::level)
                .average()
                .orElse(1.0));
    }

    private static String safe(@Nullable String value) {
        return value == null ? "" : value;
    }

}
