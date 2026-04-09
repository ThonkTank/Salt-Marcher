package features.appshell;

import features.appshell.frame.FrameObject;
import features.appshell.frame.input.ComposeFrameInput;
import features.appshell.input.ComposeShellInput;
import features.appshell.navigation.NavigationObject;
import features.appshell.navigation.input.ComposeNavigationInput;

/**
 * Public clean app-shell root seam for packaged launcher composition.
 */
@SuppressWarnings("unused")
public final class AppshellObject {

    private final ComposeShellInput.ShellInput shell;

    public AppshellObject(ComposeShellInput input) {
        ComposeShellInput resolvedInput = java.util.Objects.requireNonNull(input, "input");
        java.util.ArrayList<ComposeNavigationInput.SurfaceInput> navigationSurfaces = new java.util.ArrayList<>();
        for (ComposeShellInput.SurfaceInput surface : resolvedInput.surfaces()) {
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
                resolvedInput.initialSurfaceId(),
                resolvedInput.defaultDetailsContent(),
                resolvedInput.defaultStateContent());
        ComposeNavigationInput.NavigationInput navigation =
                new NavigationObject(composeNavigationInput).composeNavigation(composeNavigationInput);
        ComposeFrameInput frameInput = new ComposeFrameInput(
                navigation.toolbarContent(),
                navigation.navigationContent(),
                navigation.controlsContent(),
                navigation.mainContent(),
                navigation.detailsContent(),
                navigation.stateContent());
        this.shell = new ComposeShellInput.ShellInput(
                new FrameObject(frameInput).composeFrame(frameInput).root());
    }

    public ComposeShellInput.ShellInput composeShell(ComposeShellInput input) {
        if (input == null) {
            throw new IllegalArgumentException("input");
        }
        return shell;
    }
}
