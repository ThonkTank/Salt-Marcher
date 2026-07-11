package src.view.slotcontent.main.dungeonmap;

import java.util.Locale;
import src.domain.dungeon.published.DungeonCellRef;
import src.domain.dungeon.published.DungeonEditorMapSnapshot;
import src.domain.dungeon.published.DungeonFeatureKind;
import src.view.slotcontent.main.dungeonmap.DungeonMapRenderState.CellKind;

final class DungeonMapRenderCells {

    private DungeonMapRenderCells() {
    }

    static DungeonMapRenderState.Cell cell(
            DungeonEditorMapSnapshot.Area area,
            DungeonCellRef cell,
            boolean selected,
            boolean preview,
            boolean destructive,
            int deltaQ,
            int deltaR,
            int deltaLevel
    ) {
        return new DungeonMapRenderState.Cell(
                cell.q() + deltaQ,
                cell.r() + deltaR,
                cell.level() + deltaLevel,
                area.label(),
                areaKind(area),
                area.id(),
                clusterId(area),
                areaTopologyRef(area),
                selected,
                false,
                preview,
                destructive);
    }

    static DungeonMapRenderState.Cell featureCell(
            DungeonEditorMapSnapshot.Feature feature,
            DungeonCellRef cell,
            boolean selected
    ) {
        return featureCell(feature, cell, selected, false, false);
    }

    static DungeonMapRenderState.Cell featureCell(
            DungeonEditorMapSnapshot.Feature feature,
            DungeonCellRef cell,
            boolean selected,
            boolean preview,
            boolean destructive
    ) {
        return new DungeonMapRenderState.Cell(
                cell.q(),
                cell.r(),
                cell.level(),
                feature.label(),
                featureCellKind(feature.kind()),
                feature.id(),
                0L,
                featureTopologyRef(feature),
                selected,
                false,
                preview,
                destructive);
    }

    static DungeonMapRenderState.CellKind areaKind(DungeonEditorMapSnapshot.Area area) {
        return "CORRIDOR".equalsIgnoreCase(area.kind())
                ? CellKind.CORRIDOR
                : CellKind.ROOM;
    }

    static DungeonMapRenderState.CellKind featureCellKind(String kind) {
        return featureCellKind(featureKind(kind));
    }

    static DungeonMapRenderState.CellKind featureCellKind(DungeonFeatureKind kind) {
        return switch (kind == null ? DungeonFeatureKind.STAIR : kind) {
            case TRANSITION -> CellKind.TRANSITION;
            case STAIR -> CellKind.STAIR;
            case OBJECT -> CellKind.FEATURE_OBJECT;
            case ENCOUNTER -> CellKind.FEATURE_ENCOUNTER;
            case POI -> CellKind.FEATURE_POI;
        };
    }

    static DungeonMapRenderState.TopologyRef areaTopologyRef(
            DungeonEditorMapSnapshot.Area area
    ) {
        return DungeonMapRenderElementFactory.topologyRef(area.topologyRef());
    }

    static DungeonMapRenderState.TopologyRef featureTopologyRef(
            DungeonEditorMapSnapshot.Feature feature
    ) {
        return DungeonMapRenderElementFactory.topologyRef(feature.topologyRef());
    }

    static long clusterId(DungeonEditorMapSnapshot.Area area) {
        return area.clusterId();
    }

    static DungeonFeatureKind featureKind(String kind) {
        if (kind == null || kind.isBlank()) {
            return DungeonFeatureKind.STAIR;
        }
        try {
            return DungeonFeatureKind.valueOf(kind.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ignored) {
            return DungeonFeatureKind.STAIR;
        }
    }
}
