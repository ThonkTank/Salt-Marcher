package features.dungeon.application.editor;

import java.util.Map;
import features.dungeon.api.DungeonCellRef;
import features.dungeon.api.DungeonEditorMapSnapshot;

final class DungeonEditorCellFeaturePointerTargets {
    private DungeonEditorCellFeaturePointerTargets() {
    }

    static void addTargets(
            Map<String, features.dungeon.api.editor.DungeonEditorPointerInput.Target> targets,
            DungeonEditorMapSnapshot map,
            DungeonEditorSurfaceProjection snapshot
    ) {
        addAreaCellTargets(targets, map, snapshot);
        addFeatureCellTargets(targets, map, snapshot);
        addFeatureMarkerTargets(targets, map, snapshot);
    }

    private static void addAreaCellTargets(
            Map<String, features.dungeon.api.editor.DungeonEditorPointerInput.Target> targets,
            DungeonEditorMapSnapshot map,
            DungeonEditorSurfaceProjection snapshot
    ) {
        for (DungeonEditorMapSnapshot.Area area : map.areas()) {
            String elementKind = areaElementKind(area);
            features.dungeon.api.editor.DungeonEditorPointerInput.ElementKind runtimeElementKind = areaRuntimeElementKind(area);
            for (DungeonCellRef cell : area.cells()) {
                if (DungeonEditorProjectionLevelInclusion.includes(snapshot, cell.level())) {
                    targets.put(DungeonEditorCellHitRefs.exactCell(
                                    elementKind,
                                    area.id(),
                                    area.clusterId(),
                                    area.topologyRef(),
                                    cell)
                                    .value(),
                            features.dungeon.api.editor.DungeonEditorPointerInput.Target.cell(
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
            Map<String, features.dungeon.api.editor.DungeonEditorPointerInput.Target> targets,
            DungeonEditorMapSnapshot map,
            DungeonEditorSurfaceProjection snapshot
    ) {
        for (DungeonEditorMapSnapshot.Feature feature : map.features()) {
            String hitElementKind = featureCellKind(feature.kind());
            features.dungeon.api.editor.DungeonEditorPointerInput.ElementKind targetElementKind =
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
                            features.dungeon.api.editor.DungeonEditorPointerInput.Target.cell(
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
            Map<String, features.dungeon.api.editor.DungeonEditorPointerInput.Target> targets,
            DungeonEditorMapSnapshot map,
            DungeonEditorSurfaceProjection snapshot
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
            features.dungeon.api.editor.DungeonEditorPointerInput.ElementKind targetElementKind =
                    DungeonEditorFeaturePointerTargetFacts.pointerElementKind(hitElementKind);
            targets.put(
                    DungeonEditorMarkerHitRefs.featureMarker(feature.topologyRef(), feature.id(), q, r, level)
                            .value(),
                    features.dungeon.api.editor.DungeonEditorPointerInput.Target.marker(
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

    private static features.dungeon.api.editor.DungeonEditorPointerInput.ElementKind areaRuntimeElementKind(
            DungeonEditorMapSnapshot.Area area
    ) {
        return "CORRIDOR".equalsIgnoreCase(areaElementKind(area))
                ? features.dungeon.api.editor.DungeonEditorPointerInput.ElementKind.CORRIDOR
                : features.dungeon.api.editor.DungeonEditorPointerInput.ElementKind.ROOM;
    }

    private static String featureCellKind(String kind) {
        return DungeonEditorFeaturePointerTargetFacts.cellKind(kind);
    }

    private static features.dungeon.api.editor.DungeonEditorPointerInput.TopologyKind topologyKind(
            features.dungeon.api.DungeonTopologyElementRef topologyRef
    ) {
        return features.dungeon.api.editor.DungeonEditorPointerInput.TopologyKind.fromPublished(
                topologyRef == null ? null : topologyRef.kind());
    }
}
