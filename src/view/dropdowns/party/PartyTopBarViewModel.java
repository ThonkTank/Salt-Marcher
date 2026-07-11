package src.view.dropdowns.party;

import java.util.List;
import java.util.Locale;
import java.util.Optional;
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
import src.domain.party.published.MembershipState;
import src.domain.party.published.MutationResult;
import src.domain.party.published.MutationStatus;
import src.domain.party.published.PartyMemberDetails;
import src.domain.party.published.PartySnapshot;
import src.domain.party.published.PartySnapshotResult;
import src.domain.party.published.PerformPartyRestCommand;
import src.domain.party.published.ReadStatus;
import src.domain.party.published.RestCadenceStatus;
import src.domain.party.published.RestCadenceUrgency;
import src.domain.party.published.RestType;
import src.domain.party.published.SetPartyMembershipCommand;
import src.domain.party.published.UpdateCharacterCommand;

@SuppressWarnings({
        "PMD.CouplingBetweenObjects",
        "PMD.CyclomaticComplexity",
        "PMD.GodClass",
        "PMD.PublicMemberInNonPublicType",
        "PMD.TooManyMethods"
})
final class PartyTopBarViewModel {

    private static final int MAX_CHARACTER_LEVEL = 20;
    private static final long NO_MEMBER_ID = 0L;
    private static final String CHARACTER_NOT_FOUND = "Charakter konnte nicht gefunden werden.";

    private final ReadOnlyStringWrapper headerTitle =
            new ReadOnlyStringWrapper(PartyTopBarVocabulary.HEADER_TITLE);
    private final ReadOnlyStringWrapper triggerText =
            new ReadOnlyStringWrapper(PartyTopBarVocabulary.EMPTY_TRIGGER_TEXT);
    private final ReadOnlyObjectWrapper<PanelContent> panelContent =
            new ReadOnlyObjectWrapper<>(PanelContent.loadingContent());
    private final ReadOnlyObjectWrapper<EditorPanelModel> editorPanel =
            new ReadOnlyObjectWrapper<>(EditorPanelModel.hidden());
    private final MutationState mutationState = new MutationState();

    ReadOnlyStringProperty headerTitleProperty() {
        return headerTitle.getReadOnlyProperty();
    }

    ReadOnlyStringProperty triggerTextProperty() {
        return triggerText.getReadOnlyProperty();
    }

    ReadOnlyObjectProperty<PanelContent> panelContentProperty() {
        return panelContent.getReadOnlyProperty();
    }

    ReadOnlyObjectProperty<EditorPanelModel> editorPanelProperty() {
        return editorPanel.getReadOnlyProperty();
    }

    void applyLoadResult(PanelData data) {
        PartySnapshotResult snapshotResult = data == null ? null : data.snapshotResult();
        if (snapshotResult == null || snapshotResult.status() != ReadStatus.SUCCESS) {
            if (mutationState.inFlight()) {
                showPending("Speichere...");
                showActionsDisabled(true);
                return;
            }
            applyStorageError(currentEditorPanel());
            return;
        }
        applySnapshot(
                snapshotResult.snapshot(),
                data.dayResult(),
                "",
                false,
                currentEditorPanel());
    }

    void applyMutationResult(MutationAndLoadResult result) {
        boolean hideEditorOnSuccess = mutationState.hideEditorOnSuccess();
        String successMessage = mutationState.successMessage();
        mutationState.clear();
        MutationStatus status = result == null || result.mutationResult() == null
                ? MutationStatus.STORAGE_ERROR
                : result.mutationResult().status();
        if (status != MutationStatus.SUCCESS) {
            showActionsDisabled(false);
            showReadyStatus(mutationMessage(status), true);
            return;
        }
        PanelData data = result.panelData();
        if (!hasSuccessfulSnapshot(data)) {
            applyStorageError(currentEditorPanel());
            showStatus("Party konnte nach der \u00c4nderung nicht neu geladen werden.", true);
            return;
        }
        applySnapshot(
                data.snapshotResult().snapshot(),
                data.dayResult(),
                successMessage,
                false,
                hideEditorOnSuccess ? EditorPanelModel.hidden() : currentEditorPanel().withActionsDisabled(false));
    }

