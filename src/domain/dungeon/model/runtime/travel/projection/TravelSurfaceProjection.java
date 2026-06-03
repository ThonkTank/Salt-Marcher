package src.domain.dungeon.model.runtime.travel.projection;


import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.worldspace.DungeonAreaFacts;
import src.domain.dungeon.model.worldspace.DungeonCell;
import src.domain.dungeon.model.worldspace.DungeonDerivedState;
import src.domain.dungeon.model.worldspace.DungeonFeatureFacts;
import src.domain.dungeon.model.worldspace.DungeonFeatureType;
import src.domain.dungeon.model.worldspace.DungeonMap;
import src.domain.dungeon.model.worldspace.DungeonMapAuthoring;
import src.domain.dungeon.model.worldspace.DungeonMapFacts;
import src.domain.dungeon.model.worldspace.DungeonMapIdentity;
import src.domain.dungeon.model.worldspace.DungeonTransition;
import src.domain.dungeon.model.worldspace.DungeonTransitionDestination;

public final class TravelSurfaceProjection {

    public TravelSurfaceFacts project(
            DungeonMap dungeonMap,
            DungeonDerivedState derived,
            @Nullable TravelPositionFacts preferredPosition,
            String statusLabel
    ) {
        DungeonMap safeMap = dungeonMap == null
                ? DungeonMapAuthoring.empty(new DungeonMapIdentity(1L), "Dungeon")
                : dungeonMap;
        DungeonMapFacts mapFacts = derived == null ? null : derived.map();
        DungeonMapFacts safeFacts = mapFacts == null
                ? new DungeonMapFacts(safeMap.topology().topology(), 1, 1, List.of(), List.of())
                : mapFacts;
        TravelPositionFacts position = resolvePosition(safeMap, safeFacts, preferredPosition);
        DungeonCell authoredTile = TravelGeometryProjectionMapper.toWorldspaceCell(position.tile());
        SurfaceScope scope = SurfaceScopeResolver.resolve(safeFacts, authoredTile);
        List<TravelActionFacts> actions = new ArrayList<>();
        actions.addAll(new TraversalActionCatalog().describe(
                safeMap,
                derived,
                new TraversalLinkProjection().project(safeMap, safeFacts),
                scope.area(),
                scope.cells(),
                position));
        actions.addAll(TransitionActionProjector.describe(safeMap, scope, position));
        return new TravelSurfaceFacts(
                safeMap.metadata().mapId().value(),
                safeMap.metadata().mapName(),
                safeMap.revision(),
                TravelSurfaceMapProjectionMapper.toRuntimeMap(safeFacts),
                position,
                scope.title(),
                scope.areaLabel(),
                tileLabel(authoredTile),
                headingLabel(position.heading()),
                statusLabel,
                scope.description(),
                actions);
    }

    public TravelPositionFacts resolvePosition(
            DungeonMap dungeonMap,
            DungeonMapFacts mapFacts,
            @Nullable TravelPositionFacts preferredPosition
    ) {
        return TravelPositionResolver.resolve(dungeonMap, mapFacts, preferredPosition);
    }

    private static String tileLabel(DungeonCell tile) {
        return "x=" + tile.q() + " y=" + tile.r() + " z=" + tile.level();
    }

    private static String headingLabel(TravelHeading heading) {
        TravelHeading resolvedHeading = heading == null ? TravelHeading.defaultHeading() : heading;
        return resolvedHeading.displayLabel();
    }

    private record SurfaceScope(
            @Nullable DungeonAreaFacts area,
            String title,
            String areaLabel,
            String description,
            Set<Cell> cells
    ) {
        private SurfaceScope {
            title = title == null || title.isBlank() ? "Dungeon" : title.trim();
            areaLabel = areaLabel == null || areaLabel.isBlank() ? title : areaLabel.trim();
            description = description == null ? "" : description.trim();
            cells = cells == null ? Set.of() : Set.copyOf(cells);
        }
    }

    private static final class TravelPositionResolver {

