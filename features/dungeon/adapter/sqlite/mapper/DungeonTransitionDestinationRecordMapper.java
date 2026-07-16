package features.dungeon.adapter.sqlite.mapper;

import java.util.Locale;
import features.dungeon.adapter.sqlite.model.DungeonTransitionRecord;
import features.dungeon.domain.core.structure.transition.TransitionDestination;
import features.dungeon.domain.core.structure.transition.TransitionDestinationType;

final class DungeonTransitionDestinationRecordMapper {
    private DungeonTransitionDestinationRecordMapper() {
    }

    static TransitionDestination toDestination(DungeonTransitionRecord record) {
        TransitionDestinationType destinationType = destinationType(record);
        return switch (destinationType) {
            case DUNGEON_MAP -> dungeonMapDestination(record);
            case OVERWORLD_TILE -> overworldTileDestination(record);
            case UNLINKED_ENTRANCE -> unlinkedEntranceDestination(record);
        };
    }

    private static TransitionDestinationType destinationType(DungeonTransitionRecord record) {
        String destinationType = record.destinationType();
        if (destinationType == null || destinationType.isBlank()) {
            throw DungeonTransitionRecordMalformed.record(record, "Missing transition destination type.");
        }
        try {
            return TransitionDestinationType.valueOf(destinationType.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException exception) {
            throw DungeonTransitionRecordMalformed.record(
                    record,
                    "Unknown transition destination type.",
                    exception);
        }
    }

    private static void requireDungeonMapTarget(DungeonTransitionRecord record) {
        if (record.targetDungeonMapId() == null
                || record.targetDungeonMapId() <= 0L
                || nonPositive(record.targetTransitionId())
                || record.targetOverworldMapId() != null
                || record.targetOverworldTileId() != null) {
            throw DungeonTransitionRecordMalformed.record(
                    record,
                    "DUNGEON_MAP destination target columns are invalid.");
        }
    }

    private static TransitionDestination dungeonMapDestination(DungeonTransitionRecord record) {
        requireDungeonMapTarget(record);
        return TransitionDestination.dungeonMap(
                record.targetDungeonMapId(),
                record.targetTransitionId());
    }

    private static void requireOverworldTarget(DungeonTransitionRecord record) {
        if (record.targetOverworldMapId() == null
                || record.targetOverworldMapId() <= 0L
                || record.targetOverworldTileId() == null
                || record.targetOverworldTileId() <= 0L
                || record.targetDungeonMapId() != null
                || record.targetTransitionId() != null) {
            throw DungeonTransitionRecordMalformed.record(
                    record,
                    "OVERWORLD_TILE destination target columns are invalid.");
        }
    }

    private static TransitionDestination overworldTileDestination(DungeonTransitionRecord record) {
        requireOverworldTarget(record);
        return TransitionDestination.overworldTile(
                record.targetOverworldMapId(),
                record.targetOverworldTileId());
    }

    private static void requireNoDestinationTarget(DungeonTransitionRecord record) {
        if (record.targetOverworldMapId() != null
                || record.targetOverworldTileId() != null
                || record.targetDungeonMapId() != null
                || record.targetTransitionId() != null) {
            throw DungeonTransitionRecordMalformed.record(
                    record,
                    "UNLINKED_ENTRANCE destination carries target columns.");
        }
    }

    private static TransitionDestination unlinkedEntranceDestination(DungeonTransitionRecord record) {
        requireNoDestinationTarget(record);
        return TransitionDestination.unlinkedEntrance();
    }

    private static boolean nonPositive(Long value) {
        return value != null && value <= 0L;
    }
}
