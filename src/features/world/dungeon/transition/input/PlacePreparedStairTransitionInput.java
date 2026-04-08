package features.world.dungeon.transition.input;

import java.util.List;

public record PlacePreparedStairTransitionInput(
        long transitionId,
        DraftInput draft
) {
    public record DraftInput(
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
        public DraftInput {
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
