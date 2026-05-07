package src.view.dropdowns.party;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import javafx.beans.property.ReadOnlyStringProperty;
import javafx.beans.property.ReadOnlyStringWrapper;
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

public final class PartyTopBarContributionModel {

    private final ReadOnlyStringWrapper triggerText = new ReadOnlyStringWrapper("Keine _Party ▼");
    private final ReadOnlyObjectWrapper<PanelModel> panel =
            new ReadOnlyObjectWrapper<>(PanelModel.loadingModel());

    private boolean mutationInFlight;
    private ActionResult lastActionResult = ActionResult.success();

    public PartyTopBarContributionModel() {
    }

    public ReadOnlyStringProperty triggerTextProperty() {
        return triggerText.getReadOnlyProperty();
    }

    public ReadOnlyObjectProperty<PanelModel> panelProperty() {
        return panel.getReadOnlyProperty();
    }

    public void refresh() {
        panel.set(PanelModel.loadingModel());
    }

    public boolean beginMutation(String successMessage) {
        if (mutationInFlight) {
            rejectMutation("Party-Aktion laeuft bereits.");
            return false;
        }
        mutationInFlight = true;
        panel.set(safePanel().withPending("Speichere..."));
        lastActionResult = ActionResult.pending(successMessage);
        return true;
    }

    public void rejectMutation(String message) {
        showStatus(message, true);
        lastActionResult = ActionResult.failure(message);
    }

    public void openCreateEditor() {
        panel.set(safePanel().withEditor(EditorPanelModel.createDraft()));
    }

    public void openEditEditor(
            long memberId,
            String memberName,
            String playerName,
            String rawLevel,
            String rawPassivePerception,
            String rawArmorClass
    ) {
        panel.set(safePanel().withEditor(EditorPanelModel.editDraft(
                memberId,
                memberName,
                playerName,
                rawLevel,
                rawPassivePerception,
                rawArmorClass)));
    }

    public void cancelEditor() {
        panel.set(safePanel().withEditor(EditorPanelModel.hidden()));
    }

    public void requestDeleteConfirmation() {
        panel.set(safePanel().withEditor(safePanel().editorPanel().withDeleteConfirmationVisible(true)));
    }

    public void cancelDeleteConfirmation() {
        panel.set(safePanel().withEditor(safePanel().editorPanel().withDeleteConfirmationVisible(false)));
    }

    void applyLoadResult(PanelData data) {
        PartySnapshotResult snapshotResult = data == null ? null : data.snapshotResult();
        if (snapshotResult == null || snapshotResult.status() != ReadStatus.SUCCESS) {
            applyStorageError();
            return;
        }
        applySnapshot(snapshotResult.snapshot(), data.dayResult(), "", false);
    }

    ActionResult applyMutationResult(MutationAndLoadResult result) {
        mutationInFlight = false;
        MutationStatus status = result == null || result.mutationResult() == null
                ? MutationStatus.STORAGE_ERROR
                : result.mutationResult().status();
        if (status != MutationStatus.SUCCESS) {
            String message = mutationMessage(status);
            showStatus(message, true);
            lastActionResult = ActionResult.failure(message);
            return lastActionResult;
        }
        PanelData data = result.panelData();
        if (data == null) {
            String message = "Party konnte nach der Änderung nicht neu geladen werden.";
            applyStorageError();
            showStatus(message, true);
            lastActionResult = ActionResult.failure(message);
            return lastActionResult;
        }
        PartySnapshotResult snapshotResult = data.snapshotResult();
        if (snapshotResult == null || snapshotResult.status() != ReadStatus.SUCCESS) {
            String message = "Party konnte nach der Änderung nicht neu geladen werden.";
            applyStorageError();
            showStatus(message, true);
            lastActionResult = ActionResult.failure(message);
            return lastActionResult;
        }
        applySnapshot(snapshotResult.snapshot(), data.dayResult(), result.successMessage(), false);
        lastActionResult = ActionResult.success();
        return lastActionResult;
    }

    ActionResult applyMutationFailure() {
        mutationInFlight = false;
        String message = "Party-Aktion konnte nicht gespeichert werden.";
        showStatus(message, true);
        lastActionResult = ActionResult.failure(message);
        return lastActionResult;
    }

