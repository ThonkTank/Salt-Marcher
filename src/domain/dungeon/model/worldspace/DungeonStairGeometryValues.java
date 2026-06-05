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

    static @Nullable StairShape supportedShape(String value) {
        return StairShape.supportedEditorShape(value);
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

    static List<StairExit> sortedExits(List<StairExit> source) {
        return new Stair(
                0L,
                0L,
                "",
                StairShape.defaultShape(),
                null,
                0,
                0,
                List.of(),
                nonNullExits(source),
                null).exits();
    }

    static @Nullable StairGeometrySpec geometrySpec(
            StairShape shape,
            Cell anchor,
            Direction direction,
            int dimension1,
            int dimension2
    ) {
        if (shape == null || anchor == null || direction == null) {
            return null;
        }
        return new StairGeometrySpec(
                shape,
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

    private static List<StairExit> nonNullExits(List<StairExit> source) {
        List<StairExit> result = new ArrayList<>();
        for (StairExit exit : source == null ? List.<StairExit>of() : source) {
            if (exit != null) {
                result.add(exit);
            }
        }
        return List.copyOf(result);
    }
}
