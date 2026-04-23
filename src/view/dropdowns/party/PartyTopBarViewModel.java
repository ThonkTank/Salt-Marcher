package src.view.dropdowns.party;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;
import javafx.beans.property.ReadOnlyLongProperty;
import javafx.beans.property.ReadOnlyLongWrapper;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import javafx.beans.property.ReadOnlyStringProperty;
import javafx.beans.property.ReadOnlyStringWrapper;
import org.jspecify.annotations.Nullable;
import src.domain.party.PartyApplicationService;
import src.domain.party.published.AdjustPartyXpCommand;
import src.domain.party.published.AdventuringDayResult;
import src.domain.party.published.AdventuringDaySummary;
import src.domain.party.published.CharacterDraft;
import src.domain.party.published.CreateCharacterCommand;
import src.domain.party.published.DeleteCharacterCommand;
import src.domain.party.published.LoadAdventuringDaySummaryQuery;
import src.domain.party.published.LoadPartySnapshotQuery;
import src.domain.party.published.MembershipState;
import src.domain.party.published.MutationResult;
import src.domain.party.published.MutationStatus;
import src.domain.party.published.PartyMemberDetails;
import src.domain.party.published.PartySnapshot;
import src.domain.party.published.PartySnapshotResult;
import src.domain.party.published.PartySummary;
import src.domain.party.published.PerformPartyRestCommand;
import src.domain.party.published.ReadStatus;
import src.domain.party.published.RestCadenceStatus;
import src.domain.party.published.RestCadenceUrgency;
import src.domain.party.published.RestType;
import src.domain.party.published.SetPartyMembershipCommand;
import src.domain.party.published.UpdateCharacterCommand;

public final class PartyTopBarViewModel {

    private final PartyApplicationService party;
    private final ReadOnlyStringWrapper triggerText = new ReadOnlyStringWrapper("Keine _Party \u25bc");
    private final ReadOnlyObjectWrapper<PanelModel> panel =
            new ReadOnlyObjectWrapper<>(PanelModel.loadingModel());
    private final ReadOnlyLongWrapper mutationToken = new ReadOnlyLongWrapper();

    private long nextRequestId;
    private boolean mutationInFlight;

    public PartyTopBarViewModel(PartyApplicationService party) {
        this.party = Objects.requireNonNull(party, "party");
    }

    public ReadOnlyStringProperty triggerTextProperty() {
        return triggerText.getReadOnlyProperty();
    }

    public ReadOnlyObjectProperty<PanelModel> panelProperty() {
        return panel.getReadOnlyProperty();
    }

    public ReadOnlyLongProperty mutationTokenProperty() {
        return mutationToken.getReadOnlyProperty();
    }

    PanelData loadPanelData() {
        PartySnapshotResult snapshotResult = party.loadSnapshot(new LoadPartySnapshotQuery());
        AdventuringDayResult dayResult = snapshotResult == null || snapshotResult.status() != ReadStatus.SUCCESS
                ? null
                : party.loadAdventuringDaySummary(new LoadAdventuringDaySummaryQuery());
        return new PanelData(snapshotResult, dayResult);
    }

    public void refresh() {
        long requestId = nextRequestId();
        panel.set(PanelModel.loadingModel());
        try {
            applyLoadResult(requestId, loadPanelData());
        } catch (RuntimeException exception) {
            applyStorageErrorIfCurrent(requestId);
        }
    }

    public ActionResult addExisting(@Nullable Long id, String name) {
        if (id == null || id.longValue() <= 0) {
            return rejectedMutation("Charakter konnte nicht gefunden werden.");
        }
        long characterId = id.longValue();
        return submitMutation(
                () -> party.setMembership(new SetPartyMembershipCommand(characterId, MembershipState.ACTIVE)),
                displayName(name) + " wurde zur aktiven Party hinzugefuegt.");
    }

