package src.domain.dungeon.model.map.model;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.map.model.DungeonBoundaryStretchValueTypes.BoundarySide;
import src.domain.dungeon.model.map.model.DungeonBoundaryStretchValueTypes.StretchEdge;
import src.domain.dungeon.model.map.model.DungeonBoundaryStretchValueTypes.StretchOrientation;
import src.domain.dungeon.model.map.model.DungeonBoundaryStretchValueTypes.StretchSeed;
import src.domain.dungeon.model.map.model.DungeonBoundaryStretchValueTypes.StretchSelection;

final class DungeonBoundaryStretchSelectionLogic {

    Optional<StretchSelection> resolveStretch(
            DungeonRoomTopologyClusterWork target,
            List<DungeonEdge> sourceEdges,
            int deltaQ,
            int deltaR,
            int deltaLevel,
            Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries
    ) {
        if (deltaLevel != 0) {
            return Optional.empty();
        }
        Optional<StretchSeed> seed = seedForTarget(target, sourceEdges, boundaries);
        if (seed.isEmpty()) {
            return Optional.empty();
        }
        List<StretchEdge> sortedEdges = sortedStretchEdges(seed.get(), sourceEdges, boundaries);
        if (sortedEdges.isEmpty()) {
            return Optional.empty();
        }
        int movement = seed.get().orientation().movementAlongNormal(deltaQ, deltaR);
        if (movement == 0) {
            return Optional.empty();
        }
        int startVariable = seed.get().orientation().variableCoordinate(sortedEdges.getFirst().edge());
        Set<DungeonBoundaryKey> sourceKeys = new LinkedHashSet<>();
        for (StretchEdge stretchEdge : sortedEdges) {
            sourceKeys.add(stretchEdge.key());
        }
        return Optional.of(new StretchSelection(
                seed.get().level(),
                seed.get().orientation(),
                seed.get().outer(),
                seed.get().fixedCoordinate(),
                startVariable,
                startVariable + sortedEdges.size(),
                movement,
                seed.get().side(),
                sortedEdges,
                sourceKeys));
    }

    private Optional<StretchSeed> seedForTarget(
            DungeonRoomTopologyClusterWork target,
            List<DungeonEdge> sourceEdges,
            Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries
    ) {
        if (sourceEdges == null || sourceEdges.isEmpty()) {
            return Optional.empty();
        }
        DungeonEdge firstEdge = sourceEdges.getFirst();
        StretchOrientation orientation = StretchOrientation.from(firstEdge);
        if (firstEdge == null || firstEdge.from() == null || firstEdge.to() == null || orientation == null) {
            return Optional.empty();
        }
        Set<DungeonCell> clusterCells = new LinkedHashSet<>(target.cellsAt(firstEdge.from().level()));
        if (clusterCells.isEmpty()) {
            return Optional.empty();
        }
        return stretchSeed(boundaries, firstEdge, clusterCells);
    }

    private Optional<StretchSeed> stretchSeed(
            Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries,
            DungeonEdge edge,
            Set<DungeonCell> clusterCells
    ) {
        StretchOrientation orientation = StretchOrientation.from(edge);
        if (orientation == null) {
            return Optional.empty();
        }
        int fixedCoordinate = orientation.fixedCoordinate(edge);
        DungeonBoundaryTouch touch = touch(edge, clusterCells);
        if (!touch.valid()) {
            return Optional.empty();
        }
        DungeonBoundaryKey key = DungeonBoundaryKey.from(edge);
        DungeonClusterBoundary existing = boundaries.get(key);
        boolean outer = touch.insideCount() == 1;
        if ((outer && existing != null) || (!outer && existing == null)) {
            return Optional.empty();
        }
        return Optional.of(new StretchSeed(
                edge.from().level(),
                orientation,
                fixedCoordinate,
                outer,
                BoundarySide.resolve(orientation, touch, fixedCoordinate),
                clusterCells));
    }

