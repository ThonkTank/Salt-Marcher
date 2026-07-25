package platform.execution;

import java.util.List;
import java.util.Objects;

/** Releases owned handles once each while retaining every handle whose release failed. */
public final class RetryableRelease {

    private RetryableRelease() {
    }

    public static void releaseAll(List<Runnable> releases) {
        List<Runnable> retained = Objects.requireNonNull(releases, "releases");
        Throwable failure = null;
        for (int index = 0; index < retained.size();) {
            Runnable release = retained.get(index);
            try {
                release.run();
                retained.remove(index);
            } catch (RuntimeException | Error releaseFailure) {
                failure = accumulate(failure, releaseFailure);
                index++;
            }
        }
        rethrow(failure);
    }

    private static Throwable accumulate(Throwable current, Throwable next) {
        if (current == null) {
            return next;
        }
        current.addSuppressed(next);
        return current;
    }

    private static void rethrow(Throwable failure) {
        if (failure instanceof RuntimeException runtimeFailure) {
            throw runtimeFailure;
        }
        if (failure instanceof Error error) {
            throw error;
        }
    }
}
