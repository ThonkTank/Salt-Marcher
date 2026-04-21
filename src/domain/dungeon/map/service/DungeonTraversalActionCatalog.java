package src.domain.dungeon.map.service;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.map.aggregate.DungeonMap;
import src.domain.dungeon.map.entity.DungeonRoom;
import src.domain.dungeon.map.value.DungeonAreaFacts;
import src.domain.dungeon.map.value.DungeonAreaType;
import src.domain.dungeon.map.value.DungeonCell;
import src.domain.dungeon.map.value.DungeonDerivedState;
import src.domain.dungeon.map.value.DungeonEdgeDirection;
import src.domain.dungeon.map.value.DungeonRelationGraph;
import src.domain.dungeon.map.value.DungeonRoomExitDescription;
import src.domain.dungeon.map.value.DungeonTraversalEndpoint;
import src.domain.dungeon.map.value.DungeonTraversalLink;
import src.domain.dungeon.map.value.DungeonTraversalSourceKind;
import src.domain.dungeon.map.value.DungeonTravelActionFacts;
import src.domain.dungeon.map.value.DungeonTravelActionKind;
import src.domain.dungeon.map.value.DungeonTravelHeading;
import src.domain.dungeon.map.value.DungeonTravelLocationKind;
import src.domain.dungeon.map.value.DungeonTravelPositionFacts;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

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
        List<TraversalCandidate> candidates = new ArrayList<>();
        for (DungeonTraversalLink link : derived.traversalLinks()) {
            TraversalCandidate candidate = candidate(link, activeSurfaceCells);
            if (candidate != null) {
                candidates.add(candidate);
            }
        }
        candidates.sort(Comparator
                .comparingInt((TraversalCandidate candidate) -> sourceOrder(candidate.link().source().kind()))
                .thenComparingInt(candidate -> directionOrder(candidate.direction()))
                .thenComparing(candidate -> candidate.link().source().label(), String.CASE_INSENSITIVE_ORDER)
                .thenComparing(candidate -> candidate.link().key()));
        return actions(dungeonMap, derived, activeArea, position, candidates);
    }

    private static @Nullable TraversalCandidate candidate(DungeonTraversalLink link, Set<DungeonCell> activeSurfaceCells) {
        if (link == null) {
            return null;
        }
        DungeonTraversalEndpoint source = link.endpointFrom(activeSurfaceCells);
        if (source == null) {
            return null;
        }
        DungeonTraversalEndpoint target = link.oppositeOf(source);
        if (source == null || target == null) {
            return null;
        }
        return new TraversalCandidate(link, source, target, link.directionFrom(source.tile()));
    }

    private static List<DungeonTravelActionFacts> actions(
            DungeonMap dungeonMap,
            DungeonDerivedState derived,
            @Nullable DungeonAreaFacts activeArea,
            DungeonTravelPositionFacts position,
            List<TraversalCandidate> candidates
    ) {
        List<DungeonTravelActionFacts> actions = new ArrayList<>();
        int doorNumber = 1;
        for (TraversalCandidate candidate : candidates) {
            String label = label(candidate, doorNumber);
            String destinationLabel = destinationLabel(derived, activeArea, candidate);
            if (candidate.link().source().kind() == DungeonTraversalSourceKind.DOOR) {
                doorNumber++;
            }
            actions.add(new DungeonTravelActionFacts(
                    candidate.link().directionalActionId(candidate.source().tile()),
                    DungeonTravelActionKind.TRAVERSAL,
                    label,
                    destinationLabel,
                    description(dungeonMap, activeArea, position.heading(), candidate, destinationLabel),
                    new DungeonTravelPositionFacts(
                            dungeonMap.metadata().mapId(),
                            DungeonTravelLocationKind.TILE,
                            candidate.target().areaId(),
                            candidate.target().tile(),
                            candidate.link().headingFrom(candidate.source().tile(), position.heading())),
                    null));
        }
        return List.copyOf(actions);
    }

    private static String label(TraversalCandidate candidate, int doorNumber) {
        if (candidate.link().source().kind() == DungeonTraversalSourceKind.DOOR) {
            return "Tuer " + doorNumber;
        }
        return candidate.link().source().label();
    }

    private static String destinationLabel(
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
        return derived.map().areas().stream()
                .filter(area -> area.id() == target.areaId())
                .findFirst()
                .orElse(new DungeonAreaFacts(DungeonAreaType.ROOM, 0L, "", List.of()));
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
            derived.map().areas().stream()
                    .filter(area -> area.kind() == DungeonAreaType.ROOM && area.id() == connection.roomId())
                    .map(DungeonAreaFacts::label)
                    .forEach(labels::add);
        }
        return List.copyOf(labels);
    }

    private static String description(
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
            return "Ueber " + candidate.link().source().label() + " gelangt ihr zu " + target + ".";
        }
        String subject = narratedExit(dungeonMap, activeArea, candidate);
        if (subject.isBlank()) {
            subject = "eine Tuer";
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
        DungeonRoom room = dungeonMap.rooms().rooms().stream()
                .filter(candidateRoom -> candidateRoom.roomId() == activeArea.id())
                .findFirst()
                .orElse(null);
        if (room == null) {
            return "";
        }
        return room.narration().exitDescriptions().stream()
                .filter(description -> sameExit(description, candidate))
                .map(DungeonRoomExitDescription::description)
                .filter(description -> !description.isBlank())
                .findFirst()
                .orElse("");
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

    private static int sourceOrder(DungeonTraversalSourceKind kind) {
        return kind == DungeonTraversalSourceKind.DOOR ? 0 : 1;
    }

    private static int headingOrder(DungeonTravelHeading heading) {
        return switch (heading == null ? DungeonTravelHeading.defaultHeading() : heading) {
            case NORTH -> 0;
            case EAST -> 1;
            case SOUTH -> 2;
            case WEST -> 3;
        };
    }

    private static int directionOrder(@Nullable DungeonEdgeDirection direction) {
        return switch (direction == null ? DungeonEdgeDirection.NORTH : direction) {
            case NORTH -> 0;
            case EAST -> 1;
            case SOUTH -> 2;
            case WEST -> 3;
        };
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

    private record TraversalCandidate(
            DungeonTraversalLink link,
            DungeonTraversalEndpoint source,
            DungeonTraversalEndpoint target,
            @Nullable DungeonEdgeDirection direction
    ) {
    }
}
