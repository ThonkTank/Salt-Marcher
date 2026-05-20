package src.domain.dungeon.model.editor.model.session.model;

import java.util.List;
import org.jspecify.annotations.Nullable;
import src.domain.dungeon.model.editor.model.interaction.model.DungeonEditorMainViewEffect;
import src.domain.dungeon.model.editor.model.workspace.model.DungeonEditorWorkspaceValues;

public final class DungeonEditorSessionWorkflow {
    private final SessionState session = new SessionState();

    public DungeonEditorSession session() {
        return session.current();
    }

    public DungeonEditorWorkspaceValues.@Nullable MapId selectedMapId() {
        return session.current().selectedMapId();
    }

    public DungeonEditorSessionValues.Selection selection() {
        return session.current().selection();
    }

    public DungeonEditorSessionValues.Preview preview() {
        return session.current().preview();
    }

    public int projectionLevel() {
        return session.current().projectionLevel();
    }

    public DungeonEditorSessionValues.ViewMode viewMode() {
        return session.current().viewMode();
    }

    public boolean canUseGridMap(DungeonEditorWorkspaceValues.@Nullable MapSnapshot committedSnapshot) {
        return session.current().hasSelectedMap() && committedSnapshot != null && session.current().viewMode().isGrid();
    }

    public void selectMap(long mapId) {
        session.replace(session.current()
                .withSelectedMap(mapId > 0L ? new DungeonEditorWorkspaceValues.MapId(mapId) : null)
                .clearSelection()
                .clearTransientState(""));
    }

    public void mapCreated(DungeonEditorWorkspaceValues.@Nullable MapId mapId) {
        session.replace(session.current().withSelectedMap(mapId)
                .clearSelection()
                .clearTransientState("Dungeon-Map erstellt."));
    }

    public void mapRenamed(DungeonEditorWorkspaceValues.@Nullable MapId mapId) {
        session.replace(session.current().withSelectedMap(mapId).withStatusText("Dungeon-Map umbenannt."));
    }

    public void mapDeleted(DungeonEditorWorkspaceValues.@Nullable MapId mapId) {
        DungeonEditorSession currentSession = session.current();
        DungeonEditorSession nextSession = mapId != null && mapId.equals(currentSession.selectedMapId())
                ? currentSession.withSelectedMap(null)
                : currentSession;
        session.replace(nextSession.clearSelection().clearTransientState("Dungeon-Map gelöscht."));
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

    public void narrationSaved(String statusText) {
        session.replace(session.current().clearPreview().withStatusText(statusText));
    }

    public DungeonEditorSessionSnapshot.SnapshotData reconcileSnapshot(
            DungeonEditorSessionSnapshot.SnapshotData snapshot
    ) {
        session.replace(session.current().withSelectedMap(snapshot.selectedMapId())
                .withProjectionLevel(snapshot.projectionLevel()));
        return snapshot;
    }

    private static final class SessionState {
        private DungeonEditorSession current = DungeonEditorSession.empty();

        private DungeonEditorSession current() {
            return current;
        }

        private void replace(DungeonEditorSession session) {
            current = session;
        }
    }
}
