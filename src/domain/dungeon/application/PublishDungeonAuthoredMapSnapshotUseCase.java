package src.domain.dungeon.application;

import java.util.List;
import src.domain.dungeon.map.value.DungeonAreaFacts;
import src.domain.dungeon.map.value.DungeonAreaType;
import src.domain.dungeon.map.value.DungeonBoundaryFacts;
import src.domain.dungeon.map.value.DungeonEditorHandleFacts;
import src.domain.dungeon.map.value.DungeonFeatureFacts;
import src.domain.dungeon.map.value.DungeonMapFacts;
import src.domain.dungeon.map.value.DungeonTopology;
import src.domain.dungeon.published.DungeonAreaKind;
import src.domain.dungeon.published.DungeonAreaSnapshot;
import src.domain.dungeon.published.DungeonBoundarySnapshot;
import src.domain.dungeon.published.DungeonEditorHandleSnapshot;
import src.domain.dungeon.published.DungeonFeatureKind;
import src.domain.dungeon.published.DungeonFeatureSnapshot;
import src.domain.dungeon.published.DungeonMapSnapshot;
import src.domain.dungeon.published.DungeonTopologyKind;

final class PublishDungeonAuthoredMapSnapshotUseCase {

    DungeonMapSnapshot mapSnapshot(DungeonMapFacts facts, List<DungeonEditorHandleFacts> handles) {
        DungeonMapFacts safeFacts = facts == null
                ? new DungeonMapFacts(DungeonTopology.SQUARE, 1, 1, List.of(), List.of())
                : facts;
        List<DungeonEditorHandleFacts> safeHandles = handles == null ? List.of() : List.copyOf(handles);
        return new DungeonMapSnapshot(
                safeFacts.topology() == DungeonTopology.HEX ? DungeonTopologyKind.HEX : DungeonTopologyKind.SQUARE,
                safeFacts.width(),
                safeFacts.height(),
                safeFacts.areas().stream().map(this::area).toList(),
                safeFacts.boundaries().stream().map(this::boundary).toList(),
                safeFacts.features().stream().map(this::feature).toList(),
                safeHandles.stream().map(this::handle).toList());
    }

    private DungeonAreaSnapshot area(DungeonAreaFacts area) {
        return new DungeonAreaSnapshot(
                area.kind() == DungeonAreaType.CORRIDOR ? DungeonAreaKind.CORRIDOR : DungeonAreaKind.ROOM,
                area.id(),
                area.clusterId(),
                area.label(),
                area.cells().stream().map(PublishDungeonAuthoredRefUseCase::cell).toList(),
                PublishDungeonAuthoredRefUseCase.topologyRef(area.topologyRef()));
    }

    private DungeonBoundarySnapshot boundary(DungeonBoundaryFacts boundary) {
        return new DungeonBoundarySnapshot(
                boundary.kind(),
                boundary.id(),
                boundary.label(),
                PublishDungeonAuthoredRefUseCase.edge(boundary.edge()),
                PublishDungeonAuthoredRefUseCase.topologyRef(boundary.topologyRef()));
    }

    private DungeonFeatureSnapshot feature(DungeonFeatureFacts feature) {
        return new DungeonFeatureSnapshot(
                DungeonFeatureKind.valueOf(feature.kind().name()),
                feature.id(),
                feature.label(),
                feature.cells().stream().map(PublishDungeonAuthoredRefUseCase::cell).toList(),
                feature.description(),
                feature.destinationLabel(),
                PublishDungeonAuthoredRefUseCase.topologyRef(feature.topologyRef()));
    }

    private DungeonEditorHandleSnapshot handle(DungeonEditorHandleFacts handle) {
        return new DungeonEditorHandleSnapshot(
                PublishDungeonAuthoredRefUseCase.handleRef(handle.handle()),
                handle.label(),
                PublishDungeonAuthoredRefUseCase.cell(handle.handle().cell()));
    }
}
