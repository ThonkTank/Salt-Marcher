package src.domain.dungeon.model.map.model;

import org.jspecify.annotations.Nullable;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

public final class DungeonTravelSurfaceProjection {

    public DungeonTravelSurfaceFacts project(
            DungeonMap dungeonMap,
            DungeonDerivedState derived,
            @Nullable DungeonTravelPositionFacts preferredPosition,
            String statusLabel
    ) {
        DungeonMap safeMap = dungeonMap == null
                ? DungeonMapAuthoring.empty(new DungeonMapIdentity(1L), "Dungeon")
                : dungeonMap;
        DungeonMapFacts mapFacts = derived == null ? null : derived.map();
        DungeonMapFacts safeFacts = mapFacts == null
                ? new DungeonMapFacts(safeMap.topology().topology(), 1, 1, List.of(), List.of())
                : mapFacts;
        DungeonTravelPositionFacts position = resolvePosition(safeMap, safeFacts, preferredPosition);
        SurfaceScope scope = SurfaceScopeResolver.resolve(safeFacts, position.tile());
        List<DungeonTravelActionFacts> actions = new ArrayList<>();
        actions.addAll(new DungeonTraversalActionCatalog().describe(safeMap, derived, scope.area(), scope.cells(), position));
        actions.addAll(TransitionActionProjector.describe(safeMap, scope, position));
        return new DungeonTravelSurfaceFacts(
                safeMap.metadata().mapId(),
                safeMap.metadata().mapName(),
                safeMap.revision(),
                safeFacts,
                position,
                scope.title(),
                scope.areaLabel(),
                tileLabel(position.tile()),
                headingLabel(position.heading()),
                statusLabel,
                scope.description(),
                actions);
    }

    public DungeonTravelPositionFacts resolvePosition(
            DungeonMap dungeonMap,
            DungeonMapFacts mapFacts,
            @Nullable DungeonTravelPositionFacts preferredPosition
    ) {
        return TravelPositionResolver.resolve(dungeonMap, mapFacts, preferredPosition);
    }

    private static String tileLabel(DungeonCell tile) {
        return "x=" + tile.q() + " y=" + tile.r() + " z=" + tile.level();
    }

    private static String headingLabel(DungeonTravelHeading heading) {
        DungeonTravelHeading resolvedHeading = heading == null ? DungeonTravelHeading.defaultHeading() : heading;
        return resolvedHeading.displayLabel();
    }

    private record SurfaceScope(
            @Nullable DungeonAreaFacts area,
            String title,
            String areaLabel,
            String description,
            Set<DungeonCell> cells
    ) {
        private SurfaceScope {
            title = title == null || title.isBlank() ? "Dungeon" : title.trim();
            areaLabel = areaLabel == null || areaLabel.isBlank() ? title : areaLabel.trim();
            description = description == null ? "" : description.trim();
            cells = cells == null ? Set.of() : Set.copyOf(cells);
        }
    }

    private static final class TravelPositionResolver {

        private static DungeonTravelPositionFacts resolve(
                DungeonMap dungeonMap,
                DungeonMapFacts mapFacts,
                @Nullable DungeonTravelPositionFacts preferredPosition
        ) {
            DungeonCell preferredTile = preferredPosition == null ? null : preferredPosition.tile();
            DungeonTravelHeading heading =
                    preferredPosition == null ? DungeonTravelHeading.defaultHeading() : preferredPosition.heading();
            if (preferredPosition != null && preferredTile != null && containsCell(mapFacts, preferredTile)) {
                return new DungeonTravelPositionFacts(
                        dungeonMap.metadata().mapId(),
                        preferredPosition.locationKind(),
                        preferredPosition.ownerId(),
                        preferredTile,
                        heading);
            }
            DungeonCell fallback = firstTraversableCell(mapFacts);
            DungeonCell resolvedTile = fallback == null ? new DungeonCell(0, 0, 0) : fallback;
            return new DungeonTravelPositionFacts(
                    dungeonMap.metadata().mapId(),
                    DungeonTravelLocationKind.TILE,
                    0L,
                    resolvedTile,
                    heading);
        }

        private static boolean containsCell(DungeonMapFacts mapFacts, DungeonCell cell) {
            return mapFacts != null && mapFacts.allCells().contains(cell);
        }

        private static @Nullable DungeonCell firstTraversableCell(DungeonMapFacts mapFacts) {
            if (mapFacts == null) {
                return null;
            }
            List<DungeonCell> cells = new ArrayList<>();
            for (DungeonAreaFacts area : mapFacts.areas()) {
                if (area != null) {
                    appendUniqueCells(cells, area.cells());
                }
            }
            for (DungeonFeatureFacts feature : mapFacts.features()) {
                if (feature != null) {
                    appendUniqueCells(cells, feature.cells());
                }
            }
            List<DungeonCell> sortedCells = DungeonCellOrdering.sortedCells(cells);
            return sortedCells.isEmpty() ? null : sortedCells.getFirst();
        }

        private static void appendUniqueCells(List<DungeonCell> result, List<DungeonCell> cells) {
            for (DungeonCell cell : cells == null ? List.<DungeonCell>of() : cells) {
                if (cell != null && !result.contains(cell)) {
                    result.add(cell);
                }
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
                    Set.of(activeTile));
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

        private static Set<DungeonCell> sameLevelCells(List<DungeonCell> cells, int level) {
            Set<DungeonCell> result = new LinkedHashSet<>();
            for (DungeonCell cell : cells == null ? List.<DungeonCell>of() : cells) {
                if (cell != null && cell.level() == level) {
                    result.add(cell);
                }
            }
            return Set.copyOf(result);
        }
    }

    private static final class TransitionActionProjector {

        private static List<DungeonTravelActionFacts> describe(
                DungeonMap dungeonMap,
                SurfaceScope scope,
                DungeonTravelPositionFacts position
        ) {
            List<DungeonTravelActionFacts> result = new ArrayList<>();
            for (DungeonTransition transition : dungeonMap.connections().transitions()) {
                DungeonCell anchor = transition.anchor();
                if (anchor == null || anchor.level() != position.tile().level() || !scope.cells().contains(anchor)) {
                    continue;
                }
                String destinationLabel = DungeonTransitionLabels.destinationLabel(transition.destination());
                result.add(new DungeonTravelActionFacts(
                        "transition:" + transition.transitionId(),
                        DungeonTravelActionKind.TRANSITION,
                        transition.label(),
                        destinationLabel,
                        transition.description().isBlank()
                                ? transition.label() + " fuehrt zu " + destinationLabel + "."
                                : transition.description(),
                        new DungeonTravelPositionFacts(
                                dungeonMap.metadata().mapId(),
                                DungeonTravelLocationKind.TRANSITION,
                                transition.transitionId(),
                                anchor,
                                position.heading()),
                        transition.destination()));
            }
            result.sort(new TravelActionComparator());
            return List.copyOf(result);
        }
    }

    private static final class TravelActionComparator implements Comparator<DungeonTravelActionFacts> {
        @Override
        public int compare(DungeonTravelActionFacts left, DungeonTravelActionFacts right) {
            String leftLabel = left == null ? "" : left.displayLabel();
            String rightLabel = right == null ? "" : right.displayLabel();
            return String.CASE_INSENSITIVE_ORDER.compare(leftLabel, rightLabel);
        }
    }
}
