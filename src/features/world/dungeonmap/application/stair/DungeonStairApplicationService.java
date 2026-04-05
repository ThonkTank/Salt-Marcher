package features.world.dungeonmap.application.stair;

import database.DatabaseManager;
import features.world.dungeonmap.application.support.DungeonTransactionRunner;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.structures.stair.DungeonStair;
import features.world.dungeonmap.model.structures.stair.StairShape;
import features.world.dungeonmap.repository.DungeonLayoutRepository;
import features.world.dungeonmap.repository.DungeonStairRepository;

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

    private final DungeonLayoutRepository layoutRepository;
    private final DungeonStairRepository stairRepository;

    public DungeonStairApplicationService(
            DungeonLayoutRepository layoutRepository,
            DungeonStairRepository stairRepository
    ) {
        this.layoutRepository = Objects.requireNonNull(layoutRepository, "layoutRepository");
        this.stairRepository = Objects.requireNonNull(stairRepository, "stairRepository");
    }

    public long createStair(CreateStairRequest request) throws SQLException {
        CreateStairRequest resolvedRequest = Objects.requireNonNull(request, "request");
        requireMapId(resolvedRequest.mapId());
        StairDraft draft = Objects.requireNonNull(resolvedRequest.draft(), "draft");
        try (Connection conn = DatabaseManager.getConnection()) {
            return DungeonTransactionRunner.inTransaction(conn, () -> {
                DungeonLayout layout = requireLayout(conn, resolvedRequest.mapId());
                DungeonStair stair = StairDraftResolver.resolveCommitted(
                        layout,
                        null,
                        resolvedRequest.mapId(),
                        draft);
                DungeonStairRepository.StairEditorData editorData = toEditorData(draft);
                long stairId = stairRepository.insertStair(conn, resolvedRequest.mapId(), stair, editorData);
                stairRepository.replacePathNodes(conn, stairId, stair.path());
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
                DungeonLayout layout = requireLayout(conn, resolvedRequest.mapId());
                if (layout.findStair(resolvedRequest.stairId()) == null) {
                    throw new SQLException("Treppe " + resolvedRequest.stairId() + " existiert nicht");
                }
                DungeonStair stair = StairDraftResolver.resolveCommitted(
                        layout,
                        resolvedRequest.stairId(),
                        resolvedRequest.mapId(),
                        draft);
                stairRepository.updateStair(conn, resolvedRequest.stairId(), stair, toEditorData(draft));
                stairRepository.replacePathNodes(conn, resolvedRequest.stairId(), stair.path());
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
                DungeonLayout layout = requireLayout(conn, resolvedRequest.mapId());
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
                    editorData.shape(),
                    editorData.direction(),
                    editorData.minLevelZ(),
                    editorData.maxLevelZ(),
                    editorData.dimension1(),
                    editorData.dimension2(),
                    editorData.stopLevels());
        }
    }

    private DungeonLayout requireLayout(Connection conn, long mapId) throws SQLException {
        DungeonLayout layout = layoutRepository.loadLayout(conn, mapId);
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

    private static DungeonStairRepository.StairEditorData toEditorData(StairDraft draft) {
        return new DungeonStairRepository.StairEditorData(
                draft.name(),
                draft.anchorCell(),
                draft.anchorLevelZ(),
                draft.shape(),
                draft.direction(),
                draft.minLevelZ(),
                draft.maxLevelZ(),
                draft.dimension1(),
                draft.dimension2(),
                draft.stopLevels());
    }

    public record StairDraft(
            String name,
            CellCoord anchorCell,
            int anchorLevelZ,
            StairShape shape,
            CardinalDirection direction,
            int minLevelZ,
            int maxLevelZ,
            int dimension1,
            int dimension2,
            Set<Integer> stopLevels
    ) {
        public StairDraft {
            anchorCell = Objects.requireNonNull(anchorCell, "anchorCell");
            shape = shape == null ? StairShape.LADDER : shape;
            direction = direction == null ? CardinalDirection.defaultDirection() : direction;
            stopLevels = stopLevels == null ? Set.of() : Set.copyOf(new LinkedHashSet<>(stopLevels));
            name = name == null || name.isBlank() ? null : name.trim();
        }
    }

    public record CreateStairRequest(long mapId, StairDraft draft) {
    }

    public record UpdateStairRequest(long mapId, long stairId, StairDraft draft) {
    }

    public record DeleteStairRequest(long mapId, long stairId) {
    }

    public record LoadStairEditorSpecRequest(long mapId, long stairId) {
    }

    public record LoadedStairEditorSpec(
            long stairId,
            String name,
            CellCoord anchorCell,
            int anchorLevelZ,
            StairShape shape,
            CardinalDirection direction,
            int minLevelZ,
            int maxLevelZ,
            int dimension1,
            int dimension2,
            Set<Integer> stopLevels
    ) {
        public LoadedStairEditorSpec {
            anchorCell = Objects.requireNonNull(anchorCell, "anchorCell");
            shape = shape == null ? StairShape.LADDER : shape;
            direction = direction == null ? CardinalDirection.defaultDirection() : direction;
            stopLevels = stopLevels == null ? Set.of() : Set.copyOf(new LinkedHashSet<>(stopLevels));
            name = name == null || name.isBlank() ? null : name.trim();
        }
    }
}