    private Optional<StretchEdge> matchingStretchEdge(
            StretchSeed seed,
            Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries,
            DungeonEdge edge
    ) {
        StretchOrientation orientation = StretchOrientation.from(edge);
        if (orientation == null || !validEdge(edge)) {
            return Optional.empty();
        }
        if (invalidEdgeForSeed(seed, edge, orientation)) {
            return Optional.empty();
        }
        DungeonBoundaryTouch touch = touch(edge, seed.clusterCells());
        if (!matchesSeedTouch(seed, orientation, touch)) {
            return Optional.empty();
        }
        DungeonBoundaryKey key = DungeonBoundaryKey.from(edge);
        DungeonClusterBoundary existing = boundaries.get(key);
        if (!boundaryPresenceMatches(seed, existing)) {
            return Optional.empty();
        }
        return Optional.of(new StretchEdge(edge, key, existing));
    }

    private boolean validEdge(DungeonEdge edge) {
        return edge != null && edge.from() != null && edge.to() != null;
    }

    private boolean invalidEdgeForSeed(
            StretchSeed seed,
            DungeonEdge edge,
            StretchOrientation orientation
    ) {
        return edge.from().level() != seed.level()
                || orientation != seed.orientation()
                || orientation.fixedCoordinate(edge) != seed.fixedCoordinate();
    }

    private boolean matchesSeedTouch(
            StretchSeed seed,
            StretchOrientation orientation,
            DungeonBoundaryTouch touch
    ) {
        return touch.valid()
                && seed.outer() == (touch.insideCount() == 1)
                && seed.side() == BoundarySide.resolve(orientation, touch, seed.fixedCoordinate());
    }

    private boolean boundaryPresenceMatches(StretchSeed seed, @Nullable DungeonClusterBoundary existing) {
        return seed.outer() ? existing == null : existing != null;
    }

    private List<StretchEdge> sortedStretchEdges(
            StretchSeed seed,
            List<DungeonEdge> sourceEdges,
            Map<DungeonBoundaryKey, DungeonClusterBoundary> boundaries
    ) {
        List<StretchEdge> stretchEdges = new ArrayList<>();
        for (DungeonEdge edge : sourceEdges) {
            Optional<StretchEdge> stretchEdge = matchingStretchEdge(seed, boundaries, edge);
            if (stretchEdge.isEmpty()) {
                return List.of();
            }
            stretchEdges.add(stretchEdge.get());
        }
        List<StretchEdge> sortedEdges = new ArrayList<>(stretchEdges);
        sortedEdges.sort(new StretchEdgeComparator(seed));
        if (sortedEdges.isEmpty()) {
            return List.of();
        }
        int startVariable = seed.orientation().variableCoordinate(sortedEdges.getFirst().edge());
        for (int index = 0; index < sortedEdges.size(); index++) {
            if (seed.orientation().variableCoordinate(sortedEdges.get(index).edge()) != startVariable + index) {
                return List.of();
            }
        }
        return sortedEdges;
    }

    private DungeonBoundaryTouch touch(DungeonEdge edge, Set<DungeonCell> clusterCells) {
        List<DungeonCell> insideCells = new ArrayList<>();
        for (DungeonCell cell : edge.touchingCells()) {
            if (clusterCells.contains(cell)) {
                insideCells.add(cell);
            }
        }
        return new DungeonBoundaryTouch(insideCells);
    }

    private static final class StretchEdgeComparator implements java.util.Comparator<StretchEdge> {
        private final StretchSeed seed;

        private StretchEdgeComparator(StretchSeed seed) {
            this.seed = seed;
        }

        @Override
        public int compare(StretchEdge left, StretchEdge right) {
            return Integer.compare(
                    seed.orientation().variableCoordinate(left.edge()),
                    seed.orientation().variableCoordinate(right.edge()));
        }
    }
}