        private static TravelPositionFacts resolve(
                DungeonMap dungeonMap,
                DungeonMapFacts mapFacts,
                @Nullable TravelPositionFacts preferredPosition
        ) {
            DungeonCell preferredTile = preferredPosition == null
                    ? null
                    : TravelGeometryProjectionMapper.toWorldspaceCell(preferredPosition.tile());
            TravelHeading heading =
                    preferredPosition == null ? TravelHeading.defaultHeading() : preferredPosition.heading();
            CellScan scan = CellScan.from(mapFacts);
            if (preferredPosition != null && preferredTile != null && scan.contains(preferredTile)) {
                return new TravelPositionFacts(
                        dungeonMap.metadata().mapId().value(),
                        preferredPosition.locationKind(),
                        preferredPosition.ownerId(),
                        TravelGeometryProjectionMapper.toCoreCell(preferredTile),
                        heading);
            }
            DungeonCell fallback = scan.firstCell();
            DungeonCell resolvedTile = fallback == null ? new DungeonCell(0, 0, 0) : fallback;
            return new TravelPositionFacts(
                    dungeonMap.metadata().mapId().value(),
                    TravelPositionFacts.LocationKind.TILE,
                    0L,
                    TravelGeometryProjectionMapper.toCoreCell(resolvedTile),
                    heading);
        }

        private record CellScan(Set<DungeonCell> cells, @Nullable DungeonCell firstCell) {
            static CellScan from(DungeonMapFacts mapFacts) {
                Set<DungeonCell> cells = new LinkedHashSet<>();
                DungeonCell first = null;
                if (mapFacts != null) {
                    for (DungeonAreaFacts area : mapFacts.areas()) {
                        first = appendCells(cells, first, area == null ? List.of() : area.cells());
                    }
                    for (DungeonFeatureFacts feature : mapFacts.features()) {
                        first = appendCells(cells, first, feature == null ? List.of() : feature.cells());
                    }
                }
                return new CellScan(Set.copyOf(cells), first);
            }

            boolean contains(DungeonCell cell) {
                return cells.contains(cell);
            }

            private static @Nullable DungeonCell appendCells(
                    Set<DungeonCell> cells,
                    @Nullable DungeonCell first,
                    List<DungeonCell> candidates
            ) {
                DungeonCell result = first;
                for (DungeonCell cell : candidates == null ? List.<DungeonCell>of() : candidates) {
                    if (cell == null) {
                        continue;
                    }
                    cells.add(cell);
                    if (result == null || compareCells(cell, result) < 0) {
                        result = cell;
                    }
                }
                return result;
            }

            private static int compareCells(DungeonCell left, DungeonCell right) {
                int levelComparison = Integer.compare(left.level(), right.level());
                if (levelComparison != 0) {
                    return levelComparison;
                }
                int rowComparison = Integer.compare(left.r(), right.r());
                return rowComparison != 0 ? rowComparison : Integer.compare(left.q(), right.q());
            }
        }
    }

    private static final class SurfaceScopeResolver {

        private static SurfaceScope resolve(DungeonMapFacts mapFacts, DungeonCell activeTile) {
            DungeonAreaFacts area = areaAt(mapFacts, activeTile);
            if (area != null) {
                return new SurfaceScope(
                        area,
                        area.label(),
                        area.label(),
                        "Bereich " + area.label(),
                        sameLevelCells(area.cells(), activeTile.level()));
            }
            DungeonFeatureFacts feature = featureAt(mapFacts, activeTile);
            if (feature != null) {
                return new SurfaceScope(
                        null,
                        feature.label(),
                        feature.label(),
                        feature.description().isBlank() ? feature.label() : feature.description(),
                        sameLevelCells(feature.cells(), activeTile.level()));
            }
            return new SurfaceScope(
                    null,
                    "Dungeon-Feld",
                    "Feld " + activeTile.q() + "," + activeTile.r(),
                    "",
                    Set.of(TravelGeometryProjectionMapper.toCoreCell(activeTile)));
        }

