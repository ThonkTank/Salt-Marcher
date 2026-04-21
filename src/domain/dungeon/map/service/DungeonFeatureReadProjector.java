package src.domain.dungeon.map.service;

import src.domain.dungeon.map.entity.DungeonStair;
import src.domain.dungeon.map.entity.DungeonTransition;
import src.domain.dungeon.map.value.DungeonCell;
import src.domain.dungeon.map.value.DungeonFeatureFacts;
import src.domain.dungeon.map.value.DungeonFeatureType;
import src.domain.dungeon.map.value.DungeonRelationGraph;
import src.domain.dungeon.map.value.DungeonStairExit;
import src.domain.dungeon.map.value.DungeonTransitionDestination;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

public final class DungeonFeatureReadProjector {

    public Result project(List<DungeonStair> stairs, List<DungeonTransition> transitions) {
        List<DungeonFeatureFacts> features = new ArrayList<>();
        List<DungeonRelationGraph.FeatureRelation> relations = new ArrayList<>();
        for (DungeonStair stair : stairs == null ? List.<DungeonStair>of() : stairs) {
            if (stair == null || !stair.isReadable()) {
                continue;
            }
            features.add(new DungeonFeatureFacts(
                    DungeonFeatureType.STAIR,
                    stair.stairId(),
                    stair.name(),
                    sortedCells(stair.occupiedCells().stream().toList()),
                    stairDescription(stair),
                    stairDestinationLabel(stair)));
            if (stair.corridorId() != null) {
                relations.add(new DungeonRelationGraph.FeatureRelation(
                        stair.stairId(),
                        "stair",
                        stair.corridorId(),
                        "corridor",
                        "attached"));
            }
        }
        for (DungeonTransition transition : transitions == null ? List.<DungeonTransition>of() : transitions) {
            if (transition == null || !transition.isPlaced()) {
                continue;
            }
            DungeonTransitionDestination destination = transition.destination();
            features.add(new DungeonFeatureFacts(
                    DungeonFeatureType.TRANSITION,
                    transition.transitionId(),
                    transition.label(),
                    List.of(transition.anchor()),
                    transitionDescription(transition),
                    destinationLabel(destination)));
            relations.add(transitionRelation(transition, destination));
            if (transition.linkedTransitionId() != null) {
                relations.add(new DungeonRelationGraph.FeatureRelation(
                        transition.transitionId(),
                        "transition",
                        transition.linkedTransitionId(),
                        "transition",
                        "linked"));
            }
        }
        return new Result(features, relations);
    }

    private static List<DungeonCell> sortedCells(List<DungeonCell> cells) {
        return (cells == null ? List.<DungeonCell>of() : cells).stream()
                .filter(cell -> cell != null)
                .distinct()
                .sorted(Comparator
                        .comparingInt(DungeonCell::level)
                        .thenComparingInt(DungeonCell::r)
                        .thenComparingInt(DungeonCell::q))
                .toList();
    }

    private static String stairDescription(DungeonStair stair) {
        if (stair == null) {
            return "";
        }
        if (stair.exits().isEmpty()) {
            return stair.name();
        }
        return stair.name() + " verbindet " + stair.exits().size() + " Ausgaenge.";
    }

    private static String stairDestinationLabel(DungeonStair stair) {
        if (stair == null || stair.exits().isEmpty()) {
            return "";
        }
        return stair.exits().stream()
                .map(DungeonStairExit::label)
                .filter(label -> label != null && !label.isBlank())
                .distinct()
                .sorted(String.CASE_INSENSITIVE_ORDER)
                .reduce((left, right) -> left + ", " + right)
                .orElse("");
    }

    private static String transitionDescription(DungeonTransition transition) {
        if (transition == null) {
            return "";
        }
        if (!transition.description().isBlank()) {
            return transition.description();
        }
        return transition.label() + " fuehrt zu " + destinationLabel(transition.destination()) + ".";
    }

    private static String destinationLabel(DungeonTransitionDestination destination) {
        if (destination instanceof DungeonTransitionDestination.OverworldTileDestination overworld) {
            return "Overworld-Feld " + overworld.tileId();
        }
        if (destination instanceof DungeonTransitionDestination.DungeonMapDestination dungeon) {
            if (dungeon.transitionId() == null) {
                return "Dungeon " + dungeon.mapId();
            }
            return "Dungeon " + dungeon.mapId() + " / Uebergang " + dungeon.transitionId();
        }
        return "";
    }

    private static DungeonRelationGraph.FeatureRelation transitionRelation(
            DungeonTransition transition,
            DungeonTransitionDestination destination
    ) {
        if (destination instanceof DungeonTransitionDestination.OverworldTileDestination overworld) {
            return new DungeonRelationGraph.FeatureRelation(
                    transition.transitionId(),
                    "transition",
                    overworld.tileId(),
                    "overworld-tile",
                    "targets");
        }
        if (destination instanceof DungeonTransitionDestination.DungeonMapDestination dungeon) {
            long targetId = dungeon.transitionId() == null ? dungeon.mapId() : dungeon.transitionId();
            String targetKind = dungeon.transitionId() == null ? "dungeon-map" : "transition";
            return new DungeonRelationGraph.FeatureRelation(
                    transition.transitionId(),
                    "transition",
                    targetId,
                    targetKind,
                    "targets");
        }
        return new DungeonRelationGraph.FeatureRelation(
                transition.transitionId(),
                "transition",
                0L,
                "unknown",
                "targets");
    }

    public record Result(
            List<DungeonFeatureFacts> features,
            List<DungeonRelationGraph.FeatureRelation> relations
    ) {
        public Result {
            features = features == null ? List.of() : List.copyOf(features);
            relations = relations == null ? List.of() : List.copyOf(relations);
        }
    }
}
