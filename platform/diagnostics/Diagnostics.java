package platform.diagnostics;

public interface Diagnostics {

    void failure(DiagnosticId id, Class<? extends Throwable> failureType);
}
