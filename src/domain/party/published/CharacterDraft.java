package src.domain.party.published;

import src.domain.party.roster.value.PartyCharacterDraft;

public final class CharacterDraft {

    private final PartyCharacterDraft draft;

    public CharacterDraft(
            String name,
            String playerName,
            int level,
            int passivePerception,
            int armorClass
    ) {
        this(new PartyCharacterDraft(name, playerName, level, passivePerception, armorClass));
    }

    public CharacterDraft(PartyCharacterDraft draft) {
        this.draft = draft == null ? new PartyCharacterDraft("", "", 0, 0, 0) : draft;
    }

    public static CharacterDraft fromDraft(PartyCharacterDraft draft) {
        return new CharacterDraft(draft);
    }

    public PartyCharacterDraft toInternal() {
        return draft;
    }

    public String name() {
        return draft.name();
    }

    public String playerName() {
        return draft.playerName();
    }

    public int level() {
        return draft.level();
    }

    public int passivePerception() {
        return draft.passivePerception();
    }

    public int armorClass() {
        return draft.armorClass();
    }
}
