package saltmarcher.architecture;

import saltmarcher.architecture.data.DataPersistenceRules;
import saltmarcher.architecture.domain.DomainFeatureRules;
import saltmarcher.architecture.system.BuildHarnessPolicyRules;
import saltmarcher.architecture.system.SourceLayoutRules;
import java.lang.reflect.InvocationTargetException;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.ServiceLoader;
import java.util.stream.Collectors;

public final class ArchitectureChecker {

    private final ArchitectureContext context;

    public ArchitectureChecker(Path repoRoot) {
        this.context = new ArchitectureContext(repoRoot.normalize().toAbsolutePath());
    }

    public Result check() {
        ViolationSink sink = new ViolationSink();
        List<ArchitectureRule> rules = new ArrayList<>(List.of(
                new BuildHarnessPolicyRules(),
                new SourceLayoutRules(),
                new DomainFeatureRules(),
                new DataPersistenceRules()));
        addOptionalRule(rules, "saltmarcher.architecture.bootstrap.layer.BootstrapLayerTopologyRules");
        addOptionalRule(rules, "saltmarcher.architecture.data.layer.DataLayerTopologyRules");
        addOptionalRule(rules, "saltmarcher.architecture.domain.layer.DomainLayerTopologyRules");
        addOptionalRule(rules, "saltmarcher.architecture.domain.applicationservice.DomainApplicationServiceTopologyRules");
        addOptionalRule(rules, "saltmarcher.architecture.domain.published.DomainPublishedTopologyRules");
        addOptionalRule(rules, "saltmarcher.architecture.data.model.DataModelTopologyRules");
        addOptionalRule(rules, "saltmarcher.architecture.view.viewinputevent.ViewInputEventTopologyRules");
        rules.addAll(loadServiceRules());

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
            throw new IllegalStateException("Failed to instantiate architecture rule " + className + ".", exception);
        }
    }

    private static List<ArchitectureRule> loadServiceRules() {
        Map<String, ArchitectureRule> rulesByClassName = new LinkedHashMap<>();
        ServiceLoader.load(ArchitectureRule.class).forEach(rule ->
                rulesByClassName.putIfAbsent(rule.getClass().getName(), rule));
        return List.copyOf(rulesByClassName.values());
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
