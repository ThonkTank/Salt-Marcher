package src.domain.dungeoneditor.model.interaction.helper;

import org.jspecify.annotations.Nullable;
import src.domain.dungeoneditor.model.interaction.model.DungeonEditorInteractionValues.CellTarget;
import src.domain.dungeoneditor.model.interaction.model.DungeonEditorMainViewInteractionValues;
import src.domain.dungeoneditor.model.interaction.model.DungeonEditorMainViewInteractionValues.BoundaryTarget;
import src.domain.dungeoneditor.model.interaction.model.DungeonEditorMainViewInteractionValues.HandleTarget;
import src.domain.dungeoneditor.model.interaction.model.DungeonEditorMainViewInteractionValues.HitKind;
import src.domain.dungeoneditor.model.interaction.model.DungeonEditorMainViewInteractionValues.HitTarget;

final class DungeonEditorMainViewHitRefBoundaryTranslationHelper {
    private static final int MINIMUM_HIT_REF_PARTS = 2;

    private DungeonEditorMainViewHitRefBoundaryTranslationHelper() {
    }

    static HitTarget parseHitTarget(@Nullable String hitRef) {
        if (hitRef == null || hitRef.isBlank()) {
            return HitTarget.empty();
        }
        String[] parts = hitRef.split(":", -1);
        if (parts.length < MINIMUM_HIT_REF_PARTS) {
            return HitTarget.empty();
        }
        return switch (parts[0]) {
            case "cell" -> parseCell(parts);
            case "label" -> parseLabel(parts);
            case "marker" -> parseMarker(parts);
            case "edge" -> parseEdge(parts);
            case "graph-node" -> parseGraphNode(parts);
            default -> HitTarget.empty();
        };
    }

    private static HitTarget parseCell(String[] parts) {
        return new HitTarget(
                toHitKind(parts[1]),
                parseLong(parts, 2),
                parseLong(parts, 3),
                part(parts, 4),
                parseLong(parts, 5),
                HandleTarget.empty(),
                BoundaryTarget.empty());
    }

    private static HitTarget parseLabel(String[] parts) {
        long ownerId = parseLong(parts, 1);
        long clusterId = parseLong(parts, 2);
        String topologyRefKind = part(parts, 3);
        long topologyRefId = parseLong(parts, 4);
        return new HitTarget(
                HitKind.LABEL,
                ownerId,
                clusterId,
                topologyRefKind,
                topologyRefId,
                HandleTarget.clusterLabel(topologyRefKind, topologyRefId, ownerId, clusterId),
                BoundaryTarget.empty());
    }

    private static HitTarget parseMarker(String[] parts) {
        HandleTarget handleTarget = new HandleTarget(
                part(parts, 1),
                part(parts, 2),
                parseLong(parts, 3),
                parseLong(parts, 4),
                parseLong(parts, 5),
                parseLong(parts, 6),
                parseLong(parts, 7),
                parseInt(parts, 8),
                new CellTarget(parseInt(parts, 9), parseInt(parts, 10), parseInt(parts, 11)),
                part(parts, 12));
        return new HitTarget(
                HitKind.HANDLE,
                handleTarget.ownerId(),
                handleTarget.clusterId(),
                handleTarget.topologyRefKind(),
                handleTarget.topologyRefId(),
                handleTarget,
                BoundaryTarget.empty());
    }

    private static HitTarget parseEdge(String[] parts) {
        BoundaryTarget boundaryTarget = new BoundaryTarget(
                true,
                part(parts, 1),
                parseLong(parts, 2),
                0L,
                part(parts, 3),
                parseLong(parts, 4),
                new CellTarget(parseInt(parts, 6), parseInt(parts, 7), parseInt(parts, 5)),
                new CellTarget(parseInt(parts, 8), parseInt(parts, 9), parseInt(parts, 5)));
        return new HitTarget(
                HitKind.BOUNDARY,
                boundaryTarget.ownerId(),
                0L,
                boundaryTarget.topologyRefKind(),
                boundaryTarget.topologyRefId(),
                HandleTarget.clusterLabel(
                        boundaryTarget.topologyRefKind(),
                        boundaryTarget.topologyRefId(),
                        boundaryTarget.ownerId(),
                        0L),
                boundaryTarget);
    }

    private static HitTarget parseGraphNode(String[] parts) {
        String topologyRefKind = part(parts, 1);
        long ownerId = parseLong(parts, 2);
        long clusterId = parseLong(parts, 3);
        return new HitTarget(
                HitKind.LABEL,
                ownerId,
                clusterId,
                topologyRefKind,
                ownerId,
                HandleTarget.clusterLabel(topologyRefKind, ownerId, ownerId, clusterId),
                BoundaryTarget.empty());
    }

    private static String part(String[] parts, int index) {
        return index >= 0 && index < parts.length ? parts[index] : "";
    }

    private static long parseLong(String[] parts, int index) {
        try {
            return Long.parseLong(part(parts, index));
        } catch (NumberFormatException ignored) {
            return 0L;
        }
    }

    private static int parseInt(String[] parts, int index) {
        try {
            return Integer.parseInt(part(parts, index));
        } catch (NumberFormatException ignored) {
            return 0;
        }
    }

    private static HitKind toHitKind(@Nullable String kind) {
        return switch (kind == null ? "" : kind) {
            case DungeonEditorMainViewInteractionValues.ROOM_KIND -> HitKind.ROOM;
            case "CORRIDOR" -> HitKind.CORRIDOR;
            case "STAIR" -> HitKind.STAIR;
            case "TRANSITION" -> HitKind.TRANSITION;
            default -> HitKind.EMPTY;
        };
    }
}
