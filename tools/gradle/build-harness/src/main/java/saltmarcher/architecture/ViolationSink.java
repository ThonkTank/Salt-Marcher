package saltmarcher.architecture;

import java.util.ArrayList;
import java.util.List;

public final class ViolationSink {

    private final List<ArchitectureChecker.Violation> violations = new ArrayList<>();

    public void add(String source, String rule, String details) {
        violations.add(new ArchitectureChecker.Violation(source, rule, details));
    }

    public List<ArchitectureChecker.Violation> violations() {
        return List.copyOf(violations);
    }
}
