package src.domain.dungeon.model.map.model;


import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

public final class DungeonFeatureReadProjection {

    private static final String FEATURE_KIND_TRANSITION = "transition";

    public Result project(List<DungeonStair> stairs, List<DungeonTransition> transitions) {
        List<DungeonFeatureFacts> features = new ArrayList<>();
        List<DungeonRelationGraph.FeatureRelation> relations = new ArrayList<>();
        appendStairFeatures(features, relations, stairs);
        appendTransitionFeatures(features, relations, transitions);
        return new Result(features, relations);
    }

    private static void appendStairFeatures(
            List<DungeonFeatureFacts> features,
            List<DungeonRelationGraph.FeatureRelation> relations,
            List<DungeonStair> stairs
    ) {
        for (DungeonStair stair : stairs == null ? List.<DungeonStair>of() : stairs) {
            if (stair == null || !DungeonStairOps.isReadable(stair)) {
                continue;
            }
            features.add(new DungeonFeatureFacts(
                    DungeonFeatureType.STAIR,
                    stair.stairId(),
                    stair.name(),
                    sortedCells(new ArrayList<>(DungeonStairOps.occupiedCells(stair))),
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
                        FEATURE_KIND_TRANSITION,
                        transition.linkedTransitionId(),
                        FEATURE_KIND_TRANSITION,
                        "linked"));
            }
        }
    }

    private static List<DungeonCell> sortedCells(List<DungeonCell> cells) {
        List<DungeonCell> result = new ArrayList<>();
        for (DungeonCell cell : cells == null ? List.<DungeonCell>of() : cells) {
            if (cell != null && !result.contains(cell)) {
                result.add(cell);
            }
        }
        result.sort(new CellComparator());
        return List.copyOf(result);
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
        List<String> labels = new ArrayList<>();
        for (DungeonStairExit exit : stair.exits()) {
            String label = exit == null ? "" : exit.label();
            if (!label.isBlank() && !labels.contains(label)) {
                labels.add(label);
            }
        }
        labels.sort(String.CASE_INSENSITIVE_ORDER);
        return String.join(", ", labels);
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
        return DungeonTransitionLabels.destinationLabel(destination);
    }

    private static DungeonRelationGraph.FeatureRelation transitionRelation(
            DungeonTransition transition,
            DungeonTransitionDestination destination
    ) {
        if (destination != null && destination.isOverworldTileDestination()) {
            return new DungeonRelationGraph.FeatureRelation(
                    transition.transitionId(),
                    FEATURE_KIND_TRANSITION,
                    destination.tileId(),
                    "overworld-tile",
                    "targets");
        }
        if (destination != null && destination.isDungeonMapDestination()) {
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

    private static final class CellComparator implements Comparator<DungeonCell> {
        @Override
        public int compare(DungeonCell left, DungeonCell right) {
            int levelComparison = Integer.compare(left.level(), right.level());
            if (levelComparison != 0) {
                return levelComparison;
            }
            int rowComparison = Integer.compare(left.r(), right.r());
            if (rowComparison != 0) {
                return rowComparison;
            }
            return Integer.compare(left.q(), right.q());
        }
    }
}
