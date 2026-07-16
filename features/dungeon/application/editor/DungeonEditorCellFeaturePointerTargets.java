package features.dungeon.application.editor;

import java.util.Map;
import features.dungeon.api.DungeonCellRef;
import features.dungeon.api.DungeonEditorMapSnapshot;
import features.dungeon.api.DungeonEditorMapSurfaceSnapshot;

final class DungeonEditorCellFeaturePointerTargets {
    private DungeonEditorCellFeaturePointerTargets() {
    }

    static void addTargets(
            Map<String, DungeonEditorRuntimePointerTarget> targets,
            DungeonEditorMapSnapshot map,
            DungeonEditorMapSurfaceSnapshot snapshot
    ) {
        addAreaCellTargets(targets, map, snapshot);
        addFeatureCellTargets(targets, map, snapshot);
        addFeatureMarkerTargets(targets, map, snapshot);
    }

    private static void addAreaCellTargets(
            Map<String, DungeonEditorRuntimePointerTarget> targets,
            DungeonEditorMapSnapshot map,
            DungeonEditorMapSurfaceSnapshot snapshot
    ) {
        for (DungeonEditorMapSnapshot.Area area : map.areas()) {
            String elementKind = areaElementKind(area);
            DungeonEditorRuntimePointerTarget.ElementKind runtimeElementKind = areaRuntimeElementKind(area);
            for (DungeonCellRef cell : area.cells()) {
                if (DungeonEditorProjectionLevelInclusion.includes(snapshot, cell.level())) {
                    targets.put(DungeonEditorCellHitRefs.exactCell(
                                    elementKind,
                                    area.id(),
                                    area.clusterId(),
                                    area.topologyRef(),
                                    cell)
                                    .value(),
                            DungeonEditorRuntimePointerTarget.cell(
                                    runtimeElementKind,
                                    area.id(),
                                    area.clusterId(),
                                    topologyKind(area.topologyRef()),
                                    DungeonEditorTopologyHitRefs.topologyId(area.topologyRef()),
                                    cell.q(),
                                    cell.r(),
                                    cell.level()));
                }
            }
        }
    }

    private static void addFeatureCellTargets(
            Map<String, DungeonEditorRuntimePointerTarget> targets,
            DungeonEditorMapSnapshot map,
            DungeonEditorMapSurfaceSnapshot snapshot
    ) {
        for (DungeonEditorMapSnapshot.Feature feature : map.features()) {
            String hitElementKind = featureCellKind(feature.kind());
            DungeonEditorRuntimePointerTarget.ElementKind targetElementKind =
                    DungeonEditorFeaturePointerTargetFacts.pointerElementKind(hitElementKind);
            for (DungeonCellRef cell : feature.cells()) {
                if (DungeonEditorProjectionLevelInclusion.includes(snapshot, cell.level())) {
                    targets.put(DungeonEditorCellHitRefs.exactCell(
                                    hitElementKind,
                                    feature.id(),
                                    0L,
                                    feature.topologyRef(),
                                    cell)
                                    .value(),
                            DungeonEditorRuntimePointerTarget.cell(
                                    targetElementKind,
                                    feature.id(),
                                    0L,
                                    topologyKind(feature.topologyRef()),
                                    DungeonEditorTopologyHitRefs.topologyId(feature.topologyRef()),
                                    cell.q(),
                                    cell.r(),
                                    cell.level()));
                }
            }
        }
    }

    private static void addFeatureMarkerTargets(
            Map<String, DungeonEditorRuntimePointerTarget> targets,
            DungeonEditorMapSnapshot map,
            DungeonEditorMapSurfaceSnapshot snapshot
    ) {
        for (DungeonEditorMapSnapshot.Feature feature : map.features()) {
            if (!markerTargetFeature(feature)) {
                continue;
            }
            int level = DungeonEditorFeaturePointerTargetFacts.markerLevel(feature);
            if (!DungeonEditorProjectionLevelInclusion.includes(snapshot, level)) {
                continue;
            }
            int q = DungeonEditorFeaturePointerTargetFacts.markerQ(feature);
            int r = DungeonEditorFeaturePointerTargetFacts.markerR(feature);
            String hitElementKind = featureCellKind(feature.kind());
            DungeonEditorRuntimePointerTarget.ElementKind targetElementKind =
                    DungeonEditorFeaturePointerTargetFacts.pointerElementKind(hitElementKind);
            targets.put(
                    DungeonEditorMarkerHitRefs.featureMarker(feature.topologyRef(), feature.id(), q, r, level)
                            .value(),
                    DungeonEditorRuntimePointerTarget.marker(
                            targetElementKind,
                            feature.id(),
                            0L,
                            topologyKind(feature.topologyRef()),
                            DungeonEditorTopologyHitRefs.topologyId(feature.topologyRef())));
        }
    }

    private static boolean markerTargetFeature(DungeonEditorMapSnapshot.Feature feature) {
        return DungeonEditorFeaturePointerTargetFacts.markerTargetFeature(feature);
    }

    private static String areaElementKind(DungeonEditorMapSnapshot.Area area) {
        return "CORRIDOR".equalsIgnoreCase(area.kind()) ? "CORRIDOR" : "ROOM";
    }

    private static DungeonEditorRuntimePointerTarget.ElementKind areaRuntimeElementKind(
            DungeonEditorMapSnapshot.Area area
    ) {
        return DungeonEditorRuntimePointerTargetCompatibility.legacyElementKind(areaElementKind(area));
    }

    private static String featureCellKind(String kind) {
        return DungeonEditorFeaturePointerTargetFacts.cellKind(kind);
    }

    private static DungeonEditorRuntimePointerTarget.TopologyKind topologyKind(
            features.dungeon.api.DungeonEditorTopologyElementRef topologyRef
    ) {
        return DungeonEditorRuntimePointerTargetCompatibility.legacyTopologyKind(
                DungeonEditorTopologyHitRefs.topologyKind(topologyRef));
    }
}
