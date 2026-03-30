package features.world.dungeonmap.model.structures.stair;

import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.GridAnchor;
import features.world.dungeonmap.model.geometry.Point2i;
import features.world.dungeonmap.model.interaction.InteractiveLabelHandle;
import features.world.dungeonmap.model.structures.TargetKey;

import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

public final class DungeonStair {

    private static final String TARGET_KEY_PREFIX = "stair:";

    private final Long stairId;
    private final long mapId;
    private final String name;
    private final Point2i anchor;
    private final StairShape shape;
    private final CardinalDirection direction;
    private final int dimension1;
    private final int dimension2;
    private final List<Integer> exitLevels;
    private final StairGeometry geometry;
    private final Set<CubePoint> occupiedPositions;
    private final Set<Integer> reachableLevels;

    public DungeonStair(
            Long stairId,
            long mapId,
            String name,
            Point2i anchor,
            StairShape shape,
            CardinalDirection direction,
            int dimension1,
            int dimension2,
            List<Integer> exitLevels
    ) {
        this.stairId = stairId;
        this.mapId = mapId;
        this.name = normalizeName(name);
        this.anchor = Objects.requireNonNull(anchor, "anchor");
        this.shape = requireShape(shape);
        this.direction = direction == null ? CardinalDirection.defaultDirection() : direction;
        this.dimension1 = dimension1;
        this.dimension2 = dimension2;
        this.exitLevels = normalizeExitLevels(exitLevels);
        validateDimensions(this.shape, this.dimension1, this.dimension2);
        this.geometry = StairGeometry.fromExitLevels(
                this.shape,
                this.anchor,
                this.direction,
                this.dimension1,
                this.dimension2,
                this.exitLevels);
        this.occupiedPositions = this.geometry.occupiedPositions();
        this.reachableLevels = Collections.unmodifiableSet(new LinkedHashSet<>(this.exitLevels));
    }

    public static DungeonStair planned(
            Point2i anchor,
            StairShape shape,
            CardinalDirection direction,
            int dimension1,
            int dimension2,
            List<Integer> exitLevels
    ) {
        return new DungeonStair(null, 0L, null, anchor, shape, direction, dimension1, dimension2, exitLevels);
    }

    public static DungeonStair resolved(
            Long stairId,
            long mapId,
            String name,
            Point2i anchor,
            StairShape shape,
            CardinalDirection direction,
            int dimension1,
            int dimension2,
            List<Integer> exitLevels
    ) {
        return new DungeonStair(stairId, mapId, name, anchor, shape, direction, dimension1, dimension2, exitLevels);
    }

    public static DungeonStair fromMaterialized(
            Long stairId,
            long mapId,
            String name,
            List<CubePoint> path,
            List<DungeonStairExit> exits
    ) {
        StairGeometry.StairSpecification specification = StairGeometry.inferSpecification(path, exits);
        return resolved(
                stairId,
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
            long mapId
    ) {
        if (plannedStair == null) {
            return null;
        }
        try {
            return plannedStair.withIdentity(stairId, mapId);
        } catch (IllegalArgumentException ignored) {
            return null;
        }
    }

    public DungeonStair withIdentity(Long stairId, long mapId) {
        return new DungeonStair(stairId, mapId, name, anchor, shape, direction, dimension1, dimension2, exitLevels);
    }

    public Long stairId() {
        return stairId;
    }

    public long mapId() {
        return mapId;
    }

    public String name() {
        return name;
    }

    public Point2i anchor() {
        return anchor;
    }

    public StairShape shape() {
        return shape;
    }

    public CardinalDirection direction() {
        return direction;
    }

    public int dimension1() {
        return dimension1;
    }

    public int dimension2() {
        return dimension2;
    }

    public List<Integer> exitLevels() {
        return exitLevels;
    }

    public StairGeometry geometry() {
        return geometry;
    }

    public List<CubePoint> path() {
        return geometry.pathNodes();
    }

    public List<DungeonStairExit> exits() {
        return geometry.exits();
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
        return exitLevels.getFirst();
    }

    public int maxReachZ() {
        return exitLevels.getLast();
    }

    public Set<Integer> reachableLevels() {
        return reachableLevels;
    }

    public Set<CubePoint> occupiedPositions() {
        return occupiedPositions;
    }

    public List<DungeonStairExit> exitsAtLevel(int levelZ) {
        return exits().stream()
                .filter(exit -> exit.position().z() == levelZ)
                .toList();
    }

    public InteractiveLabelHandle labelHandle(int levelZ) {
        CubePoint anchorPoint = null;
        for (DungeonStairExit exit : geometry.exits()) {
            if (exit.position().z() == levelZ) {
                anchorPoint = exit.position();
                break;
            }
        }
        if (anchorPoint == null) {
            for (CubePoint node : geometry.pathNodes()) {
                if (node.z() == levelZ) {
                    anchorPoint = node;
                    break;
                }
            }
        }
        if (anchorPoint == null) {
            return null;
        }
        return new InteractiveLabelHandle(
                targetKey(),
                label(),
                GridAnchor.atTile(anchorPoint.projectedCell()));
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof DungeonStair stair)) {
            return false;
        }
        return mapId == stair.mapId
                && dimension1 == stair.dimension1
                && dimension2 == stair.dimension2
                && Objects.equals(stairId, stair.stairId)
                && Objects.equals(name, stair.name)
                && Objects.equals(anchor, stair.anchor)
                && shape == stair.shape
                && direction == stair.direction
                && Objects.equals(exitLevels, stair.exitLevels);
    }

    @Override
    public int hashCode() {
        return Objects.hash(stairId, mapId, name, anchor, shape, direction, dimension1, dimension2, exitLevels);
    }

    @Override
    public String toString() {
        return "DungeonStair[stairId=" + stairId
                + ", mapId=" + mapId
                + ", name=" + name
                + ", anchor=" + anchor
                + ", shape=" + shape
                + ", direction=" + direction
                + ", dimension1=" + dimension1
                + ", dimension2=" + dimension2
                + ", exitLevels=" + exitLevels
                + "]";
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
