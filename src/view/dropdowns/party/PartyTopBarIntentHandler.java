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

@SuppressWarnings({
        "PMD.GodClass",
        "PMD.TooManyMethods"
})
final class PartyTopBarIntentHandler {

    private static final String CHARACTER_NOT_FOUND = "Charakter konnte nicht gefunden werden.";

    private final PartyTopBarContributionModel presentationModel;
    private final DropdownPopupContentModel popupContentModel;
    private final PartyApplicationService party;

    PartyTopBarIntentHandler(
            PartyTopBarContributionModel presentationModel,
            DropdownPopupContentModel popupContentModel,
            PartyApplicationService party
    ) {
        this.presentationModel = Objects.requireNonNull(presentationModel, "presentationModel");
        this.popupContentModel = Objects.requireNonNull(popupContentModel, "popupContentModel");
        this.party = Objects.requireNonNull(party, "party");
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

    @SuppressWarnings("PMD.CyclomaticComplexity")
    void consume(PartyRosterTopBarViewInputEvent event) {
        if (event == null) {
            return;
        }
        if (event.reserveSearchChanged()) {
            presentationModel.updateReserveSearch(event.reserveSearchText());
            return;
        }
        if (event.createEditorRequested()) {
            presentationModel.openCreateEditor();
            return;
        }
        if (event.editEditorRequested()) {
            if (!presentationModel.openEditEditor(event.memberId())) {
                presentationModel.rejectMutation(CHARACTER_NOT_FOUND);
            }
            return;
        }
        if (event.addExistingRequested()) {
            addExisting(event.memberId());
            return;
        }
        if (event.removeRequested()) {
            removeFromParty(event.memberId());
            return;
        }
        if (event.xpDelta() != 0) {
            adjustXp(event.memberId(), event.xpDelta());
            return;
        }
        if (event.shortRestRequested()) {
            performShortRest(
                    "Short Rest wurde für die aktive Party ausgeführt.");
            return;
        }
        if (event.longRestRequested()) {
            performLongRest(
                    "Long Rest wurde für die aktive Party ausgeführt.");
        }
    }

    void consume(PartyEditorTopBarViewInputEvent event) {
        if (event == null) {
            return;
        }
        PartyEditorTopBarViewInputEvent.EditorDraft draft = event.draft();
        presentationModel.syncEditorDraft(
                draft.name(),
                draft.playerName(),
                draft.rawLevel(),
                draft.rawPassivePerception(),
                draft.rawArmorClass());
        if (event.cancelRequested()) {
            presentationModel.cancelEditor();
            return;
        }
        if (event.submitRequested()) {
            PartyEditorTopBarContentModel.EditorPanelModel editorPanel = presentationModel.currentEditorPanel();
            if (editorPanel.editingExisting()) {
                updateCharacter(editorPanel.memberId(), event.draft());
            } else {
                createCharacter(event.draft());
            }
            return;
        }
        if (event.deleteConfirmationRequested()) {
            presentationModel.requestDeleteConfirmation();
            return;
        }
        if (event.deleteConfirmationCancelled()) {
            presentationModel.cancelDeleteConfirmation();
            return;
        }
        if (event.deleteConfirmed()) {
            PartyEditorTopBarContentModel.EditorPanelModel editorPanel = presentationModel.currentEditorPanel();
            deleteCharacter(editorPanel.memberId(), editorPanel.memberName());
        }
    }

    private void addExisting(long memberId) {
        if (!validId(memberId)) {
            presentationModel.rejectMutation(CHARACTER_NOT_FOUND);
            return;
        }
        String memberName = presentationModel.memberName(memberId);
        String successMessage = displayName(memberName) + " wurde zur aktiven Party hinzugefügt.";
        if (!presentationModel.beginMutation(successMessage)) {
            return;
        }
        party.setMembership(new SetPartyMembershipCommand(memberId, MembershipState.ACTIVE));
    }

    private void removeFromParty(long memberId) {
        if (!validId(memberId)) {
            presentationModel.rejectMutation(CHARACTER_NOT_FOUND);
            return;
        }
        String memberName = presentationModel.memberName(memberId);
        String successMessage = displayName(memberName) + " wurde aus der aktiven Party entfernt.";
        if (!presentationModel.beginMutation(successMessage)) {
            return;
        }
        party.setMembership(new SetPartyMembershipCommand(memberId, MembershipState.RESERVE));
    }

    private void deleteCharacter(long memberId, String memberName) {
        if (!validId(memberId)) {
            presentationModel.rejectMutation(CHARACTER_NOT_FOUND);
            return;
        }
        String successMessage = displayName(memberName) + " wurde gelöscht.";
        if (!presentationModel.beginMutation(successMessage)) {
            return;
        }
        party.deleteCharacter(new DeleteCharacterCommand(memberId));
    }

    private void adjustXp(long memberId, int xpDelta) {
        if (xpDelta == 0) {
            presentationModel.rejectMutation("XP-Korrektur darf nicht 0 sein.");
            return;
        }
        if (!validId(memberId)) {
            presentationModel.rejectMutation(CHARACTER_NOT_FOUND);
            return;
        }
        String memberName = presentationModel.memberName(memberId);
        int amount = Math.abs(xpDelta);
        String successMessage = xpDelta > 0
                ? displayName(memberName) + " erhielt " + amount + " XP."
                : displayName(memberName) + " verlor bis zu " + amount + " XP.";
        if (!presentationModel.beginMutation(successMessage)) {
            return;
        }
        party.adjustXp(new AdjustPartyXpCommand(java.util.List.of(memberId), xpDelta));
    }

    private void performShortRest(String successMessage) {
        if (!presentationModel.beginMutation(successMessage)) {
            return;
        }
        party.performRest(new PerformPartyRestCommand(RestType.SHORT_REST));
    }

    private void performLongRest(String successMessage) {
        if (!presentationModel.beginMutation(successMessage)) {
            return;
        }
        party.performRest(new PerformPartyRestCommand(RestType.LONG_REST));
    }

    private void createCharacter(PartyEditorTopBarViewInputEvent.EditorDraft draft) {
        ParsedDraft parsedDraft = parseDraft(draft);
        if (!parsedDraft.valid()) {
            presentationModel.rejectMutation(parsedDraft.message());
            return;
        }
        String name = safe(parsedDraft.name());
        String successMessage = displayName(name) + " wurde erstellt und zur Party hinzugefügt.";
        if (!presentationModel.beginMutation(successMessage)) {
            return;
        }
        party.createCharacter(new CreateCharacterCommand(
                new CharacterDraft(
                        name,
                        parsedDraft.playerName(),
                        parsedDraft.level(),
                        parsedDraft.passivePerception(),
                        parsedDraft.armorClass()),
                MembershipState.ACTIVE));
    }

    private void updateCharacter(long memberId, PartyEditorTopBarViewInputEvent.EditorDraft draft) {
        if (!validId(memberId)) {
            presentationModel.rejectMutation("Charakter konnte nicht gefunden werden.");
            return;
        }
        ParsedDraft parsedDraft = parseDraft(draft);
        if (!parsedDraft.valid()) {
            presentationModel.rejectMutation(parsedDraft.message());
            return;
        }
        String name = safe(parsedDraft.name());
        String successMessage = displayName(name) + " wurde gespeichert.";
        if (!presentationModel.beginMutation(successMessage)) {
            return;
        }
        party.updateCharacter(new UpdateCharacterCommand(
                memberId,
                new CharacterDraft(
                        name,
                        parsedDraft.playerName(),
                        parsedDraft.level(),
                        parsedDraft.passivePerception(),
                        parsedDraft.armorClass())));
    }

    private static ParsedDraft parseDraft(PartyEditorTopBarViewInputEvent.EditorDraft draft) {
        String name = safe(draft == null ? "" : draft.name()).trim();
        if (name.isEmpty()) {
            return ParsedDraft.invalid("Charaktername fehlt.");
        }
        ParsedInteger level = parseInteger(draft == null ? "" : draft.rawLevel(), "Level", 1, 20);
        if (!level.valid()) {
            return ParsedDraft.invalid(level.message());
        }
        ParsedInteger passivePerception = parseInteger(
                draft == null ? "" : draft.rawPassivePerception(),
                "Passive Perception",
                1,
                99);
        if (!passivePerception.valid()) {
            return ParsedDraft.invalid(passivePerception.message());
        }
        ParsedInteger armorClass = parseInteger(draft == null ? "" : draft.rawArmorClass(), "AC", 1, 99);
        if (!armorClass.valid()) {
            return ParsedDraft.invalid(armorClass.message());
        }
        return ParsedDraft.valid(
                name,
                safe(draft == null ? "" : draft.playerName()).trim(),
                level.value(),
                passivePerception.value(),
                armorClass.value());
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

    private record ParsedDraft(
            String name,
            String playerName,
            int level,
            int passivePerception,
            int armorClass,
            boolean accepted,
            String message
    ) {

        private ParsedDraft {
            name = safe(name);
            playerName = safe(playerName);
            message = safe(message);
        }

        private boolean valid() {
            return accepted && message.isBlank();
        }

        private static ParsedDraft valid(
                String name,
                String playerName,
                int level,
                int passivePerception,
                int armorClass
        ) {
            return new ParsedDraft(name, playerName, level, passivePerception, armorClass, true, "");
        }

        private static ParsedDraft invalid(String message) {
            return new ParsedDraft("", "", 0, 0, 0, false, message);
        }
    }

    private record ParsedInteger(int value, String message) {

        private ParsedInteger {
            message = safe(message);
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