    private void applySnapshot(
            @Nullable PartySnapshot snapshot,
            @Nullable AdventuringDayResult dayResult,
            String statusMessage,
            boolean statusError
    ) {
        PartySnapshot safeSnapshot = snapshot == null ? emptySnapshot() : snapshot;
        @Nullable AdventuringDaySummary daySummary = dayResult == null || dayResult.status() != ReadStatus.SUCCESS
                ? null
                : dayResult.summary();
        Map<Long, RestCadenceStatus> restStatusByMemberId = restStatusByMemberId(daySummary);
        List<MemberModel> activeMembers = safeMembers(safeSnapshot.activeMembers()).stream()
                .map(member -> toMemberModel(member, restStatusByMemberId.get(member.id())))
                .toList();
        List<MemberModel> reserveMembers = safeMembers(safeSnapshot.reserveMembers()).stream()
                .map(member -> toMemberModel(member, restStatusByMemberId.get(member.id())))
                .toList();
        int activeCount = activeMembers.size();
        int averageLevel = safeSnapshot.summary() == null ? averageLevel(activeMembers) : safeSnapshot.summary().averageLevel();
        triggerText.set(activeCount == 0
                ? "Keine _Party ▼"
                : activeCount + " Charaktere, Ø Lv " + averageLevel + " ▼");
        panel.set(new PanelModel(
                false,
                false,
                "",
                activeMembers,
                reserveMembers,
                summaryText(activeMembers, averageLevel),
                restSummary(daySummary),
                statusMessage,
                statusError,
                activeMembers.isEmpty(),
                false,
                EditorPanelModel.hidden()));
    }

    void applyStorageError() {
        mutationInFlight = false;
        triggerText.set("Keine _Party ▼");
        panel.set(new PanelModel(
                false,
                true,
                "Party konnte nicht geladen werden.",
                List.of(),
                List.of(),
                "Keine Party-Mitglieder",
                "",
                "Party konnte nicht geladen werden.",
                true,
                true,
                true,
                EditorPanelModel.hidden()));
    }

    private void showStatus(String message, boolean error) {
        panel.set(safePanel().withStatus(message, error));
    }

