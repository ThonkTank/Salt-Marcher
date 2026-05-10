package src.data.party.mapper;

import src.data.party.model.PartyRosterRecord;
import src.domain.party.model.roster.model.PartyRoster;

public final class PartyRosterMapper {

    private PartyRosterMapper() {
    }

    public static PartyRoster toDomain(PartyRosterRecord record) {
        return new PartyRoster(
                record.nextCharacterId(),
                record.characters().stream().map(PartyCharacterMapper::toDomain).toList());
    }

    public static PartyRosterRecord toRecord(PartyRoster roster) {
        return new PartyRosterRecord(
                roster.nextCharacterId(),
                roster.characters().stream().map(PartyCharacterMapper::toRecord).toList());
    }

}