    void showReserveSearch(String searchText) {
        showPanel(safePanel().withReserveSearch(searchText));
    }

    void openCreateEditor() {
        showEditor(EditorPanelModel.createDraft());
    }

    boolean openEditEditor(long memberId) {
        MemberModel member = findMember(memberId);
        if (member == null) {
            return false;
        }
        showEditor(EditorPanelModel.editDraft(
                memberId,
                member.name(),
                member.playerName(),
                Integer.toString(member.level()),
                Integer.toString(member.passivePerception()),
                Integer.toString(member.armorClass())));
        return true;
    }

    void rejectMissingCharacter() {
        rejectMutation(CHARACTER_NOT_FOUND);
    }

    Optional<SetPartyMembershipCommand> prepareMembership(long memberId, MembershipState membershipState) {
        if (!validId(memberId)) {
            rejectMutation(CHARACTER_NOT_FOUND);
            return Optional.empty();
        }
        String successSuffix = membershipState == MembershipState.ACTIVE
                ? " wurde zur aktiven Party hinzugef\u00fcgt."
                : " wurde aus der aktiven Party entfernt.";
        String successMessage = displayName(memberName(memberId)) + successSuffix;
        if (!beginMutation(successMessage, false)) {
            return Optional.empty();
        }
        return Optional.of(new SetPartyMembershipCommand(memberId, membershipState));
    }

    Optional<AdjustPartyXpCommand> prepareXp(long memberId, int xpDelta) {
        if (xpDelta == 0) {
            rejectMutation("XP-Korrektur darf nicht 0 sein.");
            return Optional.empty();
        }
        if (!validId(memberId)) {
            rejectMutation(CHARACTER_NOT_FOUND);
            return Optional.empty();
        }
        String memberName = memberName(memberId);
        int amount = Math.abs(xpDelta);
        String successMessage = xpDelta > 0
                ? displayName(memberName) + " erhielt " + amount + " XP."
                : displayName(memberName) + " verlor bis zu " + amount + " XP.";
        if (!beginMutation(successMessage, false)) {
            return Optional.empty();
        }
        return Optional.of(new AdjustPartyXpCommand(List.of(memberId), xpDelta));
    }

    Optional<PerformPartyRestCommand> prepareRest(RestType restType) {
        String successMessage = restType == RestType.LONG_REST
                ? "Long Rest wurde f\u00fcr die aktive Party ausgef\u00fchrt."
                : "Short Rest wurde f\u00fcr die aktive Party ausgef\u00fchrt.";
        if (!beginMutation(successMessage, false)) {
            return Optional.empty();
        }
        return Optional.of(new PerformPartyRestCommand(restType));
    }

    void syncDraft(EditorDraft draft) {
        if (!currentEditorPanel().visible()) {
            return;
        }
        EditorDraft safeDraft = draft == null ? EditorDraft.empty() : draft;
        showEditor(currentEditorPanel().withDraft(
                safeDraft.name(),
                safeDraft.playerName(),
                safeDraft.rawLevel(),
                safeDraft.rawPassivePerception(),
                safeDraft.rawArmorClass()));
    }

    void cancelEditor() {
        showEditor(EditorPanelModel.hidden());
    }

    void requestDeleteConfirmation() {
        showEditor(currentEditorPanel().withDeleteConfirmationVisible(true));
    }

    void cancelDeleteConfirmation() {
        showEditor(currentEditorPanel().withDeleteConfirmationVisible(false));
    }

    Optional<SubmitCommand> prepareSubmit(EditorDraft draft) {
        syncDraft(draft);
        EditorPanelModel current = currentEditorPanel();
        if (current.editingExisting()) {
            return prepareUpdateCharacter(current.memberId(), draft).map(SubmitCommand::update);
        }
        return prepareCreateCharacter(draft).map(SubmitCommand::create);
    }

