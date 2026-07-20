package features.dungeon.application.travel.projection;


import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import org.jspecify.annotations.Nullable;
import features.dungeon.api.DungeonTravelActionId;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.application.travel.projection.TravelAuthoredSurface.Transition;
import features.dungeon.application.travel.projection.TravelAuthoredSurface.TransitionDestination;
import features.dungeon.application.travel.session.TravelDungeonSessionSurface.AreaData;
import features.dungeon.application.travel.session.TravelDungeonSessionSurface.FeatureData;
import features.dungeon.application.travel.session.TravelDungeonSessionSurface.LocationKind;

public final class TravelSurfaceProjection {

    public TravelSurfaceFacts project(
            TravelAuthoredSurface authoredSurface,
            @Nullable TravelPositionFacts preferredPosition,
            String statusLabel
    ) {
        TravelAuthoredSurface surface = authoredSurface == null
                ? TravelAuthoredSurface.empty()
                : authoredSurface;
        TravelPositionFacts position = resolvePosition(surface, preferredPosition);
        SurfaceScope scope = SurfaceScopeResolver.resolve(surface, position.tile());
        List<TravelActionFacts> actions = new ArrayList<>();
        actions.addAll(new TraversalActionCatalog().describe(
                surface,
                new TraversalLinkProjection().project(surface),
                scope.area(),
                scope.cells(),
                position));
        actions.addAll(TransitionActionProjector.describe(surface, scope, position));
        return new TravelSurfaceFacts(
                surface.header().mapId(),
                surface.header().mapName(),
                surface.header().revision(),
                surface.map(),
                position,
                scope.title(),
                scope.areaLabel(),
                tileLabel(position.tile()),
                headingLabel(position.heading()),
                statusLabel,
                scope.description(),
                actions);
    }

    public TravelPositionFacts resolvePosition(
            TravelAuthoredSurface authoredSurface,
            @Nullable TravelPositionFacts preferredPosition
    ) {
        TravelAuthoredSurface surface = authoredSurface == null
                ? TravelAuthoredSurface.empty()
                : authoredSurface;
        return TravelPositionResolver.resolve(surface, preferredPosition);
    }

    private static String tileLabel(Cell tile) {
        return "x=" + tile.q() + " y=" + tile.r() + " z=" + tile.level();
    }

    private static String headingLabel(TravelHeading heading) {
        TravelHeading resolvedHeading = heading == null ? TravelHeading.defaultHeading() : heading;
        return resolvedHeading.displayLabel();
    }

    private record SurfaceScope(
            @Nullable AreaData area,
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
                TravelAuthoredSurface authoredSurface,
                @Nullable TravelPositionFacts preferredPosition
        ) {
            TravelHeading heading =
                    preferredPosition == null ? TravelHeading.defaultHeading() : preferredPosition.heading();
            if (preferredPosition != null && TravelAuthoredSurfaceQueries.contains(authoredSurface, preferredPosition.tile())) {
                return new TravelPositionFacts(
                        authoredSurface.header().mapId(),
                        preferredPosition.locationKind(),
                        preferredPosition.ownerId(),
                        preferredPosition.tile(),
                        heading);
            }
            Transition entryTransition =
                    TravelAuthoredSurfaceQueries.deterministicEntryTransition(authoredSurface);
            if (entryTransition != null && entryTransition.anchor() != null) {
                return new TravelPositionFacts(
                        authoredSurface.header().mapId(),
                        LocationKind.TRANSITION,
                        entryTransition.transitionId(),
                        entryTransition.anchor(),
                        heading);
            }
            Cell fallback = TravelAuthoredSurfaceQueries.firstCell(authoredSurface);
            Cell resolvedTile = fallback == null ? new Cell(0, 0, 0) : fallback;
            return new TravelPositionFacts(
                    authoredSurface.header().mapId(),
                    LocationKind.TILE,
                    0L,
                    resolvedTile,
                    heading);
        }
    }

    private static final class SurfaceScopeResolver {

        private static SurfaceScope resolve(TravelAuthoredSurface authoredSurface, Cell activeTile) {
            AreaData area = TravelAuthoredSurfaceQueries.areaAt(authoredSurface, activeTile);
            if (area != null) {
                return new SurfaceScope(
                        area,
                        area.label(),
                        area.label(),
                        "Bereich " + area.label(),
                        sameLevelCells(area.cells(), activeTile.level()));
            }
            FeatureData feature = TravelAuthoredSurfaceQueries.travelFeatureAt(authoredSurface, activeTile);
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

        private static Set<Cell> sameLevelCells(List<Cell> cells, int level) {
            Set<Cell> result = new java.util.LinkedHashSet<>();
            for (Cell cell : cells == null ? List.<Cell>of() : cells) {
                if (cell != null && cell.level() == level) {
                    result.add(cell);
                }
            }
            return Set.copyOf(result);
        }
    }

    private static final class TransitionActionProjector {

        private static List<TravelActionFacts> describe(
                TravelAuthoredSurface authoredSurface,
                SurfaceScope scope,
                TravelPositionFacts position
        ) {
            List<TravelActionFacts> result = new ArrayList<>();
            for (Transition transition : authoredSurface.transitions()) {
                Cell anchor = transition.anchor();
                if (anchor == null
                        || anchor.level() != position.tile().level()
                        || !scope.cells().contains(anchor)) {
                    continue;
                }
                String destinationLabel = destinationLabel(transition.destination());
                result.add(new TravelActionFacts(
                        DungeonTravelActionId.fromStableFacts(
                                authoredSurface.header().mapId(),
                                "transition:" + transition.transitionId()),
                        TravelActionKind.TRANSITION,
                        transition.label(),
                        destinationLabel,
                        transition.description().isBlank()
                                ? transition.label() + " fuehrt zu " + destinationLabel + "."
                                : transition.description(),
                        new TravelPositionFacts(
                                authoredSurface.header().mapId(),
                                LocationKind.TRANSITION,
                                transition.transitionId(),
                                anchor,
                                position.heading()),
                        transitionTarget(transition.destination())));
            }
            result.sort(TravelSurfaceProjection::compareTravelActions);
            return List.copyOf(result);
        }

        private static TravelTransitionTarget transitionTarget(
                @Nullable TransitionDestination destination
        ) {
            if (destination == null) {
                return TravelTransitionTarget.absent();
            }
            if (destination.isOverworldTileDestination()) {
                return TravelTransitionTarget.overworldTile(destination.mapId(), destination.tileId());
            }
            if (destination.isDungeonMapDestination()) {
                return TravelTransitionTarget.dungeonMap(destination.mapId(), destination.transitionTarget());
            }
            if (destination.isUnlinkedEntranceDestination()) {
                return TravelTransitionTarget.absent();
            }
            return TravelTransitionTarget.absent();
        }

        private static String destinationLabel(TransitionDestination destination) {
            if (destination == null) {
                return "Kein Ziel verknuepft";
            }
            if (destination.isUnlinkedEntranceDestination()) {
                return "Kein Ziel verknuepft";
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
