package features.world.dungeonmap.model.structures.stair;

import features.world.dungeonmap.model.geometry.CubePoint;

import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

public record DungeonStair(
        Long stairId,
        long mapId,
        String name,
        List<CubePoint> path,
        List<DungeonStairExit> exits
) {

    private static final String TARGET_KEY_PREFIX = "stair:";

    public DungeonStair {
        name = name == null || name.isBlank()
                ? "Treppe " + (stairId == null ? "neu" : stairId)
                : name.trim();
        path = path == null ? List.of() : path.stream()
                .filter(java.util.Objects::nonNull)
                .sorted(CubePoint.POINT_ORDER)
                .toList();
        exits = exits == null ? List.of() : exits.stream()
                .filter(java.util.Objects::nonNull)
                .sorted(Comparator.comparingInt(exit -> exit.position().z()))
                .toList();
    }

    public String targetKey() {
        return stairId == null ? TARGET_KEY_PREFIX + "unassigned" : TARGET_KEY_PREFIX + stairId;
    }

    public static boolean isTargetKey(String targetKey) {
        return targetKey != null && targetKey.startsWith(TARGET_KEY_PREFIX);
    }

    public int minReachZ() {
        return occupiedPositions().stream().mapToInt(CubePoint::z).min().orElse(0);
    }

    public int maxReachZ() {
        return occupiedPositions().stream().mapToInt(CubePoint::z).max().orElse(0);
    }

    public Set<Integer> reachableLevels() {
        Set<Integer> levels = new LinkedHashSet<>();
        for (CubePoint node : occupiedPositions()) {
            levels.add(node.z());
        }
        return Set.copyOf(levels);
    }

    public Set<CubePoint> occupiedPositions() {
        Set<CubePoint> occupied = new LinkedHashSet<>(path);
        for (DungeonStairExit exit : exits) {
            occupied.add(exit.position());
        }
        return Set.copyOf(occupied);
    }

    public List<DungeonStairExit> exitsAtLevel(int levelZ) {
        return exits.stream()
                .filter(exit -> exit.position().z() == levelZ)
                .toList();
    }
}
