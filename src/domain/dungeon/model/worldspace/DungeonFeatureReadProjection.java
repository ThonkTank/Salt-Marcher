package src.domain.dungeon.model.worldspace;

import java.util.ArrayList;
import java.util.List;
import src.domain.dungeon.model.core.component.StairExit;
import src.domain.dungeon.model.core.geometry.CellOrdering;
import src.domain.dungeon.model.core.graph.DungeonRelationGraph;
import src.domain.dungeon.model.core.projection.DungeonFeatureFacts;
import src.domain.dungeon.model.core.projection.DungeonFeatureType;
import src.domain.dungeon.model.core.structure.stair.Stair;
import src.domain.dungeon.model.core.structure.stair.StairCollection;
import src.domain.dungeon.model.core.structure.transition.TransitionDestination;

public final class DungeonFeatureReadProjection {

    private static final String FEATURE_KIND_TRANSITION = "transition";

    public Result project(StairCollection stairs, List<DungeonTransition> transitions) {
        List<DungeonFeatureFacts> features = new ArrayList<>();
        List<DungeonRelationGraph.FeatureRelation> relations = new ArrayList<>();
        appendStairFeatures(features, relations, stairs);
        appendTransitionFeatures(features, relations, transitions);
        return new Result(features, relations);
    }

    private static void appendStairFeatures(
            List<DungeonFeatureFacts> features,
            List<DungeonRelationGraph.FeatureRelation> relations,
            StairCollection stairs
    ) {
        for (Stair stair : stairs == null ? List.<Stair>of() : stairs.stairs()) {
            if (stair == null || !stair.isReadable()) {
                continue;
            }
            List<StairExit> exits = stair.exits();
            features.add(new DungeonFeatureFacts(
                    DungeonFeatureType.STAIR,
                    stair.stairId(),
                    stair.name(),
                    CellOrdering.sortedCells(stair.occupiedCells()),
                    stairDescription(stair, exits),
                    stairDestinationLabel(exits),
                    stairFacts(stair)));
            if (stair.corridorId() != null) {
                relations.add(new DungeonRelationGraph.FeatureRelation(
                        stair.stairId(),
                        "stair",
                        stair.corridorId(),
                        "corridor",
                        "attached"));
            }
        }
    }

    private static void appendTransitionFeatures(
            List<DungeonFeatureFacts> features,
            List<DungeonRelationGraph.FeatureRelation> relations,
            List<DungeonTransition> transitions
    ) {
        for (DungeonTransition transition : transitions == null ? List.<DungeonTransition>of() : transitions) {
            if (transition == null || !transition.isPlaced()) {
                continue;
            }
            TransitionDestination destination = transition.destination();
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
                        FEATURE_KIND_TRANSITION,
                        transition.linkedTransitionId(),
                        FEATURE_KIND_TRANSITION,
                        "linked"));
            }
        }
    }

    private static String stairDescription(Stair stair, List<StairExit> exits) {
        if (stair == null) {
            return "";
        }
        if (exits.isEmpty()) {
            return stair.name();
        }
        return stair.name() + " verbindet " + exits.size() + " Ausgaenge.";
    }

    private static String stairDestinationLabel(List<StairExit> exits) {
        if (exits.isEmpty()) {
            return "";
        }
        List<String> labels = new ArrayList<>();
        for (StairExit exit : exits) {
            String label = exit == null ? "" : exit.label();
            if (!label.isBlank() && !labels.contains(label)) {
                labels.add(label);
            }
        }
        labels.sort(String.CASE_INSENSITIVE_ORDER);
        return String.join(", ", labels);
    }

    private static List<String> stairFacts(Stair stair) {
        if (stair == null) {
            return List.of();
        }
        return List.of(
                "shape: " + stair.shape().name(),
                "direction: " + stair.direction().name(),
                "dimension1: " + stair.dimension1(),
                "dimension2: " + stair.dimension2());
    }

    private static String transitionDescription(DungeonTransition transition) {
        return transition == null ? "" : transition.description();
    }

    private static String destinationLabel(TransitionDestination destination) {
        return destination == null ? "" : destination.label();
    }

    private static DungeonRelationGraph.FeatureRelation transitionRelation(
            DungeonTransition transition,
            TransitionDestination destination
    ) {
        if (destination != null && destination.isOverworldTile()) {
            return new DungeonRelationGraph.FeatureRelation(
                    transition.transitionId(),
                    FEATURE_KIND_TRANSITION,
                    destination.tileId(),
                    "overworld-tile",
                    "targets");
        }
        if (destination != null && destination.isDungeonMap()) {
            long targetId = destination.transitionId() == null ? destination.mapId() : destination.transitionId();
            String targetKind = destination.transitionId() == null ? "dungeon-map" : FEATURE_KIND_TRANSITION;
            return new DungeonRelationGraph.FeatureRelation(
                    transition.transitionId(),
                    FEATURE_KIND_TRANSITION,
                    targetId,
                    targetKind,
                    "targets");
        }
        return new DungeonRelationGraph.FeatureRelation(
                transition.transitionId(),
                FEATURE_KIND_TRANSITION,
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