    public ActionResult createCharacter(CharacterDraftModel draft) {
        CharacterDraftModel safeDraft = draft == null ? CharacterDraftModel.empty() : draft;
        ParsedDraft parsedDraft = parseCharacterDraft(safeDraft);
        if (!parsedDraft.valid()) {
            return rejectedMutation(parsedDraft.message());
        }
        return submitMutation(
                () -> party.createCharacter(new CreateCharacterCommand(
                        Objects.requireNonNull(parsedDraft.draft()),
                        MembershipState.ACTIVE)),
                displayName(parsedDraft.displayName()) + " wurde erstellt und zur Party hinzugefuegt.");
    }

    public ActionResult updateCharacter(CharacterDraftModel draft) {
        CharacterDraftModel safeDraft = draft == null ? CharacterDraftModel.empty() : draft;
        Long draftId = safeDraft.id();
        if (draftId == null || draftId.longValue() <= 0) {
            return rejectedMutation("Charakter konnte nicht gefunden werden.");
        }
        ParsedDraft parsedDraft = parseCharacterDraft(safeDraft);
        if (!parsedDraft.valid()) {
            return rejectedMutation(parsedDraft.message());
        }
        long characterId = draftId.longValue();
        return submitMutation(
                () -> party.updateCharacter(new UpdateCharacterCommand(
                        characterId,
                        Objects.requireNonNull(parsedDraft.draft()))),
                displayName(parsedDraft.displayName()) + " wurde gespeichert.");
    }

    public ActionResult deleteCharacter(@Nullable Long id, String name) {
        if (id == null || id.longValue() <= 0) {
            return rejectedMutation("Charakter konnte nicht gefunden werden.");
        }
        long characterId = id.longValue();
        return submitMutation(
                () -> party.deleteCharacter(new DeleteCharacterCommand(characterId)),
                displayName(name) + " wurde geloescht.");
    }

    public ActionResult removeFromParty(@Nullable Long id, String name) {
        if (id == null || id.longValue() <= 0) {
            return rejectedMutation("Charakter konnte nicht gefunden werden.");
        }
        long characterId = id.longValue();
        return submitMutation(
                () -> party.setMembership(new SetPartyMembershipCommand(characterId, MembershipState.RESERVE)),
                displayName(name) + " wurde aus der aktiven Party entfernt.");
    }

    public ActionResult adjustXp(@Nullable Long id, String name, int xpDelta) {
        if (xpDelta == 0) {
            return rejectedMutation("XP-Korrektur darf nicht 0 sein.");
        }
        if (id == null || id.longValue() <= 0) {
            return rejectedMutation("Charakter konnte nicht gefunden werden.");
        }
        long characterId = id.longValue();
        int amount = Math.abs(xpDelta);
        return submitMutation(
                () -> party.adjustXp(new AdjustPartyXpCommand(List.of(characterId), xpDelta)),
                xpDelta > 0
                        ? displayName(name) + " erhielt " + amount + " XP."
                        : displayName(name) + " verlor bis zu " + amount + " XP.");
    }

    public ActionResult shortRest() {
        return submitMutation(
                () -> party.performRest(new PerformPartyRestCommand(RestType.SHORT_REST)),
                "Short Rest wurde fuer die aktive Party ausgefuehrt.");
    }

    public ActionResult longRest() {
        return submitMutation(
                () -> party.performRest(new PerformPartyRestCommand(RestType.LONG_REST)),
                "Long Rest wurde fuer die aktive Party ausgefuehrt.");
    }

    private void applyLoadResult(long requestId, PanelData data) {
        if (!currentRequest(requestId)) {
            return;
        }
        PartySnapshotResult snapshotResult = data == null ? null : data.snapshotResult();
        if (snapshotResult == null || snapshotResult.status() != ReadStatus.SUCCESS) {
            applyStorageError();
            return;
        }
        applySnapshot(snapshotResult.snapshot(), data.dayResult(), "", false);
    }

    private void applyStorageErrorIfCurrent(long requestId) {
        if (currentRequest(requestId)) {
            applyStorageError();
        }
    }

