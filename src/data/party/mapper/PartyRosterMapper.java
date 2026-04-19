package src.data.party.mapper;

import src.data.party.model.PartyCharacterRecord;
import src.data.party.model.PartyRosterRecord;
import src.domain.party.roster.PartyCharacter;
import src.domain.party.roster.PartyCharacterCombatProfile;
import src.domain.party.roster.PartyCharacterIdentity;
import src.domain.party.roster.PartyCharacterProgress;
import src.domain.party.roster.PartyRoster;
import src.domain.party.roster.PartyMembership;

public final class PartyRosterMapper {

    private PartyRosterMapper() {
    }

    public static PartyRoster toDomain(PartyRosterRecord record) {
        return new PartyRoster(
                record.nextCharacterId(),
                record.characters().stream().map(PartyRosterMapper::toDomainCharacter).toList());
    }

    public static PartyRosterRecord toRecord(PartyRoster roster) {
        return new PartyRosterRecord(
                roster.nextCharacterId(),
                roster.characters().stream().map(PartyRosterMapper::toRecordCharacter).toList());
    }

    private static PartyCharacter toDomainCharacter(PartyCharacterRecord record) {
        return new PartyCharacter(
                record.id(),
                new PartyCharacterIdentity(record.identity().name(), record.identity().playerName()),
                new PartyCharacterProgress(
                        record.progress().level(),
                        record.progress().currentXp(),
                        record.progress().xpSinceLongRest(),
                        record.progress().xpSinceShortRest(),
                        record.progress().shortRestsTakenSinceLongRest()),
                new PartyCharacterCombatProfile(
                        record.combat().passivePerception(),
                        record.combat().armorClass()),
                PartyMembership.fromPersistence(record.membership()));
    }

    private static PartyCharacterRecord toRecordCharacter(PartyCharacter character) {
        return new PartyCharacterRecord(
                character.id(),
                new PartyCharacterRecord.Identity(
                        character.identity().name(),
                        character.identity().playerName()),
                new PartyCharacterRecord.Progress(
                        character.progress().level(),
                        character.progress().currentXp(),
                        character.progress().xpSinceLongRest(),
                        character.progress().xpSinceShortRest(),
                        character.progress().shortRestsTakenSinceLongRest()),
                new PartyCharacterRecord.Combat(
                        character.combat().passivePerception(),
                        character.combat().armorClass()),
                character.membership().name());
    }

}
