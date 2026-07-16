package platform.diagnostics;

public enum NoopDiagnostics implements Diagnostics {
    INSTANCE;

    @Override
    public void failure(DiagnosticId id, Class<? extends Throwable> failureType) {
    }
}
