package features.world.dungeonmap.model.structures.stair;

import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.GridPoint2x;
import features.world.dungeonmap.model.interaction.InteractiveLabelHandle;
import features.world.dungeonmap.model.structures.TargetKey;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

/**
 * Canonical stair truth for dungeonmap.
 *
 * <p>A stair is exactly one continuous ordered 3D line with a fixed 1:1 climb between successive levels.
 * It is not a graph, it does not branch, and exits are not persisted. Exits are disposable read projections
 * derived from the path nodes that currently intersect occupied room/corridor floor cells.
 *
 * <p>If later editing wants templates, radius, direction, or other generation inputs, those belong in
 * editor/application code. The persisted domain truth must stay this explicit path.
 */
public final class DungeonStair {

    private static final String TARGET_KEY_PREFIX = "stair:";

    private final Long stairId;
    private final long mapId;
    private final String name;
    private final List<CubePoint> path;
    private final List<DungeonStairExit> exits;
    private final Set<CubePoint> occupiedPositions;
    private final Set<Integer> reachableLevels;

    private DungeonStair(
            Long stairId,
            long mapId,
            String name,
            List<CubePoint> path,
            Set<CubePoint> occupiedFloorPositions
    ) {
        this.stairId = stairId;
        this.mapId = mapId;
        this.name = normalizeName(name);
        this.path = normalizePath(path);
        this.exits = deriveExits(this.path, occupiedFloorPositions);
        this.occupiedPositions = Collections.unmodifiableSet(new LinkedHashSet<>(this.path));
        this.reachableLevels = deriveReachableLevels(this.path);
    }

    public static DungeonStair resolved(
            Long stairId,
            long mapId,
            String name,
            List<CubePoint> path,
            Set<CubePoint> occupiedFloorPositions
    ) {
        return new DungeonStair(stairId, mapId, name, path, occupiedFloorPositions);
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

    public List<CubePoint> path() {
        return path;
    }

    public List<DungeonStairExit> exits() {
        return exits;
    }

    public String targetKey() {
        return targetKey(stairId);
    }

    public static String targetKey(Long stairId) {
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

    public Set<Integer> reachableLevels() {
        return reachableLevels;
    }

    public Set<CubePoint> occupiedPositions() {
        return occupiedPositions;
    }

    public List<DungeonStairExit> exitsAtLevel(int levelZ) {
        return exits.stream()
                .filter(exit -> exit.position().z() == levelZ)
                .toList();
    }

    public InteractiveLabelHandle labelHandle(int levelZ) {
        CubePoint anchorPoint = exits.stream()
                .map(DungeonStairExit::position)
                .filter(position -> position.z() == levelZ)
                .findFirst()
                .orElseGet(() -> path.stream()
                        .filter(position -> position.z() == levelZ)
                        .findFirst()
                        .orElse(null));
        if (anchorPoint == null) {
            return null;
        }
        return new InteractiveLabelHandle(
                targetKey(),
                label(),
                GridPoint2x.cell(anchorPoint.projectedCell()));
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
                && Objects.equals(stairId, stair.stairId)
                && Objects.equals(name, stair.name)
                && Objects.equals(path, stair.path);
    }

    @Override
    public int hashCode() {
        return Objects.hash(stairId, mapId, name, path);
    }

    @Override
    public String toString() {
        return "DungeonStair[stairId=" + stairId
                + ", mapId=" + mapId
                + ", name=" + name
                + ", path=" + path
                + "]";
    }

    private static List<CubePoint> normalizePath(List<CubePoint> path) {
        ArrayList<CubePoint> result = new ArrayList<>();
        for (CubePoint node : path == null ? List.<CubePoint>of() : path) {
            if (node != null) {
                result.add(node);
            }
        }
        if (result.isEmpty()) {
            throw new IllegalArgumentException("Treppenpfad fehlt");
        }
        HashSet<Integer> seenLevels = new HashSet<>();
        CubePoint previous = null;
        for (CubePoint current : result) {
            // The intended model is one stair node per reached z-level.
            if (!seenLevels.add(current.z())) {
                throw new IllegalArgumentException("Treppenpfad darf jede Ebene nur einmal belegen");
            }
            if (previous != null) {
                if (current.z() != previous.z() + 1) {
                    throw new IllegalArgumentException("Treppenpfad muss Ebenen in 1er-Schritten verbinden");
                }
                // Horizontal movement may be 0 or 1 cells per climbed level, never more.
                int planarDistance = Math.abs(current.x() - previous.x()) + Math.abs(current.y() - previous.y());
                if (planarDistance > 1) {
                    throw new IllegalArgumentException("Treppenpfad verletzt die 1:1-Steigung");
                }
            }
            previous = current;
        }
        return List.copyOf(result);
    }

    private static List<DungeonStairExit> deriveExits(
            List<CubePoint> path,
            Set<CubePoint> occupiedFloorPositions
    ) {
        Set<CubePoint> occupiedFloors = occupiedFloorPositions == null ? Set.of() : Set.copyOf(occupiedFloorPositions);
        LinkedHashSet<CubePoint> exitPositions = new LinkedHashSet<>();
        for (CubePoint node : path) {
            // Exits are not authored separately. They exist only where the explicit stair path
            // currently touches reachable room/corridor floor occupancy.
            if (occupiedFloors.contains(node)) {
                exitPositions.add(node);
            }
        }
        return exitPositions.stream()
                .sorted(Comparator.comparing(CubePoint::z)
                        .thenComparing(CubePoint.POINT_ORDER))
                .map(position -> new DungeonStairExit(position, null))
                .toList();
    }

    private static Set<Integer> deriveReachableLevels(List<CubePoint> path) {
        LinkedHashSet<Integer> result = new LinkedHashSet<>();
        for (CubePoint node : path) {
            result.add(node.z());
        }
        return Collections.unmodifiableSet(result);
    }

    private static String normalizeName(String name) {
        if (name == null || name.isBlank()) {
            return null;
        }
        return name.trim();
    }
}
