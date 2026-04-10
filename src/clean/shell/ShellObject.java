package clean.shell;

import clean.shell.async.AsyncObject;
import clean.shell.async.input.ComposeAsyncInput;
import clean.shell.frame.FrameObject;
import clean.shell.frame.input.ComposeFrameInput;
import clean.shell.input.ComposeShellInput;
import clean.shell.inspector.InspectorObject;
import clean.shell.inspector.input.ComposeInspectorInput;
import clean.shell.navigation.NavigationObject;
import clean.shell.navigation.input.ComposeNavigationInput;
import clean.shell.scene.SceneObject;
import clean.shell.scene.input.ComposeSceneInput;

/**
 * Public clean shell root seam for shell-framework composition.
 */
@SuppressWarnings("unused")
public final class ShellObject {

    private final ComposeShellInput.ShellInput shell;

    public ShellObject(ComposeShellInput input) {
        ComposeShellInput resolvedInput = java.util.Objects.requireNonNull(input, "input");
        this.shell = new ShellAssembly(resolvedInput).composeShell();
    }

    public ComposeShellInput.ShellInput composeShell(ComposeShellInput input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        return shell;
    }

    private static final class ShellAssembly {

        private final ComposeShellInput input;

        private ShellAssembly(ComposeShellInput input) {
            this.input = input;
        }

        private ComposeShellInput.ShellInput composeShell() {
            ComposeInspectorInput composeInspectorInput = new ComposeInspectorInput();
            ComposeInspectorInput.InspectorInput inspector =
                    new InspectorObject(composeInspectorInput).composeInspector(composeInspectorInput);

            ComposeSceneInput composeSceneInput = new ComposeSceneInput();
            ComposeSceneInput.SceneInput scene =
                    new SceneObject(composeSceneInput).composeScene(composeSceneInput);

            ComposeAsyncInput composeAsyncInput = new ComposeAsyncInput();
            ComposeAsyncInput.AsyncInput async =
                    new AsyncObject(composeAsyncInput).composeAsync(composeAsyncInput);

            java.util.ArrayList<ComposeNavigationInput.SurfaceInput> navigationSurfaces = new java.util.ArrayList<>();
            for (ComposeShellInput.SurfaceInput surface : input.surfaces()) {
                if (surface == null) {
                    continue;
                }
                navigationSurfaces.add(new ComposeNavigationInput.SurfaceInput(
                        surface.surfaceId(),
                        surface.title(),
                        surface.navigationLabel(),
                        surface.toolbarContent(),
                        surface.controlsContent(),
                        surface.mainContent(),
                        surface.detailsContent(),
                        surface.stateContent(),
                        surface.onShow(),
                        surface.onHide()));
            }

            ComposeNavigationInput composeNavigationInput = new ComposeNavigationInput(
                    navigationSurfaces,
                    input.initialSurfaceId(),
                    inspector.detailsContent(),
                    scene.stateContent()
            );
            ComposeNavigationInput.NavigationInput navigation =
                    new NavigationObject(composeNavigationInput).composeNavigation(composeNavigationInput);

            ComposeFrameInput composeFrameInput = new ComposeFrameInput(
                    navigation.toolbarContent(),
                    navigation.navigationContent(),
                    navigation.controlsContent(),
                    navigation.mainContent(),
                    navigation.detailsContent(),
                    navigation.stateContent()
            );
            ComposeFrameInput.FrameInput frame =
                    new FrameObject(composeFrameInput).composeFrame(composeFrameInput);

            ComposeShellInput.ShellHooksInput hooks = new ComposeShellInput.ShellHooksInput(
                    inspector.navigator(),
                    scene.registry(),
                    async
            );
            return new ComposeShellInput.ShellInput(frame.root(), hooks);
        }
    }
}
