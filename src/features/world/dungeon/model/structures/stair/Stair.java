package features.world.dungeon.model.structures.stair;

import features.world.dungeon.geometry.GridArea;
import features.world.dungeon.geometry.GridOccupant;
import features.world.dungeon.geometry.GridPath;
import features.world.dungeon.geometry.GridPoint;
import features.world.dungeon.geometry.GridTranslatable;
import features.world.dungeon.geometry.GridTranslation;

import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

/**
 * Passive stair object over canonical ordered path topology.
 */
public final class Stair implements GridTranslatable<Stair>, GridOccupant {

    private final GridPath path;
    private final Set<Integer> stopLevels;
    private final List<StairExit> exits;

    public Stair(GridPath path, Set<Integer> stopLevels) {
        this.path = normalizePath(path);
        this.stopLevels = normalizeStopLevels(this.path.points(), stopLevels);
        this.exits = deriveExits(this.path.points(), this.stopLevels);
    }

    public static Stair of(GridPath path, Set<Integer> stopLevels) {
        return new Stair(path, stopLevels);
    }

    public GridPath gridPath() {
        return path;
    }

    public Set<Integer> stopLevels() {
        return stopLevels;
    }

    public List<StairExit> exits() {
        return exits;
    }

    public Set<Integer> reachableLevels() {
        return path.levels();
    }

    public List<StairExit> exitsAtLevel(int levelZ) {
        return exits.stream()
                .filter(exit -> exit.cell().z() == levelZ)
                .toList();
    }

    @Override
    public GridArea cellFootprint() {
        return path.cellFootprint();
    }

    @Override
    public Stair translated(GridTranslation translation) {
        GridTranslation resolvedTranslation = translation == null ? GridTranslation.none() : translation;
        if (resolvedTranslation.isZero()) {
            return this;
        }
        Set<Integer> translatedStops = stopLevels.stream()
                .map(stopLevel -> stopLevel + resolvedTranslation.dzLevels())
                .collect(java.util.stream.Collectors.toCollection(java.util.LinkedHashSet::new));
        return Stair.of(path.translated(resolvedTranslation), translatedStops);
    }

    private static GridPath normalizePath(GridPath path) {
        GridPath resolvedPath = path == null ? GridPath.empty() : path;
        List<GridPoint> result = resolvedPath.points();
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
                int planarDistance = Math.abs(current.x2() - previous.x2()) / 2
                        + Math.abs(current.y2() - previous.y2()) / 2;
                if (planarDistance > 1) {
                    throw new IllegalArgumentException("Treppenpfad verletzt die 1:1-Steigung");
                }
            }
            previous = current;
        }
        return resolvedPath;
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

    private static List<StairExit> deriveExits(List<GridPoint> path, Set<Integer> stopLevels) {
        LinkedHashSet<GridPoint> exitPositions = new LinkedHashSet<>();
        for (GridPoint node : path) {
            if (stopLevels.contains(node.z())) {
                exitPositions.add(node);
            }
        }
        return exitPositions.stream()
                .sorted(Comparator.comparingInt(GridPoint::z).thenComparing(GridPoint.ORDER))
                .map(position -> new StairExit(position, null))
                .toList();
    }

    @Override
    public boolean equals(Object other) {
        if (this == other) {
            return true;
        }
        if (!(other instanceof Stair stair)) {
            return false;
        }
        return Objects.equals(path, stair.path)
                && Objects.equals(stopLevels, stair.stopLevels);
    }

    @Override
    public int hashCode() {
        return Objects.hash(path, stopLevels);
    }
}
