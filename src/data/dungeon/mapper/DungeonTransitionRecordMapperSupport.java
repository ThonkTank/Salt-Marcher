package src.data.dungeon.mapper;

import java.util.ArrayList;
import java.util.List;
import org.jspecify.annotations.Nullable;
import src.data.dungeon.model.DungeonTransitionRecord;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.structure.transition.Transition;
import src.domain.dungeon.model.core.structure.transition.TransitionAnchor;
import src.domain.dungeon.model.core.structure.transition.TransitionDestination;
import src.domain.dungeon.model.core.structure.transition.TransitionDestinationType;

final class DungeonTransitionRecordMapperSupport {

    private DungeonTransitionRecordMapperSupport() {
    }

    static List<Transition> toTransitions(List<DungeonTransitionRecord> records) {
        List<Transition> result = new ArrayList<>();
        for (DungeonTransitionRecord record : records == null ? List.<DungeonTransitionRecord>of() : records) {
            result.add(new Transition(
                    record.transitionId(),
                    record.mapId(),
                    record.description(),
                    DungeonTransitionAnchorRecordMapper.toAnchor(record),
                    DungeonTransitionDestinationRecordMapper.toDestination(record),
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

    private static DungeonTransitionRecord toTransitionRecord(Transition transition) {
        TransitionAnchor anchor = transition.anchor();
        Cell anchorCell = anchor.displayCell();
        DestinationRecord destination = destinationRecord(transition.destination());
        return new DungeonTransitionRecord(
                transition.transitionId(),
                transition.mapId(),
                transition.description(),
                anchorCell == null ? null : anchorCell.q(),
                anchorCell == null ? null : anchorCell.r(),
                anchorCell == null ? null : anchorCell.level(),
                anchor.kind().name(),
                anchor.edgeDirection() == null ? null : anchor.edgeDirection().name(),
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
                    TransitionDestinationType.DUNGEON_MAP.name(),
                    null,
                    null,
                    destination.mapId(),
                    destination.transitionId());
        }
        if (destination != null && destination.isOverworldTile()) {
            return new DestinationRecord(
                    TransitionDestinationType.OVERWORLD_TILE.name(),
                    destination.mapId(),
                    destination.tileId(),
                    null,
                    null);
        }
        return new DestinationRecord(TransitionDestinationType.UNLINKED_ENTRANCE.name(), null, null, null, null);
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
