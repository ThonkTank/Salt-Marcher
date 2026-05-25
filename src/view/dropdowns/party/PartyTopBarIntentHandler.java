package src.view.dropdowns.party;

import java.util.Objects;
import src.domain.party.PartyApplicationService;
import src.domain.party.published.AdjustPartyXpCommand;
import src.domain.party.published.CharacterDraft;
import src.domain.party.published.CreateCharacterCommand;
import src.domain.party.published.DeleteCharacterCommand;
import src.domain.party.published.MembershipState;
import src.domain.party.published.PerformPartyRestCommand;
import src.domain.party.published.RestType;
import src.domain.party.published.SetPartyMembershipCommand;
import src.domain.party.published.UpdateCharacterCommand;
import src.view.slotcontent.topbar.dropdown.DropdownPopupContentModel;
import src.view.slotcontent.topbar.dropdown.DropdownPopupViewInputEvent;

final class PartyTopBarIntentHandler {

    private static final String CHARACTER_NOT_FOUND = "Charakter konnte nicht gefunden werden.";

    private final DropdownPopupContentModel popupContentModel;
    private final RosterActions rosterActions;
    private final EditorActions editorActions;

    PartyTopBarIntentHandler(
        PartyTopBarContributionModel presentationModel,
        DropdownPopupContentModel popupContentModel,
        PartyApplicationService party
    ) {
        PartyTopBarContributionModel safeModel = Objects.requireNonNull(presentationModel, "presentationModel");
        this.popupContentModel = Objects.requireNonNull(popupContentModel, "popupContentModel");
        PartyApplicationService safeParty = Objects.requireNonNull(party, "party");
        MutationActions mutationActions = new MutationActions(
                safeModel.rosterContentModel(),
                safeModel.editorContentModel(),
                safeModel.mutationState());
        this.rosterActions = new RosterActions(
                safeModel.rosterContentModel(),
                safeModel.editorContentModel(),
                mutationActions,
                safeParty);
        this.editorActions = new EditorActions(safeModel.editorContentModel(), mutationActions, safeParty);
    }

    void consume(PartyTopBarViewInputEvent event) {
        if (event != null && event.popupCloseRequested()) {
            popupContentModel.close();
        }
    }

    void consume(DropdownPopupViewInputEvent event) {
        if (event == null) {
            return;
        }
        if (event.popupHidden()) {
            popupContentModel.close();
        } else if (event.triggerInvoked() && popupContentModel.isOpen()) {
            popupContentModel.close();
        } else if (event.triggerInvoked()) {
            popupContentModel.open();
        }
    }

    void consume(PartyRosterTopBarViewInputEvent event) {
        rosterActions.consume(event);
    }

    void consume(PartyEditorTopBarViewInputEvent event) {
        editorActions.consume(event);
    }

    private static final class RosterActions {

        private final PartyRosterTopBarContentModel rosterContentModel;
        private final PartyEditorTopBarContentModel editorContentModel;
        private final MutationActions mutationActions;
        private final PartyApplicationService party;

        private RosterActions(
                PartyRosterTopBarContentModel rosterContentModel,
                PartyEditorTopBarContentModel editorContentModel,
                MutationActions mutationActions,
                PartyApplicationService party
        ) {
            this.rosterContentModel = rosterContentModel;
            this.editorContentModel = editorContentModel;
            this.mutationActions = mutationActions;
            this.party = party;
        }

        private void consume(PartyRosterTopBarViewInputEvent event) {
            if (event == null) {
                return;
            }
            if (consumeLocalAction(event)) {
                return;
            }
            if (consumeMemberAction(event)) {
                return;
            }
            consumeRestAction(event);
        }

        private boolean consumeLocalAction(PartyRosterTopBarViewInputEvent event) {
            if (event.reserveSearchChanged()) {
                rosterContentModel.showReserveSearch(event.reserveSearchText());
                return true;
            }
            if (event.createEditorRequested()) {
                editorContentModel.openCreateEditor();
                return true;
            }
            if (event.editEditorRequested()) {
                if (!openEditEditor(event.memberId())) {
                    mutationActions.rejectMutation(CHARACTER_NOT_FOUND);
                }
                return true;
            }
            return false;
        }

        private boolean consumeMemberAction(PartyRosterTopBarViewInputEvent event) {
            if (event.addExistingRequested()) {
                changeMembership(event.memberId(), MembershipState.ACTIVE, " wurde zur aktiven Party hinzugefügt.");
                return true;
            }
            if (event.removeRequested()) {
                changeMembership(event.memberId(), MembershipState.RESERVE, " wurde aus der aktiven Party entfernt.");
                return true;
            }
            if (event.xpDelta() != 0) {
                adjustXp(event.memberId(), event.xpDelta());
                return true;
            }
            return false;
        }

