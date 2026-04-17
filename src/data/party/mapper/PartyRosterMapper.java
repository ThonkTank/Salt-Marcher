package src.data.party.mapper;

import src.data.party.model.PartyCharacterRecord;
import src.data.party.model.PartyRosterRecord;
import src.domain.party.entity.PartyCharacter;
import src.domain.party.entity.PartyCharacterCombatProfile;
import src.domain.party.entity.PartyCharacterIdentity;
import src.domain.party.entity.PartyCharacterProgress;
import src.domain.party.entity.PartyRoster;
import src.domain.party.valueobject.PartyMembership;

public final class PartyRosterMapper {

    private PartyRosterMapper() {
    }

    public static PartyRoster toDomain(PartyRosterRecord record) {
        if (record == null) {
            return new PartyRoster(1L, java.util.List.of());
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
                new PartyCharacterIdentity(record.name(), record.playerName()),
                new PartyCharacterProgress(
                        record.level(),
                        record.currentXp(),
                        record.xpSinceLongRest(),
                        record.xpSinceShortRest(),
                        record.shortRestsTakenSinceLongRest()),
                new PartyCharacterCombatProfile(record.passivePerception(), record.armorClass()),
                parseMembership(record.membership()));
    }

    private static PartyCharacterRecord toRecordCharacter(PartyCharacter character) {
        return new PartyCharacterRecord(
                character.id(),
                character.identity().name(),
                character.identity().playerName(),
                character.progress().level(),
                character.progress().currentXp(),
                character.progress().xpSinceLongRest(),
                character.progress().xpSinceShortRest(),
                character.progress().shortRestsTakenSinceLongRest(),
                character.combat().passivePerception(),
                character.combat().armorClass(),
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
