package features.world.dungeonmap.model.structures.stair;

import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.GridAnchor;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.interaction.InteractiveLabelHandle;
import features.world.dungeonmap.model.structures.TargetKey;

import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

public record DungeonStair(
        Long stairId,
        Long traversalId,
        long mapId,
        String name,
        Point2i anchor,
        StairShape shape,
        CardinalDirection direction,
        int dimension1,
        int dimension2,
        List<Integer> exitLevels
) {

    private static final String TARGET_KEY_PREFIX = "stair:";

    public DungeonStair {
        anchor = Objects.requireNonNull(anchor, "anchor");
        shape = requireShape(shape);
        direction = direction == null ? CardinalDirection.defaultDirection() : direction;
        name = normalizeName(name);
        exitLevels = normalizeExitLevels(exitLevels);
        validateDimensions(shape, dimension1, dimension2);
    }

    public static DungeonStair planned(
            Point2i anchor,
            StairShape shape,
            CardinalDirection direction,
            int dimension1,
            int dimension2,
            List<Integer> exitLevels
    ) {
        return new DungeonStair(null, null, 0L, null, anchor, shape, direction, dimension1, dimension2, exitLevels);
    }

    public static DungeonStair fromMaterialized(
            Long stairId,
            Long traversalId,
            long mapId,
            String name,
            List<CubePoint> path,
            List<DungeonStairExit> exits
    ) {
        StairGeometry.StairSpecification specification = StairGeometry.inferSpecification(path, exits);
        return new DungeonStair(
                stairId,
                traversalId,
                mapId,
                name,
                specification.anchor(),
                specification.shape(),
                specification.direction(),
                specification.dimension1(),
                specification.dimension2(),
                specification.exitLevels());
    }

    public static DungeonStair materialized(
            DungeonStair plannedStair,
            Long stairId,
            Long traversalId,
            long mapId
    ) {
        if (plannedStair == null) {
            return null;
        }
        try {
            return plannedStair.withIdentity(stairId, traversalId, mapId);
        } catch (IllegalArgumentException ignored) {
            return null;
        }
    }

    public DungeonStair withIdentity(Long stairId, Long traversalId, long mapId) {
        return new DungeonStair(stairId, traversalId, mapId, name, anchor, shape, direction, dimension1, dimension2, exitLevels);
    }

    public StairGeometry geometry() {
        return StairGeometry.fromStair(this);
    }

    public List<CubePoint> path() {
        return geometry().pathNodes();
    }

    public List<DungeonStairExit> exits() {
        return geometry().exits();
    }

    public String targetKey() {
        return TargetKey.of(TARGET_KEY_PREFIX, stairId).value();
    }

    public String label() {
        if (name != null) {
            return name;
        }
        return stairId == null ? "Treppe neu" : "Treppe " + stairId;
    }

    public static boolean isTargetKey(String targetKey) {
        return TargetKey.matches(targetKey, TARGET_KEY_PREFIX);
    }

    public static Long stairIdFromKey(String targetKey) {
        return TargetKey.parseId(targetKey, TARGET_KEY_PREFIX);
    }

    public int minReachZ() {
        return occupiedPositions().stream().mapToInt(CubePoint::z).min().orElse(0);
    }

    public int maxReachZ() {
        return occupiedPositions().stream().mapToInt(CubePoint::z).max().orElse(0);
    }

    public Set<Integer> reachableLevels() {
        return new LinkedHashSet<>(exitLevels).isEmpty() ? Set.of() : Set.copyOf(new LinkedHashSet<>(exitLevels));
    }

    public Set<CubePoint> occupiedPositions() {
        return geometry().occupiedPositions();
    }

    public List<DungeonStairExit> exitsAtLevel(int levelZ) {
        return exits().stream()
                .filter(exit -> exit.position().z() == levelZ)
                .toList();
    }

    public InteractiveLabelHandle labelHandle(int levelZ) {
        CubePoint anchorPoint = exitsAtLevel(levelZ).stream()
                .map(DungeonStairExit::position)
                .findFirst()
                .orElseGet(() -> path().stream()
                        .filter(node -> node.z() == levelZ)
                        .findFirst()
                        .orElse(null));
        if (anchorPoint == null) {
            return null;
        }
        return new InteractiveLabelHandle(
                targetKey(),
                label(),
                GridAnchor.atTile(anchorPoint.projectedCell()));
    }

    private static StairShape requireShape(StairShape shape) {
        if (shape == null) {
            throw new IllegalArgumentException("Treppenform fehlt");
        }
        return shape;
    }

    private static String normalizeName(String name) {
        if (name == null || name.isBlank()) {
            return null;
        }
        return name.trim();
    }

    private static List<Integer> normalizeExitLevels(List<Integer> exitLevels) {
        LinkedHashSet<Integer> normalized = new LinkedHashSet<>();
        for (Integer level : exitLevels == null ? List.<Integer>of() : exitLevels) {
            if (level != null) {
                normalized.add(level);
            }
        }
        if (normalized.size() < 2) {
            throw new IllegalArgumentException("Mindestens zwei verschiedene Ebenen");
        }
        return normalized.stream()
                .sorted(Comparator.naturalOrder())
                .toList();
    }

    private static void validateDimensions(StairShape shape, int dimension1, int dimension2) {
        String validationMessage = shape.validateDimensions(dimension1, dimension2).orElse(null);
        if (validationMessage != null) {
            throw new IllegalArgumentException(validationMessage);
        }
    }
}
