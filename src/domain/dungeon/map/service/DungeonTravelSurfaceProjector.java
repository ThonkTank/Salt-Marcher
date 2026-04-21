package src.domain.dungeon.map.service;

import org.jspecify.annotations.Nullable;
import src.domain.dungeon.map.aggregate.DungeonMap;
import src.domain.dungeon.map.entity.DungeonStair;
import src.domain.dungeon.map.entity.DungeonTransition;
import src.domain.dungeon.map.value.DungeonAreaFacts;
import src.domain.dungeon.map.value.DungeonCell;
import src.domain.dungeon.map.value.DungeonDerivedState;
import src.domain.dungeon.map.value.DungeonFeatureFacts;
import src.domain.dungeon.map.value.DungeonFeatureType;
import src.domain.dungeon.map.value.DungeonMapFacts;
import src.domain.dungeon.map.value.DungeonMapIdentity;
import src.domain.dungeon.map.value.DungeonStairExit;
import src.domain.dungeon.map.value.DungeonTransitionDestination;
import src.domain.dungeon.map.value.DungeonTravelActionFacts;
import src.domain.dungeon.map.value.DungeonTravelActionKind;
import src.domain.dungeon.map.value.DungeonTravelHeading;
import src.domain.dungeon.map.value.DungeonTravelLocationKind;
import src.domain.dungeon.map.value.DungeonTravelPositionFacts;
import src.domain.dungeon.map.value.DungeonTravelSurfaceFacts;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

public final class DungeonTravelSurfaceProjector {