        private void consumeRestAction(PartyRosterTopBarViewInputEvent event) {
            if (event.shortRestRequested()) {
                performRest(RestType.SHORT_REST, "Short Rest wurde für die aktive Party ausgeführt.");
                return;
            }
            if (event.longRestRequested()) {
                performRest(RestType.LONG_REST, "Long Rest wurde für die aktive Party ausgeführt.");
            }
        }

        private void changeMembership(long memberId, MembershipState membershipState, String successSuffix) {
            if (!MutationSupport.validId(memberId)) {
                mutationActions.rejectMutation(CHARACTER_NOT_FOUND);
                return;
            }
            String memberName = rosterContentModel.memberName(memberId);
            String successMessage = MutationSupport.displayName(memberName) + successSuffix;
            if (!mutationActions.beginMutation(successMessage)) {
                return;
            }
            party.setMembership(new SetPartyMembershipCommand(memberId, membershipState));
        }

        private void adjustXp(long memberId, int xpDelta) {
            if (xpDelta == 0) {
                mutationActions.rejectMutation("XP-Korrektur darf nicht 0 sein.");
                return;
            }
            if (!MutationSupport.validId(memberId)) {
                mutationActions.rejectMutation(CHARACTER_NOT_FOUND);
                return;
            }
            String memberName = rosterContentModel.memberName(memberId);
            int amount = Math.abs(xpDelta);
            String successMessage = xpDelta > 0
                    ? MutationSupport.displayName(memberName) + " erhielt " + amount + " XP."
                    : MutationSupport.displayName(memberName) + " verlor bis zu " + amount + " XP.";
            if (!mutationActions.beginMutation(successMessage)) {
                return;
            }
            party.adjustXp(new AdjustPartyXpCommand(java.util.List.of(memberId), xpDelta));
        }

        private void performRest(RestType restType, String successMessage) {
            if (!mutationActions.beginMutation(successMessage)) {
                return;
            }
            party.performRest(new PerformPartyRestCommand(restType));
        }

        private boolean openEditEditor(long memberId) {
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
    }

    private static final class EditorActions {

        private final PartyEditorTopBarContentModel editorContentModel;
        private final MutationActions mutationActions;
        private final PartyApplicationService party;

        private EditorActions(
                PartyEditorTopBarContentModel editorContentModel,
                MutationActions mutationActions,
                PartyApplicationService party
        ) {
            this.editorContentModel = editorContentModel;
            this.mutationActions = mutationActions;
            this.party = party;
        }

        private void consume(PartyEditorTopBarViewInputEvent event) {
            if (event == null) {
                return;
            }
            PartyEditorTopBarViewInputEvent.EditorDraft draft = event.draft();
            editorContentModel.syncDraft(
                    draft.name(),
                    draft.playerName(),
                    draft.rawLevel(),
                    draft.rawPassivePerception(),
                    draft.rawArmorClass());
            if (event.cancelRequested()) {
                editorContentModel.cancelEditor();
                return;
            }
            if (event.submitRequested()) {
                submit(draft);
                return;
            }
            if (event.deleteConfirmationRequested()) {
                editorContentModel.requestDeleteConfirmation();
                return;
            }
            if (event.deleteConfirmationCancelled()) {
                editorContentModel.cancelDeleteConfirmation();
                return;
            }
            if (event.deleteConfirmed()) {
                PartyEditorTopBarContentModel.EditorPanelModel editorPanel = editorContentModel.currentEditorPanel();
                deleteCharacter(editorPanel.memberId(), editorPanel.deleteTargetName());
            }
        }

        private void submit(PartyEditorTopBarViewInputEvent.EditorDraft draft) {
            PartyEditorTopBarContentModel.EditorPanelModel editorPanel = editorContentModel.currentEditorPanel();
            if (editorPanel.editingExisting()) {
                updateCharacter(editorPanel.memberId(), draft);
                return;
            }
            createCharacter(draft);
        }

        private void deleteCharacter(long memberId, String memberName) {
            if (!MutationSupport.validId(memberId)) {
                mutationActions.rejectMutation(CHARACTER_NOT_FOUND);
                return;
            }
            String successMessage = MutationSupport.displayName(memberName) + " wurde gelöscht.";
            if (!mutationActions.beginEditorMutation(successMessage)) {
                return;
            }
            party.deleteCharacter(new DeleteCharacterCommand(memberId));
        }

