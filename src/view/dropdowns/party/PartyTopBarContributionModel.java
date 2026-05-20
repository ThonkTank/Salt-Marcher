package src.view.dropdowns.party;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.jspecify.annotations.Nullable;
import src.domain.party.published.AdventuringDayResult;
import src.domain.party.published.AdventuringDaySummary;
import src.domain.party.published.MutationResult;
import src.domain.party.published.MutationStatus;
import src.domain.party.published.PartyMemberDetails;
import src.domain.party.published.PartySnapshot;
import src.domain.party.published.PartySnapshotResult;
import src.domain.party.published.PartySummary;
import src.domain.party.published.ReadStatus;
import src.domain.party.published.RestCadenceStatus;

@SuppressWarnings({
        "PMD.TooManyMethods"
})
public final class PartyTopBarContributionModel {

    private final PartyTopBarContentModel topBarContentModel = new PartyTopBarContentModel();
    private final PartyRosterTopBarContentModel rosterContentModel = new PartyRosterTopBarContentModel();
    private final PartyEditorTopBarContentModel editorContentModel = new PartyEditorTopBarContentModel();

    private boolean mutationInFlight;
    private boolean pendingHideEditorOnSuccess;
    private String pendingSuccessMessage = "";

    PartyTopBarContentModel topBarContentModel() {
        return topBarContentModel;
    }

    PartyRosterTopBarContentModel rosterContentModel() {
        return rosterContentModel;
    }

    PartyEditorTopBarContentModel editorContentModel() {
        return editorContentModel;
    }

    public boolean beginMutation(String successMessage) {
        return beginMutation(successMessage, false);
    }

    public boolean beginEditorMutation(String successMessage) {
        return beginMutation(successMessage, true);
    }

    private boolean beginMutation(String successMessage, boolean hideEditorOnSuccess) {
        if (mutationInFlight) {
            rejectMutation("Party-Aktion laeuft bereits.");
            return false;
        }
        mutationInFlight = true;
        pendingHideEditorOnSuccess = hideEditorOnSuccess;
        pendingSuccessMessage = safe(successMessage);
        rosterContentModel.showPending("Speichere...");
        editorContentModel.showActionsDisabled(true);
        return true;
    }

    public void rejectMutation(String message) {
        rosterContentModel.showStatus(message, true);
    }

    public void openCreateEditor() {
        editorContentModel.openCreateEditor();
    }

    public boolean openEditEditor(long memberId) {
        PartyRosterTopBarContentModel.MemberModel member = rosterContentModel.findMember(memberId);
        if (member == null) {
            return false;
        }
        editorContentModel.showEditor(PartyEditorTopBarContentModel.EditorPanelModel.editDraft(
                memberId,
                member.name(),
                member.playerName(),
                Integer.toString(member.level()),
                Integer.toString(member.passivePerception()),
                Integer.toString(member.armorClass())));
        return true;
    }

    public void cancelEditor() {
        editorContentModel.cancelEditor();
    }

    public void requestDeleteConfirmation() {
        editorContentModel.requestDeleteConfirmation();
    }

    public void cancelDeleteConfirmation() {
        editorContentModel.cancelDeleteConfirmation();
    }

    public void syncEditorDraft(
            String memberName,
            String playerName,
            String rawLevel,
            String rawPassivePerception,
            String rawArmorClass
    ) {
        editorContentModel.syncDraft(memberName, playerName, rawLevel, rawPassivePerception, rawArmorClass);
    }

    public void updateReserveSearch(String searchText) {
        rosterContentModel.showReserveSearch(searchText);
    }

    public PartyEditorTopBarContentModel.EditorPanelModel currentEditorPanel() {
        return editorContentModel.currentEditorPanel();
    }

    public String memberName(long memberId) {
        return rosterContentModel.memberName(memberId);
    }

