package features.party.adapter.sqlite.model;

import java.util.HashSet;
import java.util.Objects;
import java.util.Set;
import org.jspecify.annotations.Nullable;

/** Validates complete current-v1 Party records without repairing authored truth. */
public final class PartyRosterRecordValidator {

    private static final Set<String> MEMBERSHIPS = Set.of("ACTIVE", "RESERVE");
    private static final Set<String> DUNGEON_LOCATION_KINDS = Set.of("TILE", "TRANSITION");
    private static final Set<String> DUNGEON_HEADINGS = Set.of("NORTH", "EAST", "SOUTH", "WEST");

    private PartyRosterRecordValidator() {
    }

    public static void validate(PartyRosterRecord roster) {
        Objects.requireNonNull(roster, "roster");
        if (roster.nextCharacterId() < 1L) {
            throw invalid("next character id must be positive");
        }
        Set<Long> ids = new HashSet<>();
        long highestId = 0L;
        for (PartyCharacterRecord character : roster.characters()) {
            validateCharacter(character);
            if (!ids.add(character.id())) {
                throw invalid("character ids must be unique");
            }
            highestId = Math.max(highestId, character.id());
        }
        if (roster.nextCharacterId() <= highestId) {
            throw invalid("next character id must be greater than every stored id");
        }
    }

    public static void validateCharacter(PartyCharacterRecord character) {
        Objects.requireNonNull(character, "character");
        if (character.id() < 1L) {
            throw invalid("character id must be positive");
        }
        PartyCharacterRecord.Identity identity = Objects.requireNonNull(character.identity(), "identity");
        if (identity.name() == null || identity.name().isBlank()) {
            throw invalid("character name must not be blank");
        }
        PartyCharacterRecord.Progress progress = Objects.requireNonNull(character.progress(), "progress");
        requireRangeWhenPresent(progress.level(), 1, 20, "level");
        requireNonNegative(progress.currentXp(), "current XP");
        requireNonNegative(progress.xpSinceLongRest(), "XP since long rest");
        requireNonNegative(progress.xpSinceShortRest(), "XP since short rest");
        if (progress.level() != null
                && progress.currentXp() < features.party.domain.roster.PartyCharacterProgress
                        .minimumXpForLevel(progress.level())) {
            throw invalid("current XP must meet the authored level minimum");
        }
        if (progress.xpSinceLongRest() > progress.currentXp()) {
            throw invalid("XP since long rest must not exceed current XP");
        }
        if (progress.xpSinceShortRest() > progress.xpSinceLongRest()) {
            throw invalid("XP since short rest must not exceed XP since long rest");
        }
        if (progress.shortRestsTakenSinceLongRest() < 0
                || progress.shortRestsTakenSinceLongRest() > 2) {
            throw invalid("short-rest cadence must be between zero and two");
        }
        PartyCharacterRecord.Combat combat = Objects.requireNonNull(character.combat(), "combat");
        requireRangeWhenPresent(combat.passivePerception(), 1, 99, "passive perception");
        requireRangeWhenPresent(combat.armorClass(), 1, 99, "armor class");
        if (!MEMBERSHIPS.contains(character.membership())) {
            throw invalid("membership must be ACTIVE or RESERVE");
        }
        PartyCharacterRecord.Travel travel = character.travel();
        if (travel == null) {
            throw invalid("travel state must be present");
        }
        validateTravel(travel);
    }

    private static void validateTravel(PartyCharacterRecord.Travel travel) {
        String locationKind = travel.locationKind();
        if (locationKind == null || locationKind.isEmpty()) {
            requireAbsent(travel.dungeonMapId(), "detached dungeon map");
            requireBlank(travel.dungeonLocationKind(), "detached dungeon location kind");
            requireAbsent(travel.dungeonOwnerId(), "detached dungeon owner");
            requireAbsent(travel.dungeonQ(), "detached dungeon q");
            requireAbsent(travel.dungeonR(), "detached dungeon r");
            requireAbsent(travel.dungeonLevel(), "detached dungeon level");
            requireBlank(travel.dungeonHeading(), "detached dungeon heading");
            requireAbsent(travel.overworldMapId(), "detached overworld map");
            requireAbsent(travel.overworldTileId(), "detached overworld tile");
            return;
        }
        if ("DUNGEON".equals(locationKind)) {
            requirePresent(travel.dungeonMapId(), "dungeon map");
            requireNonNegative(travel.dungeonMapId(), "dungeon map");
            requireKnown(travel.dungeonLocationKind(), DUNGEON_LOCATION_KINDS, "dungeon location kind");
            requirePresent(travel.dungeonOwnerId(), "dungeon owner");
            requireNonNegative(travel.dungeonOwnerId(), "dungeon owner");
            requirePresent(travel.dungeonQ(), "dungeon q");
            requirePresent(travel.dungeonR(), "dungeon r");
            requirePresent(travel.dungeonLevel(), "dungeon level");
            requireKnown(travel.dungeonHeading(), DUNGEON_HEADINGS, "dungeon heading");
            requireAbsent(travel.overworldMapId(), "dungeon overworld map");
            requireAbsent(travel.overworldTileId(), "dungeon overworld tile");
            return;
        }
        if ("OVERWORLD".equals(locationKind)) {
            requirePresent(travel.overworldMapId(), "overworld map");
            requireNonNegative(travel.overworldMapId(), "overworld map");
            requirePresent(travel.overworldTileId(), "overworld tile");
            requireNonNegative(travel.overworldTileId(), "overworld tile");
            requireAbsent(travel.dungeonMapId(), "overworld dungeon map");
            requireBlank(travel.dungeonLocationKind(), "overworld dungeon location kind");
            requireAbsent(travel.dungeonOwnerId(), "overworld dungeon owner");
            requireAbsent(travel.dungeonQ(), "overworld dungeon q");
            requireAbsent(travel.dungeonR(), "overworld dungeon r");
            requireAbsent(travel.dungeonLevel(), "overworld dungeon level");
            requireBlank(travel.dungeonHeading(), "overworld dungeon heading");
            return;
        }
        throw invalid("travel location kind must be DUNGEON, OVERWORLD, or absent");
    }

    private static void requireNonNegative(int value, String field) {
        if (value < 0) {
            throw invalid(field + " must not be negative");
        }
    }

    private static void requireNonNegative(@Nullable Long value, String field) {
        if (value != null && value < 0L) {
            throw invalid(field + " must not be negative");
        }
    }

    private static void requireRangeWhenPresent(@Nullable Integer value, int minimum, int maximum, String field) {
        if (value != null && (value < minimum || value > maximum)) {
            throw invalid(field + " is outside the current-v1 range");
        }
    }

    private static void requirePresent(@Nullable Object value, String field) {
        if (value == null) {
            throw invalid(field + " must be present");
        }
    }

    private static void requireAbsent(@Nullable Object value, String field) {
        if (value != null) {
            throw invalid(field + " must be absent");
        }
    }

    private static void requireBlank(@Nullable String value, String field) {
        if (value != null && !value.isBlank()) {
            throw invalid(field + " must be absent");
        }
    }

    private static void requireKnown(@Nullable String value, Set<String> allowed, String field) {
        if (!allowed.contains(value)) {
            throw invalid(field + " is missing or unknown");
        }
    }

    private static IllegalArgumentException invalid(String message) {
        return new IllegalArgumentException("Invalid Party current-v1 record: " + message + '.');
    }
}