        private void createCharacter(PartyEditorTopBarViewInputEvent.EditorDraft draft) {
            ParsedDraft parsedDraft = DraftParser.parse(draft);
            if (!parsedDraft.valid()) {
                mutationActions.rejectMutation(parsedDraft.message);
                return;
            }
            String name = MutationSupport.safe(parsedDraft.name);
            String successMessage = MutationSupport.displayName(name) + " wurde erstellt und zur Party hinzugefügt.";
            if (!mutationActions.beginEditorMutation(successMessage)) {
                return;
            }
            party.createCharacter(new CreateCharacterCommand(
                    new CharacterDraft(
                            name,
                            parsedDraft.playerName,
                            parsedDraft.level,
                            parsedDraft.passivePerception,
                            parsedDraft.armorClass),
                    MembershipState.ACTIVE));
        }

        private void updateCharacter(long memberId, PartyEditorTopBarViewInputEvent.EditorDraft draft) {
            if (!MutationSupport.validId(memberId)) {
                mutationActions.rejectMutation("Charakter konnte nicht gefunden werden.");
                return;
            }
            ParsedDraft parsedDraft = DraftParser.parse(draft);
            if (!parsedDraft.valid()) {
                mutationActions.rejectMutation(parsedDraft.message);
                return;
            }
            String name = MutationSupport.safe(parsedDraft.name);
            String successMessage = MutationSupport.displayName(name) + " wurde gespeichert.";
            if (!mutationActions.beginEditorMutation(successMessage)) {
                return;
            }
            party.updateCharacter(new UpdateCharacterCommand(
                    memberId,
                    new CharacterDraft(
                            name,
                            parsedDraft.playerName,
                            parsedDraft.level,
                            parsedDraft.passivePerception,
                            parsedDraft.armorClass)));
        }
    }

    private static final class MutationActions {

        private final PartyRosterTopBarContentModel rosterContentModel;
        private final PartyEditorTopBarContentModel editorContentModel;
        private final PartyTopBarContributionModel.MutationState mutationState;

        private MutationActions(
                PartyRosterTopBarContentModel rosterContentModel,
                PartyEditorTopBarContentModel editorContentModel,
                PartyTopBarContributionModel.MutationState mutationState
        ) {
            this.rosterContentModel = rosterContentModel;
            this.editorContentModel = editorContentModel;
            this.mutationState = mutationState;
        }

        private boolean beginMutation(String successMessage) {
            return beginMutation(successMessage, false);
        }

        private boolean beginEditorMutation(String successMessage) {
            return beginMutation(successMessage, true);
        }

        private void rejectMutation(String message) {
            rosterContentModel.showStatus(message, true);
        }

        private boolean beginMutation(String successMessage, boolean hideEditorOnSuccess) {
            if (!mutationState.begin(successMessage, hideEditorOnSuccess)) {
                rejectMutation("Party-Aktion laeuft bereits.");
                return false;
            }
            rosterContentModel.showPending("Speichere...");
            editorContentModel.showActionsDisabled(true);
            return true;
        }
    }

    private static final class DraftParser {

        private static ParsedDraft parse(PartyEditorTopBarViewInputEvent.EditorDraft draft) {
            String name = MutationSupport.safe(draft == null ? "" : draft.name()).trim();
            ParsedInteger level = parseInteger(draft == null ? "" : draft.rawLevel(), "Level", 1, 20);
            ParsedInteger passivePerception = parseInteger(
                    draft == null ? "" : draft.rawPassivePerception(),
                    "Passive Perception",
                    1,
                    99);
            ParsedInteger armorClass = parseInteger(draft == null ? "" : draft.rawArmorClass(), "AC", 1, 99);
            return ParsedDraft.from(
                    name,
                    MutationSupport.safe(draft == null ? "" : draft.playerName()).trim(),
                    level,
                    passivePerception,
                    armorClass);
        }

        private static ParsedInteger parseInteger(String rawValue, String label, int min, int max) {
            String trimmed = MutationSupport.safe(rawValue).trim();
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
            this.name = MutationSupport.safe(name);
            this.playerName = MutationSupport.safe(playerName);
            this.level = level;
            this.passivePerception = passivePerception;
            this.armorClass = armorClass;
            this.message = MutationSupport.safe(message);
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
            this.message = MutationSupport.safe(message);
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

    private static final class MutationSupport {

        private static boolean validId(long id) {
            return id > 0L;
        }

        private static String displayName(String name) {
            String safeName = safe(name).trim();
            return safeName.isEmpty() ? "Der Charakter" : safeName;
        }

        private static String safe(String value) {
            return value == null ? "" : value;
        }
    }
}
