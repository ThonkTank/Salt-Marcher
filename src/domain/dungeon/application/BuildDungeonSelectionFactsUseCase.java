package src.domain.dungeon.application;

import java.util.ArrayList;
import java.util.List;
import src.domain.dungeon.map.entity.DungeonAggregate;
import src.domain.dungeon.map.entity.DungeonPrimitive;
import src.domain.dungeon.map.value.DungeonAreaFacts;
import src.domain.dungeon.map.value.DungeonBoundaryFacts;
import src.domain.dungeon.map.value.DungeonDerivedState;
import src.domain.dungeon.map.value.DungeonFeatureFacts;
import src.domain.dungeon.map.value.DungeonTopologyElementKind;
import src.domain.dungeon.map.value.DungeonTopologyRef;

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
        if (!present(topologyRef)) {
            return fallbackSelection();
        }
        for (DungeonAreaFacts area : derived.map().areas()) {
            if (topologyRef.equals(area.topologyRef())) {
                return new LoadDungeonSnapshotUseCase.InspectorSnapshotData(
                        area.label(),
                        AUTHORISED_AREA,
                        List.of(
                                refFact(topologyRef),
                                factLine(FACT_KIND, area.kind()),
                                factLine("cells", area.cells().size())));
            }
        }
        for (DungeonBoundaryFacts boundary : derived.map().boundaries()) {
            if (topologyRef.equals(boundary.topologyRef())) {
                return new LoadDungeonSnapshotUseCase.InspectorSnapshotData(
                        boundary.label(),
                        AUTHORISED_BOUNDARY,
                        List.of(
                                refFact(topologyRef),
                                factLine(FACT_KIND, boundary.kind())));
            }
        }
        for (DungeonFeatureFacts feature : derived.map().features()) {
            if (topologyRef.equals(feature.topologyRef())) {
                List<String> facts = new ArrayList<>();
                facts.add(refFact(topologyRef));
                facts.add(factLine(FACT_KIND, feature.kind()));
                appendFactIfPresent(facts, "target", feature.destinationLabel());
                return new LoadDungeonSnapshotUseCase.InspectorSnapshotData(
                        feature.label(),
                        feature.description(),
                        facts);
            }
        }
        for (DungeonAggregate aggregate : derived.aggregates()) {
            if (matchesAggregate(topologyRef, aggregate)) {
                return new LoadDungeonSnapshotUseCase.InspectorSnapshotData(
                        aggregate.label(),
                        AGGREGATE_OWNER,
                        List.of(
                                factLine("id", aggregate.id()),
                                factLine(FACT_KIND, topologyRef.kind()),
                                factLine("label", aggregate.label())));
            }
        }
        for (DungeonPrimitive primitive : derived.primitives()) {
            if (primitive.id() == topologyRef.id()) {
                return new LoadDungeonSnapshotUseCase.InspectorSnapshotData(
                        "Primitive " + topologyRef.id(),
                        PRIMITIVE_BOUNDARY,
                        List.of(
                                factLine("id", primitive.id()),
                                factLine(FACT_KIND, topologyRef.kind())));
            }
        }
        return fallbackSelection();
    }

    boolean isFallbackSelection(LoadDungeonSnapshotUseCase.InspectorSnapshotData snapshot) {
        return snapshot != null
                && DUNGEON_TITLE.equals(snapshot.title())
                && NO_SELECTION_DETAILS.equals(snapshot.description())
                && snapshot.facts().equals(List.of(SELECTION_NONE));
    }

    private static boolean matchesAggregate(DungeonTopologyRef topologyRef, DungeonAggregate aggregate) {
        return aggregate.id() == topologyRef.id()
                && DungeonTopologyElementKind.fromAreaType(aggregate.kind()) == topologyRef.kind();
    }

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
