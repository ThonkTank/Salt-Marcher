package src.view.dropdowns.party;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import org.jspecify.annotations.Nullable;
import src.domain.party.published.AdventuringDayResult;
import src.domain.party.published.AdventuringDaySummary;
import src.domain.party.published.MembershipState;
import src.domain.party.published.MutationResult;
import src.domain.party.published.MutationStatus;
import src.domain.party.published.PartyMemberDetails;
import src.domain.party.published.PartySnapshot;
import src.domain.party.published.PartySnapshotResult;
import src.domain.party.published.PartySummary;
import src.domain.party.published.ReadStatus;
import src.domain.party.published.RestCadenceStatus;
import src.domain.party.published.RestCadenceUrgency;

@SuppressWarnings({
        "PMD.TooManyMethods"
})
public final class PartyTopBarContributionModel {

    private static final int MAX_CHARACTER_LEVEL = 20;

    private final PartyTopBarContentModel topBarContentModel = new PartyTopBarContentModel();
    private final PartyRosterTopBarContentModel rosterContentModel = new PartyRosterTopBarContentModel();
    private final PartyEditorTopBarContentModel editorContentModel = new PartyEditorTopBarContentModel();

    private boolean mutationInFlight;
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
        if (mutationInFlight) {
            rejectMutation("Party-Aktion laeuft bereits.");
            return false;
        }
        mutationInFlight = true;
        pendingSuccessMessage = safe(successMessage);
        rosterContentModel.showPending("Speichere...");
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
        String successMessage = pendingSuccessMessage;
        pendingSuccessMessage = "";
        MutationStatus status = result == null || result.mutationResult() == null
                ? MutationStatus.STORAGE_ERROR
                : result.mutationResult().status();
        if (status != MutationStatus.SUCCESS) {
            rosterContentModel.showStatus(mutationMessage(status), true);
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
                PartyEditorTopBarContentModel.EditorPanelModel.hidden());
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
                .map(member -> MemberProjectionSupport.toMemberModel(member, restStatusByMemberId.get(member.id())))
                .toList();
        List<PartyRosterTopBarContentModel.MemberModel> reserveMembers = safeMembers(safeSnapshot.reserveMembers()).stream()
                .map(member -> MemberProjectionSupport.toMemberModel(member, restStatusByMemberId.get(member.id())))
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
                reserveMembers,
                "",
                summaryText(activeMembers, averageLevel),
                restSummary(daySummary),
                statusMessage,
                statusError,
                activeMembers.isEmpty(),
                false));
        editorContentModel.showEditor(editorPanel);
    }

    void applyStorageError(PartyEditorTopBarContentModel.EditorPanelModel editorPanel) {
        mutationInFlight = false;
        pendingSuccessMessage = "";
        topBarContentModel.showTriggerText("Keine _Party ▼");
        rosterContentModel.showPanel(new PartyRosterTopBarContentModel.PanelContent(
                false,
                true,
                "Party konnte nicht geladen werden.",
                List.of(),
                List.of(),
                List.of(),
                "",
                "Keine Party-Mitglieder",
                "",
                "Party konnte nicht geladen werden.",
                true,
                true,
                true));
        editorContentModel.showEditor(editorPanel);
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

    private record LevelProgressDisplay(String nextLevelLabel, String text) {
    }

    @SuppressWarnings("PMD.UnnecessaryConstructor")
    private static final class MemberProjectionSupport {

        private MemberProjectionSupport() {
        }

        private static PartyRosterTopBarContentModel.MemberModel toMemberModel(
                @Nullable PartyMemberDetails member,
                @Nullable RestCadenceStatus restStatus
        ) {
            PartyMemberDetails safeMember = member == null
                    ? new PartyMemberDetails(0L, "", "", 1, 0, 0, 300, 300, false, 10, 10, 0, 0, 0,
                    MembershipState.ACTIVE)
                    : member;
            String restText = safe(restStatusText(restStatus));
            LevelProgressDisplay levelProgress = levelProgressDisplay(safeMember);
            return new PartyRosterTopBarContentModel.MemberModel(
                    safeMember.id(),
                    safe(safeMember.name()),
                    safe(safeMember.playerName()),
                    safeMember.level(),
                    safeMember.passivePerception(),
                    safeMember.armorClass(),
                    identityText(safeMember),
                    combatText(safeMember),
                    "Lv " + safeMember.level(),
                    levelProgress.nextLevelLabel(),
                    levelProgress.text(),
                    restText,
                    restUrgencyStyleClass(restStatus));
        }

        private static String identityText(PartyMemberDetails member) {
            String name = safe(member.name()).trim();
            String player = safe(member.playerName()).trim();
            if (player.isBlank()) {
                return name;
            }
            if (name.isBlank()) {
                return player;
            }
            return name + " - " + player;
        }

        private static String combatText(PartyMemberDetails member) {
            return "AC " + member.armorClass() + " | PP " + member.passivePerception();
        }

        private static LevelProgressDisplay levelProgressDisplay(PartyMemberDetails member) {
            int currentXp = Math.max(0, member.currentXp());
            int currentLevelXp = Math.max(0, member.currentLevelXp());
            int nextLevelXp = Math.max(currentLevelXp, member.nextLevelXp());
            if (member.level() >= MAX_CHARACTER_LEVEL || nextLevelXp <= currentLevelXp) {
                return new LevelProgressDisplay("Max", formatProgressText(currentXp, currentXp, 100));
            }
            int span = Math.max(1, nextLevelXp - currentLevelXp);
            int earnedInLevel = Math.max(0, currentXp - currentLevelXp);
            double fraction = Math.max(0.0, Math.min(1.0, (double) earnedInLevel / span));
            int percent = (int) Math.round(fraction * 100.0);
            if (member.readyToLevel()) {
                fraction = 1.0;
                percent = 100;
            }
            return new LevelProgressDisplay(
                    "Lv " + (member.level() + 1),
                    formatProgressText(currentXp, nextLevelXp, percent));
        }

        private static String formatProgressText(int currentXp, int targetXp, int percent) {
            return currentXp + "/" + Math.max(0, targetXp) + " XP (" + Math.max(0, Math.min(100, percent)) + "%)";
        }

        private static String restStatusText(@Nullable RestCadenceStatus status) {
            if (status == null) {
                return "";
            }
            return switch (status.nextMilestone()) {
                case SHORT_REST_ONE -> "Short Rest 1";
                case SHORT_REST_TWO -> "Short Rest 2";
                case LONG_REST -> "Long Rest";
            } + ": " + status.xpDelta() + " XP";
        }

        private static String restUrgencyStyleClass(@Nullable RestCadenceStatus status) {
            if (status == null) {
                return "";
            }
            RestCadenceUrgency urgency = status.urgency();
            if (urgency == RestCadenceUrgency.OVERDUE) {
                return "party-rest-chip-overdue";
            }
            if (urgency == RestCadenceUrgency.SOON) {
                return "party-rest-chip-soon";
            }
            return "party-rest-chip-normal";
        }
    }
}