    public DungeonTravelSurfaceFacts project(
            DungeonMap dungeonMap,
            DungeonDerivedState derived,
            @Nullable DungeonTravelPositionFacts preferredPosition,
            String statusLabel
    ) {
        DungeonMap safeMap = dungeonMap == null
                ? DungeonMap.empty(new DungeonMapIdentity(1L), "Dungeon")
                : dungeonMap;
        DungeonMapFacts mapFacts = derived == null ? null : derived.map();
        DungeonMapFacts safeFacts = mapFacts == null
                ? new DungeonMapFacts(safeMap.topology().topology(), 1, 1, List.of(), List.of())
                : mapFacts;
        DungeonTravelPositionFacts position = resolvePosition(safeMap, safeFacts, preferredPosition);
        SurfaceScope scope = surfaceScope(safeFacts, position.tile());
        List<DungeonTravelActionFacts> actions = new ArrayList<>();
        actions.addAll(stairActions(safeMap, scope, position));
        actions.addAll(transitionActions(safeMap, scope, position));
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
        DungeonCell preferredTile = preferredPosition == null ? null : preferredPosition.tile();
        DungeonTravelHeading heading = preferredPosition == null ? DungeonTravelHeading.defaultHeading() : preferredPosition.heading();
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

    private static SurfaceScope surfaceScope(DungeonMapFacts mapFacts, DungeonCell activeTile) {
        DungeonAreaFacts area = areaAt(mapFacts, activeTile);
        if (area != null) {
            return new SurfaceScope(
                    area.label(),
                    area.label(),
                    "Bereich " + area.label(),
                    sameLevelCells(area.cells(), activeTile.level()));
        }
        DungeonFeatureFacts feature = featureAt(mapFacts, activeTile);
        if (feature != null) {
            return new SurfaceScope(
                    feature.label(),
                    feature.label(),
                    feature.description().isBlank() ? feature.label() : feature.description(),
                    sameLevelCells(feature.cells(), activeTile.level()));
        }
        return new SurfaceScope(
                "Dungeon-Feld",
                "Feld " + activeTile.q() + "," + activeTile.r(),
                "",
                Set.of(activeTile));
    }

    private static List<DungeonTravelActionFacts> stairActions(
            DungeonMap dungeonMap,
            SurfaceScope scope,
            DungeonTravelPositionFacts position
    ) {
        List<DungeonTravelActionFacts> result = new ArrayList<>();
        Set<DungeonCell> surfaceCells = scope.cells();
        int activeLevel = position.tile().level();
        for (DungeonStair stair : dungeonMap.connections().stairs()) {
            Set<DungeonCell> originPositions = new LinkedHashSet<>();
            for (DungeonStairExit exit : stair.exitsAtLevel(activeLevel)) {
                if (surfaceCells.contains(exit.position())) {
                    originPositions.add(exit.position());
                }
            }
            if (originPositions.isEmpty()) {
                continue;
            }
            for (DungeonStairExit exit : stair.exits()) {
                if (originPositions.contains(exit.position()) || position.tile().equals(exit.position())) {
                    continue;
                }
                result.add(new DungeonTravelActionFacts(
                        stairActionId(stair.stairId(), exit.position()),
                        DungeonTravelActionKind.STAIR,
                        stair.name(),
                        exit.label(),
                        "Ueber " + stair.name() + " gelangt ihr zu " + exit.label() + ".",
                        new DungeonTravelPositionFacts(
                                dungeonMap.metadata().mapId(),
                                DungeonTravelLocationKind.STAIR_EXIT,
                                stair.stairId(),
                                exit.position(),
                                position.heading()),
                        null));
            }
        }
        return result.stream()
                .sorted(Comparator.comparing(DungeonTravelActionFacts::displayLabel, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    private static List<DungeonTravelActionFacts> transitionActions(
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
            result.add(new DungeonTravelActionFacts(
                    transitionActionId(transition.transitionId()),
                    DungeonTravelActionKind.TRANSITION,
                    transition.label(),
                    destinationLabel(transition.destination()),
                    transition.description().isBlank()
                            ? transition.label() + " fuehrt zu " + destinationLabel(transition.destination()) + "."
                            : transition.description(),
                    new DungeonTravelPositionFacts(
                            dungeonMap.metadata().mapId(),
                            DungeonTravelLocationKind.TRANSITION,
                            transition.transitionId(),
                            anchor,
                            position.heading()),
                    transition.destination()));
        }
        return result.stream()
                .sorted(Comparator.comparing(DungeonTravelActionFacts::displayLabel, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    public static String stairActionId(long stairId, DungeonCell target) {
        return "stair:" + stairId + ":" + target.q() + "," + target.r() + "," + target.level();
    }

    public static String transitionActionId(long transitionId) {
        return "transition:" + transitionId;
    }

    private static @Nullable DungeonAreaFacts areaAt(DungeonMapFacts mapFacts, DungeonCell cell) {
        if (mapFacts == null || cell == null) {
            return null;
        }
        return mapFacts.areas().stream()
                .filter(area -> area.cells().contains(cell))
                .findFirst()
                .orElse(null);
    }

    private static @Nullable DungeonFeatureFacts featureAt(DungeonMapFacts mapFacts, DungeonCell cell) {
        if (mapFacts == null || cell == null) {
            return null;
        }
        return mapFacts.features().stream()
                .filter(feature -> feature.kind() == DungeonFeatureType.STAIR
                        || feature.kind() == DungeonFeatureType.TRANSITION)
                .filter(feature -> feature.cells().contains(cell))
                .findFirst()
                .orElse(null);
    }

    private static boolean containsCell(DungeonMapFacts mapFacts, DungeonCell cell) {
        return mapFacts != null && mapFacts.allCells().contains(cell);
    }

    private static @Nullable DungeonCell firstTraversableCell(DungeonMapFacts mapFacts) {
        if (mapFacts == null) {
            return null;
        }
        return java.util.stream.Stream.concat(
                        mapFacts.areas().stream().flatMap(area -> area.cells().stream()),
                        mapFacts.features().stream().flatMap(feature -> feature.cells().stream()))
                .distinct()
                .sorted(Comparator
                        .comparingInt(DungeonCell::level)
                        .thenComparingInt(DungeonCell::r)
                        .thenComparingInt(DungeonCell::q))
                .findFirst()
                .orElse(null);
    }

    private static Set<DungeonCell> sameLevelCells(List<DungeonCell> cells, int level) {
        return (cells == null ? List.<DungeonCell>of() : cells).stream()
                .filter(cell -> cell != null && cell.level() == level)
                .collect(java.util.stream.Collectors.toCollection(LinkedHashSet::new));
    }

    private static String tileLabel(DungeonCell tile) {
        return "x=" + tile.q() + " y=" + tile.r() + " z=" + tile.level();
    }

    private static String headingLabel(DungeonTravelHeading heading) {
        return switch (heading == null ? DungeonTravelHeading.defaultHeading() : heading) {
            case NORTH -> "Norden";
            case EAST -> "Osten";
            case SOUTH -> "Sueden";
            case WEST -> "Westen";
        };
    }

    private static String destinationLabel(DungeonTransitionDestination destination) {
        return DungeonTransitionLabels.destinationLabel(destination);
    }

    private record SurfaceScope(
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
}