    void applyLoadResult(PanelData data) {
        PartySnapshotResult snapshotResult = data == null ? null : data.snapshotResult();
        if (snapshotResult == null || snapshotResult.status() != ReadStatus.SUCCESS) {
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

    void applyMutationResult(MutationAndLoadResult result) {
        mutationInFlight = false;
        boolean hideEditorOnSuccess = pendingHideEditorOnSuccess;
        pendingHideEditorOnSuccess = false;
        String successMessage = pendingSuccessMessage;
        pendingSuccessMessage = "";
        MutationStatus status = result == null || result.mutationResult() == null
                ? MutationStatus.STORAGE_ERROR
                : result.mutationResult().status();
        if (status != MutationStatus.SUCCESS) {
            editorContentModel.showActionsDisabled(false);
            rosterContentModel.showReadyStatus(mutationMessage(status), true);
            return;
        }
        PanelData data = result.panelData();
        if (data == null) {
            applyStorageError(editorContentModel.currentEditorPanel());
            rosterContentModel.showStatus("Party konnte nach der Änderung nicht neu geladen werden.", true);
            return;
        }
        PartySnapshotResult snapshotResult = data.snapshotResult();
        if (snapshotResult == null || snapshotResult.status() != ReadStatus.SUCCESS) {
            applyStorageError(editorContentModel.currentEditorPanel());
            rosterContentModel.showStatus("Party konnte nach der Änderung nicht neu geladen werden.", true);
            return;
        }
        applySnapshot(
                snapshotResult.snapshot(),
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
        PartySnapshot safeSnapshot = snapshot == null ? emptySnapshot() : snapshot;
        @Nullable AdventuringDaySummary daySummary = dayResult == null || dayResult.status() != ReadStatus.SUCCESS
                ? null
                : dayResult.summary();
        Map<Long, RestCadenceStatus> restStatusByMemberId = restStatusByMemberId(daySummary);
        List<PartyRosterTopBarContentModel.MemberModel> activeMembers = safeMembers(safeSnapshot.activeMembers()).stream()
                .map(member -> PartyRosterTopBarContentModel.memberModel(member, restStatusByMemberId.get(member.id())))
                .toList();
        List<PartyRosterTopBarContentModel.MemberModel> reserveMembers = safeMembers(safeSnapshot.reserveMembers()).stream()
                .map(member -> PartyRosterTopBarContentModel.memberModel(member, restStatusByMemberId.get(member.id())))
                .toList();
        int activeCount = activeMembers.size();
        int averageLevel = safeSnapshot.summary() == null ? averageLevel(activeMembers) : safeSnapshot.summary().averageLevel();
        topBarContentModel.showTriggerText(activeCount == 0
                ? "Keine _Party ▼"
                : activeCount + " Charaktere, Ø Lv " + averageLevel + " ▼");
        rosterContentModel.showPanel(new PartyRosterTopBarContentModel.PanelContent(
                false,
                false,
                "",
                activeMembers,
                reserveMembers,
                rosterContentModel.reserveSearchText(),
                summaryText(activeMembers, averageLevel),
                restSummary(daySummary),
                statusMessage,
                statusError,
                mutationInFlight || activeMembers.isEmpty(),
                mutationInFlight));
        if (mutationInFlight) {
            rosterContentModel.showPending("Speichere...");
        }
        editorContentModel.showEditor(editorPanel);
    }

    void applyStorageError(PartyEditorTopBarContentModel.EditorPanelModel editorPanel) {
        mutationInFlight = false;
        pendingHideEditorOnSuccess = false;
        pendingSuccessMessage = "";
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

    private static String mutationMessage(@Nullable MutationStatus status) {
        if (status == MutationStatus.NOT_FOUND) {
            return "Charakter konnte nicht gefunden werden.";
        }
        if (status == MutationStatus.INVALID_INPUT) {
            return "Eingaben sind ungültig.";
        }
        return "Party-Aktion konnte nicht gespeichert werden.";
    }

    private static Map<Long, RestCadenceStatus> restStatusByMemberId(@Nullable AdventuringDaySummary summary) {
        if (summary == null) {
            return Map.of();
        }
        return summary.restCadenceStatuses().stream()
                .filter(status -> status != null && status.characterId() != null)
                .collect(Collectors.toMap(
                        RestCadenceStatus::characterId,
                        Function.identity(),
                        (first, second) -> first));
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

    private static PartySnapshot emptySnapshot() {
        return new PartySnapshot(List.of(), List.of(), new PartySummary(0, 0, 1));
    }

    private static String safe(@Nullable String value) {
        return value == null ? "" : value;
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

}
