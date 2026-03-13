package features.world.dungeonmap.ui.editor.state;

import features.world.dungeonmap.ui.editor.chrome.controls.DungeonColorRenderMode;
import features.world.dungeonmap.ui.editor.chrome.controls.DungeonEditorTool;
import features.world.dungeonmap.ui.editor.chrome.controls.DungeonPaintMode;
import features.world.dungeonmap.ui.editor.chrome.controls.PassageEditorMode;
import features.world.dungeonmap.ui.editor.chrome.controls.WallEditorMode;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;

public final class DungeonEditorInteractionState {

    private final List<Consumer<DungeonEditorTool>> toolListeners = new ArrayList<>();
    private final List<Consumer<DungeonPaintMode>> paintModeListeners = new ArrayList<>();
    private final List<Consumer<DungeonColorRenderMode>> colorRenderModeListeners = new ArrayList<>();
    private final List<Consumer<WallEditorMode>> wallModeListeners = new ArrayList<>();
    private final List<Consumer<PassageEditorMode>> passageModeListeners = new ArrayList<>();

    private DungeonEditorTool activeTool = DungeonEditorTool.SELECT;
    private DungeonPaintMode paintMode = DungeonPaintMode.BRUSH;
    private DungeonColorRenderMode colorRenderMode = DungeonColorRenderMode.ROOMS;
    private WallEditorMode wallEditorMode = WallEditorMode.PAINT_WALL;
    private PassageEditorMode passageEditorMode = PassageEditorMode.PLACE_PASSAGE;

    public DungeonEditorTool activeTool() {
        return activeTool;
    }

    public void setActiveTool(DungeonEditorTool tool) {
        DungeonEditorTool effectiveTool = tool == null ? DungeonEditorTool.SELECT : tool;
        if (activeTool == effectiveTool) {
            return;
        }
        activeTool = effectiveTool;
        for (Consumer<DungeonEditorTool> listener : List.copyOf(toolListeners)) {
            listener.accept(effectiveTool);
        }
    }

    public DungeonPaintMode paintMode() {
        return paintMode;
    }

    public void setPaintMode(DungeonPaintMode mode) {
        DungeonPaintMode effectiveMode = mode == null ? DungeonPaintMode.BRUSH : mode;
        if (paintMode == effectiveMode) {
            return;
        }
        paintMode = effectiveMode;
        for (Consumer<DungeonPaintMode> listener : List.copyOf(paintModeListeners)) {
            listener.accept(effectiveMode);
        }
    }

    public DungeonColorRenderMode colorRenderMode() {
        return colorRenderMode;
    }

    public void setColorRenderMode(DungeonColorRenderMode mode) {
        DungeonColorRenderMode effectiveMode = mode == null ? DungeonColorRenderMode.ROOMS : mode;
        if (colorRenderMode == effectiveMode) {
            return;
        }
        colorRenderMode = effectiveMode;
        for (Consumer<DungeonColorRenderMode> listener : List.copyOf(colorRenderModeListeners)) {
            listener.accept(effectiveMode);
        }
    }

    public WallEditorMode wallEditorMode() {
        return wallEditorMode;
    }

    public void setWallEditorMode(WallEditorMode mode) {
        WallEditorMode effectiveMode = mode == null ? WallEditorMode.PAINT_WALL : mode;
        if (wallEditorMode == effectiveMode) {
            return;
        }
        wallEditorMode = effectiveMode;
        for (Consumer<WallEditorMode> listener : List.copyOf(wallModeListeners)) {
            listener.accept(effectiveMode);
        }
    }

    public PassageEditorMode passageEditorMode() {
        return passageEditorMode;
    }

    public void setPassageEditorMode(PassageEditorMode mode) {
        PassageEditorMode effectiveMode = mode == null ? PassageEditorMode.PLACE_PASSAGE : mode;
        if (passageEditorMode == effectiveMode) {
            return;
        }
        passageEditorMode = effectiveMode;
        for (Consumer<PassageEditorMode> listener : List.copyOf(passageModeListeners)) {
            listener.accept(effectiveMode);
        }
    }

    public void onActiveToolChanged(Consumer<DungeonEditorTool> listener) {
        if (listener != null) {
            toolListeners.add(listener);
        }
    }

    public void onPaintModeChanged(Consumer<DungeonPaintMode> listener) {
        if (listener != null) {
            paintModeListeners.add(listener);
        }
    }

    public void onColorRenderModeChanged(Consumer<DungeonColorRenderMode> listener) {
        if (listener != null) {
            colorRenderModeListeners.add(listener);
        }
    }

    public void onWallEditorModeChanged(Consumer<WallEditorMode> listener) {
        if (listener != null) {
            wallModeListeners.add(listener);
        }
    }

    public void onPassageEditorModeChanged(Consumer<PassageEditorMode> listener) {
        if (listener != null) {
            passageModeListeners.add(listener);
        }
    }
}
