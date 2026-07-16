package features.dungeon.application.travel.projection;


import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import org.jspecify.annotations.Nullable;
import features.dungeon.domain.core.geometry.Cell;
import features.dungeon.domain.core.geometry.Direction;
import features.dungeon.application.travel.session.TravelDungeonSessionSurface.AreaKind;
import features.dungeon.application.travel.session.TravelDungeonSessionSurface.AreaData;
import features.dungeon.application.travel.session.TravelDungeonSessionSurface.LocationKind;

final class TraversalActionCatalog {

    List<TravelActionFacts> describe(
            TravelAuthoredSurface authoredSurface,
            List<TraversalLink> traversalLinks,
            @Nullable AreaData activeArea,
            Set<Cell> activeSurfaceCells,
            TravelPositionFacts position
    ) {
        if (authoredSurface == null || activeSurfaceCells == null || activeSurfaceCells.isEmpty()) {
            return List.of();
        }
        return TraversalActionComposer.describe(
                authoredSurface,
                traversalLinks == null ? List.of() : traversalLinks,
                activeArea,
                activeSurfaceCells,
                position);
    }

    private static final class TraversalActionComposer {

        private static List<TravelActionFacts> describe(
                TravelAuthoredSurface authoredSurface,
                List<TraversalLink> traversalLinks,
                @Nullable AreaData activeArea,
                Set<Cell> activeSurfaceCells,
                TravelPositionFacts position
        ) {
            List<TraversalCandidate> candidates = collectCandidates(
                    traversalLinks,
                    activeSurfaceCells,
                    position.tile());
            List<TravelActionFacts> actions = new ArrayList<>();
            int doorNumber = 1;
            for (TraversalCandidate candidate : candidates) {
                TraversalSourceKind sourceKind = candidate.link().source().kind();
                String label = sourceKind.isDoor()
                        ? "Tür " + doorNumber
                        : candidate.link().source().label();
                String destinationLabel = TraversalDestinationLabelResolver.resolve(authoredSurface, activeArea, candidate);
                if (sourceKind.isDoor()) {
                    doorNumber++;
                }
                actions.add(new TravelActionFacts(
                        candidate.link().directionalActionId(candidate.source().tile()),
                        TravelActionKind.TRAVERSAL,
                        label,
                        destinationLabel,
                        TraversalNarrationProjector.describe(
                                authoredSurface,
                                activeArea,
                                position.heading(),
                                candidate,
                                destinationLabel),
                        new TravelPositionFacts(
                                authoredSurface.header().mapId(),
                                LocationKind.TILE,
                                candidate.target().areaId(),
                                candidate.target().tile(),
                                candidate.link().headingFrom(candidate.source().tile(), position.heading())),
                        TravelTransitionTarget.absent()));
            }
            return List.copyOf(actions);
        }

        private static List<TraversalCandidate> collectCandidates(
                List<TraversalLink> traversalLinks,
                Set<Cell> activeSurfaceCells,
                Cell activeTile
        ) {
            List<TraversalCandidate> candidates = new ArrayList<>();
            for (TraversalLink link : traversalLinks) {
                TraversalCandidate candidate = candidate(link, activeSurfaceCells, activeTile);
                if (candidate != null) {
                    candidates.add(candidate);
                }
            }
            candidates.sort(TraversalActionCatalog::compareTraversalCandidates);
            return candidates;
        }

        private static @Nullable TraversalCandidate candidate(
                TraversalLink link,
                Set<Cell> activeSurfaceCells,
                Cell activeTile
        ) {
            if (link == null) {
                return null;
            }
            TraversalEndpoint source = link.source().kind().isCorridor()
                    ? link.endpointFrom(Set.of(activeTile))
                    : link.endpointFrom(activeSurfaceCells);
            if (source == null) {
                return null;
            }
            TraversalEndpoint target = link.oppositeOf(source);
            if (target == null) {
                return null;
            }
            return new TraversalCandidate(link, source, target, link.directionFrom(source.tile()));
        }

    }

    private static final class TraversalDestinationLabelResolver {

        private static String resolve(
                TravelAuthoredSurface authoredSurface,
                @Nullable AreaData activeArea,
                TraversalCandidate candidate
        ) {
            TraversalEndpoint target = candidate.target();
            if (target.areaLabel().isBlank()) {
                return "";
            }
            if (candidate.link().source().kind().isDoor()
                    && activeArea != null
                    && activeArea.kind().equals(AreaKind.ROOM)
                    && TravelAuthoredSurfaceQueries.areaById(authoredSurface, target.areaId()).kind()
                            .equals(AreaKind.CORRIDOR)) {
                List<String> corridorTargets =
                        TravelAuthoredSurfaceQueries.corridorTargetLabels(authoredSurface, activeArea, target.areaId());
                if (!corridorTargets.isEmpty()) {
                    return String.join(", ", corridorTargets);
                }
            }
            return target.areaLabel();
        }
    }

