package src.view.dropdowns.party;

import java.util.Objects;
import java.util.function.Consumer;
import org.jspecify.annotations.Nullable;

final class PartyTopBarIntentHandler {

    private final PartyTopBarContributionModel presentationModel;
    private Consumer<PartyTopBarPublishedEvent> publishedEventListener = ignored -> {};

    PartyTopBarIntentHandler(PartyTopBarContributionModel presentationModel) {
        this.presentationModel = Objects.requireNonNull(presentationModel, "presentationModel");
    }

    void onPublishedEventRequested(Consumer<PartyTopBarPublishedEvent> listener) {
        publishedEventListener = listener == null ? ignored -> {} : listener;
    }

    void consume(PartyTopBarViewInputEvent event) {
        if (event == null) {
            return;
        }
        switch (event.kind()) {
            case OPENED -> presentationModel.refresh();
            case ADD_EXISTING -> addExisting(event.memberId(), event.memberName());
            case REMOVE_FROM_PARTY -> removeFromParty(event.memberId(), event.memberName());
            case ADJUST_XP -> adjustXp(event.memberId(), event.memberName(), event.xpDelta());
            case SHORT_REST -> performRest(PartyTopBarPublishedEvent.RestAction.SHORT_REST, "Short Rest wurde fuer die aktive Party ausgefuehrt.");
            case LONG_REST -> performRest(PartyTopBarPublishedEvent.RestAction.LONG_REST, "Long Rest wurde fuer die aktive Party ausgefuehrt.");
            case CREATE_CHARACTER -> createCharacter(event.draft());
            case UPDATE_CHARACTER -> updateCharacter(event.draft());
            case DELETE_CHARACTER -> deleteCharacter(event.memberId(), event.memberName());
        }
    }

    private void addExisting(long memberId, String memberName) {
        if (!validId(memberId)) {
            presentationModel.rejectMutation("Charakter konnte nicht gefunden werden.");
            return;
        }
        String successMessage = displayName(memberName) + " wurde zur aktiven Party hinzugefuegt.";
        if (!presentationModel.beginMutation(successMessage)) {
            return;
        }
        publishedEventListener.accept(new PartyTopBarPublishedEvent(
                PartyTopBarPublishedEvent.Kind.SET_MEMBERSHIP,
                memberId,
                PartyTopBarPublishedEvent.MembershipTarget.ACTIVE,
                "",
                "",
                0,
                0,
                0,
                0,
                PartyTopBarPublishedEvent.RestAction.NONE,
                successMessage));
    }

    private void removeFromParty(long memberId, String memberName) {
        if (!validId(memberId)) {
            presentationModel.rejectMutation("Charakter konnte nicht gefunden werden.");
            return;
        }
        String successMessage = displayName(memberName) + " wurde aus der aktiven Party entfernt.";
        if (!presentationModel.beginMutation(successMessage)) {
            return;
        }
        publishedEventListener.accept(new PartyTopBarPublishedEvent(
                PartyTopBarPublishedEvent.Kind.SET_MEMBERSHIP,
                memberId,
                PartyTopBarPublishedEvent.MembershipTarget.RESERVE,
                "",
                "",
                0,
                0,
                0,
                0,
                PartyTopBarPublishedEvent.RestAction.NONE,
                successMessage));
    }

    private void deleteCharacter(long memberId, String memberName) {
        if (!validId(memberId)) {
            presentationModel.rejectMutation("Charakter konnte nicht gefunden werden.");
            return;
        }
        String successMessage = displayName(memberName) + " wurde geloescht.";
        if (!presentationModel.beginMutation(successMessage)) {
            return;
        }
        publishedEventListener.accept(new PartyTopBarPublishedEvent(
                PartyTopBarPublishedEvent.Kind.DELETE_CHARACTER,
                memberId,
                PartyTopBarPublishedEvent.MembershipTarget.ACTIVE,
                "",
                "",
                0,
                0,
                0,
                0,
                PartyTopBarPublishedEvent.RestAction.NONE,
                successMessage));
    }

    private void adjustXp(long memberId, String memberName, int xpDelta) {
        if (xpDelta == 0) {
            presentationModel.rejectMutation("XP-Korrektur darf nicht 0 sein.");
            return;
        }
        if (!validId(memberId)) {
            presentationModel.rejectMutation("Charakter konnte nicht gefunden werden.");
            return;
        }
        int amount = Math.abs(xpDelta);
        String successMessage = xpDelta > 0
                ? displayName(memberName) + " erhielt " + amount + " XP."
                : displayName(memberName) + " verlor bis zu " + amount + " XP.";
        if (!presentationModel.beginMutation(successMessage)) {
            return;
        }
        publishedEventListener.accept(new PartyTopBarPublishedEvent(
                PartyTopBarPublishedEvent.Kind.ADJUST_XP,
                memberId,
                PartyTopBarPublishedEvent.MembershipTarget.ACTIVE,
                "",
                "",
                0,
                0,
                0,
                xpDelta,
                PartyTopBarPublishedEvent.RestAction.NONE,
                successMessage));
    }

    private void performRest(PartyTopBarPublishedEvent.RestAction restAction, String successMessage) {
        if (!presentationModel.beginMutation(successMessage)) {
            return;
        }
        publishedEventListener.accept(new PartyTopBarPublishedEvent(
                PartyTopBarPublishedEvent.Kind.PERFORM_REST,
                0L,
                PartyTopBarPublishedEvent.MembershipTarget.ACTIVE,
                "",
                "",
                0,
                0,
                0,
                0,
                restAction,
                successMessage));
    }

    private void createCharacter(PartyTopBarViewInputEvent.EditorDraft draft) {
        ParsedDraft parsedDraft = parseDraft(draft);
        if (!parsedDraft.valid()) {
            presentationModel.rejectMutation(parsedDraft.message());
            return;
        }
        String name = safe(parsedDraft.name());
        String successMessage = displayName(name) + " wurde erstellt und zur Party hinzugefuegt.";
        if (!presentationModel.beginMutation(successMessage)) {
            return;
        }
        publishedEventListener.accept(new PartyTopBarPublishedEvent(
                PartyTopBarPublishedEvent.Kind.CREATE_CHARACTER,
                0L,
                PartyTopBarPublishedEvent.MembershipTarget.ACTIVE,
                name,
                parsedDraft.playerName(),
                parsedDraft.level(),
                parsedDraft.passivePerception(),
                parsedDraft.armorClass(),
                0,
                PartyTopBarPublishedEvent.RestAction.NONE,
                successMessage));
    }

    private void updateCharacter(PartyTopBarViewInputEvent.EditorDraft draft) {
        if (draft == null || !validId(draft.id())) {
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
        publishedEventListener.accept(new PartyTopBarPublishedEvent(
                PartyTopBarPublishedEvent.Kind.UPDATE_CHARACTER,
                draft.id(),
                PartyTopBarPublishedEvent.MembershipTarget.ACTIVE,
                name,
                parsedDraft.playerName(),
                parsedDraft.level(),
                parsedDraft.passivePerception(),
                parsedDraft.armorClass(),
                0,
                PartyTopBarPublishedEvent.RestAction.NONE,
                successMessage));
    }

    private static ParsedDraft parseDraft(PartyTopBarViewInputEvent.EditorDraft draft) {
        PartyTopBarViewInputEvent.EditorDraft safeDraft = draft == null
                ? PartyTopBarViewInputEvent.EditorDraft.empty()
                : draft;
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
        return ParsedDraft.valid(
                name,
                safe(safeDraft.playerName()).trim(),
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
