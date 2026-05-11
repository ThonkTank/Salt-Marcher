package src.domain.dungeon.application;

import java.util.List;
import src.domain.dungeon.model.map.model.DungeonAreaFacts;
import src.domain.dungeon.model.map.model.DungeonAreaType;
import src.domain.dungeon.model.map.model.DungeonBoundaryFacts;
import src.domain.dungeon.model.map.model.DungeonFeatureFacts;
import src.domain.dungeon.model.map.model.DungeonMapFacts;
import src.domain.dungeon.model.map.model.DungeonTopology;
import src.domain.dungeon.published.DungeonAreaKind;
import src.domain.dungeon.published.DungeonAreaSnapshot;
import src.domain.dungeon.published.DungeonBoundarySnapshot;
import src.domain.dungeon.published.DungeonFeatureKind;
import src.domain.dungeon.published.DungeonFeatureSnapshot;
import src.domain.dungeon.published.DungeonMapSnapshot;
import src.domain.dungeon.published.DungeonTopologyKind;

final class PublishDungeonTravelMapSnapshotUseCase {

    DungeonMapSnapshot mapSnapshot(DungeonMapFacts facts) {
        DungeonMapFacts safeFacts = facts == null
                ? new DungeonMapFacts(DungeonTopology.SQUARE, 1, 1, List.of(), List.of())
                : facts;
        return new DungeonMapSnapshot(
                safeFacts.topology() == DungeonTopology.HEX ? DungeonTopologyKind.HEX : DungeonTopologyKind.SQUARE,
                safeFacts.width(),
                safeFacts.height(),
                safeFacts.areas().stream().map(this::area).toList(),
                safeFacts.boundaries().stream().map(this::boundary).toList(),
                safeFacts.features().stream().map(this::feature).toList(),
                List.of());
    }

    private DungeonAreaSnapshot area(DungeonAreaFacts area) {
        return new DungeonAreaSnapshot(
                area.kind() == DungeonAreaType.CORRIDOR ? DungeonAreaKind.CORRIDOR : DungeonAreaKind.ROOM,
                area.id(),
                area.clusterId(),
                area.label(),
                area.cells().stream().map(PublishDungeonTravelRefUseCase::cell).toList(),
                PublishDungeonTravelRefUseCase.topologyRef(area.topologyRef()));
    }

    private DungeonBoundarySnapshot boundary(DungeonBoundaryFacts boundary) {
        return new DungeonBoundarySnapshot(
                boundary.kind(),
                boundary.id(),
                boundary.label(),
                PublishDungeonTravelRefUseCase.edge(boundary.edge()),
                PublishDungeonTravelRefUseCase.topologyRef(boundary.topologyRef()));
    }

    private DungeonFeatureSnapshot feature(DungeonFeatureFacts feature) {
        return new DungeonFeatureSnapshot(
                DungeonFeatureKind.valueOf(feature.kind().name()),
                feature.id(),
                feature.label(),
                feature.cells().stream().map(PublishDungeonTravelRefUseCase::cell).toList(),
                feature.description(),
                feature.destinationLabel(),
                PublishDungeonTravelRefUseCase.topologyRef(feature.topologyRef()));
    }
}
