package src.domain.dungeon.map.service;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.map.aggregate.DungeonMap;
import src.domain.dungeon.map.entity.DungeonRoom;
import src.domain.dungeon.map.value.DungeonAreaFacts;
import src.domain.dungeon.map.value.DungeonAreaType;
import src.domain.dungeon.map.value.DungeonBoundaryFacts;
import src.domain.dungeon.map.value.DungeonCell;
import src.domain.dungeon.map.value.DungeonDerivedState;
import src.domain.dungeon.map.value.DungeonEdge;
import src.domain.dungeon.map.value.DungeonEdgeDirection;
import src.domain.dungeon.map.value.DungeonMapFacts;
import src.domain.dungeon.map.value.DungeonRelationGraph;
import src.domain.dungeon.map.value.DungeonRoomExitDescription;
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

final class DungeonDoorActionCatalog {

    private static final String DOOR_KIND = "door";

    List<DungeonTravelActionFacts> describe(
            DungeonMap dungeonMap,
            DungeonDerivedState derived,
            @Nullable DungeonAreaFacts activeArea,
            Set<DungeonCell> activeSurfaceCells,
            DungeonTravelPositionFacts position
    ) {
        DungeonMapFacts mapFacts = derived == null ? null : derived.map();
        if (dungeonMap == null || mapFacts == null || activeSurfaceCells == null || activeSurfaceCells.isEmpty()) {
            return List.of();
        }
        List<DoorCandidate> candidates = new ArrayList<>();
        for (DungeonBoundaryFacts boundary : mapFacts.boundaries()) {
            DoorCandidate candidate = candidate(boundary, mapFacts, activeSurfaceCells);
            if (candidate != null) {
                candidates.add(candidate);
            }
        }
        candidates.sort(Comparator
                .comparingInt((DoorCandidate candidate) -> directionOrder(candidate.direction()))
                .thenComparingInt(candidate -> candidate.source().level())
                .thenComparingInt(candidate -> candidate.source().r())
                .thenComparingInt(candidate -> candidate.source().q())
                .thenComparingLong(candidate -> candidate.boundary().id()));
        return actions(dungeonMap, derived, activeArea, position, candidates);
    }

    private static List<DungeonTravelActionFacts> actions(
            DungeonMap dungeonMap,
            DungeonDerivedState derived,
            @Nullable DungeonAreaFacts activeArea,
            DungeonTravelPositionFacts position,
            List<DoorCandidate> candidates
    ) {
        List<DungeonTravelActionFacts> actions = new ArrayList<>();
        int number = 1;
        for (DoorCandidate candidate : candidates) {
            DungeonAreaFacts targetArea = areaAt(derived.map(), candidate.target());
            String destinationLabel = destinationLabel(derived, activeArea, targetArea);
            actions.add(new DungeonTravelActionFacts(
                    actionId(candidate.boundary(), candidate.source(), candidate.target()),
                    DungeonTravelActionKind.DOOR,
                    "Tuer " + number,
                    destinationLabel,
                    description(dungeonMap, activeArea, candidate, destinationLabel, position.heading()),
                    new DungeonTravelPositionFacts(
                            dungeonMap.metadata().mapId(),
                            DungeonTravelLocationKind.TILE,
                            targetArea == null ? 0L : targetArea.id(),
                            candidate.target(),
                            heading(candidate.direction())),
                    null));
            number++;
        }
        return List.copyOf(actions);
    }

    private static @Nullable DoorCandidate candidate(
            DungeonBoundaryFacts boundary,
            DungeonMapFacts mapFacts,
            Set<DungeonCell> activeSurfaceCells
    ) {
        if (boundary == null || !DOOR_KIND.equalsIgnoreCase(boundary.kind())) {
            return null;
        }
        DungeonEdge edge = boundary.edge();
        if (edge == null || edge.from() == null || edge.to() == null) {
            return null;
        }
        DungeonCell from = edge.from();
        DungeonCell to = edge.to();
        boolean fromActive = activeSurfaceCells.contains(from);
        boolean toActive = activeSurfaceCells.contains(to);
        if (fromActive == toActive) {
            return null;
        }
        DungeonCell source = fromActive ? from : to;
        DungeonCell target = fromActive ? to : from;
        DungeonEdgeDirection direction = direction(source, target);
        if (direction == null || !mapFacts.allCells().contains(target)) {
            return null;
        }
        return new DoorCandidate(boundary, source, target, direction);
    }

    private static @Nullable DungeonEdgeDirection direction(DungeonCell source, DungeonCell target) {
        if (source.level() != target.level()) {
            return null;
        }
        int deltaQ = target.q() - source.q();
        int deltaR = target.r() - source.r();
        for (DungeonEdgeDirection direction : DungeonEdgeDirection.values()) {
            if (direction.deltaQ() == deltaQ && direction.deltaR() == deltaR) {
                return direction;
            }
        }
        return null;
    }

