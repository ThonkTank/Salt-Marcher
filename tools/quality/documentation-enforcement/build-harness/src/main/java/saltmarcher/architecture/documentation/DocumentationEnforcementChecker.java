package saltmarcher.architecture.documentation;

import saltmarcher.architecture.ArchitectureChecker;
import saltmarcher.architecture.ArchitectureContext;
import saltmarcher.architecture.ArchitectureRule;
import saltmarcher.architecture.ViolationSink;
import saltmarcher.architecture.documentation.domain.DomainDocumentationRules;
import saltmarcher.architecture.documentation.domain.DomainEnforcementCoverageRules;
import java.lang.reflect.InvocationTargetException;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

public final class DocumentationEnforcementChecker {

    private final ArchitectureContext context;

    public DocumentationEnforcementChecker(Path repoRoot) {
        this.context = new ArchitectureContext(repoRoot.normalize().toAbsolutePath());
    }

    public ArchitectureChecker.Result check() {
        ViolationSink sink = new ViolationSink();
        List<ArchitectureRule> rules = new ArrayList<>(List.of(
                new DomainDocumentationRules(),
                new DomainEnforcementCoverageRules()));
        addOptionalRule(rules, "saltmarcher.architecture.data.layer.DataLayerEnforcementCoverageRules");
        addOptionalRule(rules, "saltmarcher.architecture.documentation.domaincontext.DomainContextDocumentationRules");
        addOptionalRule(rules, "saltmarcher.architecture.documentation.domaincontext.DomainContextEnforcementCoverageRules");
        addOptionalRule(rules, "saltmarcher.architecture.documentation.domainaggregate.DomainAggregateEnforcementDocumentationRules");
        addOptionalRule(rules, "saltmarcher.architecture.domain.layer.DomainLayerEnforcementCoverageRules");
        addOptionalRule(rules, "saltmarcher.architecture.domain.applicationservice.DomainApplicationServiceDocumentationRules");
        addOptionalRule(rules, "saltmarcher.architecture.domain.applicationservice.DomainApplicationServiceEnforcementCoverageRules");
        addOptionalRule(rules, "saltmarcher.architecture.domain.published.DomainPublishedEnforcementCoverageRules");
        addOptionalRule(rules, "saltmarcher.architecture.documentation.dataservicecontribution.DataServiceContributionEnforcementCoverageRules");
        addOptionalRule(rules, "saltmarcher.architecture.data.persistencecore.DataPersistencecoreEnforcementCoverageRules");
        addOptionalRule(rules, "saltmarcher.architecture.data.model.DataModelEnforcementCoverageRules");
        addOptionalRule(rules, "saltmarcher.architecture.documentation.datarepository.DataRepositoryEnforcementDocumentationRules");
        addOptionalRule(rules, "saltmarcher.architecture.documentation.dataquery.DataQueryEnforcementDocumentationRules");
        addOptionalRule(rules, "saltmarcher.architecture.documentation.datamapper.DataMapperEnforcementDocumentationRules");
        addOptionalRule(rules, "saltmarcher.architecture.documentation.domainevent.DomainEventEnforcementDocumentationRules");
        addOptionalRule(rules, "saltmarcher.architecture.documentation.domainpolicy.DomainPolicyEnforcementDocumentationRules");
        addOptionalRule(rules, "saltmarcher.architecture.documentation.domainservice.DomainServiceEnforcementDocumentationRules");
        addOptionalRule(rules, "saltmarcher.architecture.documentation.domainvalue.DomainValueEnforcementDocumentationRules");
        addOptionalRule(rules, "saltmarcher.architecture.domain.usecase.DomainUseCaseEnforcementCoverageRules");

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

    private static void addOptionalRule(List<ArchitectureRule> rules, String className) {
        try {
            Class<?> ruleClass = Class.forName(className);
            Object candidate = ruleClass.getDeclaredConstructor().newInstance();
            if (candidate instanceof ArchitectureRule architectureRule) {
                rules.add(architectureRule);
                return;
            }
            throw new IllegalStateException(className + " does not implement ArchitectureRule.");
        } catch (ClassNotFoundException ignored) {
            // Focused enforcement runs intentionally omit inactive bundle sources.
        } catch (InstantiationException | IllegalAccessException | InvocationTargetException | NoSuchMethodException exception) {
            throw new IllegalStateException("Failed to instantiate documentation rule " + className + ".", exception);
        }
    }
}
