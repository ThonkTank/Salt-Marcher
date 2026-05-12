package src.data.dungeon.repository;

import java.util.List;
import src.domain.dungeon.model.map.model.DungeonAreaFacts;
import src.domain.dungeon.model.map.model.DungeonAreaType;
import src.domain.dungeon.model.map.model.DungeonEditorHandle;
import src.domain.dungeon.model.map.model.DungeonEditorHandleFacts;
import src.domain.dungeon.model.map.model.DungeonMapFacts;
import src.domain.dungeon.model.map.model.DungeonTopology;
import src.domain.dungeon.published.DungeonAreaKind;
import src.domain.dungeon.published.DungeonAreaSnapshot;
import src.domain.dungeon.published.DungeonBoundarySnapshot;
import src.domain.dungeon.published.DungeonEditorHandleKind;
import src.domain.dungeon.published.DungeonEditorHandleRef;
import src.domain.dungeon.published.DungeonEditorHandleSnapshot;
import src.domain.dungeon.published.DungeonFeatureKind;
import src.domain.dungeon.published.DungeonFeatureSnapshot;
import src.domain.dungeon.published.DungeonMapSnapshot;
import src.domain.dungeon.published.DungeonTopologyKind;

final class DungeonPublishedMapSnapshotProjector {

    DungeonMapSnapshot snapshot(DungeonMapFacts facts, List<DungeonEditorHandleFacts> handles) {
        DungeonMapFacts safeFacts = facts == null
                ? new DungeonMapFacts(DungeonTopology.SQUARE, 1, 1, List.of(), List.of())
                : facts;
        List<DungeonEditorHandleFacts> safeHandles = handles == null ? List.of() : List.copyOf(handles);
        return new DungeonMapSnapshot(
                topology(safeFacts),
                safeFacts.width(),
                safeFacts.height(),
                safeFacts.areas().stream().map(DungeonPublishedMapSnapshotProjector::area).toList(),
                safeFacts.boundaries().stream().map(boundary -> new DungeonBoundarySnapshot(
                        boundary.kind(),
                        boundary.id(),
                        boundary.label(),
                        DungeonPublishedStateValues.edge(boundary.edge()),
                        DungeonPublishedStateValues.topologyRef(boundary.topologyRef()))).toList(),
                safeFacts.features().stream().map(feature -> new DungeonFeatureSnapshot(
                        DungeonFeatureKind.valueOf(feature.kind().name()),
                        feature.id(),
                        feature.label(),
                        feature.cells().stream().map(DungeonPublishedStateValues::cell).toList(),
                        feature.description(),
                        feature.destinationLabel(),
                        DungeonPublishedStateValues.topologyRef(feature.topologyRef()))).toList(),
                safeHandles.stream().map(DungeonPublishedMapSnapshotProjector::handle).toList());
    }

    private static DungeonTopologyKind topology(DungeonMapFacts facts) {
        return facts.topology() == DungeonTopology.HEX ? DungeonTopologyKind.HEX : DungeonTopologyKind.SQUARE;
    }

    private static DungeonAreaSnapshot area(DungeonAreaFacts area) {
        return new DungeonAreaSnapshot(
                area.kind() == DungeonAreaType.CORRIDOR ? DungeonAreaKind.CORRIDOR : DungeonAreaKind.ROOM,
                area.id(),
                area.clusterId(),
                area.label(),
                area.cells().stream().map(DungeonPublishedStateValues::cell).toList(),
                DungeonPublishedStateValues.topologyRef(area.topologyRef()));
    }

    private static DungeonEditorHandleSnapshot handle(DungeonEditorHandleFacts handle) {
        return new DungeonEditorHandleSnapshot(
                handleRef(handle.handle()),
                handle.label(),
                DungeonPublishedStateValues.cell(handle.handle().cell()));
    }

    private static DungeonEditorHandleRef handleRef(DungeonEditorHandle handle) {
        return new DungeonEditorHandleRef(
                DungeonEditorHandleKind.valueOf(handle.type().name()),
                DungeonPublishedStateValues.topologyRef(handle.topologyRef()),
                handle.ownerId(),
                handle.clusterId(),
                handle.corridorId(),
                handle.roomId(),
                handle.index(),
                DungeonPublishedStateValues.cell(handle.cell()),
                handle.direction().name());
    }
}
