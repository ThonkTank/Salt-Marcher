package src.data.party.mapper;

import org.jspecify.annotations.Nullable;
import src.data.party.model.PartyCharacterRecord;
import src.domain.party.model.roster.PartyCharacter;
import src.domain.party.model.roster.PartyCharacterCombatProfile;
import src.domain.party.model.roster.PartyCharacterIdentity;
import src.domain.party.model.roster.PartyCharacterProgress;
import src.domain.party.model.roster.PartyCharacterTravelState;
import src.domain.party.model.roster.PartyDungeonTravelLocationKind;
import src.domain.party.model.roster.PartyMembership;
import src.domain.party.model.roster.PartyTravelHeading;
import src.domain.party.model.roster.PartyTravelLocation;
import src.domain.party.model.roster.PartyTravelTile;

final class PartyCharacterMapper {

    private static final String DUNGEON_LOCATION_KIND = "DUNGEON";
    private static final String OVERWORLD_LOCATION_KIND = "OVERWORLD";

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
                PartyMembership.fromPersistence(record.membership()),
                toDomainTravel(record.travel()));
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
                character.membership().name(),
                toRecordTravel(character.travel()));
    }

    private static PartyCharacterTravelState toDomainTravel(PartyCharacterRecord.Travel travel) {
        if (travel == null) {
            return PartyCharacterTravelState.attachedWithoutLocation();
        }
        return new PartyCharacterTravelState(
                toDomainTravelLocation(travel),
                travel.attachedToPartyToken());
    }

    private static @Nullable PartyTravelLocation toDomainTravelLocation(PartyCharacterRecord.Travel travel) {
        if (DUNGEON_LOCATION_KIND.equalsIgnoreCase(travel.locationKind())) {
            return PartyTravelLocation.dungeon(
                    valueOrDefault(travel.dungeonMapId(), 1L),
                    PartyDungeonTravelLocationKind.parse(travel.dungeonLocationKind()),
                    valueOrDefault(travel.dungeonOwnerId(), 0L),
                    new PartyTravelTile(
                            valueOrDefault(travel.dungeonQ(), 0),
                            valueOrDefault(travel.dungeonR(), 0),
                            valueOrDefault(travel.dungeonLevel(), 0)),
                    PartyTravelHeading.parse(travel.dungeonHeading()));
        }
        if (OVERWORLD_LOCATION_KIND.equalsIgnoreCase(travel.locationKind())) {
            return PartyTravelLocation.overworld(
                    valueOrDefault(travel.overworldMapId(), 0L),
                    valueOrDefault(travel.overworldTileId(), 0L));
        }
        return null;
    }

    private static PartyCharacterRecord.Travel toRecordTravel(PartyCharacterTravelState travel) {
        PartyCharacterTravelState safeTravel = travel == null
                ? PartyCharacterTravelState.attachedWithoutLocation()
                : travel;
        PartyTravelLocation location = safeTravel.location();
        if (location != null && location.isDungeon()) {
            return new PartyCharacterRecord.Travel(
                    DUNGEON_LOCATION_KIND,
                    location.mapId(),
                    location.dungeonLocationKind().name(),
                    location.dungeonOwnerId(),
                    location.dungeonTile().q(),
                    location.dungeonTile().r(),
                    location.dungeonTile().level(),
                    location.dungeonHeading().name(),
                    null,
                    null,
                    safeTravel.attachedToPartyToken());
        }
        if (location != null && location.isOverworld()) {
            return new PartyCharacterRecord.Travel(
                    OVERWORLD_LOCATION_KIND,
                    null,
                    "",
                    null,
                    null,
                    null,
                    null,
                    "",
                    location.mapId(),
                    location.overworldTileId(),
                    safeTravel.attachedToPartyToken());
        }
        return new PartyCharacterRecord.Travel(
                "",
                null,
                "",
                null,
                null,
                null,
                null,
                "",
                null,
                null,
                safeTravel.attachedToPartyToken());
    }

    private static long valueOrDefault(@Nullable Long value, long fallback) {
        return value == null ? fallback : value;
    }

    private static int valueOrDefault(@Nullable Integer value, int fallback) {
        return value == null ? fallback : value;
    }
}
