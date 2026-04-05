package features.world.dungeonmap.model.structures.stair;

import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.CubePoint;
import features.world.dungeonmap.model.geometry.GridPoint2x;
import features.world.dungeonmap.model.geometry.TileShape;
import features.world.dungeonmap.model.interaction.DungeonSelectionRef;
import features.world.dungeonmap.model.interaction.InteractiveLabelHandle;

import java.util.ArrayList;
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
 * path plus the authored stop levels that the editor exposes as usable stair connections.
 *
 * <p>If later editing wants templates, radius, direction, or other generation inputs, those belong in
 * editor/application code. The persisted structure truth must stay this explicit path plus its authored stop levels.
 */
public final class DungeonStair extends TileShape {

    private final Long stairId;
    private final long mapId;
    private final String name;
    private final Set<Integer> stopLevels;
    private final List<DungeonStairExit> exits;

    private DungeonStair(
            Long stairId,
            long mapId,
            String name,
            List<CubePoint> path,
            Set<Integer> stopLevels
    ) {
        this(stairId, mapId, name, TileShape.fromPath(normalizePath(path)), stopLevels);
    }

    private DungeonStair(
            Long stairId,
            long mapId,
            String name,
            TileShape pathShape,
            Set<Integer> stopLevels
    ) {
        super(pathShape);
        this.stairId = stairId;
        this.mapId = mapId;
        this.name = normalizeName(name);
        this.stopLevels = normalizeStopLevels(path(), stopLevels);
        this.exits = deriveExits(path(), this.stopLevels);
    }

    public static DungeonStair resolved(
            Long stairId,
            long mapId,
            String name,
            List<CubePoint> path,
            Set<Integer> stopLevels
    ) {
        return new DungeonStair(stairId, mapId, name, path, stopLevels);
    }

    public static DungeonStair resolved(
            Long stairId,
            long mapId,
            String name,
            TileShape pathShape,
            Set<Integer> stopLevels
    ) {
        return new DungeonStair(stairId, mapId, name, pathShape, stopLevels);
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
        return pathPoints();
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
        return pathPointSet();
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
        if (!(other instanceof DungeonStair stair)) {
            return false;
        }
        return mapId == stair.mapId
                && Objects.equals(stairId, stair.stairId)
                && Objects.equals(name, stair.name)
                && Objects.equals(path(), stair.path())
                && Objects.equals(stopLevels, stair.stopLevels);
    }

    @Override
    public int hashCode() {
        return Objects.hash(stairId, mapId, name, path(), stopLevels);
    }

    @Override
    public String toString() {
        return "DungeonStair[stairId=" + stairId
                + ", mapId=" + mapId
                + ", name=" + name
                + ", path=" + path()
                + ", stopLevels=" + stopLevels
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
        LinkedHashSet<Integer> seenLevels = new LinkedHashSet<>();
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

    public DungeonStair movedBy(CellCoord delta, int levelDelta) {
        CellCoord resolvedDelta = delta == null ? new CellCoord(0, 0) : delta;
        if ((resolvedDelta.x() == 0 && resolvedDelta.y() == 0) && levelDelta == 0) {
            return this;
        }
        List<CubePoint> translatedPath = path().stream()
                .map(point -> CubePoint.at(point.projectedCell().add(resolvedDelta), point.z() + levelDelta))
                .toList();
        Set<Integer> translatedStops = stopLevels.stream()
                .map(stopLevel -> stopLevel + levelDelta)
                .collect(java.util.stream.Collectors.toCollection(java.util.LinkedHashSet::new));
        return resolved(stairId, mapId, name, translatedPath, translatedStops);
    }

    private static String normalizeName(String name) {
        if (name == null || name.isBlank()) {
            return null;
        }
        return name.trim();
    }
}
