package src.domain.dungeon.application;

import java.util.List;
import src.domain.dungeon.map.value.DungeonAreaFacts;
import src.domain.dungeon.map.value.DungeonBoundaryFacts;
import src.domain.dungeon.map.value.DungeonEditorHandleFacts;
import src.domain.dungeon.map.value.DungeonFeatureFacts;
import src.domain.dungeon.map.value.DungeonMapFacts;
import src.domain.dungeon.map.value.DungeonTopology;
import src.domain.dungeon.published.DungeonAreaSnapshot;
import src.domain.dungeon.published.DungeonBoundarySnapshot;
import src.domain.dungeon.published.DungeonFeatureKind;
import src.domain.dungeon.published.DungeonFeatureSnapshot;
import src.domain.dungeon.published.DungeonMapSnapshot;

public final class DungeonMapProjector {

    private DungeonMapProjector() {
    }

    public static DungeonMapSnapshot snapshot(DungeonMapFacts facts, List<DungeonEditorHandleFacts> handles) {
        DungeonMapFacts safeFacts = facts == null
                ? new DungeonMapFacts(DungeonTopology.SQUARE, 1, 1, List.of(), List.of())
                : facts;
        List<DungeonEditorHandleFacts> safeHandles = handles == null ? List.of() : handles;
        return new DungeonMapSnapshot(
                DungeonTopologyBoundaryTranslator.topology(safeFacts.topology()),
                safeFacts.width(),
                safeFacts.height(),
                safeFacts.areas().stream().map(DungeonMapProjector::area).toList(),
                safeFacts.boundaries().stream().map(DungeonMapProjector::boundary).toList(),
                safeFacts.features().stream().map(DungeonMapProjector::feature).toList(),
                safeHandles.stream().map(DungeonEditorHandleBoundaryTranslator::snapshot).toList());
    }

    public static DungeonMapSnapshot snapshot(DungeonMapFacts facts) {
        return snapshot(facts, List.of());
    }

    private static DungeonAreaSnapshot area(DungeonAreaFacts area) {
        return new DungeonAreaSnapshot(
                DungeonTopologyBoundaryTranslator.areaKind(area.kind()),
                area.id(),
                area.clusterId(),
                area.label(),
                area.cells().stream().map(DungeonCellEdgeBoundaryTranslator::cell).toList(),
                DungeonTopologyBoundaryTranslator.topologyRef(area.topologyRef()));
    }

    private static DungeonBoundarySnapshot boundary(DungeonBoundaryFacts boundary) {
        return new DungeonBoundarySnapshot(
                boundary.kind(),
                boundary.id(),
                boundary.label(),
                DungeonCellEdgeBoundaryTranslator.edge(boundary.edge()),
                DungeonTopologyBoundaryTranslator.topologyRef(boundary.topologyRef()));
    }

    private static DungeonFeatureSnapshot feature(DungeonFeatureFacts feature) {
        return new DungeonFeatureSnapshot(
                DungeonFeatureKind.valueOf(feature.kind().name()),
                feature.id(),
                feature.label(),
                feature.cells().stream().map(DungeonCellEdgeBoundaryTranslator::cell).toList(),
                feature.description(),
                feature.destinationLabel(),
                DungeonTopologyBoundaryTranslator.topologyRef(feature.topologyRef()));
    }
}