    private ActionResult submitMutation(MutationOperation operation, String successMessage) {
        if (mutationInFlight) {
            return rejectedMutation("Party-Aktion laeuft bereits.");
        }
        long requestId = nextRequestId();
        mutationInFlight = true;
        panel.set(safePanel().withPending("Speichere..."));
        try {
            return applyMutationResult(requestId, loadAfterMutation(operation, successMessage));
        } catch (RuntimeException exception) {
            return applyMutationFailure(requestId);
        }
    }

    private MutationAndLoadResult loadAfterMutation(
            MutationOperation operation,
            String successMessage
    ) {
        MutationResult mutationResult = operation.get();
        MutationStatus status = mutationResult == null ? MutationStatus.STORAGE_ERROR : mutationResult.status();
        PanelData data = status == MutationStatus.SUCCESS ? loadPanelData() : null;
        return new MutationAndLoadResult(mutationResult, data, successMessage);
    }

    private ActionResult applyMutationResult(long requestId, MutationAndLoadResult result) {
        if (!currentRequest(requestId)) {
            return ActionResult.failure("Party-Aktion wurde von einer neueren Anfrage ueberholt.");
        }
        mutationInFlight = false;
        MutationStatus status = result == null || result.mutationResult() == null
                ? MutationStatus.STORAGE_ERROR
                : result.mutationResult().status();
        if (status != MutationStatus.SUCCESS) {
            String message = mutationMessage(status);
            showStatus(message, true);
            return ActionResult.failure(message);
        }
        PanelData data = result.panelData();
        if (data == null) {
            String message = "Party konnte nach der Aenderung nicht neu geladen werden.";
            applyStorageError();
            showStatus(message, true);
            return ActionResult.failure(message);
        }
        PartySnapshotResult snapshotResult = data.snapshotResult();
        if (snapshotResult == null || snapshotResult.status() != ReadStatus.SUCCESS) {
            String message = "Party konnte nach der Aenderung nicht neu geladen werden.";
            applyStorageError();
            showStatus(message, true);
            return ActionResult.failure(message);
        }
        applySnapshot(snapshotResult.snapshot(), data.dayResult(), result.successMessage(), false);
        publishMutation();
        return ActionResult.success();
    }

