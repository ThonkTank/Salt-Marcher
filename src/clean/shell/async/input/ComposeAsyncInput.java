package clean.shell.async.input;

public record ComposeAsyncInput() {
    public record AsyncInput(
            java.util.function.BiConsumer<String, Throwable> reportBackgroundFailure
    ) {
    }
}
