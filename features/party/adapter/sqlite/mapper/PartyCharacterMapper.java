package features.party.adapter.sqlite.mapper;

import org.jspecify.annotations.Nullable;
import java.util.Objects;
import features.party.adapter.sqlite.model.PartyCharacterRecord;
import features.party.domain.roster.PartyCharacter;
import features.party.domain.roster.PartyCharacterCombatProfile;
import features.party.domain.roster.PartyCharacterIdentity;
import features.party.domain.roster.PartyCharacterProgress;
import features.party.domain.roster.PartyCharacterTravelState;
import features.party.domain.roster.PartyDungeonTravelLocationKind;
import features.party.domain.roster.PartyMembership;
import features.party.domain.roster.PartyTravelHeading;
import features.party.domain.roster.PartyTravelLocation;
import features.party.domain.roster.PartyTravelTile;

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
                toDomainMembership(record.membership()),
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
        Objects.requireNonNull(travel, "travel");
        return new PartyCharacterTravelState(
                toDomainTravelLocation(travel),
                travel.attachedToPartyToken());
    }

    private static PartyMembership toDomainMembership(String membership) {
        if ("ACTIVE".equalsIgnoreCase(membership)) {
            return PartyMembership.ACTIVE;
        }
        if ("RESERVE".equalsIgnoreCase(membership)) {
            return PartyMembership.RESERVE;
        }
        throw new IllegalArgumentException("Unknown Party membership in current-v1 record.");
    }

    private static @Nullable PartyTravelLocation toDomainTravelLocation(PartyCharacterRecord.Travel travel) {
        if (DUNGEON_LOCATION_KIND.equalsIgnoreCase(travel.locationKind())) {
            return PartyTravelLocation.dungeon(
                    Objects.requireNonNull(travel.dungeonMapId(), "dungeonMapId"),
                    PartyDungeonTravelLocationKind.parse(travel.dungeonLocationKind()),
                    Objects.requireNonNull(travel.dungeonOwnerId(), "dungeonOwnerId"),
                    new PartyTravelTile(
                            Objects.requireNonNull(travel.dungeonQ(), "dungeonQ"),
                            Objects.requireNonNull(travel.dungeonR(), "dungeonR"),
                            Objects.requireNonNull(travel.dungeonLevel(), "dungeonLevel")),
                    PartyTravelHeading.parse(travel.dungeonHeading()));
        }
        if (OVERWORLD_LOCATION_KIND.equalsIgnoreCase(travel.locationKind())) {
            return PartyTravelLocation.overworld(
                    Objects.requireNonNull(travel.overworldMapId(), "overworldMapId"),
                    Objects.requireNonNull(travel.overworldTileId(), "overworldTileId"));
        }
        return null;
    }

    private static PartyCharacterRecord.Travel toRecordTravel(PartyCharacterTravelState travel) {
        PartyCharacterTravelState safeTravel = Objects.requireNonNull(travel, "travel");
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

}
