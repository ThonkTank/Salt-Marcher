package src.domain.dungeon.model.core.projection;

import java.util.ArrayList;
import java.util.List;
import src.domain.dungeon.model.core.graph.DungeonRelationGraph;
import src.domain.dungeon.model.core.structure.transition.Transition;
import src.domain.dungeon.model.core.structure.transition.TransitionDestination;

final class DungeonTransitionFeatureProjection {
    private static final String FEATURE_KIND_TRANSITION = "transition";

    private DungeonTransitionFeatureProjection() {
    }

    static void append(
            List<DungeonFeatureFacts> features,
            List<DungeonRelationGraph.FeatureRelation> relations,
            List<Transition> transitions
    ) {
        for (Transition transition : transitions == null ? List.<Transition>of() : transitions) {
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
                    destinationLabel(destination),
                    transitionFacts(destination)));
            relations.add(transitionRelation(transition, destination));
            appendReverseLinkRelation(relations, transition);
        }
    }

    private static String transitionDescription(Transition transition) {
        return transition == null ? "" : transition.description();
    }

    private static String destinationLabel(TransitionDestination destination) {
        return destination == null ? "" : destination.label();
    }

    private static List<String> transitionFacts(TransitionDestination destination) {
        if (destination == null) {
            return List.of();
        }
        List<String> facts = new ArrayList<>();
        facts.add("destinationType: " + destination.type().name());
        facts.add("destinationMapId: " + destination.mapId());
        appendDestinationDetailFacts(facts, destination);
        return List.copyOf(facts);
    }

    private static void appendDestinationDetailFacts(List<String> facts, TransitionDestination destination) {
        if (destination.isOverworldTile()) {
            facts.add("destinationTileId: " + destination.tileId());
        }
        if (destination.transitionId() != null) {
            facts.add("destinationTransitionId: " + destination.transitionId());
        }
    }

    private static void appendReverseLinkRelation(
            List<DungeonRelationGraph.FeatureRelation> relations,
            Transition transition
    ) {
        if (transition.linkedTransitionId() == null) {
            return;
        }
        relations.add(new DungeonRelationGraph.FeatureRelation(
                transition.transitionId(),
                FEATURE_KIND_TRANSITION,
                transition.linkedTransitionId(),
                FEATURE_KIND_TRANSITION,
                "linked"));
    }

    private static DungeonRelationGraph.FeatureRelation transitionRelation(
            Transition transition,
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
}
