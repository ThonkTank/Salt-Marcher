package saltmarcher.architecture.domain.layer;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import saltmarcher.architecture.ArchitectureContext;
import saltmarcher.architecture.ArchitectureRule;
import saltmarcher.architecture.SourceFile;
import saltmarcher.architecture.ViolationSink;

public final class DomainModuleBoundaryRules implements ArchitectureRule {

    private static final Pattern DOMAIN_REFERENCE_PATTERN =
            Pattern.compile("\\bsrc\\.domain\\.([a-z][a-z0-9_]*)\\.([A-Za-z_][\\w.]*)");
    private static final Map<String, Set<String>> ALLOWED_CONTEXT_DEPENDENCIES = Map.of(
            "encounter", Set.of("creatures", "encountertable", "party"),
            "dungeoneditor", Set.of("dungeon"),
            "travel", Set.of("dungeon", "party"),
            "sessionplanner", Set.of("encounter", "party")
    );

    @Override
    public void check(ArchitectureContext context, ViolationSink violations) {
        Map<String, Set<String>> dependencyGraph = new TreeMap<>();
        Map<String, List<String>> dependencySources = new HashMap<>();
        for (SourceFile sourceFile : context.sourceFiles(violations)) {
            if (!sourceFile.isUnderDomainFeatureRoot() || sourceFile.featureName() == null) {
                continue;
            }
            String sourceFeature = sourceFile.featureName();
            dependencyGraph.computeIfAbsent(sourceFeature, ignored -> new TreeSet<>());
            for (ReferencedDomainType referencedType : referencedDomainTypes(sourceFile)) {
                if (sourceFeature.equals(referencedType.feature())) {
                    continue;
                }
                dependencyGraph
                        .computeIfAbsent(sourceFeature, ignored -> new TreeSet<>())
                        .add(referencedType.feature());
                dependencySources
                        .computeIfAbsent(sourceFeature + "->" + referencedType.feature(), ignored -> new ArrayList<>())
                        .add(sourceFile.relativePath());
                validateExplicitDependency(sourceFile, sourceFeature, referencedType, violations);
                validateApiOnlyAccess(sourceFile, referencedType, violations);
            }
        }
        validateAcyclicModules(dependencyGraph, dependencySources, violations);
    }

    private static List<ReferencedDomainType> referencedDomainTypes(SourceFile sourceFile) {
        List<ReferencedDomainType> references = new ArrayList<>();
        Matcher matcher = DOMAIN_REFERENCE_PATTERN.matcher(sourceFile.content());
        while (matcher.find()) {
            references.add(new ReferencedDomainType(
                    matcher.group(1),
                    "src.domain." + matcher.group(1) + "." + matcher.group(2)));
        }
        return references;
    }

    private static void validateExplicitDependency(
            SourceFile sourceFile,
            String sourceFeature,
            ReferencedDomainType referencedType,
            ViolationSink violations) {
        if (ALLOWED_CONTEXT_DEPENDENCIES
                .getOrDefault(sourceFeature, Set.of())
                .contains(referencedType.feature())) {
            return;
        }
        violations.add(sourceFile.relativePath(), "domain-modules-explicit-allowed-dependencies",
                "Domain context '" + sourceFeature + "' depends on context '" + referencedType.feature()
                        + "' without an explicit allowed dependency in the domain context map. "
                        + "This mirrors Spring Modulith's allowedDependencies check.");
    }

    private static void validateApiOnlyAccess(
            SourceFile sourceFile,
            ReferencedDomainType referencedType,
            ViolationSink violations) {
        String qualifiedName = referencedType.qualifiedName();
        if (qualifiedName.startsWith("src.domain." + referencedType.feature() + ".published.")) {
            return;
        }
        if (isForeignRootApplicationService(qualifiedName, referencedType.feature())) {
            return;
        }
        violations.add(sourceFile.relativePath(), "domain-modules-api-only-access",
                "Foreign domain context access must target only root *ApplicationService or published/** API types. "
                        + "Forbidden reference: " + qualifiedName + ".");
    }

    private static boolean isForeignRootApplicationService(String qualifiedName, String feature) {
        String prefix = "src.domain." + feature + ".";
        if (!qualifiedName.startsWith(prefix) || !qualifiedName.endsWith("ApplicationService")) {
            return false;
        }
        return qualifiedName.substring(prefix.length()).indexOf('.') < 0;
    }

    private static void validateAcyclicModules(
            Map<String, Set<String>> dependencyGraph,
            Map<String, List<String>> dependencySources,
            ViolationSink violations) {
        for (String feature : dependencyGraph.keySet()) {
            List<String> cycle = findCycleFrom(feature, dependencyGraph);
            if (!cycle.isEmpty()) {
                String edge = cycle.get(0) + "->" + cycle.get(1);
                String path = dependencySources
                        .getOrDefault(edge, List.of("."))
                        .stream()
                        .sorted()
                        .findFirst()
                        .orElse(".");
                violations.add(path, "domain-modules-acyclic-context-graph",
                        "Domain context dependencies must be acyclic. Cycle: "
                                + String.join(" -> ", cycle) + ".");
                return;
            }
        }
    }

    private static List<String> findCycleFrom(String start, Map<String, Set<String>> dependencyGraph) {
        ArrayDeque<String> path = new ArrayDeque<>();
        Set<String> visiting = new HashSet<>();
        return findCycle(start, start, dependencyGraph, visiting, path);
    }

    private static List<String> findCycle(
            String start,
            String current,
            Map<String, Set<String>> dependencyGraph,
            Set<String> visiting,
            ArrayDeque<String> path) {
        visiting.add(current);
        path.addLast(current);
        for (String next : dependencyGraph.getOrDefault(current, Set.of())) {
            if (start.equals(next)) {
                List<String> cycle = new ArrayList<>(path);
                cycle.add(start);
                return cycle;
            }
            if (!visiting.contains(next)) {
                List<String> cycle = findCycle(start, next, dependencyGraph, visiting, path);
                if (!cycle.isEmpty()) {
                    return cycle;
                }
            }
        }
        path.removeLast();
        visiting.remove(current);
        return List.of();
    }

    private record ReferencedDomainType(String feature, String qualifiedName) {
    }
}