    Optional<DeleteCharacterCommand> prepareDeleteConfirmed(EditorDraft draft) {
        syncDraft(draft);
        EditorPanelModel current = currentEditorPanel();
        if (!validId(current.memberId())) {
            rejectMutation(CHARACTER_NOT_FOUND);
            return Optional.empty();
        }
        String successMessage = displayName(current.deleteTargetName()) + " wurde gel\u00f6scht.";
        if (!beginMutation(successMessage, true)) {
            return Optional.empty();
        }
        return Optional.of(new DeleteCharacterCommand(current.memberId()));
    }

    private Optional<CreateCharacterCommand> prepareCreateCharacter(EditorDraft draft) {
        ParsedDraft parsedDraft = DraftParser.parse(draft);
        if (!parsedDraft.valid()) {
            rejectMutation(parsedDraft.message);
            return Optional.empty();
        }
        String name = safe(parsedDraft.name);
        String successMessage = displayName(name) + " wurde erstellt und zur Party hinzugef\u00fcgt.";
        if (!beginMutation(successMessage, true)) {
            return Optional.empty();
        }
        return Optional.of(new CreateCharacterCommand(
                new CharacterDraft(
                        name,
                        parsedDraft.playerName,
                        parsedDraft.level,
                        parsedDraft.passivePerception,
                        parsedDraft.armorClass),
                MembershipState.ACTIVE));
    }

    private Optional<UpdateCharacterCommand> prepareUpdateCharacter(long memberId, EditorDraft draft) {
        if (!validId(memberId)) {
            rejectMutation(CHARACTER_NOT_FOUND);
            return Optional.empty();
        }
        ParsedDraft parsedDraft = DraftParser.parse(draft);
        if (!parsedDraft.valid()) {
            rejectMutation(parsedDraft.message);
            return Optional.empty();
        }
        String name = safe(parsedDraft.name);
        String successMessage = displayName(name) + " wurde gespeichert.";
        if (!beginMutation(successMessage, true)) {
            return Optional.empty();
        }
        return Optional.of(new UpdateCharacterCommand(
                memberId,
                new CharacterDraft(
                        name,
                        parsedDraft.playerName,
                        parsedDraft.level,
                        parsedDraft.passivePerception,
                        parsedDraft.armorClass)));
    }

