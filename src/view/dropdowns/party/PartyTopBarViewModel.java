package src.view.dropdowns.party;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;
import javafx.beans.property.ReadOnlyObjectProperty;
import javafx.beans.property.ReadOnlyObjectWrapper;
import javafx.beans.property.ReadOnlyStringProperty;
import javafx.beans.property.ReadOnlyStringWrapper;
import org.jspecify.annotations.Nullable;
import src.domain.party.PartyApplicationService;
import src.domain.party.published.AdventuringDayResult;
import src.domain.party.published.AdventuringDaySummary;
import src.domain.party.published.AwardPartyXpCommand;
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
    private final ReadOnlyStringWrapper triggerText = new ReadOnlyStringWrapper("Keine Party v");
    private final ReadOnlyObjectWrapper<PanelModel> panel =
            new ReadOnlyObjectWrapper<>(PanelModel.loadingModel());

    public PartyTopBarViewModel(PartyApplicationService party) {
        this.party = Objects.requireNonNull(party, "party");
    }

    public ReadOnlyStringProperty triggerTextProperty() {
        return triggerText.getReadOnlyProperty();
    }

    public ReadOnlyObjectProperty<PanelModel> panelProperty() {
        return panel.getReadOnlyProperty();
    }

    public void refresh() {
        panel.set(PanelModel.loadingModel());
        PartySnapshotResult snapshotResult = party.loadSnapshot(new LoadPartySnapshotQuery());
        if (snapshotResult == null || snapshotResult.status() != ReadStatus.SUCCESS) {
            applyStorageError();
            return;
        }
        AdventuringDayResult dayResult = party.loadAdventuringDaySummary(new LoadAdventuringDaySummaryQuery());
        applySnapshot(snapshotResult.snapshot(), dayResult);
    }

    public boolean addExisting(@Nullable Long id, String name) {
        if (id == null || id.longValue() <= 0) {
            showStatus("Charakter konnte nicht gefunden werden.", true);
            return false;
        }
        long characterId = id.longValue();
        MutationResult result = party.setMembership(new SetPartyMembershipCommand(characterId, MembershipState.ACTIVE));
        return applyMutation(result, displayName(name) + " wurde zur aktiven Party hinzugefuegt.");
    }

    public boolean createCharacter(CharacterDraftModel draft) {
        CharacterDraftModel safeDraft = draft == null ? CharacterDraftModel.empty() : draft;
        MutationResult result = party.createCharacter(new CreateCharacterCommand(toCharacterDraft(safeDraft), MembershipState.ACTIVE));
        return applyMutation(result, displayName(safeDraft.name()) + " wurde erstellt und zur Party hinzugefuegt.");
    }

    public boolean updateCharacter(CharacterDraftModel draft) {
        CharacterDraftModel safeDraft = draft == null ? CharacterDraftModel.empty() : draft;
        Long draftId = safeDraft.id();
        if (draftId == null || draftId.longValue() <= 0) {
            showStatus("Charakter konnte nicht gefunden werden.", true);
            return false;
        }
        long characterId = draftId.longValue();
        MutationResult result = party.updateCharacter(new UpdateCharacterCommand(characterId, toCharacterDraft(safeDraft)));
        return applyMutation(result, displayName(safeDraft.name()) + " wurde gespeichert.");
    }

    public boolean deleteCharacter(@Nullable Long id, String name) {
        if (id == null || id.longValue() <= 0) {
            showStatus("Charakter konnte nicht gefunden werden.", true);
            return false;
        }
        long characterId = id.longValue();
        MutationResult result = party.deleteCharacter(new DeleteCharacterCommand(characterId));
        return applyMutation(result, displayName(name) + " wurde geloescht.");
    }

    public boolean removeFromParty(@Nullable Long id, String name) {
        if (id == null || id.longValue() <= 0) {
            showStatus("Charakter konnte nicht gefunden werden.", true);
            return false;
        }
        long characterId = id.longValue();
        MutationResult result = party.setMembership(new SetPartyMembershipCommand(characterId, MembershipState.RESERVE));
        return applyMutation(result, displayName(name) + " wurde aus der aktiven Party entfernt.");
    }

    public boolean awardXp(@Nullable Long id, String name, String rawXp) {
        int xp = parsePositiveInt(rawXp);
        if (xp <= 0) {
            showStatus("XP muss groesser als 0 sein.", true);
            return false;
        }
        if (id == null || id.longValue() <= 0) {
            showStatus("Charakter konnte nicht gefunden werden.", true);
            return false;
        }
        long characterId = id.longValue();
        MutationResult result = party.awardXp(new AwardPartyXpCommand(List.of(characterId), xp));
        return applyMutation(result, displayName(name) + " erhielt " + xp + " XP.");
    }

    public boolean shortRest() {
        MutationResult result = party.performRest(new PerformPartyRestCommand(RestType.SHORT_REST));
        return applyMutation(result, "Short Rest wurde fuer die aktive Party ausgefuehrt.");
    }

    public boolean longRest() {
        MutationResult result = party.performRest(new PerformPartyRestCommand(RestType.LONG_REST));
        return applyMutation(result, "Long Rest wurde fuer die aktive Party ausgefuehrt.");
    }

    private void applySnapshot(@Nullable PartySnapshot snapshot, @Nullable AdventuringDayResult dayResult) {
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
                ? "Keine Party v"
                : activeCount + " Charaktere, Avg Lv " + averageLevel + " v");
        panel.set(new PanelModel(
                false,
                false,
                "",
                activeMembers,
                reserveMembers,
                summaryText(activeMembers, averageLevel),
                restSummary(daySummary),
                "",
                false,
                activeMembers.isEmpty()));
    }

    private void applyStorageError() {
        triggerText.set("Keine Party");
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
                true));
    }

    private void showStatus(String message, boolean error) {
        PanelModel current = panel.get();
        PanelModel safeCurrent = current == null ? PanelModel.loadingModel() : current;
        panel.set(safeCurrent.withStatus(message, error));
    }

    private boolean applyMutation(@Nullable MutationResult result, String successMessage) {
        MutationStatus status = result == null ? MutationStatus.STORAGE_ERROR : result.status();
        if (status == MutationStatus.SUCCESS) {
            refresh();
            showStatus(successMessage, false);
            return true;
        }
        showStatus(mutationMessage(status), true);
        return false;
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

    private static CharacterDraft toCharacterDraft(CharacterDraftModel draft) {
        CharacterDraftModel safeDraft = draft == null ? CharacterDraftModel.empty() : draft;
        return new CharacterDraft(
                safeDraft.name(),
                safeDraft.playerName(),
                safeDraft.level(),
                safeDraft.passivePerception(),
                safeDraft.armorClass());
    }

    private static MemberModel toMemberModel(@Nullable PartyMemberDetails member, @Nullable RestCadenceStatus restStatus) {
        PartyMemberDetails safeMember = member == null
                ? new PartyMemberDetails(0L, "", "", 1, 0, 0, false, 10, 10, 0, 0, 0, MembershipState.ACTIVE)
                : member;
        String progression = safe(progressionDetails(safeMember));
        String restText = safe(restStatusText(restStatus));
        return new MemberModel(
                safeMember.id(),
                safe(safeMember.name()),
                safe(safeMember.playerName()),
                safeMember.level(),
                safeMember.currentXp(),
                safeMember.passivePerception(),
                safeMember.armorClass(),
                "Lv " + safeMember.level(),
                memberDetails(safeMember),
                progression,
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
        return activeMembers.size() + " Charaktere  .  Avg Lv " + String.format(Locale.ROOT, "%.1f", exactAverage)
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

    private static int parsePositiveInt(String rawValue) {
        String trimmed = safe(rawValue).trim();
        if (trimmed.isEmpty()) {
            return 0;
        }
        try {
            return Math.max(0, Integer.parseInt(trimmed));
        } catch (NumberFormatException exception) {
            return 0;
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
            boolean restActionsDisabled
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
                    restActionsDisabled);
        }
    }

    public record MemberModel(
            @Nullable Long id,
            String name,
            String playerName,
            int level,
            int currentXp,
            int passivePerception,
            int armorClass,
            String levelLabel,
            String detailsText,
            String progressionText,
            String restText,
            String restStyleClass
    ) {

        public MemberModel {
            name = safe(name);
            playerName = safe(playerName);
            levelLabel = safe(levelLabel);
            detailsText = safe(detailsText);
            progressionText = safe(progressionText);
            restText = safe(restText);
            restStyleClass = safe(restStyleClass);
        }
    }

    public record CharacterDraftModel(
            @Nullable Long id,
            String name,
            String playerName,
            int level,
            int passivePerception,
            int armorClass
    ) {

        public CharacterDraftModel {
            name = safe(name);
            playerName = safe(playerName);
        }

        static CharacterDraftModel empty() {
            return new CharacterDraftModel(null, "", "", 1, 10, 10);
        }
    }
}
