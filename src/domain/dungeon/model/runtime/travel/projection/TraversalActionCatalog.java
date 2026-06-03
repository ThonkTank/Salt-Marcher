package src.domain.dungeon.model.runtime.travel.projection;


import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.core.geometry.Cell;
import src.domain.dungeon.model.core.geometry.Direction;
import src.domain.dungeon.model.worldspace.DungeonAreaFacts;
import src.domain.dungeon.model.worldspace.DungeonAreaType;
import src.domain.dungeon.model.worldspace.DungeonDerivedState;
import src.domain.dungeon.model.worldspace.DungeonMap;
import src.domain.dungeon.model.worldspace.DungeonRelationGraph;
import src.domain.dungeon.model.worldspace.DungeonRoom;
import src.domain.dungeon.model.worldspace.DungeonRoomExitDescription;

final class TraversalActionCatalog {

    List<TravelActionFacts> describe(
            DungeonMap dungeonMap,
            DungeonDerivedState derived,
            List<TraversalLink> traversalLinks,
            @Nullable DungeonAreaFacts activeArea,
            Set<Cell> activeSurfaceCells,
            TravelPositionFacts position
    ) {
        if (dungeonMap == null || derived == null || activeSurfaceCells == null || activeSurfaceCells.isEmpty()) {
            return List.of();
        }
        return TraversalActionComposer.describe(
                dungeonMap,
                derived,
                traversalLinks == null ? List.of() : traversalLinks,
                activeArea,
                activeSurfaceCells,
                position);
    }

    private static final class TraversalActionComposer {

        private static List<TravelActionFacts> describe(
                DungeonMap dungeonMap,
                DungeonDerivedState derived,
                List<TraversalLink> traversalLinks,
                @Nullable DungeonAreaFacts activeArea,
                Set<Cell> activeSurfaceCells,
                TravelPositionFacts position
        ) {
            List<TraversalCandidate> candidates = collectCandidates(traversalLinks, activeSurfaceCells);
            List<TravelActionFacts> actions = new ArrayList<>();
            int doorNumber = 1;
            for (TraversalCandidate candidate : candidates) {
                String label = candidate.link().source().kind().isDoor()
                        ? "Tür " + doorNumber
                        : candidate.link().source().label();
                String destinationLabel = TraversalDestinationLabelResolver.resolve(derived, activeArea, candidate);
                if (candidate.link().source().kind().isDoor()) {
                    doorNumber++;
                }
                actions.add(new TravelActionFacts(
                        candidate.link().directionalActionId(candidate.source().tile()),
                        TravelActionKind.TRAVERSAL,
                        label,
                        destinationLabel,
                        TraversalNarrationProjector.describe(
                                dungeonMap,
                                activeArea,
                                position.heading(),
                                candidate,
                                destinationLabel),
                        new TravelPositionFacts(
                                dungeonMap.metadata().mapId().value(),
                                TravelPositionFacts.LocationKind.TILE,
                                candidate.target().areaId(),
                                candidate.target().tile(),
                                candidate.link().headingFrom(candidate.source().tile(), position.heading())),
                        null));
            }
            return List.copyOf(actions);
        }

        private static List<TraversalCandidate> collectCandidates(
                List<TraversalLink> traversalLinks,
                Set<Cell> activeSurfaceCells
        ) {
            List<TraversalCandidate> candidates = new ArrayList<>();
            for (TraversalLink link : traversalLinks) {
                TraversalCandidate candidate = candidate(link, activeSurfaceCells);
                if (candidate != null) {
                    candidates.add(candidate);
                }
            }
            candidates.sort(TraversalActionCatalog::compareTraversalCandidates);
            return candidates;
        }

        private static @Nullable TraversalCandidate candidate(
                TraversalLink link,
                Set<Cell> activeSurfaceCells
        ) {
            if (link == null) {
                return null;
            }
            TraversalEndpoint source = link.endpointFrom(activeSurfaceCells);
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
                DungeonDerivedState derived,
                @Nullable DungeonAreaFacts activeArea,
                TraversalCandidate candidate
        ) {
            TraversalEndpoint target = candidate.target();
            if (target.areaLabel().isBlank()) {
                return "";
            }
            if (candidate.link().source().kind().isDoor()
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

        private static DungeonAreaFacts targetArea(DungeonDerivedState derived, TraversalEndpoint target) {
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
            return candidate.source().tile().equals(TravelGeometryProjectionMapper.toCoreCell(description.roomCell()))
                    && candidate.direction() == directionFromName(
                            description.direction() == null ? "" : description.direction().name());
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

    private static Direction directionFromName(String name) {
        return switch (name == null ? "" : name.trim()) {
            case "EAST" -> Direction.EAST;
            case "SOUTH" -> Direction.SOUTH;
            case "WEST" -> Direction.WEST;
            default -> Direction.NORTH;
        };
    }

    private static String sourceLabel(TraversalCandidate candidate) {
        return candidate == null ? "" : candidate.link().source().label();
    }

    private static String sourceKey(TraversalCandidate candidate) {
        return candidate == null ? "" : candidate.link().key();
    }
}
