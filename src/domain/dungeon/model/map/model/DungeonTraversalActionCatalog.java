package src.domain.dungeon.model.map.model;

import java.io.Serial;
import java.io.Serializable;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.jspecify.annotations.Nullable;

final class DungeonTraversalActionCatalog {

    List<DungeonTravelActionFacts> describe(
            DungeonMap dungeonMap,
            DungeonDerivedState derived,
            @Nullable DungeonAreaFacts activeArea,
            Set<DungeonCell> activeSurfaceCells,
            DungeonTravelPositionFacts position
    ) {
        if (dungeonMap == null || derived == null || activeSurfaceCells == null || activeSurfaceCells.isEmpty()) {
            return List.of();
        }
        return TraversalActionComposer.describe(dungeonMap, derived, activeArea, activeSurfaceCells, position);
    }

    private static final class TraversalActionComposer {

        private static List<DungeonTravelActionFacts> describe(
                DungeonMap dungeonMap,
                DungeonDerivedState derived,
                @Nullable DungeonAreaFacts activeArea,
                Set<DungeonCell> activeSurfaceCells,
                DungeonTravelPositionFacts position
        ) {
            List<TraversalCandidate> candidates = collectCandidates(derived.traversalLinks(), activeSurfaceCells);
            List<DungeonTravelActionFacts> actions = new ArrayList<>();
            int doorNumber = 1;
            for (TraversalCandidate candidate : candidates) {
                String label = candidate.link().source().kind() == DungeonTraversalSourceKind.DOOR
                        ? "Tür " + doorNumber
                        : candidate.link().source().label();
                String destinationLabel = TraversalDestinationLabelResolver.resolve(derived, activeArea, candidate);
                if (candidate.link().source().kind() == DungeonTraversalSourceKind.DOOR) {
                    doorNumber++;
                }
                actions.add(new DungeonTravelActionFacts(
                        candidate.link().directionalActionId(candidate.source().tile()),
                        DungeonTravelActionKind.TRAVERSAL,
                        label,
                        destinationLabel,
                        TraversalNarrationProjector.describe(
                                dungeonMap,
                                activeArea,
                                position.heading(),
                                candidate,
                                destinationLabel),
                        new DungeonTravelPositionFacts(
                                dungeonMap.metadata().mapId(),
                                DungeonTravelPositionFacts.LocationKind.TILE,
                                candidate.target().areaId(),
                                candidate.target().tile(),
                                candidate.link().headingFrom(candidate.source().tile(), position.heading())),
                        null));
            }
            return List.copyOf(actions);
        }

        private static List<TraversalCandidate> collectCandidates(
                List<DungeonTraversalLink> traversalLinks,
                Set<DungeonCell> activeSurfaceCells
        ) {
            List<TraversalCandidate> candidates = new ArrayList<>();
            for (DungeonTraversalLink link : traversalLinks) {
                TraversalCandidate candidate = candidate(link, activeSurfaceCells);
                if (candidate != null) {
                    candidates.add(candidate);
                }
            }
            candidates.sort(new TraversalCandidateComparator());
            return candidates;
        }

        private static @Nullable TraversalCandidate candidate(
                DungeonTraversalLink link,
                Set<DungeonCell> activeSurfaceCells
        ) {
            if (link == null) {
                return null;
            }
            DungeonTraversalEndpoint source = link.endpointFrom(activeSurfaceCells);
            if (source == null) {
                return null;
            }
            DungeonTraversalEndpoint target = link.oppositeOf(source);
            if (target == null) {
                return null;
            }
            return new TraversalCandidate(link, source, target, link.directionFrom(source.tile()));
        }

    }

    private static final class TraversalDestinationLabelResolver {

        private static String resolve(
                DungeonDerivedState derived,
                @Nullable DungeonAreaFacts activeArea,
                TraversalCandidate candidate
        ) {
            DungeonTraversalEndpoint target = candidate.target();
            if (target.areaLabel().isBlank()) {
                return "";
            }
            if (candidate.link().source().kind() == DungeonTraversalSourceKind.DOOR
                    && activeArea != null
                    && activeArea.kind() == DungeonAreaType.ROOM
                    && targetArea(derived, target).kind() == DungeonAreaType.CORRIDOR) {
                List<String> corridorTargets = corridorTargetLabels(derived, activeArea, target.areaId());
                if (!corridorTargets.isEmpty()) {
                    return String.join(", ", corridorTargets);
                }
            }
            return target.areaLabel();
        }

        private static DungeonAreaFacts targetArea(DungeonDerivedState derived, DungeonTraversalEndpoint target) {
            for (DungeonAreaFacts area : derived.map().areas()) {
                if (area != null && area.id() == target.areaId()) {
                    return area;
                }
            }
            return new DungeonAreaFacts(DungeonAreaType.ROOM, 0L, "", List.of());
        }

