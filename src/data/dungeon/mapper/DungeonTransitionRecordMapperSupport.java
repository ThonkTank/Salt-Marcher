package src.data.dungeon.mapper;

import java.util.ArrayList;
import java.util.List;
import org.jspecify.annotations.Nullable;
import src.data.dungeon.model.DungeonTransitionRecord;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.structure.transition.Transition;
import src.domain.dungeon.model.core.structure.transition.TransitionDestination;

final class DungeonTransitionRecordMapperSupport {

    private static final String DESTINATION_DUNGEON_MAP = "DUNGEON_MAP";
    private static final String DESTINATION_OVERWORLD_TILE = "OVERWORLD_TILE";

    private DungeonTransitionRecordMapperSupport() {
    }

    static List<Transition> toTransitions(List<DungeonTransitionRecord> records) {
        List<Transition> result = new ArrayList<>();
        for (DungeonTransitionRecord record : records == null ? List.<DungeonTransitionRecord>of() : records) {
            result.add(new Transition(
                    record.transitionId(),
                    record.mapId(),
                    record.description(),
                    transitionAnchor(record),
                    transitionDestination(record),
                    record.linkedTransitionId()));
        }
        return List.copyOf(result);
    }

    static List<DungeonTransitionRecord> toTransitionRecords(List<Transition> transitions) {
        List<DungeonTransitionRecord> result = new ArrayList<>();
        for (Transition transition
                : transitions == null ? List.<Transition>of() : transitions) {
            result.add(toTransitionRecord(transition));
        }
        return List.copyOf(result);
    }

    private static @Nullable Cell transitionAnchor(DungeonTransitionRecord record) {
        if (record.cellX() == null) {
            return null;
        }
        return new Cell(
                record.cellX(),
                record.cellY() == null ? 0 : record.cellY(),
                record.levelZ() == null ? 0 : record.levelZ());
    }

    private static TransitionDestination transitionDestination(DungeonTransitionRecord record) {
        if (DESTINATION_DUNGEON_MAP.equalsIgnoreCase(record.destinationType())) {
            return TransitionDestination.dungeonMap(
                    record.targetDungeonMapId() == null ? 0L : record.targetDungeonMapId(),
                    record.targetTransitionId());
        }
        return TransitionDestination.overworldTile(
                record.targetOverworldMapId() == null ? 0L : record.targetOverworldMapId(),
                record.targetOverworldTileId() == null ? 0L : record.targetOverworldTileId());
    }

    private static DungeonTransitionRecord toTransitionRecord(Transition transition) {
        Cell anchor = transition.anchor();
        DestinationRecord destination = destinationRecord(transition.destination());
        return new DungeonTransitionRecord(
                transition.transitionId(),
                transition.mapId(),
                transition.description(),
                anchor == null ? null : anchor.q(),
                anchor == null ? null : anchor.r(),
                anchor == null ? null : anchor.level(),
                destination.destinationType(),
                destination.targetOverworldMapId(),
                destination.targetOverworldTileId(),
                destination.targetDungeonMapId(),
                destination.targetTransitionId(),
                transition.linkedTransitionId());
    }

    private static DestinationRecord destinationRecord(TransitionDestination destination) {
        if (destination != null && destination.isDungeonMap()) {
            return new DestinationRecord(
                    DESTINATION_DUNGEON_MAP,
                    null,
                    null,
                    destination.mapId(),
                    destination.transitionId());
        }
        if (destination != null && destination.isOverworldTile()) {
            return new DestinationRecord(
                    DESTINATION_OVERWORLD_TILE,
                    destination.mapId(),
                    destination.tileId(),
                    null,
                    null);
        }
        return new DestinationRecord(DESTINATION_OVERWORLD_TILE, 0L, 0L, null, null);
    }

    private record DestinationRecord(
            String destinationType,
            @Nullable Long targetOverworldMapId,
            @Nullable Long targetOverworldTileId,
            @Nullable Long targetDungeonMapId,
            @Nullable Long targetTransitionId
    ) {
    }
}
