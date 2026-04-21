package saltmarcher.architecture;

import java.nio.file.Path;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

public final class ArchitectureChecker {

    private final ArchitectureContext context;

    public ArchitectureChecker(Path repoRoot) {
        this.context = new ArchitectureContext(repoRoot.normalize().toAbsolutePath());
    }

    public Result check() {
        ViolationSink sink = new ViolationSink();
        List<ArchitectureRule> rules = List.of(
                new BuildHarnessPolicyRules(),
                new RepositoryTopologyRules(),
                new SourceLayoutRules(),
                new ViewFeatureRules(),
                new DomainFeatureRules(),
                new ShellSurfaceRules(),
                new DataPersistenceRules(),
                new DataEnforcementCoverageRules());

        for (ArchitectureRule rule : rules) {
            rule.check(context, sink);
        }

        List<Violation> ordered = sink.violations().stream()
                .sorted(Comparator.comparing(Violation::source)
                        .thenComparing(Violation::rule)
                        .thenComparing(Violation::details))
                .toList();
        return new Result(ordered);
    }

    public record Result(List<Violation> violations) {
        public boolean isSuccess() {
            return violations.isEmpty();
        }

        public String render() {
            if (violations.isEmpty()) {
                return "Architecture checks passed.";
            }
            String body = violations.stream()
                    .map(violation -> "- [" + violation.rule() + "] " + violation.source() + ": " + violation.details())
                    .collect(Collectors.joining(System.lineSeparator()));
            return "Architecture check failed with " + violations.size() + " violation(s):"
                    + System.lineSeparator() + body;
        }
    }

    public record Violation(String source, String rule, String details) {
    }
}