        private static @Nullable DungeonAreaFacts areaAt(DungeonMapFacts mapFacts, DungeonCell cell) {
            if (mapFacts == null || cell == null) {
                return null;
            }
            for (DungeonAreaFacts area : mapFacts.areas()) {
                if (area != null && area.cells().contains(cell)) {
                    return area;
                }
            }
            return null;
        }

        private static @Nullable DungeonFeatureFacts featureAt(DungeonMapFacts mapFacts, DungeonCell cell) {
            if (mapFacts == null || cell == null) {
                return null;
            }
            for (DungeonFeatureFacts feature : mapFacts.features()) {
                if (feature != null
                        && (feature.kind() == DungeonFeatureType.STAIR
                        || feature.kind() == DungeonFeatureType.TRANSITION)
                        && feature.cells().contains(cell)) {
                    return feature;
                }
            }
            return null;
        }

        private static Set<Cell> sameLevelCells(List<DungeonCell> cells, int level) {
            Set<Cell> result = new LinkedHashSet<>();
            for (DungeonCell cell : cells == null ? List.<DungeonCell>of() : cells) {
                if (cell != null && cell.level() == level) {
                    result.add(TravelGeometryProjectionMapper.toCoreCell(cell));
                }
            }
            return Set.copyOf(result);
        }
    }

    private static final class TransitionActionProjector {

        private static List<TravelActionFacts> describe(
                DungeonMap dungeonMap,
                SurfaceScope scope,
                TravelPositionFacts position
        ) {
            List<TravelActionFacts> result = new ArrayList<>();
            for (DungeonTransition transition : dungeonMap.connections().transitions()) {
                DungeonCell anchor = transition.anchor();
                DungeonCell authoredTile = TravelGeometryProjectionMapper.toWorldspaceCell(position.tile());
                if (anchor == null
                        || anchor.level() != authoredTile.level()
                        || !scope.cells().contains(TravelGeometryProjectionMapper.toCoreCell(anchor))) {
                    continue;
                }
                String destinationLabel = destinationLabel(transition.destination());
                result.add(new TravelActionFacts(
                        "transition:" + transition.transitionId(),
                        TravelActionKind.TRANSITION,
                        transition.label(),
                        destinationLabel,
                        transition.description().isBlank()
                                ? transition.label() + " fuehrt zu " + destinationLabel + "."
                                : transition.description(),
                        new TravelPositionFacts(
                                dungeonMap.metadata().mapId().value(),
                                TravelPositionFacts.LocationKind.TRANSITION,
                                transition.transitionId(),
                                TravelGeometryProjectionMapper.toCoreCell(anchor),
                                position.heading()),
                        transitionTarget(transition.destination())));
            }
            result.sort(TravelSurfaceProjection::compareTravelActions);
            return List.copyOf(result);
        }

        private static @Nullable TravelTransitionTarget transitionTarget(
                @Nullable DungeonTransitionDestination destination
        ) {
            if (destination == null) {
                return null;
            }
            if (destination.isOverworldTileDestination()) {
                return TravelTransitionTarget.overworldTile(destination.mapId(), destination.tileId());
            }
            if (destination.isDungeonMapDestination()) {
                return TravelTransitionTarget.dungeonMap(destination.mapId(), destination.transitionId());
            }
            return null;
        }

        private static String destinationLabel(DungeonTransitionDestination destination) {
            if (destination == null) {
                return "";
            }
            if (destination.isOverworldTileDestination()) {
                return "Overworld-Feld " + destination.tileId();
            }
            if (destination.isDungeonMapDestination()) {
                Long transitionId = destination.transitionId();
                return transitionId == null
                        ? "Dungeon " + destination.mapId()
                        : "Dungeon " + destination.mapId() + " / Übergang " + transitionId;
            }
            return "";
        }
    }

    private static int compareTravelActions(TravelActionFacts left, TravelActionFacts right) {
        String leftLabel = left == null ? "" : left.displayLabel();
        String rightLabel = right == null ? "" : right.displayLabel();
        return String.CASE_INSENSITIVE_ORDER.compare(leftLabel, rightLabel);
    }
}
