package features.world.dungeon.application.stair;

import database.DatabaseManager;
import features.world.dungeon.application.support.DungeonTransactionRunner;
import features.world.dungeon.dungoenmap.model.DungeonMap;
import features.world.dungeon.geometry.GridPoint;
import features.world.dungeon.model.structures.stair.DungeonStair;
import features.world.dungeon.dungoenmap.repository.DungeonMapRepository;
import features.world.dungeon.repository.DungeonStairRepository;
import features.world.dungeon.stair.model.StairPathPatternSpec;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.LinkedHashSet;
import java.util.Objects;
import java.util.Set;

/**
 * Single workflow owner for editor-authored stair create, update, delete, and reopen metadata.
 *
 * <p>The persisted structure truth remains the explicit ordered stair path plus stop levels. This service validates
 * editor inputs, generates that path from the current spec, and persists the editor metadata needed to reopen it.
 */
public final class DungeonStairApplicationService {

    private final DungeonMapRepository mapRepository;
    private final DungeonStairRepository stairRepository;

    public DungeonStairApplicationService(
            DungeonMapRepository mapRepository,
            DungeonStairRepository stairRepository
    ) {
        this.mapRepository = Objects.requireNonNull(mapRepository, "mapRepository");
        this.stairRepository = Objects.requireNonNull(stairRepository, "stairRepository");
    }

    public long createStair(CreateStairRequest request) throws SQLException {
        CreateStairRequest resolvedRequest = Objects.requireNonNull(request, "request");
        requireMapId(resolvedRequest.mapId());
        StairDraft draft = Objects.requireNonNull(resolvedRequest.draft(), "draft");
        try (Connection conn = DatabaseManager.getConnection()) {
            return DungeonTransactionRunner.inTransaction(conn, () -> {
                DungeonMap layout = requireLayout(conn, resolvedRequest.mapId());
                StairDraft namedDraft = draftWithGeneratedCreateName(layout, draft);
                DungeonStair stair = StairDraftResolver.resolveCommitted(
                        layout,
                        null,
                        resolvedRequest.mapId(),
                        namedDraft);
                DungeonStairRepository.StairEditorData editorData = toEditorData(namedDraft);
                long stairId = stairRepository.insertStair(conn, resolvedRequest.mapId(), stair, editorData);
                stairRepository.replacePathNodes(conn, stairId, stair.gridPath().points());
                stairRepository.replaceStopLevels(conn, stairId, stair.stopLevels());
                return stairId;
            });
        }
    }