    private PanelModel safePanel() {
        PanelModel current = panel.get();
        return current == null ? PanelModel.loadingModel() : current;
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

    private static MemberModel toMemberModel(@Nullable PartyMemberDetails member, @Nullable RestCadenceStatus restStatus) {
        PartyMemberDetails safeMember = member == null
                ? new PartyMemberDetails(0L, "", "", 1, 0, 0, 300, 300, false, 10, 10, 0, 0, 0,
                MembershipState.ACTIVE)
                : member;
        String progression = safe(progressionDetails(safeMember));
        String restText = safe(restStatusText(restStatus));
        LevelProgressDisplay levelProgress = levelProgressDisplay(safeMember);
        return new MemberModel(
                safeMember.id(),
                safe(safeMember.name()),
                safe(safeMember.playerName()),
                safeMember.level(),
                safeMember.currentXp(),
                safeMember.currentLevelXp(),
                safeMember.nextLevelXp(),
                safeMember.passivePerception(),
                safeMember.armorClass(),
                "Lv " + safeMember.level(),
                levelProgress.nextLevelLabel(),
                memberDetails(safeMember),
                progression,
                levelProgress.text(),
                levelProgress.fraction(),
                restText,
                restUrgencyStyleClass(restStatus));
    }

    private static String memberDetails(PartyMemberDetails member) {
        String playerName = safe(member.playerName()).trim();
        String prefix = playerName.isEmpty() ? "" : playerName + "  .  ";
        return prefix + "AC " + member.armorClass() + "  .  PP " + member.passivePerception();
    }

    private static String progressionDetails(PartyMemberDetails member) {
        if (member.level() >= 20) {
            return "Max-Level erreicht";
        }
        if (member.readyToLevel()) {
            return "Level-up bereit";
        }
        return member.xpToNextLevel() + " XP bis Level " + (member.level() + 1);
    }

    private static LevelProgressDisplay levelProgressDisplay(PartyMemberDetails member) {
        int currentXp = Math.max(0, member.currentXp());
        int currentLevelXp = Math.max(0, member.currentLevelXp());
        int nextLevelXp = Math.max(currentLevelXp, member.nextLevelXp());
        if (member.level() >= 20 || nextLevelXp <= currentLevelXp) {
            return new LevelProgressDisplay("Max", formatProgressText(currentXp, currentXp, 100), 1.0);
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
                formatProgressText(currentXp, nextLevelXp, percent),
                fraction);
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

    private static String summaryText(List<MemberModel> activeMembers, int averageLevel) {
        if (activeMembers.isEmpty()) {
            return "Keine Party-Mitglieder";
        }
        double exactAverage = activeMembers.stream().mapToInt(MemberModel::level).average().orElse(1.0);
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

    private static int averageLevel(List<MemberModel> activeMembers) {
        if (activeMembers.isEmpty()) {
            return 1;
        }
        return (int) Math.round(activeMembers.stream().mapToInt(MemberModel::level).average().orElse(1.0));
    }

    private static PartySnapshot emptySnapshot() {
        return new PartySnapshot(List.of(), List.of(), new PartySummary(0, 0, 1));
    }

    private static String safe(@Nullable String value) {
        return value == null ? "" : value;
    }

    public record PanelModel(
            boolean loading,
            boolean storageError,
            String storageMessage,
            List<MemberModel> activeMembers,
            List<MemberModel> reserveMembers,
            String summaryText,
            String restSummaryText,
            String actionStatus,
            boolean actionStatusError,
            boolean restActionsDisabled,
            boolean actionsDisabled,
            EditorPanelModel editorPanel
    ) {

        public PanelModel {
            storageMessage = safe(storageMessage);
            activeMembers = activeMembers == null ? List.of() : List.copyOf(activeMembers);
            reserveMembers = reserveMembers == null ? List.of() : List.copyOf(reserveMembers);
            summaryText = safe(summaryText);
            restSummaryText = safe(restSummaryText);
            actionStatus = safe(actionStatus);
            editorPanel = editorPanel == null ? EditorPanelModel.hidden() : editorPanel;
        }

        static PanelModel loadingModel() {
            return new PanelModel(
                    true,
                    false,
                    "",
                    List.of(),
                    List.of(),
                    "Lade...",
                    "",
                    "",
                    false,
                    true,
                    true,
                    EditorPanelModel.hidden());
        }

        PanelModel withStatus(String status, boolean error) {
            return new PanelModel(
                    loading,
                    storageError,
                    storageMessage,
                    activeMembers,
                    reserveMembers,
                    summaryText,
                    restSummaryText,
                    status,
                    error,
                    restActionsDisabled,
                    actionsDisabled,
                    editorPanel);
        }

        PanelModel withPending(String status) {
            return new PanelModel(
                    loading,
                    storageError,
                    storageMessage,
                    activeMembers,
                    reserveMembers,
                    summaryText,
                    restSummaryText,
                    status,
                    false,
                    true,
                    true,
                    editorPanel);
        }

        PanelModel withEditor(EditorPanelModel nextEditorPanel) {
            return new PanelModel(
                    loading,
                    storageError,
                    storageMessage,
                    activeMembers,
                    reserveMembers,
                    summaryText,
                    restSummaryText,
                    actionStatus,
                    actionStatusError,
                    restActionsDisabled,
                    actionsDisabled,
                    nextEditorPanel);
        }
    }

    public record EditorPanelModel(
            boolean visible,
            boolean editingExisting,
            long memberId,
            String memberName,
            String playerName,
            String rawLevel,
            String rawPassivePerception,
            String rawArmorClass,
            boolean deleteConfirmationVisible
    ) {

        public EditorPanelModel {
            memberId = Math.max(0L, memberId);
            memberName = safe(memberName);
            playerName = safe(playerName);
            rawLevel = safe(rawLevel);
            rawPassivePerception = safe(rawPassivePerception);
            rawArmorClass = safe(rawArmorClass);
        }

        static EditorPanelModel hidden() {
            return new EditorPanelModel(false, false, 0L, "", "", "1", "10", "10", false);
        }

        static EditorPanelModel createDraft() {
            return new EditorPanelModel(true, false, 0L, "", "", "1", "10", "10", false);
        }

        static EditorPanelModel editDraft(
                long memberId,
                String memberName,
                String playerName,
                String rawLevel,
                String rawPassivePerception,
                String rawArmorClass
        ) {
            return new EditorPanelModel(
                    true,
                    true,
                    memberId,
                    memberName,
                    playerName,
                    rawLevel,
                    rawPassivePerception,
                    rawArmorClass,
                    false);
        }

        EditorPanelModel withDeleteConfirmationVisible(boolean visible) {
            return new EditorPanelModel(
                    this.visible,
                    this.editingExisting,
                    this.memberId,
                    this.memberName,
                    this.playerName,
                    this.rawLevel,
                    this.rawPassivePerception,
                    this.rawArmorClass,
                    visible);
        }
    }

    public record MemberModel(
            @Nullable Long id,
            String name,
            String playerName,
            int level,
            int currentXp,
            int currentLevelXp,
            int nextLevelXp,
            int passivePerception,
            int armorClass,
            String levelLabel,
            String nextLevelLabel,
            String detailsText,
            String progressionText,
            String levelProgressText,
            double levelProgressFraction,
            String restText,
            String restStyleClass
    ) {

        public MemberModel {
            name = safe(name);
            playerName = safe(playerName);
            levelLabel = safe(levelLabel);
            nextLevelLabel = safe(nextLevelLabel);
            detailsText = safe(detailsText);
            progressionText = safe(progressionText);
            levelProgressText = safe(levelProgressText);
            levelProgressFraction = Math.max(0.0, Math.min(1.0, levelProgressFraction));
            restText = safe(restText);
            restStyleClass = safe(restStyleClass);
        }
    }

    private record LevelProgressDisplay(String nextLevelLabel, String text, double fraction) {
    }

    public record ActionResult(boolean accepted, boolean pending, String message) {

        public ActionResult {
            message = safe(message);
        }

        static ActionResult success() {
            return new ActionResult(true, false, "");
        }

        static ActionResult failure(String message) {
            return new ActionResult(false, false, message);
        }

        static ActionResult pending(String message) {
            return new ActionResult(false, true, message);
        }
    }

    record PanelData(
            @Nullable PartySnapshotResult snapshotResult,
            @Nullable AdventuringDayResult dayResult
    ) {
    }

    record MutationAndLoadResult(
            @Nullable MutationResult mutationResult,
            @Nullable PanelData panelData,
            String successMessage
    ) {

        MutationAndLoadResult {
            successMessage = safe(successMessage);
        }
    }
}
