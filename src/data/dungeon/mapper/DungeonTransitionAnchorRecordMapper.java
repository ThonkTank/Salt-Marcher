package src.data.dungeon.mapper;

import java.util.Locale;
import org.jspecify.annotations.Nullable;
import src.data.dungeon.model.DungeonTransitionRecord;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Direction;
import src.domain.dungeon.model.core.structure.transition.TransitionAnchor;

final class DungeonTransitionAnchorRecordMapper {
    private DungeonTransitionAnchorRecordMapper() {
    }

    static TransitionAnchor toAnchor(DungeonTransitionRecord record) {
        Cell cell = anchorCell(record);
        TransitionAnchor.Kind kind = anchorKind(record, cell);
        return switch (kind) {
            case CELL -> TransitionAnchor.cell(cell);
            case EDGE -> TransitionAnchor.edge(cell, Direction.supportedCardinal(record.anchorEdgeDirection()));
            case NONE -> TransitionAnchor.none();
        };
    }

    private static @Nullable Cell anchorCell(DungeonTransitionRecord record) {
        boolean hasX = record.cellX() != null;
        boolean hasY = record.cellY() != null;
        boolean hasLevel = record.levelZ() != null;
        if (!hasX && !hasY && !hasLevel) {
            return null;
        }
        if (!hasX || !hasY || !hasLevel) {
            throw DungeonTransitionRecordMalformed.record(
                    record,
                    "Anchor coordinate columns must be all present or all null.");
        }
        return new Cell(record.cellX(), record.cellY(), record.levelZ());
    }

    private static TransitionAnchor.Kind anchorKind(
            DungeonTransitionRecord record,
            @Nullable Cell cell
    ) {
        String anchorType = record.anchorType();
        if (anchorType == null || anchorType.isBlank()) {
            if (record.anchorEdgeDirection() != null) {
                throw DungeonTransitionRecordMalformed.record(
                        record,
                        "Transition anchor edge direction requires explicit EDGE anchor type.");
            }
            return cell == null ? TransitionAnchor.Kind.NONE : TransitionAnchor.Kind.CELL;
        }
        return explicitAnchorKind(record, cell, anchorType.trim().toUpperCase(Locale.ROOT));
    }

    private static TransitionAnchor.Kind explicitAnchorKind(
            DungeonTransitionRecord record,
            @Nullable Cell cell,
            String anchorType
    ) {
        return switch (anchorType) {
            case "NONE" -> noneAnchorKind(record, cell);
            case "CELL" -> cellAnchorKind(record, cell);
            case "EDGE" -> edgeAnchorKind(record, cell);
            default -> throw DungeonTransitionRecordMalformed.record(record, "Unknown transition anchor type.");
        };
    }

    private static TransitionAnchor.Kind noneAnchorKind(
            DungeonTransitionRecord record,
            @Nullable Cell cell
    ) {
        if (cell != null || record.anchorEdgeDirection() != null) {
            throw DungeonTransitionRecordMalformed.record(record, "NONE anchor carries placement fields.");
        }
        return TransitionAnchor.Kind.NONE;
    }

    private static TransitionAnchor.Kind cellAnchorKind(
            DungeonTransitionRecord record,
            @Nullable Cell cell
    ) {
        if (cell == null || record.anchorEdgeDirection() != null) {
            throw DungeonTransitionRecordMalformed.record(
                    record,
                    "CELL anchor is incomplete or carries edge direction.");
        }
        return TransitionAnchor.Kind.CELL;
    }

    private static TransitionAnchor.Kind edgeAnchorKind(
            DungeonTransitionRecord record,
            @Nullable Cell cell
    ) {
        if (cell == null || Direction.supportedCardinal(record.anchorEdgeDirection()) == null) {
            throw DungeonTransitionRecordMalformed.record(
                    record,
                    "EDGE anchor is incomplete or has invalid direction.");
        }
        return TransitionAnchor.Kind.EDGE;
    }
}
