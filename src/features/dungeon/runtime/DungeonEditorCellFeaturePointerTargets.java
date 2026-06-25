package src.features.dungeon.runtime;

import java.util.Locale;
import java.util.Map;
import src.domain.dungeon.published.DungeonCellRef;
import src.domain.dungeon.published.DungeonEditorMapHitRef;
import src.domain.dungeon.published.DungeonEditorMapSnapshot;
import src.domain.dungeon.published.DungeonEditorMapSurfaceSnapshot;
import src.domain.dungeon.published.DungeonEditorTopologyElementRef;

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
            for (DungeonCellRef cell : area.cells()) {
                if (DungeonEditorProjectionLevelInclusion.includes(snapshot, cell.level())) {
                    targets.put(cellHitRef(
                                    elementKind,
                                    area.id(),
                                    area.clusterId(),
                                    area.topologyRef(),
                                    cell),
                            DungeonEditorRuntimePointerTargetFactory.cell(
                                    elementKind,
                                    area.id(),
                                    area.clusterId(),
                                    area.topologyRef()));
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
            for (DungeonCellRef cell : feature.cells()) {
                if (DungeonEditorProjectionLevelInclusion.includes(snapshot, cell.level())) {
                    String hitElementKind = featureCellKind(feature.kind());
                    String targetElementKind = featurePointerElementKind(hitElementKind);
                    targets.put(cellHitRef(
                                    hitElementKind,
                                    feature.id(),
                                    0L,
                                    feature.topologyRef(),
                                    cell),
                            DungeonEditorRuntimePointerTargetFactory.cell(
                                    targetElementKind,
                                    feature.id(),
                                    0L,
                                    feature.topologyRef()));
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
            if (!"TRANSITION".equalsIgnoreCase(feature.kind()) || feature.cells().isEmpty()) {
                continue;
            }
            DungeonCellRef firstCell = feature.cells().getFirst();
            if (!DungeonEditorProjectionLevelInclusion.includes(snapshot, firstCell.level())) {
                continue;
            }
            int q = (int) Math.floor(centerQ(feature));
            int r = (int) Math.floor(centerR(feature));
            targets.put(
                    DungeonEditorMapHitRef.featureMarker(feature.topologyRef(), feature.id(), q, r, firstCell.level())
                            .value(),
                    DungeonEditorRuntimePointerTargetFactory.cell(
                            featurePointerElementKind(featureCellKind(feature.kind())),
                            feature.id(),
                            0L,
                            feature.topologyRef()));
        }
    }

    private static String cellHitRef(
            String elementKind,
            long ownerId,
            long clusterId,
            DungeonEditorTopologyElementRef topologyRef,
            DungeonCellRef cell
    ) {
        return DungeonEditorMapHitRef.exactCell(elementKind, ownerId, clusterId, topologyRef, cell).value();
    }

    private static double centerQ(DungeonEditorMapSnapshot.Feature feature) {
        double total = 0.0;
        for (DungeonCellRef cell : feature.cells()) {
            total += cell.q() + 0.5;
        }
        return total / Math.max(1, feature.cells().size());
    }

    private static double centerR(DungeonEditorMapSnapshot.Feature feature) {
        double total = 0.0;
        for (DungeonCellRef cell : feature.cells()) {
            total += cell.r() + 0.5;
        }
        return total / Math.max(1, feature.cells().size());
    }

    private static String areaElementKind(DungeonEditorMapSnapshot.Area area) {
        return "CORRIDOR".equalsIgnoreCase(area.kind()) ? "CORRIDOR" : "ROOM";
    }

    private static String featureCellKind(String kind) {
        return switch (kind == null ? "" : kind.trim().toUpperCase(Locale.ROOT)) {
            case "OBJECT" -> "FEATURE_OBJECT";
            case "ENCOUNTER" -> "FEATURE_ENCOUNTER";
            case "POI" -> "FEATURE_POI";
            case "TRANSITION" -> "TRANSITION";
            default -> "STAIR";
        };
    }

    private static String featurePointerElementKind(String cellKind) {
        return switch (cellKind) {
            case "FEATURE_OBJECT", "FEATURE_ENCOUNTER", "FEATURE_POI" -> "FEATURE_MARKER";
            default -> cellKind;
        };
    }
}