    private static String destinationLabel(
            DungeonDerivedState derived,
            @Nullable DungeonAreaFacts activeArea,
            @Nullable DungeonAreaFacts targetArea
    ) {
        if (targetArea == null) {
            return "";
        }
        if (activeArea != null
                && activeArea.kind() == DungeonAreaType.ROOM
                && targetArea.kind() == DungeonAreaType.CORRIDOR) {
            List<String> corridorTargets = corridorTargetLabels(derived, activeArea, targetArea);
            if (!corridorTargets.isEmpty()) {
                return String.join(", ", corridorTargets);
            }
        }
        return targetArea.label();
    }

    private static List<String> corridorTargetLabels(
            DungeonDerivedState derived,
            DungeonAreaFacts activeArea,
            DungeonAreaFacts targetArea
    ) {
        Set<String> labels = new LinkedHashSet<>();
        if (derived.relations() == null) {
            return List.of();
        }
        for (DungeonRelationGraph.ConnectionRelation connection : derived.relations().connections()) {
            if (connection.corridorId() != targetArea.id() || connection.roomId() == activeArea.id()) {
                continue;
            }
            DungeonAreaFacts room = areaById(derived.map(), DungeonAreaType.ROOM, connection.roomId());
            if (room != null) {
                labels.add(room.label());
            }
        }
        return List.copyOf(labels);
    }

    private static String description(
            DungeonMap dungeonMap,
            @Nullable DungeonAreaFacts activeArea,
            DoorCandidate candidate,
            String destinationLabel,
            DungeonTravelHeading heading
    ) {
        String subject = narratedExit(dungeonMap, activeArea, candidate);
        if (subject.isBlank()) {
            subject = "eine Tuer";
        }
        String destination = destinationLabel.isBlank() ? "" : " nach " + destinationLabel;
        return relativePrefix(candidate.direction(), heading) + " ist " + stripTrailingPeriod(subject) + destination + ".";
    }

    private static String narratedExit(
            DungeonMap dungeonMap,
            @Nullable DungeonAreaFacts activeArea,
            DoorCandidate candidate
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

    private static boolean sameExit(DungeonRoomExitDescription description, DoorCandidate candidate) {
        return candidate.source().equals(description.roomCell()) && candidate.direction() == description.direction();
    }

    private static String relativePrefix(DungeonEdgeDirection direction, DungeonTravelHeading heading) {
        int turn = Math.floorMod(directionOrder(direction) - headingOrder(heading), 4);
        return switch (turn) {
            case 0 -> "Direkt vor euch";
            case 1 -> "Rechts von euch";
            case 2 -> "Hinter euch";
            default -> "Links von euch";
        };
    }

    private static DungeonTravelHeading heading(DungeonEdgeDirection direction) {
        return DungeonTravelHeading.valueOf(direction.name());
    }

    private static int headingOrder(DungeonTravelHeading heading) {
        return switch (heading == null ? DungeonTravelHeading.defaultHeading() : heading) {
            case NORTH -> 0;
            case EAST -> 1;
            case SOUTH -> 2;
            case WEST -> 3;
        };
    }

    private static int directionOrder(DungeonEdgeDirection direction) {
        return switch (direction) {
            case NORTH -> 0;
            case EAST -> 1;
            case SOUTH -> 2;
            case WEST -> 3;
        };
    }

    private static @Nullable DungeonAreaFacts areaAt(DungeonMapFacts mapFacts, DungeonCell cell) {
        return mapFacts.areas().stream()
                .filter(area -> area.cells().contains(cell))
                .findFirst()
                .orElse(null);
    }

    private static @Nullable DungeonAreaFacts areaById(DungeonMapFacts mapFacts, DungeonAreaType kind, long id) {
        return mapFacts.areas().stream()
                .filter(area -> area.kind() == kind && area.id() == id)
                .findFirst()
                .orElse(null);
    }

    private static String actionId(DungeonBoundaryFacts boundary, DungeonCell source, DungeonCell target) {
        return "door:" + boundary.id() + ":" + cellKey(source) + ":" + cellKey(target);
    }

    private static String cellKey(DungeonCell cell) {
        return cell.q() + "," + cell.r() + "," + cell.level();
    }

    private static String stripTrailingPeriod(String value) {
        String text = value == null ? "" : value.trim();
        while (text.endsWith(".") || text.endsWith("!") || text.endsWith("?")) {
            text = text.substring(0, text.length() - 1).trim();
        }
        return text;
    }

    private record DoorCandidate(
            DungeonBoundaryFacts boundary,
            DungeonCell source,
            DungeonCell target,
            DungeonEdgeDirection direction
    ) {
    }
}
