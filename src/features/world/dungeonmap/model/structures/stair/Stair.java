package features.world.dungeonmap.model.structures.stair;

import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.GridPoint2x;
import features.world.dungeonmap.model.geometry.TilePath;
import features.world.dungeonmap.model.interaction.DungeonSelectionRef;
import features.world.dungeonmap.model.interaction.InteractiveLabelHandle;

import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

/**
 * Canonical stair truth for dungeonmap.
 *
 * <p>A stair is exactly one continuous ordered 3D line with a fixed 1:1 climb between successive levels.
 * It is not a graph and it does not branch. Exits are disposable read projections derived from the explicit
 * path plus the authored stop levels that the editor exposes as usable stair connections.</p>
 */
public final class Stair extends TilePath {

    private final Long stairId;
    private final long mapId;
    private final String name;
    private final Set<Integer> stopLevels;
    private final List<DungeonStairExit> exits;

    private Stair(
            Long stairId,
            long mapId,
            String name,
            List<CubePoint> path,
            Set<Integer> stopLevels
    ) {
        super(normalizePath(path));
        this.stairId = stairId;
        this.mapId = mapId;
        this.name = normalizeName(name);
        this.stopLevels = normalizeStopLevels(points(), stopLevels);
        this.exits = deriveExits(points(), this.stopLevels);
    }

    private Stair(
            Long stairId,
            long mapId,
            String name,
            TilePath path,
            Set<Integer> stopLevels
    ) {
        this(stairId, mapId, name, path == null ? List.of() : path.points(), stopLevels);
    }

    public static Stair resolved(
            Long stairId,
            long mapId,
            String name,
            List<CubePoint> path,
            Set<Integer> stopLevels
    ) {
        return new Stair(stairId, mapId, name, path, stopLevels);
    }

    public static Stair resolved(
            Long stairId,
            long mapId,
            String name,
            TilePath path,
            Set<Integer> stopLevels
    ) {
        return new Stair(stairId, mapId, name, path, stopLevels);
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

    public TilePath tilePath() {
        return this;
    }

    public List<CubePoint> path() {
        return points();
    }

    public Set<Integer> stopLevels() {
        return stopLevels;
    }

    public List<DungeonStairExit> exits() {
        return exits;
    }

    public String label() {
        if (name != null) {
            return name;
        }
        return stairId == null ? "Treppe neu" : "Treppe " + stairId;
    }

    public Set<Integer> reachableLevels() {
        return levels();
    }

    public Set<CubePoint> occupiedPositions() {
        return pointSet();
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
                .orElseGet(() -> path().stream()
                        .filter(position -> position.z() == levelZ)
                        .findFirst()
                        .orElse(null));
        if (anchorPoint == null) {
            return null;
        }
        return new InteractiveLabelHandle(
                new DungeonSelectionRef.StairRef(stairId),
                label(),
                GridPoint2x.cell(anchorPoint.projectedCell()));
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof Stair stair)) {
            return false;
        }
        return mapId == stair.mapId
                && Objects.equals(stairId, stair.stairId)
                && Objects.equals(name, stair.name)
                && Objects.equals(points(), stair.points())
                && Objects.equals(stopLevels, stair.stopLevels);
    }

    @Override
    public int hashCode() {
        return Objects.hash(stairId, mapId, name, points(), stopLevels);
    }

    @Override
    public String toString() {
        return "Stair[stairId=" + stairId
                + ", mapId=" + mapId
                + ", name=" + name
                + ", path=" + points()
                + ", stopLevels=" + stopLevels
                + "]";
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

    private static List<DungeonStairExit> deriveExits(
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
                .map(position -> new DungeonStairExit(position, null))
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
        return resolved(stairId, mapId, name, translatedBy(resolvedDelta, levelDelta), translatedStops);
    }

    private static String normalizeName(String name) {
        if (name == null || name.isBlank()) {
            return null;
        }
        return name.trim();
    }
}
