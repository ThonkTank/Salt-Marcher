package features.party.adapter.sqlite.mapper;

import features.party.adapter.sqlite.model.PartyRosterRecord;
import features.party.domain.roster.PartyRoster;

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
