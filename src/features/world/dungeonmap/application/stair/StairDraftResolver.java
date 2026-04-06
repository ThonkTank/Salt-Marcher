package features.world.dungeonmap.application.stair;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.geometry.TilePath;
import features.world.dungeonmap.model.objects.Stair;
import features.world.dungeonmap.model.objects.StructureObject;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.model.structures.stair.DungeonStair;

import java.util.Objects;
import java.util.Set;

/**
 * Shared stair-draft semantics for both editor preview and persisted workflows.
 *
 * <p>The tool may own field parsing and local UI state, but the authored stair rules themselves stay centralized
 * here so preview and commit cannot drift apart.
 */
public final class StairDraftResolver {

    private StairDraftResolver() {
        throw new AssertionError("No instances");
    }

    public static DungeonStair resolvePreview(
            DungeonLayout layout,
            Long stairId,
            long mapId,
            DungeonStairApplicationService.StairDraft draft
    ) {
        return toDungeonStair(resolveDraft(layout, mapId, draft, true), stairId, mapId);
    }

    public static DungeonStair resolveCommitted(
            DungeonLayout layout,
            Long stairId,
            long mapId,
            DungeonStairApplicationService.StairDraft draft
    ) {
        return toDungeonStair(resolveDraft(layout, mapId, draft, false), stairId, mapId);
    }

    public static ResolvedStairDraft resolveDraft(
            DungeonLayout layout,
            long mapId,
            DungeonStairApplicationService.StairDraft draft,
            boolean allowSingleStop
    ) {
        DungeonLayout resolvedLayout = Objects.requireNonNull(layout, "layout");
        DungeonStairApplicationService.StairDraft resolvedDraft = Objects.requireNonNull(draft, "draft");
        if (mapId <= 0) {
            throw new IllegalArgumentException("Kein aktiver Dungeon geladen");
        }
        if (resolvedDraft.anchorCell() == null) {
            throw new IllegalArgumentException("Treppenanker fehlt");
        }
        if (resolvedDraft.minLevelZ() > resolvedDraft.maxLevelZ()) {
            throw new IllegalArgumentException("Treppenspanne ist ungültig");
        }
        if (resolvedDraft.anchorLevelZ() < resolvedDraft.minLevelZ()
                || resolvedDraft.anchorLevelZ() > resolvedDraft.maxLevelZ()) {
            throw new IllegalArgumentException("Start-Ebene liegt außerhalb der Treppenspanne");
        }
        if (resolvedDraft.stopLevels().isEmpty()) {
            throw new IllegalArgumentException("Mindestens eine Ziel-Ebene wählen");
        }
        if (!resolvedDraft.stopLevels().contains(resolvedDraft.anchorLevelZ())) {
            throw new IllegalArgumentException("Start-Ebene muss Teil der Treppenstopps bleiben");
        }
        if (!allowSingleStop && resolvedDraft.stopLevels().size() < 2) {
            throw new IllegalArgumentException("Mindestens eine weitere Ebene wählen");
        }
        for (Integer stopLevel : resolvedDraft.stopLevels()) {
            if (stopLevel == null
                    || stopLevel < resolvedDraft.minLevelZ()
                    || stopLevel > resolvedDraft.maxLevelZ()) {
                throw new IllegalArgumentException("Treppenstopps liegen außerhalb der Treppenspanne");
            }
        }
        String validationMessage = resolvedDraft.shapeSpec().validate().orElse(null);
        if (validationMessage != null) {
            throw new IllegalArgumentException(validationMessage);
        }
        validateAnchor(resolvedLayout, resolvedDraft.anchorCell(), resolvedDraft.anchorLevelZ());
        return new ResolvedStairDraft(
                resolvedDraft,
                TilePath.generate(
                        resolvedDraft.shapeSpec(),
                        resolvedDraft.anchorCell(),
                        resolvedDraft.anchorLevelZ(),
                        resolvedDraft.minLevelZ(),
                        resolvedDraft.maxLevelZ()),
                resolvedDraft.stopLevels());
    }

    public static DungeonStairApplicationService.StairDraft shiftedDraft(
            DungeonStairApplicationService.StairDraft draft,
            CellCoord delta,
            int levelDelta
    ) {
        DungeonStairApplicationService.StairDraft resolvedDraft = Objects.requireNonNull(draft, "draft");
        CellCoord resolvedDelta = delta == null ? new CellCoord(0, 0) : delta;
        return new DungeonStairApplicationService.StairDraft(
                resolvedDraft.name(),
                resolvedDraft.anchorCell().add(resolvedDelta),
                resolvedDraft.anchorLevelZ() + levelDelta,
                resolvedDraft.shapeSpec(),
                resolvedDraft.minLevelZ() + levelDelta,
                resolvedDraft.maxLevelZ() + levelDelta,
                resolvedDraft.stopLevels().stream()
                        .map(level -> level == null ? null : level + levelDelta)
                        .filter(Objects::nonNull)
                        .collect(java.util.stream.Collectors.toCollection(java.util.LinkedHashSet::new)));
    }

    private static DungeonStair toDungeonStair(
            ResolvedStairDraft resolvedDraft,
            Long stairId,
            long mapId
    ) {
        ResolvedStairDraft resolution = Objects.requireNonNull(resolvedDraft, "resolvedDraft");
        return DungeonStair.resolved(
                stairId,
                mapId,
                resolution.draft().name(),
                StructureObject.fromStair(Stair.of(resolution.path(), resolution.stopLevels())));
    }

    private static void validateAnchor(DungeonLayout layout, CellCoord anchorCell, int anchorLevelZ) {
        Room room = layout.roomWithFloorAtCell(anchorCell, anchorLevelZ);
        if (room == null) {
            throw new IllegalArgumentException("Treppenstart muss auf einem Raum-Floor liegen");
        }
    }

    public record ResolvedStairDraft(
            DungeonStairApplicationService.StairDraft draft,
            TilePath path,
            Set<Integer> stopLevels
    ) {
        public ResolvedStairDraft {
            draft = Objects.requireNonNull(draft, "draft");
            path = path == null ? TilePath.empty() : path;
            stopLevels = Set.copyOf(stopLevels == null ? Set.<Integer>of() : stopLevels);
        }
    }
}
