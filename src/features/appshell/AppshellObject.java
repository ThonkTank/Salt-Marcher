package features.appshell;

import features.appshell.frame.FrameObject;
import features.appshell.frame.input.ComposeFrameInput;
import features.appshell.input.ComposeShellInput;

/**
 * Public clean app-shell root seam for packaged launcher composition.
 */
@SuppressWarnings("unused")
public final class AppshellObject {

    private final ComposeShellInput.ShellInput shell;

    public AppshellObject(ComposeShellInput input) {
        ComposeShellInput resolvedInput = java.util.Objects.requireNonNull(input, "input");
        ComposeFrameInput frameInput = new ComposeFrameInput(
                resolvedInput.title(),
                resolvedInput.navigationLabel(),
                resolvedInput.controlsContent(),
                resolvedInput.mainContent(),
                resolvedInput.detailsContent(),
                resolvedInput.stateContent());
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
