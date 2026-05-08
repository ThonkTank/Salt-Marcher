package saltmarcher.architecture;

import saltmarcher.architecture.data.DataPersistenceRules;
import saltmarcher.architecture.domain.DomainFeatureRules;
import saltmarcher.architecture.system.BuildHarnessPolicyRules;
import saltmarcher.architecture.system.SourceLayoutRules;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

public final class ArchitectureChecker {

    private final ArchitectureContext context;
    private final List<String> optionalRuleClassNames;
    private final boolean includeDefaultRules;

    public ArchitectureChecker(Path repoRoot) {
        this(repoRoot, List.of(), true);
    }

    public ArchitectureChecker(Path repoRoot, List<String> optionalRuleClassNames) {
        this(repoRoot, optionalRuleClassNames, true);
    }

    public ArchitectureChecker(Path repoRoot, List<String> optionalRuleClassNames, boolean includeDefaultRules) {
        this.context = new ArchitectureContext(repoRoot.normalize().toAbsolutePath());
        this.optionalRuleClassNames = List.copyOf(optionalRuleClassNames);
        this.includeDefaultRules = includeDefaultRules;
    }

    public Result check() {
        ViolationSink sink = new ViolationSink();
        List<ArchitectureRule> rules = new ArrayList<>();
        if (includeDefaultRules) {
            rules.addAll(List.of(
                    new BuildHarnessPolicyRules(),
                    new SourceLayoutRules(),
                    new DomainFeatureRules(),
                    new DataPersistenceRules()));
        }
        rules.addAll(ArchitectureRuleLoader.instantiateRules(optionalRuleClassNames, "architectureCheck"));

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
