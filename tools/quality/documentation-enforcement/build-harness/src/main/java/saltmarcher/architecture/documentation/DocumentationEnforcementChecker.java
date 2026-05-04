package saltmarcher.architecture.documentation;

import saltmarcher.architecture.ArchitectureChecker;
import saltmarcher.architecture.ArchitectureContext;
import saltmarcher.architecture.ArchitectureRule;
import saltmarcher.architecture.ArchitectureRuleLoader;
import saltmarcher.architecture.ViolationSink;
import saltmarcher.architecture.documentation.domain.DomainDocumentationRules;
import saltmarcher.architecture.documentation.domain.DomainEnforcementCoverageRules;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

public final class DocumentationEnforcementChecker {

    private final ArchitectureContext context;
    private final List<String> optionalRuleClassNames;

    public DocumentationEnforcementChecker(Path repoRoot) {
        this(repoRoot, List.of());
    }

    public DocumentationEnforcementChecker(Path repoRoot, List<String> optionalRuleClassNames) {
        this.context = new ArchitectureContext(repoRoot.normalize().toAbsolutePath());
        this.optionalRuleClassNames = List.copyOf(optionalRuleClassNames);
    }

    public ArchitectureChecker.Result check() {
        ViolationSink sink = new ViolationSink();
        List<ArchitectureRule> rules = new ArrayList<>(List.of(
                new DomainDocumentationRules(),
                new DomainEnforcementCoverageRules()));
        rules.addAll(ArchitectureRuleLoader.instantiateRules(optionalRuleClassNames, "documentationEnforcementCheck"));

        for (ArchitectureRule rule : rules) {
            rule.check(context, sink);
        }

        List<ArchitectureChecker.Violation> ordered = sink.violations().stream()
                .sorted(Comparator.comparing(ArchitectureChecker.Violation::source)
                        .thenComparing(ArchitectureChecker.Violation::rule)
                        .thenComparing(ArchitectureChecker.Violation::details))
                .toList();
        return new ArchitectureChecker.Result(ordered);
    }
}
