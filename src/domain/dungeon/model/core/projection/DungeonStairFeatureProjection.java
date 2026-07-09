package src.domain.dungeon.model.core.projection;

import java.util.ArrayList;
import java.util.List;
import src.domain.dungeon.model.core.component.StairExit;
import src.domain.dungeon.model.core.geometry.CellOrdering;
import src.domain.dungeon.model.core.graph.DungeonRelationGraph;
import src.domain.dungeon.model.core.graph.DungeonTopologyElementKind;
import src.domain.dungeon.model.core.graph.DungeonTopologyRef;
import src.domain.dungeon.model.core.structure.stair.Stair;
import src.domain.dungeon.model.core.structure.stair.StairCollection;

final class DungeonStairFeatureProjection {

    private DungeonStairFeatureProjection() {
    }

    static void append(
            List<DungeonFeatureFacts> features,
            List<DungeonRelationGraph.FeatureRelation> relations,
            StairCollection stairs
    ) {
        for (Stair stair : stairs == null ? List.<Stair>of() : stairs.stairs()) {
            if (stair == null || !stair.isReadable()) {
                continue;
            }
            appendFeature(features, relations, stair);
        }
    }

    private static void appendFeature(
            List<DungeonFeatureFacts> features,
            List<DungeonRelationGraph.FeatureRelation> relations,
            Stair stair
    ) {
        List<StairExit> exits = stair.exits();
        features.add(new DungeonFeatureFacts(
                DungeonFeatureType.STAIR,
                stair.stairId(),
                stair.name(),
                CellOrdering.sortedCells(stair.occupiedCells()),
                stairDescription(stair, exits),
                stairDestinationLabel(exits),
                stairFacts(stair),
                DungeonFeatureFacts.StatePanelFacts.stair(
                        stair.stairId(),
                        stair.shape(),
                        stair.direction(),
                        stair.dimension1(),
                        stair.dimension2()),
                new DungeonTopologyRef(DungeonTopologyElementKind.STAIR, stair.stairId())));
        if (stair.corridorId() != null) {
            relations.add(new DungeonRelationGraph.FeatureRelation(
                    stair.stairId(),
                    "stair",
                    stair.corridorId(),
                    "corridor",
                    "attached"));
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
}
