package features.dungeon.application.editor.usecase;

import java.util.List;
import features.dungeon.domain.core.graph.DungeonTopologyElementKind;
import features.dungeon.domain.core.graph.DungeonTopologyRef;
import features.dungeon.domain.core.projection.DungeonAreaFacts;
import features.dungeon.domain.core.projection.DungeonAreaType;
import features.dungeon.domain.core.projection.DungeonBoundaryFacts;
import features.dungeon.domain.core.projection.DungeonFeatureFacts;
import features.dungeon.domain.core.projection.DungeonDerivedState;
import features.dungeon.domain.core.projection.DungeonState;

final class BuildDungeonSelectionFactsUseCase {

    private static final String DUNGEON_TITLE = "Dungeon";
    private static final String NO_SELECTION_DETAILS = "No selection details available.";
    private static final String AUTHORISED_AREA = "Authoriertes Dungeon-Areal.";
    private static final String AUTHORISED_BOUNDARY = "Authorisierte Dungeon-Grenze.";
    private static final String AGGREGATE_OWNER = "Aggregate owner in committed dungeon truth.";

    LoadDungeonSnapshotUseCase.InspectorSnapshotData execute(
            DungeonDerivedState derived,
            DungeonTopologyRef topologyRef
    ) {
        if (!SelectionFacts.present(topologyRef)) {
            return SelectionFacts.fallbackSelection();
        }
        LoadDungeonSnapshotUseCase.InspectorSnapshotData selection = SelectionResolver.resolve(derived, topologyRef);
        return selection == null ? SelectionFacts.fallbackSelection() : selection;
    }

    boolean isFallbackSelection(LoadDungeonSnapshotUseCase.InspectorSnapshotData snapshot) {
        return snapshot != null
                && DUNGEON_TITLE.equals(snapshot.title())
                && NO_SELECTION_DETAILS.equals(snapshot.description());
    }

    private static final class SelectionResolver {

        private static LoadDungeonSnapshotUseCase.InspectorSnapshotData resolve(
                DungeonDerivedState derived,
                DungeonTopologyRef topologyRef
        ) {
            LoadDungeonSnapshotUseCase.InspectorSnapshotData selection =
                    areaSelection(derived.map().areas(), topologyRef);
            if (selection != null) {
                return selection;
            }
            selection = boundarySelection(derived.map().boundaries(), topologyRef);
            if (selection != null) {
                return selection;
            }
            selection = featureSelection(derived.map().features(), topologyRef);
            if (selection != null) {
                return selection;
            }
            selection = aggregateSelection(derived.aggregates(), topologyRef);
            if (selection != null) {
                return selection;
            }
            return null;
        }

        private static LoadDungeonSnapshotUseCase.InspectorSnapshotData areaSelection(
                List<DungeonAreaFacts> areas,
                DungeonTopologyRef topologyRef
        ) {
            for (DungeonAreaFacts area : areas) {
                if (topologyRef.equals(area.topologyRef())) {
                    return new LoadDungeonSnapshotUseCase.InspectorSnapshotData(
                            area.label(),
                            AUTHORISED_AREA);
                }
            }
            return null;
        }

        private static LoadDungeonSnapshotUseCase.InspectorSnapshotData boundarySelection(
                List<DungeonBoundaryFacts> boundaries,
                DungeonTopologyRef topologyRef
        ) {
            for (DungeonBoundaryFacts boundary : boundaries) {
                if (topologyRef.equals(boundary.topologyRef())) {
                    return new LoadDungeonSnapshotUseCase.InspectorSnapshotData(
                            boundary.label(),
                            AUTHORISED_BOUNDARY);
                }
            }
            return null;
        }

        private static LoadDungeonSnapshotUseCase.InspectorSnapshotData featureSelection(
                List<DungeonFeatureFacts> features,
                DungeonTopologyRef topologyRef
        ) {
            for (DungeonFeatureFacts feature : features) {
                if (topologyRef.equals(feature.topologyRef())) {
                    return new LoadDungeonSnapshotUseCase.InspectorSnapshotData(
                            feature.label(),
                            feature.description(),
                            SelectionFacts.statePanelFacts(feature),
                            List.of());
                }
            }
            return null;
        }

        private static LoadDungeonSnapshotUseCase.InspectorSnapshotData aggregateSelection(
                List<DungeonState> aggregates,
                DungeonTopologyRef topologyRef
        ) {
            for (DungeonState aggregate : aggregates) {
                if (matchesAggregate(topologyRef, aggregate)) {
                    return new LoadDungeonSnapshotUseCase.InspectorSnapshotData(
                            aggregate.label(),
                            AGGREGATE_OWNER);
                }
            }
            return null;
        }

        private static boolean matchesAggregate(DungeonTopologyRef topologyRef, DungeonState aggregate) {
            return aggregate.id() == topologyRef.id()
                    && topologyKind(aggregate.kind()) == topologyRef.kind();
        }

        private static DungeonTopologyElementKind topologyKind(DungeonAreaType kind) {
            return kind == DungeonAreaType.CORRIDOR
                    ? DungeonTopologyElementKind.CORRIDOR
                    : DungeonTopologyElementKind.ROOM;
        }
    }

    private static final class SelectionFacts {

        private static boolean present(DungeonTopologyRef topologyRef) {
            return topologyRef != null && topologyRef.present();
        }

        private static LoadDungeonSnapshotUseCase.InspectorSnapshotData fallbackSelection() {
            return new LoadDungeonSnapshotUseCase.InspectorSnapshotData(
                    DUNGEON_TITLE,
                    NO_SELECTION_DETAILS);
        }

        private static LoadDungeonSnapshotUseCase.StatePanelFacts statePanelFacts(DungeonFeatureFacts feature) {
            DungeonFeatureFacts.StatePanelFacts facts = feature == null
                    ? DungeonFeatureFacts.StatePanelFacts.empty()
                    : feature.statePanelFacts();
            return new LoadDungeonSnapshotUseCase.StatePanelFacts(
                    stairGeometryFacts(facts.stairGeometry()),
                    transitionDestinationFacts(facts.transitionDestination()));
        }

        private static LoadDungeonSnapshotUseCase.StairGeometryPanelFacts stairGeometryFacts(
                DungeonFeatureFacts.StairGeometryFacts facts
        ) {
            DungeonFeatureFacts.StairGeometryFacts safeFacts = facts == null
                    ? DungeonFeatureFacts.StairGeometryFacts.empty()
                    : facts;
            return new LoadDungeonSnapshotUseCase.StairGeometryPanelFacts(
                    safeFacts.present(),
                    safeFacts.stairId(),
                    safeFacts.shapeName(),
                    safeFacts.directionName(),
                    safeFacts.dimension1(),
                    safeFacts.dimension2());
        }

        private static LoadDungeonSnapshotUseCase.TransitionDestinationPanelFacts transitionDestinationFacts(
                DungeonFeatureFacts.TransitionDestinationFacts facts
        ) {
            DungeonFeatureFacts.TransitionDestinationFacts safeFacts = facts == null
                    ? DungeonFeatureFacts.TransitionDestinationFacts.empty()
                    : facts;
            return new LoadDungeonSnapshotUseCase.TransitionDestinationPanelFacts(
                    safeFacts.present(),
                    safeFacts.destinationTypeKey(),
                    safeFacts.mapId(),
                    safeFacts.tileId(),
                    safeFacts.transitionId());
        }
    }
}
