package features.world.dungeonclean.editor.input;

@SuppressWarnings("unused")
public record ComposeEditorInput(
        java.util.concurrent.Callable<StatusSnapshot> statusLoader
) {

    public record StatusSnapshot(
            long roomCount,
            long roomLevelCount,
            long roomNarrationCount,
            String errorMessage
    ) {
    }
}
