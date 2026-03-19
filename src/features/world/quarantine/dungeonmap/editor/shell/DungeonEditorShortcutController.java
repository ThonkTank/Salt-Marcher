package features.world.quarantine.dungeonmap.editor.shell;

import javafx.beans.value.ChangeListener;
import javafx.event.EventHandler;
import javafx.scene.Node;
import javafx.scene.Scene;
import javafx.scene.control.TextInputControl;
import javafx.scene.input.KeyCode;
import javafx.scene.input.KeyEvent;
import javafx.stage.Window;

public final class DungeonEditorShortcutController {

    private final Node controls;
    private final Node workspace;
    private final Node stateContent;
    private final ToggleDeleteOverride toggleDeleteOverride;
    private final SwitchPersistentToolMode switchPersistentToolMode;
    private final EventHandler<KeyEvent> keyPressedHandler = this::handleKeyPressed;
    private final EventHandler<KeyEvent> keyReleasedHandler = this::handleKeyReleased;
    private final ChangeListener<Node> focusOwnerListener = this::handleFocusOwnerChanged;
    private final ChangeListener<Boolean> shortcutWindowFocusListener = this::handleWindowFocusChanged;
    private final ChangeListener<Window> shortcutSceneWindowListener = this::handleSceneWindowChanged;

    private Scene shortcutScene;
    private Window shortcutWindow;

    public DungeonEditorShortcutController(
            Node controls,
            Node workspace,
            Node stateContent,
            ToggleDeleteOverride toggleDeleteOverride,
            SwitchPersistentToolMode switchPersistentToolMode
    ) {
        this.controls = controls;
        this.workspace = workspace;
        this.stateContent = stateContent;
        this.toggleDeleteOverride = toggleDeleteOverride;
        this.switchPersistentToolMode = switchPersistentToolMode;
    }

    public void attach(Scene scene) {
        if (scene == null || scene == shortcutScene) {
            return;
        }
        shortcutScene = scene;
        shortcutScene.addEventFilter(KeyEvent.KEY_PRESSED, keyPressedHandler);
        shortcutScene.addEventFilter(KeyEvent.KEY_RELEASED, keyReleasedHandler);
        shortcutScene.focusOwnerProperty().addListener(focusOwnerListener);
        shortcutScene.windowProperty().addListener(shortcutSceneWindowListener);
        installShortcutWindow(scene.getWindow());
    }

    public void detach(Scene scene) {
        if (scene == null) {
            return;
        }
        scene.removeEventFilter(KeyEvent.KEY_PRESSED, keyPressedHandler);
        scene.removeEventFilter(KeyEvent.KEY_RELEASED, keyReleasedHandler);
        scene.focusOwnerProperty().removeListener(focusOwnerListener);
        scene.windowProperty().removeListener(shortcutSceneWindowListener);
        uninstallShortcutWindow(scene.getWindow());
        if (scene == shortcutScene) {
            shortcutScene = null;
        }
    }

    private void installShortcutWindow(Window window) {
        if (window == null || window == shortcutWindow) {
            return;
        }
        shortcutWindow = window;
        shortcutWindow.focusedProperty().addListener(shortcutWindowFocusListener);
    }

    private void uninstallShortcutWindow(Window window) {
        if (window == null) {
            return;
        }
        window.focusedProperty().removeListener(shortcutWindowFocusListener);
        if (window == shortcutWindow) {
            shortcutWindow = null;
        }
    }

    private void handleKeyPressed(KeyEvent event) {
        if (shouldIgnoreShortcut(event)) {
            return;
        }
        if (event.getCode() == KeyCode.CONTROL) {
            if (toggleDeleteOverride.apply(true)) {
                event.consume();
            }
            return;
        }
        if (event.isControlDown()) {
            return;
        }
        if (event.getCode() == KeyCode.E) {
            if (switchPersistentToolMode.apply(false)) {
                event.consume();
            }
            return;
        }
        if (event.getCode() == KeyCode.D && switchPersistentToolMode.apply(true)) {
            event.consume();
        }
    }

    private void handleKeyReleased(KeyEvent event) {
        if (event.getCode() == KeyCode.CONTROL && toggleDeleteOverride.apply(false)) {
            event.consume();
        }
    }

    private void handleFocusOwnerChanged(Object obs, Node previous, Node focusOwner) {
        if (!isWithinEditorView(focusOwner)) {
            toggleDeleteOverride.apply(false);
        }
    }

    private void handleWindowFocusChanged(Object obs, Boolean wasFocused, Boolean isFocused) {
        if (!Boolean.TRUE.equals(isFocused)) {
            toggleDeleteOverride.apply(false);
        }
    }

    private void handleSceneWindowChanged(Object obs, Window previousWindow, Window nextWindow) {
        uninstallShortcutWindow(previousWindow);
        installShortcutWindow(nextWindow);
    }

    private boolean shouldIgnoreShortcut(KeyEvent event) {
        if (event == null || event.getTarget() instanceof TextInputControl) {
            return true;
        }
        if (event.getTarget() instanceof Node node) {
            return !isWithinEditorView(node);
        }
        return true;
    }

    private boolean isWithinEditorView(Node node) {
        Node current = node;
        while (current != null) {
            if (current == controls || current == workspace || current == stateContent) {
                return true;
            }
            current = current.getParent();
        }
        return false;
    }

    @FunctionalInterface
    public interface ToggleDeleteOverride {
        boolean apply(boolean active);
    }

    @FunctionalInterface
    public interface SwitchPersistentToolMode {
        boolean apply(boolean deleteMode);
    }
}