    public void updateStair(UpdateStairRequest request) throws SQLException {
        UpdateStairRequest resolvedRequest = Objects.requireNonNull(request, "request");
        requireMapId(resolvedRequest.mapId());
        if (resolvedRequest.stairId() <= 0) {
            throw new IllegalArgumentException("Treppe fehlt");
        }
        StairDraft draft = Objects.requireNonNull(resolvedRequest.draft(), "draft");
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                DungeonMap layout = requireLayout(conn, resolvedRequest.mapId());
                if (layout.findStair(resolvedRequest.stairId()) == null) {
                    throw new SQLException("Treppe " + resolvedRequest.stairId() + " existiert nicht");
                }
                DungeonStair stair = StairDraftResolver.resolveCommitted(
                        layout,
                        resolvedRequest.stairId(),
                        resolvedRequest.mapId(),
                        draft);
                stairRepository.updateStair(conn, resolvedRequest.stairId(), stair, toEditorData(draft));
                stairRepository.replacePathNodes(conn, resolvedRequest.stairId(), stair.gridPath().points());
                stairRepository.replaceStopLevels(conn, resolvedRequest.stairId(), stair.stopLevels());
                return null;
            });
        }
    }

    public void moveStair(MoveStairRequest request) throws SQLException {
        MoveStairRequest resolvedRequest = Objects.requireNonNull(request, "request");
        requireMapId(resolvedRequest.mapId());
        if (resolvedRequest.stairId() <= 0) {
            throw new IllegalArgumentException("Treppe fehlt");
        }
        StairDraft resolvedDraft = Objects.requireNonNull(resolvedRequest.draft(), "draft");
        if ((resolvedRequest.delta() == null || (resolvedRequest.delta().cellX() == 0 && resolvedRequest.delta().cellY() == 0))
                && resolvedRequest.levelDelta() == 0) {
            return;
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                DungeonMap layout = requireLayout(conn, resolvedRequest.mapId());
                if (layout.findStair(resolvedRequest.stairId()) == null) {
                    throw new SQLException("Treppe " + resolvedRequest.stairId() + " existiert nicht");
                }
                StairDraft movedDraft = StairDraftResolver.shiftedDraft(
                        resolvedDraft,
                        resolvedRequest.delta(),
                        resolvedRequest.levelDelta());
                DungeonStair stair = StairDraftResolver.resolveCommitted(
                        layout,
                        resolvedRequest.stairId(),
                        resolvedRequest.mapId(),
                        movedDraft);
                stairRepository.updateStair(conn, resolvedRequest.stairId(), stair, toEditorData(movedDraft));
                stairRepository.replacePathNodes(conn, resolvedRequest.stairId(), stair.gridPath().points());
                stairRepository.replaceStopLevels(conn, resolvedRequest.stairId(), stair.stopLevels());
                return null;
            });
        }
    }

    public void deleteStair(DeleteStairRequest request) throws SQLException {
        DeleteStairRequest resolvedRequest = Objects.requireNonNull(request, "request");
        requireMapId(resolvedRequest.mapId());
        if (resolvedRequest.stairId() <= 0) {
            return;
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                DungeonMap layout = requireLayout(conn, resolvedRequest.mapId());
                if (layout.findStair(resolvedRequest.stairId()) != null) {
                    stairRepository.deleteStair(conn, resolvedRequest.stairId());
                }
                return null;
            });
        }
    }

    public LoadedStairEditorSpec loadStairEditorSpec(LoadStairEditorSpecRequest request) throws SQLException {
        LoadStairEditorSpecRequest resolvedRequest = Objects.requireNonNull(request, "request");
        requireMapId(resolvedRequest.mapId());
        if (resolvedRequest.stairId() <= 0) {
            return null;
        }
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonStairRepository.StairEditorData editorData = stairRepository.loadEditorData(
                    conn,
                    resolvedRequest.mapId(),
                    resolvedRequest.stairId());
            if (editorData == null) {
                return null;
            }
            return new LoadedStairEditorSpec(
                    resolvedRequest.stairId(),
                    editorData.name(),
                    editorData.anchorCell(),
                    editorData.anchorLevelZ(),
                    editorData.shapeSpec(),
                    editorData.minLevelZ(),
                    editorData.maxLevelZ(),
                    editorData.stopLevels());
        }
    }

    private DungeonMap requireLayout(Connection conn, long mapId) throws SQLException {
        DungeonMap layout = mapRepository.loadMap(conn, mapId);
        if (layout == null) {
            throw new SQLException("Dungeon " + mapId + " konnte nicht geladen werden");
        }
        return layout;
    }

    private static void requireMapId(long mapId) {
        if (mapId <= 0) {
            throw new IllegalArgumentException("Kein aktiver Dungeon geladen");
        }
    }

    private static StairDraft draftWithGeneratedCreateName(DungeonMap layout, StairDraft draft) {
        if (draft == null || draft.name() != null) {
            return draft;
        }
        // Create flows assign the standard stair name once; update flows must not backfill legacy unnamed stairs.
        return new StairDraft(
                StairNameGenerator.nextName(layout),
                draft.anchorCell(),
                draft.anchorLevelZ(),
                draft.shapeSpec(),
                draft.minLevelZ(),
                draft.maxLevelZ(),
                draft.stopLevels());
    }

    private static DungeonStairRepository.StairEditorData toEditorData(StairDraft draft) {
        return new DungeonStairRepository.StairEditorData(
                draft.name(),
                draft.anchorCell(),
                draft.anchorLevelZ(),
                draft.shapeSpec(),
                draft.minLevelZ(),
                draft.maxLevelZ(),
                draft.stopLevels());
    }

    public record StairDraft(
            String name,
            GridPoint anchorCell,
            int anchorLevelZ,
            StairPathPatternSpec shapeSpec,
            int minLevelZ,
            int maxLevelZ,
            Set<Integer> stopLevels
    ) {
        public StairDraft {
            anchorCell = Objects.requireNonNull(anchorCell, "anchorCell");
            shapeSpec = shapeSpec == null ? StairPathPatternSpec.defaultSpec() : shapeSpec;
            stopLevels = stopLevels == null ? Set.of() : Set.copyOf(new LinkedHashSet<>(stopLevels));
            name = name == null || name.isBlank() ? null : name.trim();
        }
    }

    public record CreateStairRequest(long mapId, StairDraft draft) {
    }

    public record UpdateStairRequest(long mapId, long stairId, StairDraft draft) {
    }

    public record MoveStairRequest(long mapId, long stairId, StairDraft draft, GridPoint delta, int levelDelta) {
    }

    public record DeleteStairRequest(long mapId, long stairId) {
    }

    public record LoadStairEditorSpecRequest(long mapId, long stairId) {
    }

    public record LoadedStairEditorSpec(
            long stairId,
            String name,
            GridPoint anchorCell,
            int anchorLevelZ,
            StairPathPatternSpec shapeSpec,
            int minLevelZ,
            int maxLevelZ,
            Set<Integer> stopLevels
    ) {
        public LoadedStairEditorSpec {
            anchorCell = Objects.requireNonNull(anchorCell, "anchorCell");
            shapeSpec = shapeSpec == null ? StairPathPatternSpec.defaultSpec() : shapeSpec;
            stopLevels = stopLevels == null ? Set.of() : Set.copyOf(new LinkedHashSet<>(stopLevels));
            name = name == null || name.isBlank() ? null : name.trim();
        }
    }
}
