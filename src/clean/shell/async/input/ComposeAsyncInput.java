package clean.shell.async.input;

@SuppressWarnings("unused")
public record ComposeAsyncInput() {

    public record SubmitBackgroundInput(
            String operationName,
            java.util.concurrent.Callable<Void> work,
            Runnable onSuccess,
            java.util.function.Consumer<Throwable> onFailure,
            Runnable onCancelled
    ) {
    }

    public record ReportBackgroundFailureInput(
            String operationName,
            Throwable throwable
    ) {
    }

    public record AsyncInput(
            java.util.function.Consumer<SubmitBackgroundInput> submitBackground,
            java.util.function.Consumer<ReportBackgroundFailureInput> reportBackgroundFailure
    ) {
    }
}
