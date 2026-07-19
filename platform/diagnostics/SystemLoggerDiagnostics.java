package platform.diagnostics;

import java.util.Objects;
import java.util.function.Consumer;

public final class SystemLoggerDiagnostics implements Diagnostics {

    private final Consumer<String> warningSink;
    private final Consumer<String> measurementSink;

    public SystemLoggerDiagnostics() {
        this(
                message -> System.getLogger(SystemLoggerDiagnostics.class.getName())
                        .log(System.Logger.Level.WARNING, message),
                message -> System.getLogger(SystemLoggerDiagnostics.class.getName())
                        .log(System.Logger.Level.INFO, message));
    }

    SystemLoggerDiagnostics(Consumer<String> warningSink, Consumer<String> measurementSink) {
        this.warningSink = Objects.requireNonNull(warningSink, "warningSink");
        this.measurementSink = Objects.requireNonNull(measurementSink, "measurementSink");
    }

    @Override
    public void failure(DiagnosticId id, Class<? extends Throwable> failureType) {
        warningSink.accept(Objects.requireNonNull(id, "id").value()
                + " failure="
                + Objects.requireNonNull(failureType, "failureType").getName());
    }

    @Override
    public void measurement(Measurement measurement) {
        Measurement safe = Objects.requireNonNull(measurement, "measurement");
        measurementSink.accept(safe.id().value()
                + " operation=" + safe.operationId()
                + " durationNanos=" + safe.durationNanos()
                + " cardinality=" + safe.cardinality()
                + " queryCount=" + safe.queryCount());
    }
}