        private static List<String> corridorTargetLabels(
                DungeonDerivedState derived,
                DungeonAreaFacts activeArea,
                long corridorId
        ) {
            if (derived.relations() == null) {
                return List.of();
            }
            Set<String> labels = new LinkedHashSet<>();
            for (DungeonRelationGraph.ConnectionRelation connection : derived.relations().connections()) {
                if (connection.corridorId() != corridorId || connection.roomId() == activeArea.id()) {
                    continue;
                }
                for (DungeonAreaFacts area : derived.map().areas()) {
                    if (area != null && area.kind() == DungeonAreaType.ROOM && area.id() == connection.roomId()) {
                        labels.add(area.label());
                    }
                }
            }
            return List.copyOf(labels);
        }
    }

    private static final class TraversalNarrationProjector {

        private static String describe(
                DungeonMap dungeonMap,
                @Nullable DungeonAreaFacts activeArea,
                DungeonTravelHeading heading,
                TraversalCandidate candidate,
                String destinationLabel
        ) {
            if (candidate.link().source().kind() == DungeonTraversalSourceKind.STAIR) {
                String target = candidate.target().areaLabel().isBlank()
                        ? tileLabel(candidate.target().tile())
                        : candidate.target().areaLabel();
                return "Über " + candidate.link().source().label() + " gelangt ihr zu " + target + ".";
            }
            String subject = narratedExit(dungeonMap, activeArea, candidate);
            if (subject.isBlank()) {
                subject = "eine Tür";
            }
            String suffix = destinationLabel == null || destinationLabel.isBlank() ? "" : " nach " + destinationLabel;
            return relativePrefix(candidate.direction(), heading) + " ist " + stripTrailingPeriod(subject) + suffix + ".";
        }

        private static String narratedExit(
                DungeonMap dungeonMap,
                @Nullable DungeonAreaFacts activeArea,
                TraversalCandidate candidate
        ) {
            if (activeArea == null || activeArea.kind() != DungeonAreaType.ROOM) {
                return "";
            }
            DungeonRoom room = roomFor(dungeonMap, activeArea);
            if (room == null) {
                return "";
            }
            return exitDescription(room, candidate);
        }

        private static @Nullable DungeonRoom roomFor(DungeonMap dungeonMap, DungeonAreaFacts activeArea) {
            for (DungeonRoom candidateRoom : dungeonMap.rooms().rooms()) {
                if (candidateRoom != null && candidateRoom.roomId() == activeArea.id()) {
                    return candidateRoom;
                }
            }
            return null;
        }

        private static String exitDescription(DungeonRoom room, TraversalCandidate candidate) {
            for (DungeonRoomExitDescription description : room.narration().exitDescriptions()) {
                if (description != null && sameExit(description, candidate) && !description.description().isBlank()) {
                    return description.description();
                }
            }
            return "";
        }

        private static boolean sameExit(DungeonRoomExitDescription description, TraversalCandidate candidate) {
            return candidate.source().tile().equals(description.roomCell())
                    && candidate.direction() == description.direction();
        }

        private static String relativePrefix(@Nullable DungeonEdgeDirection direction, DungeonTravelHeading heading) {
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

        private static int headingOrder(DungeonTravelHeading heading) {
            DungeonTravelHeading resolvedHeading = heading == null ? DungeonTravelHeading.defaultHeading() : heading;
            return resolvedHeading.turnOrder();
        }

        private static int directionOrder(@Nullable DungeonEdgeDirection direction) {
            DungeonEdgeDirection resolvedDirection = direction == null ? DungeonEdgeDirection.NORTH : direction;
            if (resolvedDirection == DungeonEdgeDirection.NORTH) {
                return 0;
            }
            if (resolvedDirection == DungeonEdgeDirection.EAST) {
                return 1;
            }
            if (resolvedDirection == DungeonEdgeDirection.SOUTH) {
                return 2;
            }
            return 3;
        }

        private static String tileLabel(DungeonCell tile) {
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
            DungeonTraversalLink link,
            DungeonTraversalEndpoint source,
            DungeonTraversalEndpoint target,
            @Nullable DungeonEdgeDirection direction
    ) {
    }

    private static final class TraversalCandidateComparator implements Comparator<TraversalCandidate>, Serializable {
        @Serial
        private static final long serialVersionUID = 1L;

        @Override
        public int compare(TraversalCandidate left, TraversalCandidate right) {
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
            return candidate != null && candidate.link().source().kind() == DungeonTraversalSourceKind.DOOR ? 0 : 1;
        }

        private static int directionOrder(TraversalCandidate candidate) {
            if (candidate == null) {
                return 0;
            }
            DungeonEdgeDirection direction = candidate.direction();
            if (direction == DungeonEdgeDirection.EAST) {
                return 1;
            }
            if (direction == DungeonEdgeDirection.SOUTH) {
                return 2;
            }
            if (direction == DungeonEdgeDirection.WEST) {
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
}
