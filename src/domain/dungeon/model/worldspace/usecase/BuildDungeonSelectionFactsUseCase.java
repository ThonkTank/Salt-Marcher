package src.domain.dungeon.model.worldspace.usecase;

import java.util.ArrayList;
import java.util.List;
import src.domain.dungeon.model.worldspace.DungeonState;
import src.domain.dungeon.model.worldspace.DungeonPrimitive;
import src.domain.dungeon.model.worldspace.DungeonAreaFacts;
import src.domain.dungeon.model.worldspace.DungeonBoundaryFacts;
import src.domain.dungeon.model.worldspace.DungeonDerivedState;
import src.domain.dungeon.model.worldspace.DungeonFeatureFacts;
import src.domain.dungeon.model.worldspace.DungeonTopologyElementKind;
import src.domain.dungeon.model.worldspace.DungeonTopologyRef;

final class BuildDungeonSelectionFactsUseCase {

    private static final String DUNGEON_TITLE = "Dungeon";
    private static final String NO_SELECTION_DETAILS = "No selection details available.";
    private static final String SELECTION_NONE = "selection: none";
    private static final String FACT_KIND = "kind";
    private static final String AUTHORISED_AREA = "Authoriertes Dungeon-Areal.";
    private static final String AUTHORISED_BOUNDARY = "Authorisierte Dungeon-Grenze.";
    private static final String AGGREGATE_OWNER = "Aggregate owner in committed dungeon truth.";
    private static final String PRIMITIVE_BOUNDARY = "Primitive boundary object.";

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
                && NO_SELECTION_DETAILS.equals(snapshot.description())
                && snapshot.facts().equals(List.of(SELECTION_NONE));
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
            return primitiveSelection(derived.primitives(), topologyRef);
        }

        private static LoadDungeonSnapshotUseCase.InspectorSnapshotData areaSelection(
                List<DungeonAreaFacts> areas,
                DungeonTopologyRef topologyRef
        ) {
            for (DungeonAreaFacts area : areas) {
                if (topologyRef.equals(area.topologyRef())) {
                    return new LoadDungeonSnapshotUseCase.InspectorSnapshotData(
                            area.label(),
                            AUTHORISED_AREA,
                            List.of(
                                    SelectionFacts.refFact(topologyRef),
                                    SelectionFacts.factLine(FACT_KIND, area.kind()),
                                    SelectionFacts.factLine("cells", area.cells().size())));
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
                            AUTHORISED_BOUNDARY,
                            List.of(
                                    SelectionFacts.refFact(topologyRef),
                                    SelectionFacts.factLine(FACT_KIND, boundary.kind())));
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
                    List<String> facts = new ArrayList<>();
                    facts.add(SelectionFacts.refFact(topologyRef));
                    facts.add(SelectionFacts.factLine(FACT_KIND, feature.kind()));
                    SelectionFacts.appendFactIfPresent(facts, "target", feature.destinationLabel());
                    facts.addAll(feature.facts());
                    return new LoadDungeonSnapshotUseCase.InspectorSnapshotData(
                            feature.label(),
                            feature.description(),
                            facts);
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
                            AGGREGATE_OWNER,
                            List.of(
                                    SelectionFacts.factLine("id", aggregate.id()),
                                    SelectionFacts.factLine(FACT_KIND, topologyRef.kind()),
                                    SelectionFacts.factLine("label", aggregate.label())));
                }
            }
            return null;
        }

        private static LoadDungeonSnapshotUseCase.InspectorSnapshotData primitiveSelection(
                List<DungeonPrimitive> primitives,
                DungeonTopologyRef topologyRef
        ) {
            for (DungeonPrimitive primitive : primitives) {
                if (primitive.id() == topologyRef.id()) {
                    return new LoadDungeonSnapshotUseCase.InspectorSnapshotData(
                            "Primitive " + topologyRef.id(),
                            PRIMITIVE_BOUNDARY,
                            List.of(
                                    SelectionFacts.factLine("id", primitive.id()),
                                    SelectionFacts.factLine(FACT_KIND, topologyRef.kind())));
                }
            }
            return null;
        }

        private static boolean matchesAggregate(DungeonTopologyRef topologyRef, DungeonState aggregate) {
            return aggregate.id() == topologyRef.id()
                    && DungeonTopologyElementKind.fromAreaType(aggregate.kind()) == topologyRef.kind();
        }
    }

    private static final class SelectionFacts {

        private static boolean present(DungeonTopologyRef topologyRef) {
            return topologyRef != null && topologyRef.present();
        }

        private static LoadDungeonSnapshotUseCase.InspectorSnapshotData fallbackSelection() {
            return new LoadDungeonSnapshotUseCase.InspectorSnapshotData(
                    DUNGEON_TITLE,
                    NO_SELECTION_DETAILS,
                    List.of(SELECTION_NONE));
        }

        private static String refFact(DungeonTopologyRef topologyRef) {
            return factLine("ref", topologyRef.kind() + " " + topologyRef.id());
        }

        private static void appendFactIfPresent(List<String> facts, String key, String value) {
            if (value != null && !value.isBlank()) {
                facts.add(factLine(key, value));
            }
        }

        private static String factLine(String key, Object value) {
            return key + ": " + value;
        }
    }
}
