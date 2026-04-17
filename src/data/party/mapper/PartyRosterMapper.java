package src.data.party.mapper;

import src.data.party.model.PartyCharacterRecord;
import src.data.party.model.PartyRosterRecord;
import src.domain.party.entity.PartyCharacter;
import src.domain.party.entity.PartyRoster;
import src.domain.party.valueobject.PartyMembership;

public final class PartyRosterMapper {

    private PartyRosterMapper() {
    }

    public static PartyRoster toDomain(PartyRosterRecord record) {
        if (record == null) {
            return PartyRoster.empty();
        }
        return new PartyRoster(
                record.nextCharacterId(),
                record.characters().stream().map(PartyRosterMapper::toDomainCharacter).toList());
    }

    public static PartyRosterRecord toRecord(PartyRoster roster) {
        if (roster == null) {
            return PartyRosterRecord.empty();
        }
        return new PartyRosterRecord(
                roster.nextCharacterId(),
                roster.characters().stream().map(PartyRosterMapper::toRecordCharacter).toList());
    }

    private static PartyCharacter toDomainCharacter(PartyCharacterRecord record) {
        return new PartyCharacter(
                record.id(),
                record.name(),
                record.playerName(),
                record.level(),
                record.currentXp(),
                record.xpSinceLongRest(),
                record.xpSinceShortRest(),
                record.passivePerception(),
                record.armorClass(),
                parseMembership(record.membership()));
    }

    private static PartyCharacterRecord toRecordCharacter(PartyCharacter character) {
        return new PartyCharacterRecord(
                character.id(),
                character.name(),
                character.playerName(),
                character.level(),
                character.currentXp(),
                character.xpSinceLongRest(),
                character.xpSinceShortRest(),
                character.passivePerception(),
                character.armorClass(),
                character.membership().name());
    }

    private static PartyMembership parseMembership(String rawMembership) {
        if (rawMembership == null || rawMembership.isBlank()) {
            return PartyMembership.RESERVE;
        }
        try {
            return PartyMembership.valueOf(rawMembership.trim().toUpperCase());
        } catch (IllegalArgumentException exception) {
            return PartyMembership.RESERVE;
        }
    }
}
