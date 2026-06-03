package src.domain.dungeon.model.runtime.editor.session;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.runtime.editor.interaction.DungeonEditorMainViewEffect;

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
            case MAP_DELETED -> (mapId != null && mapId.equals(session.current().selectedMapId())
                    ? session.current().withSelectedMap(null)
                    : session.current()).clearSelection().clearTransientState("Dungeon-Map gelöscht.");
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
        session.replace(session.current().shiftProjectionLevel(projectionLevelDelta).withStatusText(""));
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

    public DungeonEditorSessionValues.@Nullable Preview applyEffect(DungeonEditorMainViewEffect effect) {
        if (effect == null) {
            return null;
        }
        if (effect.projectionLevelDelta() != 0) {
            session.replace(session.current().shiftProjectionLevel(effect.projectionLevelDelta()));
        }
        if (effect.statusText() != null) {
            session.replace(session.current().withStatusText(effect.statusText()));
        }
        if (effect.clearSelection()) {
            session.replace(session.current().clearSelection().clearPreview());
        } else if (effect.selection() != null) {
            session.replace(session.current().withSelection(effect.selection()).clearPreview());
        }
        if (effect.clearPreview()) {
            session.replace(session.current().clearPreview());
        } else if (effect.preview() != null) {
            session.replace(session.current().withPreview(effect.preview()).withStatusText(""));
        }
        return effect.applyPreview();
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
