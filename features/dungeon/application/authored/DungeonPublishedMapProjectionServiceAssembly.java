package features.dungeon.application.authored;

import java.util.List;
import features.dungeon.domain.core.geometry.DungeonTopology;
import features.dungeon.domain.core.graph.DungeonTopologyRef;
import features.dungeon.domain.core.projection.DungeonAreaType;
import features.dungeon.application.editor.interaction.DungeonEditorHandleProjection;
import features.dungeon.api.DungeonTopologyKind;

final class DungeonPublishedMapProjectionServiceAssembly {

    private DungeonPublishedMapProjectionServiceAssembly() {
    }

    static features.dungeon.api.DungeonSnapshot defaultSnapshot() {
        return new features.dungeon.api.DungeonSnapshot(
                "Dungeon",
                features.dungeon.api.DungeonMapMode.EDITOR,
                features.dungeon.api.DungeonMapSnapshot.empty(),
                List.of(),
                List.of(),
                0);
    }

    static features.dungeon.api.DungeonMapSnapshot mapSnapshot(
            features.dungeon.domain.core.projection.DungeonMapFacts facts,
            List<DungeonEditorHandleProjection> handles
    ) {
        features.dungeon.domain.core.projection.DungeonMapFacts safeFacts = facts == null
                ? new features.dungeon.domain.core.projection.DungeonMapFacts(DungeonTopology.SQUARE, 1, 1, List.of(), List.of())
                : facts;
        List<DungeonEditorHandleProjection> safeHandles = handles == null ? List.of() : List.copyOf(handles);
        return new features.dungeon.api.DungeonMapSnapshot(
                topology(safeFacts),
                safeFacts.width(),
                safeFacts.height(),
                safeFacts.areas().stream().map(DungeonPublishedMapProjectionServiceAssembly::area).toList(),
                safeFacts.boundaries().stream().map(boundary -> new features.dungeon.api.DungeonBoundarySnapshot(
                        boundary.kind(),
                        boundary.id(),
                        boundary.label(),
                        PublishedProjectionSupport.edge(boundary.edge()),
                        PublishedProjectionSupport.topologyRef(boundary.topologyRef()))).toList(),
                safeFacts.features().stream().map(feature -> new features.dungeon.api.DungeonFeatureSnapshot(
                        features.dungeon.api.DungeonFeatureKind.valueOf(feature.kind().name()),
                        feature.id(),
                        feature.label(),
                        feature.cells().stream().map(PublishedProjectionSupport::cell).toList(),
                        feature.description(),
                        feature.destinationLabel(),
                        PublishedProjectionSupport.topologyRef(feature.topologyRef()),
                        feature.anchorEdge() == null
                                ? null
                                : PublishedProjectionSupport.edge(feature.anchorEdge()))).toList(),
                safeHandles.stream().map(PublishedProjectionSupport::handle).toList());
    }

    static features.dungeon.api.DungeonCellRef cell(features.dungeon.domain.core.geometry.Cell cell) {
        return PublishedProjectionSupport.cell(cell);
    }

    static int revision(long revision) {
        if (revision > Integer.MAX_VALUE) {
            return Integer.MAX_VALUE;
        }
        return Math.max(0, (int) revision);
    }

    private static DungeonTopologyKind topology(features.dungeon.domain.core.projection.DungeonMapFacts facts) {
        return facts.topology() == DungeonTopology.HEX ? DungeonTopologyKind.HEX : DungeonTopologyKind.SQUARE;
    }

    private static features.dungeon.api.DungeonAreaSnapshot area(features.dungeon.domain.core.projection.DungeonAreaFacts area) {
        return new features.dungeon.api.DungeonAreaSnapshot(
                area.kind() == DungeonAreaType.CORRIDOR ? features.dungeon.api.DungeonAreaKind.CORRIDOR : features.dungeon.api.DungeonAreaKind.ROOM,
                area.id(),
                area.clusterId(),
                area.label(),
                area.cells().stream().map(PublishedProjectionSupport::cell).toList(),
                PublishedProjectionSupport.topologyRef(area.topologyRef()));
    }

    private static final class PublishedProjectionSupport {

        private static features.dungeon.api.DungeonEditorHandleSnapshot handle(
                DungeonEditorHandleProjection handle
        ) {
            return new features.dungeon.api.DungeonEditorHandleSnapshot(
                    handleRef(handle),
                    handle.label(),
                    cell(handle.cell()),
                    handle.markerQ(),
                    handle.markerR());
        }

        private static features.dungeon.api.DungeonCellRef cell(
                features.dungeon.domain.core.geometry.Cell cell
        ) {
            features.dungeon.domain.core.geometry.Cell safeCell =
                    cell == null ? new features.dungeon.domain.core.geometry.Cell(0, 0, 0) : cell;
            return new features.dungeon.api.DungeonCellRef(safeCell.q(), safeCell.r(), safeCell.level());
        }

        private static features.dungeon.api.DungeonTopologyElementRef topologyRef(DungeonTopologyRef ref) {
            if (ref == null) {
                return features.dungeon.api.DungeonTopologyElementRef.empty();
            }
            return new features.dungeon.api.DungeonTopologyElementRef(
                    publishedTopologyKind(ref),
                    ref.id());
        }

        private static features.dungeon.api.DungeonEdgeRef edge(
                features.dungeon.domain.core.geometry.Edge edge
        ) {
            if (edge == null) {
                return new features.dungeon.api.DungeonEdgeRef(cell(null), cell(null));
            }
            return new features.dungeon.api.DungeonEdgeRef(cell(edge.from()), cell(edge.to()));
        }

        private static features.dungeon.api.DungeonEditorHandleRef handleRef(
                DungeonEditorHandleProjection handle
        ) {
            return new features.dungeon.api.DungeonEditorHandleRef(
                    features.dungeon.api.DungeonEditorHandleKind.valueOf(handle.kind().name()),
                    topologyRef(handle.topologyRef()),
                    handle.ownerId(),
                    handle.clusterId(),
                    handle.corridorId(),
                    handle.roomId(),
                    handle.index(),
                    cell(handle.cell()),
                    handle.direction().name(),
                    handle.sourceEdge() == null ? null : edge(handle.sourceEdge()),
                    handle.sourceEdges().stream().map(PublishedProjectionSupport::edge).toList());
        }

        private static features.dungeon.api.DungeonTopologyElementKind publishedTopologyKind(
                DungeonTopologyRef ref
        ) {
            try {
                return features.dungeon.api.DungeonTopologyElementKind.valueOf(ref.kind().name());
            } catch (IllegalArgumentException exception) {
                return features.dungeon.api.DungeonTopologyElementKind.EMPTY;
            }
        }
    }
}
