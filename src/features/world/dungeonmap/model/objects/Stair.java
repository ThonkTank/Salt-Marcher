package features.world.dungeonmap.model.objects;

import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.TilePath;

import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/**
 * Passive stair object over canonical ordered path topology.
 */
public final class Stair extends TilePath {

    private final Set<Integer> stopLevels;
    private final List<StairExit> exits;

    public Stair(List<CubePoint> path, Set<Integer> stopLevels) {
        super(normalizePath(path));
        this.stopLevels = normalizeStopLevels(points(), stopLevels);
        this.exits = deriveExits(points(), this.stopLevels);
    }

    public Stair(TilePath path, Set<Integer> stopLevels) {
        this(path == null ? List.of() : path.points(), stopLevels);
    }

    public static Stair of(List<CubePoint> path, Set<Integer> stopLevels) {
        return new Stair(path, stopLevels);
    }

    public static Stair of(TilePath path, Set<Integer> stopLevels) {
        return new Stair(path, stopLevels);
    }

    public TilePath tilePath() {
        return this;
    }

    public List<CubePoint> path() {
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

    public Set<CubePoint> occupiedPositions() {
        return pointSet();
    }

    public List<StairExit> exitsAtLevel(int levelZ) {
        return exits.stream()
                .filter(exit -> exit.position().z() == levelZ)
                .toList();
    }

    public Stair movedBy(CellCoord delta, int levelDelta) {
        CellCoord resolvedDelta = delta == null ? new CellCoord(0, 0) : delta;
        if ((resolvedDelta.x() == 0 && resolvedDelta.y() == 0) && levelDelta == 0) {
            return this;
        }
        Set<Integer> translatedStops = stopLevels.stream()
                .map(stopLevel -> stopLevel + levelDelta)
                .collect(java.util.stream.Collectors.toCollection(java.util.LinkedHashSet::new));
        return Stair.of(translatedBy(resolvedDelta, levelDelta), translatedStops);
    }

    private static List<CubePoint> normalizePath(List<CubePoint> path) {
        java.util.ArrayList<CubePoint> result = new java.util.ArrayList<>();
        for (CubePoint node : path == null ? List.<CubePoint>of() : path) {
            if (node != null) {
                result.add(node);
            }
        }
        if (result.isEmpty()) {
            throw new IllegalArgumentException("Treppenpfad fehlt");
        }
        LinkedHashSet<Integer> seenLevels = new LinkedHashSet<>();
        CubePoint previous = null;
        for (CubePoint current : result) {
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

    private static Set<Integer> normalizeStopLevels(List<CubePoint> path, Set<Integer> stopLevels) {
        LinkedHashSet<Integer> reachableLevels = new LinkedHashSet<>();
        for (CubePoint node : path) {
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
            List<CubePoint> path,
            Set<Integer> stopLevels
    ) {
        LinkedHashSet<CubePoint> exitPositions = new LinkedHashSet<>();
        for (CubePoint node : path) {
            if (stopLevels.contains(node.z())) {
                exitPositions.add(node);
            }
        }
        return exitPositions.stream()
                .sorted(Comparator.comparing(CubePoint::z)
                        .thenComparing(CubePoint.POINT_ORDER))
                .map(position -> new StairExit(position, null))
                .toList();
    }
}
