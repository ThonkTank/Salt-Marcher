package src.data.party.mapper;

import src.data.party.model.PartyCharacterRecord;
import src.domain.party.roster.entity.PartyCharacter;
import src.domain.party.roster.value.PartyCharacterCombatProfile;
import src.domain.party.roster.value.PartyCharacterIdentity;
import src.domain.party.roster.value.PartyCharacterProgress;
import src.domain.party.roster.value.PartyMembership;

final class PartyCharacterMapper {

    private PartyCharacterMapper() {
    }

    static PartyCharacter toDomain(PartyCharacterRecord record) {
        PartyCharacterRecord.Identity identity = record.identity();
        PartyCharacterRecord.Progress progress = record.progress();
        PartyCharacterRecord.Combat combat = record.combat();
        return new PartyCharacter(
                record.id(),
                new PartyCharacterIdentity(identity.name(), identity.playerName()),
                new PartyCharacterProgress(
                        progress.level(),
                        progress.currentXp(),
                        progress.xpSinceLongRest(),
                        progress.xpSinceShortRest(),
                        progress.shortRestsTakenSinceLongRest()),
                new PartyCharacterCombatProfile(
                        combat.passivePerception(),
                        combat.armorClass()),
                PartyMembership.fromPersistence(record.membership()));
    }

    static PartyCharacterRecord toRecord(PartyCharacter character) {
        PartyCharacterIdentity identity = character.identity();
        PartyCharacterProgress progress = character.progress();
        PartyCharacterCombatProfile combat = character.combat();
        return new PartyCharacterRecord(
                character.id(),
                new PartyCharacterRecord.Identity(
                        identity.name(),
                        identity.playerName()),
                new PartyCharacterRecord.Progress(
                        progress.level(),
                        progress.currentXp(),
                        progress.xpSinceLongRest(),
                        progress.xpSinceShortRest(),
                        progress.shortRestsTakenSinceLongRest()),
                new PartyCharacterRecord.Combat(
                        combat.passivePerception(),
                        combat.armorClass()),
                character.membership().name());
    }
}
