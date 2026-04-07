package features.world.dungeonmap.model.structures.stair;

import features.world.dungeonmap.geometry.GridPoint;
import features.world.dungeonmap.geometry.GridPoint;
import features.world.dungeonmap.geometry.GridPath;

import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Passive stair object over canonical ordered path topology.
 */
public final class Stair extends GridPath {

    private final Set<Integer> stopLevels;
    private final List<StairExit> exits;

    public Stair(List<GridPoint> path, Set<Integer> stopLevels) {
        super(normalizePath(path));
        this.stopLevels = normalizeStopLevels(points(), stopLevels);
        this.exits = deriveExits(points(), this.stopLevels);
    }

    public Stair(GridPath path, Set<Integer> stopLevels) {
        this(path == null ? List.of() : path.points(), stopLevels);
    }

    public static Stair of(List<GridPoint> path, Set<Integer> stopLevels) {
        return new Stair(path, stopLevels);
    }

    public static Stair of(GridPath path, Set<Integer> stopLevels) {
        return new Stair(path, stopLevels);
    }

    public GridPath tilePath() {
        return this;
    }

    public List<GridPoint> path() {
        return points();
    }

    public Set<Integer> stopLevels() {
        return stopLevels;
    }

    public List<StairExit> exits() {
        return exits;
    }

    public Set<Integer> reachableLevels() {
        return levels();
    }

    public Set<GridPoint> occupiedPositions() {
        return pointSet();
    }

    public List<StairExit> exitsAtLevel(int levelZ) {
        return exits.stream()
                .filter(exit -> exit.position().z() == levelZ)
                .toList();
    }

    public Stair movedBy(GridPoint delta, int levelDelta) {
        GridPoint resolvedDelta = delta == null ? new GridPoint(0, 0) : delta;
        if ((resolvedDelta.x() == 0 && resolvedDelta.y() == 0) && levelDelta == 0) {
            return this;
        }
        Set<Integer> translatedStops = stopLevels.stream()
                .map(stopLevel -> stopLevel + levelDelta)
                .collect(java.util.stream.Collectors.toCollection(java.util.LinkedHashSet::new));
        return Stair.of(translatedBy(resolvedDelta, levelDelta), translatedStops);
    }

    private static List<GridPoint> normalizePath(List<GridPoint> path) {
        java.util.ArrayList<GridPoint> result = new java.util.ArrayList<>();
        for (GridPoint node : path == null ? List.<GridPoint>of() : path) {
            if (node != null) {
                result.add(node);
            }
        }
        if (result.isEmpty()) {
            throw new IllegalArgumentException("Treppenpfad fehlt");
        }
        LinkedHashSet<Integer> seenLevels = new LinkedHashSet<>();
        GridPoint previous = null;
        for (GridPoint current : result) {
            if (!seenLevels.add(current.z())) {
                throw new IllegalArgumentException("Treppenpfad darf jede Ebene nur einmal belegen");
            }
            if (previous != null) {
                if (current.z() != previous.z() + 1) {
                    throw new IllegalArgumentException("Treppenpfad muss Ebenen in 1er-Schritten verbinden");
                }
                int planarDistance = Math.abs(current.x() - previous.x()) + Math.abs(current.y() - previous.y());
                if (planarDistance > 1) {
                    throw new IllegalArgumentException("Treppenpfad verletzt die 1:1-Steigung");
                }
            }
            previous = current;
        }
        return List.copyOf(result);
    }

    private static Set<Integer> normalizeStopLevels(List<GridPoint> path, Set<Integer> stopLevels) {
        LinkedHashSet<Integer> reachableLevels = new LinkedHashSet<>();
        for (GridPoint node : path) {
            reachableLevels.add(node.z());
        }
        LinkedHashSet<Integer> normalizedStops = new LinkedHashSet<>();
        for (Integer stopLevel : stopLevels == null ? Set.<Integer>of() : stopLevels) {
            if (stopLevel != null) {
                if (!reachableLevels.contains(stopLevel)) {
                    throw new IllegalArgumentException("Treppenstopp liegt außerhalb des Treppenpfads");
                }
                normalizedStops.add(stopLevel);
            }
        }
        if (normalizedStops.isEmpty()) {
            throw new IllegalArgumentException("Treppenstopps fehlen");
        }
        return Collections.unmodifiableSet(normalizedStops);
    }

    private static List<StairExit> deriveExits(
            List<GridPoint> path,
            Set<Integer> stopLevels
    ) {
        LinkedHashSet<GridPoint> exitPositions = new LinkedHashSet<>();
        for (GridPoint node : path) {
            if (stopLevels.contains(node.z())) {
                exitPositions.add(node);
            }
        }
        return exitPositions.stream()
                .sorted(Comparator.comparing(GridPoint::z)
                        .thenComparing(GridPoint.POINT_ORDER))
                .map(position -> new StairExit(position, null))
                .toList();
    }
}
