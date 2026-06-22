package src.domain.dungeon.model.runtime.editor.session;

import java.util.List;
import org.jspecify.annotations.Nullable;

public final class DungeonEditorSessionWorkflow {
    public static final String MAP_CREATED = "CREATED";
    public static final String MAP_RENAMED = "RENAMED";
    public static final String MAP_DELETED = "DELETED";

    private final DungeonEditorSessionWorkflowState session = new DungeonEditorSessionWorkflowState();

    public DungeonEditorSession session() {
        return session.current();
    }

    public void selectMap(long mapId) {
        session.replace(session.current()
                .withSelectedMap(mapId > 0L ? new DungeonEditorWorkspaceValues.MapId(mapId) : null)
                .clearSelection()
                .clearTransientState(""));
    }

    public void applyMapLifecycle(
            String event,
            DungeonEditorWorkspaceValues.@Nullable MapId mapId
    ) {
        session.replace(switch (event) {
            case MAP_CREATED -> session.current().withSelectedMap(mapId)
                    .clearSelection()
                    .clearTransientState("Dungeon-Map erstellt.");
            case MAP_RENAMED -> session.current().withSelectedMap(mapId).withStatusText("Dungeon-Map umbenannt.");
            case MAP_DELETED -> session.current().withSelectedMap(mapId)
                    .clearSelection()
                    .clearTransientState("Dungeon-Map gelöscht.");
            default -> session.current();
        });
    }

    public void setViewMode(String viewModeName) {
        session.replace(session.current().withViewMode(DungeonEditorSessionValues.ViewMode.fromName(viewModeName))
                .clearTransientState(""));
    }

    public void setTool(String toolName) {
        session.replace(session.current().withSelectedTool(DungeonEditorSessionValues.Tool.fromName(toolName))
                .clearTransientState(""));
    }

    public void shiftProjectionLevel(int projectionLevelDelta) {
        session.replace(session.current().shiftProjectionLevel(projectionLevelDelta).clearPreview().withStatusText(""));
    }

    public void setOverlay(
            String modeKey,
            int levelRange,
            double opacity,
            List<Integer> selectedLevels
    ) {
        session.replace(session.current().withOverlaySettings(new DungeonEditorSessionValues.OverlaySettings(
                modeKey,
                levelRange,
                opacity,
                selectedLevels)).withStatusText(""));
    }

    public DungeonEditorSessionValues.@Nullable Preview applyEffect(DungeonEditorSessionEffect effect) {
        if (effect == null) {
            return null;
        }
        if (effect.getProjectionLevelDelta() != 0) {
            session.replace(session.current().shiftProjectionLevel(effect.getProjectionLevelDelta()).clearPreview());
        }
        if (effect.getStatusText() != null) {
            session.replace(session.current().withStatusText(effect.getStatusText()));
        }
        if (effect.isClearSelection()) {
            session.replace(session.current().clearSelection().clearPreview());
        } else if (effect.getSelection() != null) {
            session.replace(session.current().withSelection(effect.getSelection()).clearPreview());
        }
        if (effect.isClearPreview()) {
            session.replace(session.current().clearPreview());
        } else if (effect.getPreview() != null) {
            String previewStatus = previewStatus(effect.getPreview(), effect.getStatusText());
            session.replace(session.current().withPreview(effect.getPreview()).withStatusText(previewStatus));
        }
        return effect.getApplyPreview();
    }

    private static String previewStatus(
            DungeonEditorSessionValues.Preview preview,
            @Nullable String effectStatus
    ) {
        if (effectStatus != null) {
            return effectStatus;
        }
        return preview instanceof DungeonEditorSessionValues.StairCreatePreview stair ? stair.statusText() : "";
    }

    public void clearPreviewWithStatus(String statusText) {
        session.replace(session.current().clearPreview().withStatusText(statusText));
    }

    public DungeonEditorSessionSnapshot.SnapshotData reconcileSnapshot(
            DungeonEditorSessionSnapshot.SnapshotData snapshot
    ) {
        session.replace(session.current().withSelectedMap(snapshot.selectedMapId())
                .withProjectionLevel(snapshot.projectionLevel()));
        return snapshot;
    }
}
