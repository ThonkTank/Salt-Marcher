package features.world.dungeonmap.application.stair;

import database.DatabaseManager;
import features.world.dungeonmap.application.support.DungeonTransactionRunner;
import features.world.dungeonmap.model.DungeonLayout;
import features.world.dungeonmap.model.geometry.CardinalDirection;
import features.world.dungeonmap.model.geometry.CellCoord;
import features.world.dungeonmap.model.structures.room.Room;
import features.world.dungeonmap.model.structures.stair.DungeonStair;
import features.world.dungeonmap.model.structures.stair.StairPathGenerator;
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
        StairDraft draft = requireDraft(resolvedRequest.draft());
        try (Connection conn = DatabaseManager.getConnection()) {
            return DungeonTransactionRunner.inTransaction(conn, () -> {
                DungeonLayout layout = requireLayout(conn, resolvedRequest.mapId());
                validateAnchor(layout, draft.anchorCell(), draft.anchorLevelZ());
                DungeonStair stair = buildStair(null, resolvedRequest.mapId(), draft);
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
        StairDraft draft = requireDraft(resolvedRequest.draft());
        try (Connection conn = DatabaseManager.getConnection()) {
            DungeonTransactionRunner.inTransaction(conn, () -> {
                DungeonLayout layout = requireLayout(conn, resolvedRequest.mapId());
                if (layout.findStair(resolvedRequest.stairId()) == null) {
                    throw new SQLException("Treppe " + resolvedRequest.stairId() + " existiert nicht");
                }
                validateAnchor(layout, draft.anchorCell(), draft.anchorLevelZ());
                DungeonStair stair = buildStair(resolvedRequest.stairId(), resolvedRequest.mapId(), draft);
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

    private static StairDraft requireDraft(StairDraft draft) {
        StairDraft resolvedDraft = Objects.requireNonNull(draft, "draft");
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
        if (resolvedDraft.stopLevels().size() < 2) {
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
        return resolvedDraft;
    }

    private static void validateAnchor(DungeonLayout layout, CellCoord anchorCell, int anchorLevelZ) throws SQLException {
        Room room = layout == null ? null : layout.roomAtCell(anchorCell, anchorLevelZ);
        if (room == null) {
            throw new SQLException("Treppenstart muss auf einem Raum-Floor liegen");
        }
    }

    private static DungeonStair buildStair(Long stairId, long mapId, StairDraft draft) {
        return DungeonStair.resolved(
                stairId,
                mapId,
                draft.name(),
                StairPathGenerator.generateAnchoredPath(
                        draft.shape(),
                        draft.anchorCell(),
                        draft.anchorLevelZ(),
                        draft.direction(),
                        draft.minLevelZ(),
                        draft.maxLevelZ(),
                        draft.dimension1(),
                        draft.dimension2()),
                draft.stopLevels());
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
