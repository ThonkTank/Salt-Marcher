package src.domain.dungeon.model.worldspace;

import java.util.ArrayList;
import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.component.StairExit;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Direction;
import src.domain.dungeon.model.core.structure.stair.Stair;
import src.domain.dungeon.model.core.structure.stair.StairGeometrySpec;
import src.domain.dungeon.model.core.structure.stair.StairShape;

final class DungeonStairGeometryValues {
    private DungeonStairGeometryValues() {
    }

    static @Nullable DungeonStairShape supportedShape(String value) {
        StairShape shape = StairShape.supportedEditorShape(value);
        return shape == null ? null : DungeonStairShape.parse(shape.name());
    }

    static @Nullable Direction supportedCardinalDirection(String value) {
        String normalized = value == null ? "" : value.trim().toUpperCase(java.util.Locale.ROOT);
        return switch (normalized) {
            case "NORTH" -> Direction.NORTH;
            case "EAST" -> Direction.EAST;
            case "SOUTH" -> Direction.SOUTH;
            case "WEST" -> Direction.WEST;
            default -> null;
        };
    }

    static List<Cell> uniquePath(List<Cell> source) {
        return cells(new Stair(
                0L,
                0L,
                "",
                StairShape.defaultShape(),
                null,
                0,
                0,
                cells(source),
                List.of(),
                null).path());
    }

    static List<DungeonStairExit> sortedExits(List<DungeonStairExit> source) {
        return worldspaceExits(new Stair(
                0L,
                0L,
                "",
                StairShape.defaultShape(),
                null,
                0,
                0,
                List.of(),
                coreExits(source),
                null).exits());
    }

    static @Nullable StairGeometrySpec geometrySpec(
            DungeonStairShape shape,
            Cell anchor,
            Direction direction,
            int dimension1,
            int dimension2
    ) {
        if (shape == null || anchor == null || direction == null) {
            return null;
        }
        return new StairGeometrySpec(
                StairShape.parse(shape.name()),
                anchor,
                direction,
                dimension1,
                dimension2);
    }

    static List<Cell> cells(List<Cell> source) {
        List<Cell> result = new ArrayList<>();
        for (Cell cell : source == null ? List.<Cell>of() : source) {
            if (cell != null) {
                result.add(cell);
            }
        }
        return List.copyOf(result);
    }

    static List<StairExit> coreExits(List<DungeonStairExit> source) {
        List<StairExit> result = new ArrayList<>();
        for (DungeonStairExit exit : source == null ? List.<DungeonStairExit>of() : source) {
            if (exit != null) {
                result.add(new StairExit(exit.exitId(), exit.position(), exit.label()));
            }
        }
        return List.copyOf(result);
    }

    static List<DungeonStairExit> worldspaceExits(List<StairExit> source) {
        List<DungeonStairExit> result = new ArrayList<>();
        for (StairExit exit : source == null ? List.<StairExit>of() : source) {
            if (exit != null) {
                result.add(new DungeonStairExit(
                        exit.exitId(),
                        exit.position(),
                        exit.label()));
            }
        }
        return List.copyOf(result);
    }
}