    private void applySnapshot(
            @Nullable PartySnapshot snapshot,
            @Nullable AdventuringDayResult dayResult,
            String statusMessage,
            boolean statusError,
            EditorPanelModel editorPanelModel
    ) {
        SnapshotPresentation presentation = SnapshotPresentation.from(
                snapshot,
                dayResult,
                reserveSearchText(),
                mutationState.inFlight());
        triggerText.set(presentation.triggerText);
        showPanel(new PanelContent(
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
            showPending("Speichere...");
        }
        showEditor(editorPanelModel);
    }

    private void applyStorageError(EditorPanelModel editorPanelModel) {
        mutationState.clear();
        triggerText.set(PartyTopBarVocabulary.EMPTY_TRIGGER_TEXT);
        showPanel(new PanelContent(
                false,
                true,
                PartyTopBarVocabulary.STORAGE_ERROR,
                List.of(),
                List.of(),
                reserveSearchText(),
                "Keine Party-Mitglieder",
                "",
                PartyTopBarVocabulary.STORAGE_ERROR,
                true,
                true,
                true));
        showEditor(editorPanelModel.withActionsDisabled(false));
    }

    private boolean beginMutation(String successMessage, boolean hideEditorOnSuccess) {
        if (!mutationState.begin(successMessage, hideEditorOnSuccess)) {
            rejectMutation("Party-Aktion laeuft bereits.");
            return false;
        }
        showPending("Speichere...");
        showActionsDisabled(true);
        return true;
    }

    private void rejectMutation(String message) {
        showStatus(message, true);
    }

    private void showPanel(PanelContent content) {
        panelContent.set(content == null ? PanelContent.loadingContent() : content);
    }

    private void showPending(String status) {
        showPanel(safePanel().withPending(status));
    }

    private void showStatus(String status, boolean error) {
        showPanel(safePanel().withStatus(status, error));
    }

    private void showReadyStatus(String status, boolean error) {
        showPanel(safePanel().withReadyStatus(status, error));
    }

    private void showEditor(EditorPanelModel content) {
        editorPanel.set(content == null ? EditorPanelModel.hidden() : content);
    }

    private void showActionsDisabled(boolean actionsDisabled) {
        showEditor(currentEditorPanel().withActionsDisabled(actionsDisabled));
    }

    private PanelContent safePanel() {
        PanelContent current = panelContent.get();
        return current == null ? PanelContent.loadingContent() : current;
    }

    private EditorPanelModel currentEditorPanel() {
        EditorPanelModel current = editorPanel.get();
        return current == null ? EditorPanelModel.hidden() : current;
    }

    private String reserveSearchText() {
        return safePanel().reserveSearchText();
    }

    private @Nullable MemberModel findMember(long memberId) {
        if (!validId(memberId)) {
            return null;
        }
        PanelContent safePanel = safePanel();
        for (MemberModel member : safePanel.activeMembers()) {
            if (member.id() == memberId) {
                return member;
            }
        }
        for (MemberModel member : safePanel.reserveMembers()) {
            if (member.id() == memberId) {
                return member;
            }
        }
        return null;
    }

    private String memberName(long memberId) {
        MemberModel member = findMember(memberId);
        return member == null ? "" : member.name();
    }

    private static boolean hasSuccessfulSnapshot(@Nullable PanelData data) {
        return data != null && data.snapshotResult() != null && data.snapshotResult().status() == ReadStatus.SUCCESS;
    }

    private static String mutationMessage(@Nullable MutationStatus status) {
        if (status == MutationStatus.NOT_FOUND) {
            return CHARACTER_NOT_FOUND;
        }
        if (status == MutationStatus.INVALID_INPUT) {
            return "Eingaben sind ung\u00fcltig.";
        }
        return "Party-Aktion konnte nicht gespeichert werden.";
    }

    private static boolean validId(long id) {
        return id > NO_MEMBER_ID;
    }

    private static String displayName(String name) {
        String safeName = safe(name).trim();
        return safeName.isEmpty() ? "Der Charakter" : safeName;
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

    record SubmitCommand(
            @Nullable CreateCharacterCommand createCommand,
            @Nullable UpdateCharacterCommand updateCommand
    ) {

        static SubmitCommand create(CreateCharacterCommand command) {
            return new SubmitCommand(command, null);
        }

        static SubmitCommand update(UpdateCharacterCommand command) {
            return new SubmitCommand(null, command);
        }

        void dispatch(PartyApplicationService partyService) {
            if (createCommand != null) {
                partyService.createCharacter(createCommand);
            } else if (updateCommand != null) {
                partyService.updateCharacter(updateCommand);
            }
        }
    }

    record EditorDraft(
            String name,
            String playerName,
            String rawLevel,
            String rawPassivePerception,
            String rawArmorClass
    ) {

        EditorDraft {
            name = safe(name);
            playerName = safe(playerName);
            rawLevel = safe(rawLevel);
            rawPassivePerception = safe(rawPassivePerception);
            rawArmorClass = safe(rawArmorClass);
        }

        static EditorDraft empty() {
            return new EditorDraft("", "", "", "", "");
        }
    }

    record PanelContent(
            boolean loading,
            boolean storageError,
            String storageMessage,
            List<MemberModel> activeMembers,
            List<MemberModel> allReserveMembers,
            String reserveSearchText,
            String summaryText,
            String restSummaryText,
            String actionStatus,
            boolean actionStatusError,
            boolean restActionsDisabled,
            boolean actionsDisabled
    ) {

        public PanelContent {
            storageMessage = safe(storageMessage);
            activeMembers = activeMembers == null ? List.of() : List.copyOf(activeMembers);
            allReserveMembers = allReserveMembers == null ? List.of() : List.copyOf(allReserveMembers);
            reserveSearchText = safe(reserveSearchText);
            summaryText = safe(summaryText);
            restSummaryText = safe(restSummaryText);
            actionStatus = safe(actionStatus);
        }

        static PanelContent loadingContent() {
            return new PanelContent(
                    true,
                    false,
                    "",
                    List.of(),
                    List.of(),
                    "",
                    PartyTopBarVocabulary.LOADING,
                    "",
                    "",
                    false,
                    true,
                    true);
        }

        public List<MemberModel> reserveMembers() {
            return filteredReserveMembers(allReserveMembers, reserveSearchText);
        }

        PanelContent withStatus(String status, boolean error) {
            return copy(reserveSearchText, status, error, restActionsDisabled, actionsDisabled);
        }

        PanelContent withReadyStatus(String status, boolean error) {
            return copy(reserveSearchText, status, error, activeMembers.isEmpty(), false);
        }

        PanelContent withPending(String status) {
            return copy(reserveSearchText, status, false, true, true);
        }

        PanelContent withReserveSearch(String searchText) {
            return copy(searchText, actionStatus, actionStatusError, restActionsDisabled, actionsDisabled);
        }

        private PanelContent copy(
                String nextReserveSearchText,
                String nextActionStatus,
                boolean nextActionStatusError,
                boolean nextRestActionsDisabled,
                boolean nextActionsDisabled
        ) {
            return new PanelContent(
                    loading,
                    storageError,
                    storageMessage,
                    activeMembers,
                    allReserveMembers,
                    nextReserveSearchText,
                    summaryText,
                    restSummaryText,
                    nextActionStatus,
                    nextActionStatusError,
                    nextRestActionsDisabled,
                    nextActionsDisabled);
        }

        private static List<MemberModel> filteredReserveMembers(List<MemberModel> members, String searchText) {
            String lowerSearch = safe(searchText).trim().toLowerCase(Locale.ROOT);
            if (lowerSearch.isBlank()) {
                return List.copyOf(members);
            }
            return members.stream()
                    .filter(member -> member.name().toLowerCase(Locale.ROOT).contains(lowerSearch))
                    .toList();
        }
    }

    record MemberModel(
            long id,
            String name,
            String playerName,
            int level,
            int passivePerception,
            int armorClass,
            String identityText,
            String combatText,
            String levelLabel,
            String nextLevelLabel,
            String levelProgressText,
            String restText,
            String restStyleClass
    ) {

        public MemberModel {
            id = Math.max(0L, id);
            name = safe(name);
            playerName = safe(playerName);
            level = Math.max(1, level);
            passivePerception = Math.max(0, passivePerception);
            armorClass = Math.max(0, armorClass);
            identityText = safe(identityText);
            combatText = safe(combatText);
            levelLabel = safe(levelLabel);
            nextLevelLabel = safe(nextLevelLabel);
            levelProgressText = safe(levelProgressText);
            restText = safe(restText);
            restStyleClass = safe(restStyleClass);
        }
    }

    record EditorPanelModel(
            boolean visible,
            boolean editingExisting,
            long memberId,
            String memberName,
            String deleteTargetName,
            String playerName,
            String rawLevel,
            String rawPassivePerception,
            String rawArmorClass,
            boolean deleteConfirmationVisible,
            boolean actionsDisabled
    ) {

        public EditorPanelModel {
            memberId = Math.max(0L, memberId);
            memberName = safe(memberName);
            deleteTargetName = safe(deleteTargetName);
            playerName = safe(playerName);
            rawLevel = safe(rawLevel);
            rawPassivePerception = safe(rawPassivePerception);
            rawArmorClass = safe(rawArmorClass);
        }

        static EditorPanelModel hidden() {
            return new EditorPanelModel(false, false, 0L, "", "", "", "1", "10", "10", false, false);
        }

        static EditorPanelModel createDraft() {
            return new EditorPanelModel(true, false, 0L, "", "", "", "1", "10", "10", false, false);
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
                    memberName,
                    playerName,
                    rawLevel,
                    rawPassivePerception,
                    rawArmorClass,
                    false,
                    false);
        }

        EditorPanelModel withDeleteConfirmationVisible(boolean visible) {
            return new EditorPanelModel(
                    this.visible,
                    this.editingExisting,
                    this.memberId,
                    this.memberName,
                    this.deleteTargetName,
                    this.playerName,
                    this.rawLevel,
                    this.rawPassivePerception,
                    this.rawArmorClass,
                    visible,
                    this.actionsDisabled);
        }

        EditorPanelModel withDraft(
                String memberName,
                String playerName,
                String rawLevel,
                String rawPassivePerception,
                String rawArmorClass
        ) {
            return new EditorPanelModel(
                    this.visible,
                    this.editingExisting,
                    this.memberId,
                    memberName,
                    this.deleteTargetName,
                    playerName,
                    rawLevel,
                    rawPassivePerception,
                    rawArmorClass,
                    false,
                    this.actionsDisabled);
        }

        EditorPanelModel withActionsDisabled(boolean actionsDisabled) {
            return new EditorPanelModel(
                    this.visible,
                    this.editingExisting,
                    this.memberId,
                    this.memberName,
                    this.deleteTargetName,
                    this.playerName,
                    this.rawLevel,
                    this.rawPassivePerception,
                    this.rawArmorClass,
                    this.deleteConfirmationVisible,
                    actionsDisabled);
        }
    }

    @SuppressWarnings("PMD.TooManyMethods")
    private static final class SnapshotPresentation {

        private final String triggerText;
        private final List<MemberModel> activeMembers;
        private final List<MemberModel> reserveMembers;
        private final String reserveSearchText;
        private final String summaryText;
        private final String restSummaryText;
        private final boolean restActionsDisabled;
        private final boolean actionsDisabled;

        private SnapshotPresentation(
                String triggerText,
                List<MemberModel> activeMembers,
                List<MemberModel> reserveMembers,
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
            List<MemberModel> activeMembers =
                    memberModels(snapshot == null ? null : snapshot.activeMembers(), daySummary);
            List<MemberModel> reserveMembers =
                    memberModels(snapshot == null ? null : snapshot.reserveMembers(), daySummary);
            int activeCount = activeMembers.size();
            int averageLevel = snapshot == null || snapshot.summary() == null
                    ? averageLevel(activeMembers)
                    : snapshot.summary().averageLevel();
            return new SnapshotPresentation(
                    PartyTopBarVocabulary.triggerText(activeCount, averageLevel),
                    activeMembers,
                    reserveMembers,
                    reserveSearchText,
                    summaryText(activeMembers, averageLevel),
                    restSummary(daySummary),
                    mutationInFlight || activeMembers.isEmpty(),
                    mutationInFlight);
        }

        private static List<MemberModel> memberModels(
                @Nullable List<PartyMemberDetails> members,
                @Nullable AdventuringDaySummary daySummary
        ) {
            return safeMembers(members).stream()
                    .map(member -> memberModel(member, restStatusFor(daySummary, member.id())))
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

        private static MemberModel memberModel(
                @Nullable PartyMemberDetails member,
                @Nullable RestCadenceStatus restStatus
        ) {
            if (member == null) {
                return emptyMemberModel(restStatus);
            }
            String restText = safe(restStatusText(restStatus));
            LevelProgressDisplay levelProgress = levelProgressDisplay(member);
            return new MemberModel(
                    member.id(),
                    safe(member.name()),
                    safe(member.playerName()),
                    member.level(),
                    member.passivePerception(),
                    member.armorClass(),
                    identityText(member),
                    combatText(member),
                    "Lv " + member.level(),
                    levelProgress.nextLevelLabel(),
                    levelProgress.text(),
                    restText,
                    restUrgencyStyleClass(restStatus));
        }

        private static MemberModel emptyMemberModel(@Nullable RestCadenceStatus restStatus) {
            return new MemberModel(
                    0L,
                    "",
                    "",
                    1,
                    10,
                    10,
                    "",
                    "AC 10 | PP 10",
                    "Lv 1",
                    "Lv 2",
                    formatProgressText(0, 300, 0),
                    safe(restStatusText(restStatus)),
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

        private static String summaryText(List<MemberModel> activeMembers, int averageLevel) {
            if (activeMembers.isEmpty()) {
                return "Keine Party-Mitglieder";
            }
            double exactAverage = activeMembers.stream()
                    .mapToInt(MemberModel::level)
                    .average()
                    .orElse(1.0);
            return activeMembers.size() + " Charaktere  .  Schnitt Lv "
                    + String.format(Locale.ROOT, "%.1f", exactAverage) + "  .  Rundung " + averageLevel;
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

        private static List<PartyMemberDetails> safeMembers(@Nullable List<PartyMemberDetails> members) {
            return members == null ? List.of() : List.copyOf(members);
        }

        private static int averageLevel(List<MemberModel> activeMembers) {
            if (activeMembers.isEmpty()) {
                return 1;
            }
            return (int) Math.round(activeMembers.stream()
                    .mapToInt(MemberModel::level)
                    .average()
                    .orElse(1.0));
        }
    }

    private record LevelProgressDisplay(String nextLevelLabel, String text) {
    }

    private static final class MutationState {

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

    private static final class DraftParser {

        private static ParsedDraft parse(EditorDraft draft) {
            String name = safe(draft == null ? "" : draft.name()).trim();
            ParsedInteger level = parseInteger(draft == null ? "" : draft.rawLevel(), "Level", 1, 20);
            ParsedInteger passivePerception = parseInteger(
                    draft == null ? "" : draft.rawPassivePerception(),
                    "Passive Perception",
                    1,
                    99);
            ParsedInteger armorClass = parseInteger(draft == null ? "" : draft.rawArmorClass(), "AC", 1, 99);
            return ParsedDraft.from(
                    name,
                    safe(draft == null ? "" : draft.playerName()).trim(),
                    level,
                    passivePerception,
                    armorClass);
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
    }

    private static final class ParsedDraft {

        private final String name;
        private final String playerName;
        private final int level;
        private final int passivePerception;
        private final int armorClass;
        private final String message;

        private ParsedDraft(
                String name,
                String playerName,
                int level,
                int passivePerception,
                int armorClass,
                String message
        ) {
            this.name = safe(name);
            this.playerName = safe(playerName);
            this.level = level;
            this.passivePerception = passivePerception;
            this.armorClass = armorClass;
            this.message = safe(message);
        }

        private boolean valid() {
            return message.isBlank();
        }

        private static ParsedDraft from(
                String name,
                String playerName,
                ParsedInteger level,
                ParsedInteger passivePerception,
                ParsedInteger armorClass
        ) {
            if (name.isEmpty()) {
                return invalid("Charaktername fehlt.");
            }
            if (!level.valid()) {
                return invalid(level.message);
            }
            if (!passivePerception.valid()) {
                return invalid(passivePerception.message);
            }
            if (!armorClass.valid()) {
                return invalid(armorClass.message);
            }
            return new ParsedDraft(name, playerName, level.value, passivePerception.value, armorClass.value, "");
        }

        private static ParsedDraft invalid(String message) {
            return new ParsedDraft("", "", 0, 0, 0, message);
        }
    }

    private static final class ParsedInteger {

        private final int value;
        private final String message;

        private ParsedInteger(int value, String message) {
            this.value = value;
            this.message = safe(message);
        }

        private boolean valid() {
            return message.isBlank();
        }

        private static ParsedInteger valid(int value) {
            return new ParsedInteger(value, "");
        }

        private static ParsedInteger invalid(String message) {
            return new ParsedInteger(0, message);
        }
    }
}
