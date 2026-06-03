package src.domain.dungeon.model.worldspace;

import java.util.ArrayList;
import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.component.StairExit;
import src.domain.dungeon.model.core.geometry.Cell;
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

    static List<DungeonCell> uniquePath(List<DungeonCell> source) {
        return worldspaceCells(new Stair(
                0L,
                0L,
                "",
                StairShape.defaultShape(),
                null,
                0,
                0,
                coreCells(source),
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
            DungeonCell anchor,
            DungeonEdgeDirection direction,
            int dimension1,
            int dimension2
    ) {
        if (shape == null || anchor == null || direction == null) {
            return null;
        }
        return new StairGeometrySpec(
                StairShape.parse(shape.name()),
                anchor.geometry(),
                direction.geometry(),
                dimension1,
                dimension2);
    }

    static List<Cell> coreCells(List<DungeonCell> source) {
        List<Cell> result = new ArrayList<>();
        for (DungeonCell cell : source == null ? List.<DungeonCell>of() : source) {
            if (cell != null) {
                result.add(cell.geometry());
            }
        }
        return List.copyOf(result);
    }

    static List<DungeonCell> worldspaceCells(List<Cell> source) {
        List<DungeonCell> result = new ArrayList<>();
        for (Cell cell : source == null ? List.<Cell>of() : source) {
            if (cell != null) {
                result.add(DungeonCell.fromGeometry(cell));
            }
        }
        return List.copyOf(result);
    }

    static List<StairExit> coreExits(List<DungeonStairExit> source) {
        List<StairExit> result = new ArrayList<>();
        for (DungeonStairExit exit : source == null ? List.<DungeonStairExit>of() : source) {
            if (exit != null) {
                result.add(new StairExit(exit.exitId(), exit.position().geometry(), exit.label()));
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
                        DungeonCell.fromGeometry(exit.position()),
                        exit.label()));
            }
        }
        return List.copyOf(result);
    }
}