    private ActionResult applyMutationFailure(long requestId) {
        if (!currentRequest(requestId)) {
            return ActionResult.failure("Party-Aktion wurde von einer neueren Anfrage ueberholt.");
        }
        mutationInFlight = false;
        String message = "Party-Aktion konnte nicht gespeichert werden.";
        showStatus(message, true);
        return ActionResult.failure(message);
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
                ? "Keine _Party \u25bc"
                : activeCount + " Charaktere, \u00d8 Lv " + averageLevel + " \u25bc");
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
                false));
    }

    private void applyStorageError() {
        mutationInFlight = false;
        triggerText.set("Keine _Party \u25bc");
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
                true));
    }

    private void showStatus(String message, boolean error) {
        PanelModel current = panel.get();
        PanelModel safeCurrent = current == null ? PanelModel.loadingModel() : current;
        panel.set(safeCurrent.withStatus(message, error));
    }

    private PanelModel safePanel() {
        PanelModel current = panel.get();
        return current == null ? PanelModel.loadingModel() : current;
    }

    private long nextRequestId() {
        return ++nextRequestId;
    }

    private boolean currentRequest(long requestId) {
        return requestId == nextRequestId;
    }

    private void publishMutation() {
        mutationToken.set(mutationToken.get() + 1L);
    }

    private ActionResult rejectedMutation(String message) {
        showStatus(message, true);
        return ActionResult.failure(message);
    }

    private static String mutationMessage(@Nullable MutationStatus status) {
        if (status == MutationStatus.NOT_FOUND) {
            return "Charakter konnte nicht gefunden werden.";
        }
        if (status == MutationStatus.INVALID_INPUT) {
            return "Eingaben sind ungueltig.";
        }
        return "Party-Aktion konnte nicht gespeichert werden.";
    }

    private static ParsedDraft parseCharacterDraft(CharacterDraftModel draft) {
        CharacterDraftModel safeDraft = draft == null ? CharacterDraftModel.empty() : draft;
        String name = safe(safeDraft.name()).trim();
        if (name.isEmpty()) {
            return ParsedDraft.invalid("Charaktername fehlt.");
        }
        ParsedInteger level = parseInteger(safeDraft.rawLevel(), "Level", 1, 20);
        if (!level.valid()) {
            return ParsedDraft.invalid(level.message());
        }
        ParsedInteger passivePerception = parseInteger(safeDraft.rawPassivePerception(), "Passive Perception", 1, 99);
        if (!passivePerception.valid()) {
            return ParsedDraft.invalid(passivePerception.message());
        }
        ParsedInteger armorClass = parseInteger(safeDraft.rawArmorClass(), "AC", 1, 99);
        if (!armorClass.valid()) {
            return ParsedDraft.invalid(armorClass.message());
        }
        return ParsedDraft.valid(new CharacterDraft(
                name,
                safe(safeDraft.playerName()).trim(),
                level.value(),
                passivePerception.value(),
                armorClass.value()));
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

    private static ParsedInteger parseInteger(String rawValue, String label, int min, int max) {
        String trimmed = safe(rawValue).trim();
        if (trimmed.isEmpty()) {
            return ParsedInteger.invalid(label + " fehlt.");
        }
        try {
            int value = Integer.parseInt(trimmed);
            if (value < min || value > max) {
                return ParsedInteger.invalid(label + " muss zwischen " + min + " und " + max + " liegen.");
            }
            return ParsedInteger.valid(value);
        } catch (NumberFormatException exception) {
            return ParsedInteger.invalid(label + " muss eine Zahl sein.");
        }
    }

    private static String displayName(String name) {
        String safeName = safe(name).trim();
        return safeName.isEmpty() ? "Der Charakter" : safeName;
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
            boolean actionsDisabled
    ) {

        public PanelModel {
            storageMessage = safe(storageMessage);
            activeMembers = activeMembers == null ? List.of() : List.copyOf(activeMembers);
            reserveMembers = reserveMembers == null ? List.of() : List.copyOf(reserveMembers);
            summaryText = safe(summaryText);
            restSummaryText = safe(restSummaryText);
            actionStatus = safe(actionStatus);
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
                    true);
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
                    actionsDisabled);
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
                    true);
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

    public record CharacterDraftModel(
            @Nullable Long id,
            String name,
            String playerName,
            String rawLevel,
            String rawPassivePerception,
            String rawArmorClass
    ) {

        public CharacterDraftModel {
            name = safe(name);
            playerName = safe(playerName);
            rawLevel = safe(rawLevel);
            rawPassivePerception = safe(rawPassivePerception);
            rawArmorClass = safe(rawArmorClass);
        }

        static CharacterDraftModel empty() {
            return new CharacterDraftModel(null, "", "", "1", "10", "10");
        }
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

    private record ParsedDraft(@Nullable CharacterDraft draft, String message) {

        ParsedDraft {
            message = safe(message);
        }

        boolean valid() {
            return draft != null && message.isBlank();
        }

        String displayName() {
            return draft == null ? "" : draft.name();
        }

        static ParsedDraft valid(CharacterDraft draft) {
            return new ParsedDraft(draft, "");
        }

        static ParsedDraft invalid(String message) {
            return new ParsedDraft(null, message);
        }
    }

    private record ParsedInteger(int value, String message) {

        ParsedInteger {
            message = safe(message);
        }

        boolean valid() {
            return message.isBlank();
        }

        static ParsedInteger valid(int value) {
            return new ParsedInteger(value, "");
        }

        static ParsedInteger invalid(String message) {
            return new ParsedInteger(0, message);
        }
    }

    @FunctionalInterface
    private interface MutationOperation {
        MutationResult get();
    }

    record PanelData(
            @Nullable PartySnapshotResult snapshotResult,
            @Nullable AdventuringDayResult dayResult
    ) {
    }

    private record MutationAndLoadResult(
            @Nullable MutationResult mutationResult,
            @Nullable PanelData panelData,
            String successMessage
    ) {

        MutationAndLoadResult {
            successMessage = safe(successMessage);
        }
    }
}
