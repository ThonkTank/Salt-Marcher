package src.data.party.model;

import java.util.List;

public record PartyRosterRecord(
        long nextCharacterId,
        List<PartyCharacterRecord> characters
) {
    public PartyRosterRecord {
        characters = characters == null ? List.of() : List.copyOf(characters);
    }

    public static PartyRosterRecord empty() {
        return new PartyRosterRecord(1L, List.of());
    }
}
