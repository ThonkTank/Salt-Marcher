package features.world.dungeonmap.shell.editor.interaction;

import features.world.dungeonmap.shell.editor.DungeonEditorTool;
import javafx.scene.Node;

import java.util.Set;

public sealed interface EditorTool
        permits SelectionTool, PaintTool, BoundaryTool,
                CorridorTool, StairTool, TransitionTool {

    Set<DungeonEditorTool> supportedTools();

    void activate(DungeonEditorTool tool);

    void deactivate();

    boolean pressed(EditorToolContext ctx);

    boolean dragged(EditorToolContext ctx);

    boolean released(EditorToolContext ctx);

    default boolean levelScrolled(EditorToolContext ctx, int delta) {
        return false;
    }

    Node statePaneContent();

    void setRefreshCallback(Runnable callback);
}

final class SelectionTool implements EditorTool {

    @Override
    public Set<DungeonEditorTool> supportedTools() {
        return Set.of();
    }

    @Override
    public void activate(DungeonEditorTool tool) {
    }

    @Override
    public void deactivate() {
    }

    @Override
    public boolean pressed(EditorToolContext ctx) {
        return false;
    }

    @Override
    public boolean dragged(EditorToolContext ctx) {
        return false;
    }

    @Override
    public boolean released(EditorToolContext ctx) {
        return false;
    }

    @Override
    public Node statePaneContent() {
        return null;
    }

    @Override
    public void setRefreshCallback(Runnable callback) {
    }
}

final class PaintTool implements EditorTool {

    @Override
    public Set<DungeonEditorTool> supportedTools() {
        return Set.of();
    }

    @Override
    public void activate(DungeonEditorTool tool) {
    }

    @Override
    public void deactivate() {
    }

    @Override
    public boolean pressed(EditorToolContext ctx) {
        return false;
    }

    @Override
    public boolean dragged(EditorToolContext ctx) {
        return false;
    }

    @Override
    public boolean released(EditorToolContext ctx) {
        return false;
    }

    @Override
    public Node statePaneContent() {
        return null;
    }

    @Override
    public void setRefreshCallback(Runnable callback) {
    }
}

final class BoundaryTool implements EditorTool {

    @Override
    public Set<DungeonEditorTool> supportedTools() {
        return Set.of();
    }

    @Override
    public void activate(DungeonEditorTool tool) {
    }

    @Override
    public void deactivate() {
    }

    @Override
    public boolean pressed(EditorToolContext ctx) {
        return false;
    }

    @Override
    public boolean dragged(EditorToolContext ctx) {
        return false;
    }

    @Override
    public boolean released(EditorToolContext ctx) {
        return false;
    }

    @Override
    public Node statePaneContent() {
        return null;
    }

    @Override
    public void setRefreshCallback(Runnable callback) {
    }
}

final class CorridorTool implements EditorTool {

    @Override
    public Set<DungeonEditorTool> supportedTools() {
        return Set.of();
    }

    @Override
    public void activate(DungeonEditorTool tool) {
    }

    @Override
    public void deactivate() {
    }

    @Override
    public boolean pressed(EditorToolContext ctx) {
        return false;
    }

    @Override
    public boolean dragged(EditorToolContext ctx) {
        return false;
    }

    @Override
    public boolean released(EditorToolContext ctx) {
        return false;
    }

    @Override
    public Node statePaneContent() {
        return null;
    }

    @Override
    public void setRefreshCallback(Runnable callback) {
    }
}

final class StairTool implements EditorTool {

    @Override
    public Set<DungeonEditorTool> supportedTools() {
        return Set.of();
    }

    @Override
    public void activate(DungeonEditorTool tool) {
    }

    @Override
    public void deactivate() {
    }

    @Override
    public boolean pressed(EditorToolContext ctx) {
        return false;
    }

    @Override
    public boolean dragged(EditorToolContext ctx) {
        return false;
    }

    @Override
    public boolean released(EditorToolContext ctx) {
        return false;
    }

    @Override
    public Node statePaneContent() {
        return null;
    }

    @Override
    public void setRefreshCallback(Runnable callback) {
    }
}

final class TransitionTool implements EditorTool {

    @Override
    public Set<DungeonEditorTool> supportedTools() {
        return Set.of();
    }

    @Override
    public void activate(DungeonEditorTool tool) {
    }

    @Override
    public void deactivate() {
    }

    @Override
    public boolean pressed(EditorToolContext ctx) {
        return false;
    }

    @Override
    public boolean dragged(EditorToolContext ctx) {
        return false;
    }

    @Override
    public boolean released(EditorToolContext ctx) {
        return false;
    }

    @Override
    public Node statePaneContent() {
        return null;
    }

    @Override
    public void setRefreshCallback(Runnable callback) {
    }
}
