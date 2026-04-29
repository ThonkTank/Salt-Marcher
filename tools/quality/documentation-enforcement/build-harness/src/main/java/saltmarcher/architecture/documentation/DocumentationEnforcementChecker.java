package saltmarcher.architecture.documentation;

import saltmarcher.architecture.ArchitectureChecker;
import saltmarcher.architecture.ArchitectureContext;
import saltmarcher.architecture.ArchitectureRule;
import saltmarcher.architecture.ViolationSink;
import saltmarcher.architecture.documentation.data.DataEnforcementCoverageRules;
import saltmarcher.architecture.documentation.domain.DomainDocumentationRules;
import saltmarcher.architecture.documentation.domain.DomainEnforcementCoverageRules;
import java.nio.file.Path;
import java.util.Comparator;
import java.util.List;

public final class DocumentationEnforcementChecker {

    private final ArchitectureContext context;

    public DocumentationEnforcementChecker(Path repoRoot) {
        this.context = new ArchitectureContext(repoRoot.normalize().toAbsolutePath());
    }

    public ArchitectureChecker.Result check() {
        ViolationSink sink = new ViolationSink();
        List<ArchitectureRule> rules = List.of(
                new DomainDocumentationRules(),
                new DomainEnforcementCoverageRules(),
                new DataEnforcementCoverageRules());

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
