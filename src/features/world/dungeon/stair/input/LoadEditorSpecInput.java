package features.world.dungeon.stair.input;

import java.util.List;

public record LoadEditorSpecInput(
        long mapId,
        long stairId
) {
    public record EditorSpecInput(
            long stairId,
            String name,
            int anchorCellX,
            int anchorCellY,
            int anchorCellZ,
            int anchorLevelZ,
            ShapeSpecInput shapeSpec,
            int minLevelZ,
            int maxLevelZ,
            List<Integer> stopLevels
    ) {
        public EditorSpecInput {
            name = name == null ? "" : name.trim();
            shapeSpec = shapeSpec == null ? ShapeSpecInput.defaultInput() : shapeSpec;
            stopLevels = stopLevels == null ? List.of() : List.copyOf(stopLevels);
        }
    }

    public record ShapeSpecInput(
            String kind,
            String direction,
            int parameter1,
            int parameter2
    ) {
        public ShapeSpecInput {
            kind = kind == null ? "" : kind.trim();
            direction = direction == null ? "" : direction.trim();
        }

        public static ShapeSpecInput defaultInput() {
            return new ShapeSpecInput("STACK", "NORTH", 0, 0);
        }
    }
}
