package platform.diagnostics;

import java.util.Objects;
import java.util.function.Consumer;

public final class SystemLoggerDiagnostics implements Diagnostics {

    private final Consumer<String> warningSink;

    public SystemLoggerDiagnostics() {
        this(message -> System.getLogger(SystemLoggerDiagnostics.class.getName())
                .log(System.Logger.Level.WARNING, message));
    }

    SystemLoggerDiagnostics(Consumer<String> warningSink) {
        this.warningSink = Objects.requireNonNull(warningSink, "warningSink");
    }

    @Override
    public void failure(DiagnosticId id, Class<? extends Throwable> failureType) {
        warningSink.accept(Objects.requireNonNull(id, "id").value()
                + " failure="
                + Objects.requireNonNull(failureType, "failureType").getName());
    }
}