    private static final class TraversalNarrationProjector {

        private static String describe(
                TravelAuthoredSurface authoredSurface,
                @Nullable AreaData activeArea,
                TravelHeading heading,
                TraversalCandidate candidate,
                String destinationLabel
        ) {
            if (candidate.link().source().kind().isStair()) {
                String target = candidate.target().areaLabel().isBlank()
                        ? tileLabel(candidate.target().tile())
                        : candidate.target().areaLabel();
                return "Über " + candidate.link().source().label() + " gelangt ihr zu " + target + ".";
            }
            if (candidate.link().source().kind().isCorridor()) {
                return "Ihr folgt " + candidate.link().source().label()
                        + " zu " + tileLabel(candidate.target().tile()) + ".";
            }
            String subject = narratedExit(authoredSurface, activeArea, candidate);
            if (subject.isBlank()) {
                subject = "eine Tür";
            }
            String suffix = destinationLabel == null || destinationLabel.isBlank() ? "" : " nach " + destinationLabel;
            return relativePrefix(candidate.direction(), heading) + " ist " + stripTrailingPeriod(subject) + suffix + ".";
        }

        private static String narratedExit(
                TravelAuthoredSurface authoredSurface,
                @Nullable AreaData activeArea,
                TraversalCandidate candidate
        ) {
            return TravelAuthoredSurfaceQueries.narratedExit(
                    authoredSurface,
                    activeArea,
                    candidate.source().tile(),
                    candidate.direction());
        }

        private static String relativePrefix(@Nullable Direction direction, TravelHeading heading) {
            if (direction == null) {
                return "Bei euch";
            }
            int turn = Math.floorMod(directionOrder(direction) - headingOrder(heading), 4);
            return switch (turn) {
                case 0 -> "Direkt vor euch";
                case 1 -> "Rechts von euch";
                case 2 -> "Hinter euch";
                default -> "Links von euch";
            };
        }

        private static int headingOrder(TravelHeading heading) {
            TravelHeading resolvedHeading = heading == null ? TravelHeading.defaultHeading() : heading;
            return resolvedHeading.turnOrder();
        }

        private static int directionOrder(@Nullable Direction direction) {
            Direction resolvedDirection = direction == null ? Direction.NORTH : direction;
            if (resolvedDirection == Direction.NORTH) {
                return 0;
            }
            if (resolvedDirection == Direction.EAST) {
                return 1;
            }
            if (resolvedDirection == Direction.SOUTH) {
                return 2;
            }
            return 3;
        }

        private static String tileLabel(Cell tile) {
            return "x=" + tile.q() + " y=" + tile.r() + " z=" + tile.level();
        }

        private static String stripTrailingPeriod(String value) {
            String text = value == null ? "" : value.trim();
            while (text.endsWith(".") || text.endsWith("!") || text.endsWith("?")) {
                text = text.substring(0, text.length() - 1).trim();
            }
            return text;
        }
    }

    private record TraversalCandidate(
            TraversalLink link,
            TraversalEndpoint source,
            TraversalEndpoint target,
            @Nullable Direction direction
    ) {
    }

    private static int compareTraversalCandidates(TraversalCandidate left, TraversalCandidate right) {
        int sourceComparison = Integer.compare(sourceOrder(left), sourceOrder(right));
        if (sourceComparison != 0) {
            return sourceComparison;
        }
        int directionComparison = Integer.compare(directionOrder(left), directionOrder(right));
        if (directionComparison != 0) {
            return directionComparison;
        }
        int labelComparison = String.CASE_INSENSITIVE_ORDER.compare(sourceLabel(left), sourceLabel(right));
        if (labelComparison != 0) {
            return labelComparison;
        }
        return sourceKey(left).compareTo(sourceKey(right));
    }

    private static int sourceOrder(TraversalCandidate candidate) {
        return candidate == null ? 0 : candidate.link().source().kind().sortOrder();
    }

    private static int directionOrder(TraversalCandidate candidate) {
        if (candidate == null) {
            return 0;
        }
        Direction direction = candidate.direction();
        if (direction == Direction.EAST) {
            return 1;
        }
        if (direction == Direction.SOUTH) {
            return 2;
        }
        if (direction == Direction.WEST) {
            return 3;
        }
        return 0;
    }

    private static String sourceLabel(TraversalCandidate candidate) {
        return candidate == null ? "" : candidate.link().source().label();
    }

    private static String sourceKey(TraversalCandidate candidate) {
        return candidate == null ? "" : candidate.link().key();
    }
}
