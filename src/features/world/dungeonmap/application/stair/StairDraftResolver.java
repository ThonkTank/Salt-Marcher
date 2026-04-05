package features.world.dungeonmap.application.stair;

import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.model.structures.stair.DungeonStair;
import features.world.dungeonmap.model.structures.stair.StairPathGenerator;

import java.util.Objects;

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
        return resolve(layout, stairId, mapId, draft, true);
    }

    public static DungeonStair resolveCommitted(
            DungeonLayout layout,
            Long stairId,
            long mapId,
            DungeonStairApplicationService.StairDraft draft
    ) {
        return resolve(layout, stairId, mapId, draft, false);
    }

    private static DungeonStair resolve(
            DungeonLayout layout,
            Long stairId,
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
        String validationMessage = resolvedDraft.shape()
                .validateDimensions(resolvedDraft.dimension1(), resolvedDraft.dimension2())
                .orElse(null);
        if (validationMessage != null) {
            throw new IllegalArgumentException(validationMessage);
        }
        validateAnchor(resolvedLayout, resolvedDraft.anchorCell(), resolvedDraft.anchorLevelZ());
        return DungeonStair.resolved(
                stairId,
                mapId,
                resolvedDraft.name(),
                StairPathGenerator.generateAnchoredPath(
                        resolvedDraft.shape(),
                        resolvedDraft.anchorCell(),
                        resolvedDraft.anchorLevelZ(),
                        resolvedDraft.direction(),
                        resolvedDraft.minLevelZ(),
                        resolvedDraft.maxLevelZ(),
                        resolvedDraft.dimension1(),
                        resolvedDraft.dimension2()),
                resolvedDraft.stopLevels());
    }

    private static void validateAnchor(DungeonLayout layout, CellCoord anchorCell, int anchorLevelZ) {
        Room room = layout.roomAtCell(anchorCell, anchorLevelZ);
        if (room == null) {
            throw new IllegalArgumentException("Treppenstart muss auf einem Raum-Floor liegen");
        }
    }
}
