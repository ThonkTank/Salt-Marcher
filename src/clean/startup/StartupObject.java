package clean.startup;

import clean.startup.input.StartApplicationInput;

/**
 * Startup owner for the clean application shell and stage presentation.
 */
@SuppressWarnings("unused")
public final class StartupObject {

    public StartApplicationInput startApplication(StartApplicationInput input) {
        return java.util.Objects.requireNonNull(input, "input");
    }
}
