package saltmarcher.architecture;

import static saltmarcher.architecture.ArchitectureNaming.expectedDomainRootFileName;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.TreeMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.stream.Stream;

final class DomainFeatureRules implements ArchitectureRule {

    private static final String DOMAIN_COVERAGE_PATH =
            "docs/standards/architecture-enforcement-coverage-domain.md";
    private static final Pattern MARKDOWN_HEADING_PATTERN =
            Pattern.compile("(?m)^##\\s+.+$");
    private static final Pattern CONTEXT_BULLET_PATTERN =
            Pattern.compile("(?m)^\\s*-\\s+`([^`]+)`\\s*:\\s*(.+)$");
    private static final Pattern DOMAIN_CONTEXT_NAME_MARKER_PATTERN =
            Pattern.compile("(?m)^\\s*Context Name:\\s+([A-Z][A-Za-z0-9_]*)\\s*$");
    private static final Pattern DOMAIN_CONTEXT_ROLE_MARKER_PATTERN =
            Pattern.compile("(?m)^\\s*Context Role:\\s+(.+?)\\s*$");
    private static final Pattern AGGREGATE_ROOT_MARKER_PATTERN =
            Pattern.compile("(?m)^\\s*Aggregate Root:\\s+([A-Z][A-Za-z0-9_]*)\\s*$");
    private static final Pattern WRITE_MODEL_NONE_PATTERN =
            Pattern.compile("(?m)^\\s*Write Model:\\s+None\\s*$");
    private static final Set<String> DOMAIN_CONTEXT_ROLES =
            Set.of(
                    "Roster Truth Context",
                    "Reference Catalog Context",
                    "Generation Policy Context",
                    "Authored World-Space Context");
    private static final Set<String> AUTHORED_CONTEXT_ROLES =
            Set.of("Roster Truth Context", "Authored World-Space Context");
    private static final List<String> REQUIRED_ENFORCED_DOMAIN_RULES = List.of(
            "domain-root-presence",
            "domain-context-name-declared",
            "domain-root-class-shape",
            "domain-root-public-api-carriers",
            "domain-root-no-nested-contracts",
            "domain-root-constructor-composition",
            "domain-service-registry-root-only",
            "domain-published-direct-files",
            "domain-published-carrier-shape",
            "domain-published-no-callable-contracts",
            "domain-application-direct-usecases",
            "domain-application-no-generic-usecase-names",
            "domain-application-no-backend-port-contracts",
            "domain-application-no-same-context-published",
            "domain-module-role-required",
            "domain-module-name-shape",
            "domain-role-direct-files",
            "domain-role-package-name",
            "domain-forbidden-top-level-bucket",
            "domain-mapcore-removed",
            "domain-context-roles-complete",
            "domain-context-relationships-complete",
            "domain-context-document-presence",
            "domain-context-shape-declared",
            "domain-context-required-sections",
            "domain-role-context-required-sections",
            "domain-authored-context-write-model-required",
            "domain-aggregate-marker-shape",
            "domain-generation-policy-required-sections",
            "domain-generation-policy-write-model-none",
            "domain-generation-policy-ephemeral-rationale",
            "domain-forbidden-infrastructure-dependency",
            "domain-source-no-infrastructure-token-source-pattern",
            "domain-root-no-infrastructure-construction-source-pattern",
            "domain-application-no-policy-helper-prefix-source-pattern",
            "domain-named-module-no-setter-mutation-source-pattern",
            "domain-outer-layer-independence",
            "domain-foreign-feature-public-boundary",
            "domain-named-module-private-context",
            "domain-named-module-no-same-context-application",
            "domain-model-roles-no-outbound-ports",
            "domain-named-module-no-published-carriers",
            "domain-port-boundary",
            "domain-public-boundary-signature-purity",
            "domain-published-no-foreign-signatures",
            "domain-role-shape",
            "domain-field-purity",
            "domain-public-concrete-type-shape",
            "domain-service-factory-statelessness",
            "domain-feature-cycles",
            "domain-module-cycles",
            "domain-enforcement-coverage-complete");
    private static final List<String> REQUIRED_DOMAIN_RULE_GROUPS = List.of(
            "domain-hexagonal-core-boundary",
            "domain-application-service-root-boundary",
            "domain-application-usecase-orchestration",
            "domain-application-thinness-and-policy-placement",
            "domain-root-translation-boundary",
            "domain-published-language-carriers",
            "domain-published-language-vocabulary",
            "domain-port-ownership-and-signatures",
            "domain-port-domain-language",
            "domain-repository-port-write-orientation",
            "domain-technical-bucket-rejection",
            "domain-technical-vocabulary-rejection",
            "domain-context-root-layout",
            "domain-named-module-layout",
            "domain-tactical-role-optionality",
            "domain-role-type-shapes",
            "domain-value-shallow-shape",
            "domain-value-immutability",
            "domain-service-factory-policy-statelessness",
            "domain-service-behavior",
            "domain-context-document-markers",
            "domain-authored-truth-document-contract",
            "domain-generation-policy-document-contract",
            "domain-context-roles-standard-coverage",
            "domain-context-relationships-public-boundary",
            "domain-context-relationship-prose-accuracy",
            "domain-foreign-service-documentation",
            "domain-outer-layer-independence-group",
            "domain-foreign-context-private-isolation",
            "domain-business-policy-not-in-view-data",
            "domain-application-no-published-to-model",
            "domain-mapcore-removed-rule",
            "domain-enforcement-coverage-inventory");
    private static final List<String> BASE_CONTEXT_REQUIRED_SECTIONS = List.of(
            "## Context Role",
            "## Published Language",
            "## Application Boundary",
            "## Ubiquitous Language");
    private static final List<String> AUTHORED_CONTEXT_REQUIRED_SECTIONS = List.of(
            "## Aggregate Model",
            "## Commands And Invariants",
            "## Consistency Model");
    private static final List<String> GENERATION_POLICY_REQUIRED_SECTIONS = List.of(
            "## Commands And Invariants",
            "## Consistency Model");

    @Override
    public void check(ArchitectureContext context, ViolationSink violations) {
        List<SourceFile> sourceFiles = context.sourceFiles(violations);
        Set<String> domainFeatures = context.domainFeatures(violations);

        validateDomainFeatureBoundaries(context, domainFeatures, sourceFiles, violations);
        validateMapcoreRemoved(context, violations);
        validateDomainFeatureDirectories(context, violations);
        validateDomainContextRoles(context, domainFeatures, violations);
        validateDomainContextRelationships(context, domainFeatures, violations);
        validateDomainContextDocuments(context, domainFeatures, violations);
        validateDomainCoverageDocument(context, violations);
    }

    private void validateDomainFeatureBoundaries(
            ArchitectureContext context,
            Set<String> domainFeatures,
            List<SourceFile> sourceFiles,
            ViolationSink violations) {
        TreeMap<String, List<SourceFile>> rootsByFeature = new TreeMap<>();
        for (SourceFile sourceFile : sourceFiles) {
            if (sourceFile.kind() == SourceKind.DOMAIN_ROOT) {
                rootsByFeature.computeIfAbsent(sourceFile.featureName(), ignored -> new ArrayList<>()).add(sourceFile);
            }
        }

        for (String featureName : domainFeatures) {
            List<SourceFile> roots = rootsByFeature.getOrDefault(featureName, List.of()).stream()
                    .sorted(Comparator.comparing(SourceFile::relativePath))
                    .toList();
            if (roots.size() == 1) {
                continue;
            }
            String files = roots.isEmpty()
                    ? "none found"
                    : roots.stream().map(SourceFile::relativePath).collect(Collectors.joining(", "));
            violations.add("src/domain/" + featureName, "domain-root-presence",
                    "Domain feature '" + featureName + "' must expose exactly one root application service."
                            + " Expected " + expectedDomainRootFileName(featureName, context.domainContextName(featureName)) + ". Found: " + files);
        }
    }

    private void validateMapcoreRemoved(ArchitectureContext context, ViolationSink violations) {
        Path mapcoreRoot = context.repoRoot().resolve("src/domain/mapcore");
        if (context.hasRepositoryContent(mapcoreRoot)) {
            violations.add("src/domain/mapcore", "domain-mapcore-removed",
                    "src/domain/mapcore is forbidden. Map/world facts belong to dungeon published language and render display models belong to the view layer.");
        }
    }

    private void validateDomainFeatureDirectories(ArchitectureContext context, ViolationSink violations) {
        Path domainRoot = context.repoRoot().resolve("src/domain");
        if (!Files.isDirectory(domainRoot)) {
            return;
        }
        try (Stream<Path> stream = Files.list(domainRoot)) {
            stream.filter(Files::isDirectory)
                    .sorted()
                    .forEach(featureRoot -> validateDomainFeatureDirectory(context, featureRoot, violations));
        } catch (IOException exception) {
            violations.add(context.relativize(domainRoot), "scan-root",
                    "Could not scan domain feature root: " + exception.getMessage());
        }
    }

    private void validateDomainFeatureDirectory(
            ArchitectureContext context,
            Path featureRoot,
            ViolationSink violations) {
        try (Stream<Path> stream = Files.list(featureRoot)) {
            stream.filter(Files::isDirectory)
                    .sorted()
                    .forEach(directory -> {
                        String bucket = directory.getFileName().toString();
                        SourceLayoutRules.validateDomainBucket(context.relativize(directory), bucket, violations);
                    });
        } catch (IOException exception) {
            violations.add(context.relativize(featureRoot), "scan-root",
                    "Could not scan domain feature directory: " + exception.getMessage());
        }
    }

    private void validateDomainContextRelationships(
            ArchitectureContext context,
            Set<String> domainFeatures,
            ViolationSink violations) {
        Path contextMapDocument = context.repoRoot().resolve("docs/standards/domain-layer.md");
        String contextMapPath = "docs/standards/domain-layer.md";
        if (!Files.isRegularFile(contextMapDocument)) {
            violations.add(contextMapPath, "domain-context-relationships-complete",
                    "Domain layer standard must define a '## Context Relationships' section covering every domain context.");
            return;
        }

        String content;
        try {
            content = Files.readString(contextMapDocument, StandardCharsets.UTF_8);
        } catch (IOException exception) {
            violations.add(contextMapPath, "file-readable",
                    "Could not read domain layer standard: " + exception.getMessage());
            return;
        }

        String section = sectionBody(content, "## Context Relationships");
        if (section.trim().isBlank()) {
            violations.add(contextMapPath, "domain-context-relationships-complete",
                    "Domain layer standard must include a non-empty '## Context Relationships' section.");
            return;
        }
        TreeMap<String, List<String>> declaredBullets = contextBullets(section);
        validateNoStaleContextBullets(
                contextMapPath,
                "domain-context-relationships-no-stale-contexts",
                declaredBullets.keySet(),
                domainFeatures,
                violations);

        for (String featureName : domainFeatures) {
            List<String> bullets = declaredBullets.getOrDefault(featureName, List.of());
            if (bullets.isEmpty()) {
                violations.add(contextMapPath, "domain-context-relationships-complete",
                        "Context relationships must include a bullet for src/domain/" + featureName
                                + " using '- `" + featureName + "`: ...'.");
                continue;
            }
            if (bullets.size() > 1) {
                violations.add(contextMapPath, "domain-context-relationships-complete",
                        "Context relationships must include exactly one bullet for src/domain/" + featureName + ".");
                continue;
            }
            String declaredContextRole = declaredDomainContextRole(context, featureName);
            if (declaredContextRole != null && !bullets.getFirst().contains(declaredContextRole)) {
                violations.add(contextMapPath, "domain-context-relationships-role-matches",
                        "Context relationship bullet for src/domain/" + featureName
                                + " must include its declared context role '" + declaredContextRole + "'.");
            }
        }
    }

    private void validateDomainContextRoles(
            ArchitectureContext context,
            Set<String> domainFeatures,
            ViolationSink violations) {
        Path contextMapDocument = context.repoRoot().resolve("docs/standards/domain-layer.md");
        String contextMapPath = "docs/standards/domain-layer.md";
        if (!Files.isRegularFile(contextMapDocument)) {
            violations.add(contextMapPath, "domain-context-roles-complete",
                    "Domain layer standard must define a '## Context Roles' section covering every domain context.");
            return;
        }

        String content;
        try {
            content = Files.readString(contextMapDocument, StandardCharsets.UTF_8);
        } catch (IOException exception) {
            violations.add(contextMapPath, "file-readable",
                    "Could not read domain layer standard: " + exception.getMessage());
            return;
        }

        String section = sectionBody(content, "## Context Roles");
        if (section.trim().isBlank()) {
            violations.add(contextMapPath, "domain-context-roles-complete",
                    "Domain layer standard must include a non-empty '## Context Roles' section.");
            return;
        }
        TreeMap<String, List<String>> declaredBullets = contextBullets(section);
        validateNoStaleContextBullets(
                contextMapPath,
                "domain-context-roles-no-stale-contexts",
                declaredBullets.keySet(),
                domainFeatures,
                violations);

        for (String featureName : domainFeatures) {
            List<String> bullets = declaredBullets.getOrDefault(featureName, List.of());
            if (bullets.isEmpty()) {
                violations.add(contextMapPath, "domain-context-roles-complete",
                        "Context roles must include a bullet for src/domain/" + featureName
                                + " using '- `" + featureName + "`: <role>'.");
                continue;
            }
            if (bullets.size() > 1) {
                violations.add(contextMapPath, "domain-context-roles-complete",
                        "Context roles must include exactly one bullet for src/domain/" + featureName + ".");
                continue;
            }
            String declaredContextRole = declaredDomainContextRole(context, featureName);
            if (declaredContextRole != null && !bullets.getFirst().contains(declaredContextRole)) {
                violations.add(contextMapPath, "domain-context-roles-role-matches",
                        "Context role bullet for src/domain/" + featureName
                                + " must include its declared context role '" + declaredContextRole + "'.");
            }
        }
    }

    private String declaredDomainContextRole(ArchitectureContext context, String featureName) {
        Path document = context.repoRoot().resolve("src/domain").resolve(featureName).resolve("DOMAIN.md");
        if (!Files.isRegularFile(document)) {
            return null;
        }
        try {
            List<String> declaredRoles = declaredDomainContextRoles(Files.readString(document, StandardCharsets.UTF_8));
            return declaredRoles.size() == 1 ? declaredRoles.getFirst() : null;
        } catch (IOException ignored) {
            return null;
        }
    }

    private void validateDomainContextDocuments(
            ArchitectureContext context,
            Set<String> domainFeatures,
            ViolationSink violations) {
        for (String featureName : domainFeatures) {
            Path document = context.repoRoot().resolve("src/domain").resolve(featureName).resolve("DOMAIN.md");
            String documentPath = "src/domain/" + featureName + "/DOMAIN.md";
            if (!Files.isRegularFile(document)) {
                violations.add(documentPath, "domain-context-document-presence",
                        "Every domain feature must declare its context type in DOMAIN.md.");
                continue;
            }

            String content;
            try {
                content = Files.readString(document, StandardCharsets.UTF_8);
            } catch (IOException exception) {
                violations.add(documentPath, "file-readable",
                        "Could not read domain context document: " + exception.getMessage());
                continue;
            }

            List<String> declaredNames = declaredDomainContextNames(content);
            if (declaredNames.size() != 1) {
                violations.add(documentPath, "domain-context-name-declared",
                        "DOMAIN.md must contain exactly one context name marker: 'Context Name: <PascalContext>'.");
            }

            List<String> declaredRoles = declaredDomainContextRoles(content);
            if (declaredRoles.size() != 1) {
                violations.add(documentPath, "domain-context-shape-declared",
                        "DOMAIN.md must contain exactly one context marker: 'Context Role: <role>'. Allowed roles: "
                                + String.join(", ", DOMAIN_CONTEXT_ROLES) + ".");
                continue;
            }

            String role = declaredRoles.getFirst();
            if (!DOMAIN_CONTEXT_ROLES.contains(role)) {
                violations.add(documentPath, "domain-context-shape-declared",
                        "DOMAIN.md declares unsupported context role '" + role
                                + "'. Allowed roles: " + String.join(", ", DOMAIN_CONTEXT_ROLES) + ".");
                continue;
            }
            validateBaseContextDocument(documentPath, content, violations);
            if (AUTHORED_CONTEXT_ROLES.contains(role)) {
                validateAggregateOwningContextDocument(context, featureName, documentPath, content, violations);
            }
            if ("Generation Policy Context".equals(role)) {
                validateGenerationPolicyContextDocument(documentPath, content, violations);
            }
        }
    }

    private void validateDomainCoverageDocument(ArchitectureContext context, ViolationSink violations) {
        Path coverageDocument = context.repoRoot().resolve(DOMAIN_COVERAGE_PATH);
        if (!Files.isRegularFile(coverageDocument)) {
            violations.add(DOMAIN_COVERAGE_PATH, "domain-enforcement-coverage-complete",
                    "Domain enforcement coverage must document every required enforced domain rule and rule group.");
            return;
        }

        String content;
        try {
            content = Files.readString(coverageDocument, StandardCharsets.UTF_8);
        } catch (IOException exception) {
            violations.add(DOMAIN_COVERAGE_PATH, "file-readable",
                    "Could not read domain enforcement coverage: " + exception.getMessage());
            return;
        }

        validateRequiredEnforcedDomainRules(content, violations);
        validateRequiredDomainRuleGroups(content, violations);
    }

    private static void validateRequiredEnforcedDomainRules(String content, ViolationSink violations) {
        for (String ruleId : REQUIRED_ENFORCED_DOMAIN_RULES) {
            String line = lineContainingMechanicalOwner(content, "`" + ruleId + "`");
            if (line == null) {
                violations.add(DOMAIN_COVERAGE_PATH, "domain-enforcement-coverage-complete",
                        "Domain enforcement coverage row for `" + ruleId
                                + "` must name a mechanical owner and blocking Gradle entrypoint.");
            }
        }
    }

    private static void validateRequiredDomainRuleGroups(String content, ViolationSink violations) {
        for (String ruleGroupId : REQUIRED_DOMAIN_RULE_GROUPS) {
            String line = lineContainingRuleGroupStatus(content, "`" + ruleGroupId + "`");
            if (line == null) {
                violations.add(DOMAIN_COVERAGE_PATH, "domain-enforcement-coverage-complete",
                        "Domain enforcement coverage must classify domain-layer rule group `"
                                + ruleGroupId + "` as Enforced, Source-Pattern Enforced, Candidate, or Review-Owned.");
                continue;
            }
            if (!lineContainsRuleGroupStatus(line)) {
                violations.add(DOMAIN_COVERAGE_PATH, "domain-enforcement-coverage-complete",
                        "Coverage row for domain-layer rule group `" + ruleGroupId
                                + "` must use status Enforced, Source-Pattern Enforced, Candidate, or Review-Owned.");
            }
        }
    }

    private void validateBaseContextDocument(
            String documentPath,
            String content,
            ViolationSink violations) {
        for (String heading : BASE_CONTEXT_REQUIRED_SECTIONS) {
            if (!hasNonEmptySection(content, heading)) {
                violations.add(documentPath, "domain-context-required-sections",
                        "Every DOMAIN.md must include a non-empty '" + heading + "' section.");
            }
        }
    }

    private void validateAggregateOwningContextDocument(
            ArchitectureContext context,
            String featureName,
            String documentPath,
            String content,
            ViolationSink violations) {
        for (String heading : AUTHORED_CONTEXT_REQUIRED_SECTIONS) {
            if (!hasNonEmptySection(content, heading)) {
                violations.add(documentPath, "domain-role-context-required-sections",
                        "Aggregate-owning domain roles must include a non-empty '" + heading + "' section.");
            }
        }

        List<String> aggregateRoots = aggregateRootMarkers(content);
        boolean writeModelNone = WRITE_MODEL_NONE_PATTERN.matcher(content).find();
        if (writeModelNone) {
            violations.add(documentPath, "domain-authored-context-write-model-required",
                    "Aggregate-owning domain roles must own authored truth and must not declare 'Write Model: None'.");
        }
        if (aggregateRoots.isEmpty()) {
            violations.add(documentPath, "domain-aggregate-marker-shape",
                    "Aggregate-owning domain roles must declare 'Aggregate Root: <TypeName>' for an existing module role type.");
            return;
        }

        for (String aggregateRoot : aggregateRoots) {
            if (!context.domainNamedModuleTypeExists(featureName, aggregateRoot)) {
                violations.add(documentPath, "domain-aggregate-marker-shape",
                        "Declared aggregate root '" + aggregateRoot
                                + "' must exist as a Java type under src/domain/" + featureName
                                + "/<named-domain-module>/<role>/, not under published/, application/, or the feature root.");
            }
        }
    }

    private void validateGenerationPolicyContextDocument(
            String documentPath,
            String content,
            ViolationSink violations) {
        for (String heading : GENERATION_POLICY_REQUIRED_SECTIONS) {
            if (!hasNonEmptySection(content, heading)) {
                violations.add(documentPath, "domain-generation-policy-required-sections",
                        "Generation policy contexts must include a non-empty '" + heading + "' section.");
            }
        }
        if (!WRITE_MODEL_NONE_PATTERN.matcher(content).find()) {
            violations.add(documentPath, "domain-generation-policy-write-model-none",
                    "Generation policy contexts must declare 'Write Model: None'.");
        }
        if (!hasNonEmptySection(content, "## Ephemeral Policy Rationale")) {
            violations.add(documentPath, "domain-generation-policy-ephemeral-rationale",
                    "Generation policy contexts must include a non-empty '## Ephemeral Policy Rationale' section.");
        }
    }

    private static List<String> aggregateRootMarkers(String content) {
        Matcher matcher = AGGREGATE_ROOT_MARKER_PATTERN.matcher(content);
        List<String> aggregateRoots = new ArrayList<>();
        while (matcher.find()) {
            aggregateRoots.add(matcher.group(1));
        }
        return aggregateRoots.stream().sorted().toList();
    }

    private static List<String> declaredDomainContextNames(String content) {
        List<String> result = new ArrayList<>();
        Matcher matcher = DOMAIN_CONTEXT_NAME_MARKER_PATTERN.matcher(content);
        while (matcher.find()) {
            result.add(matcher.group(1));
        }
        return result.stream().sorted().toList();
    }

    private static List<String> declaredDomainContextRoles(String content) {
        List<String> result = new ArrayList<>();
        Matcher matcher = DOMAIN_CONTEXT_ROLE_MARKER_PATTERN.matcher(content);
        while (matcher.find()) {
            result.add(matcher.group(1));
        }
        return result.stream().sorted().toList();
    }

    private static TreeMap<String, List<String>> contextBullets(String section) {
        TreeMap<String, List<String>> result = new TreeMap<>();
        Matcher matcher = CONTEXT_BULLET_PATTERN.matcher(section);
        while (matcher.find()) {
            result.computeIfAbsent(matcher.group(1), ignored -> new ArrayList<>()).add(matcher.group(2));
        }
        return result;
    }

    private static String lineContaining(String content, String needle) {
        for (String line : content.split("\\R")) {
            if (line.contains(needle)) {
                return line;
            }
        }
        return null;
    }

    private static String lineContainingRuleGroupStatus(String content, String needle) {
        for (String line : content.split("\\R")) {
            if (line.contains(needle) && lineContainsRuleGroupStatus(line)) {
                return line;
            }
        }
        return null;
    }

    private static String lineContainingMechanicalOwner(String content, String needle) {
        for (String line : content.split("\\R")) {
            if (line.contains(needle) && line.contains("./gradlew") && lineContainsMechanicalOwner(line)) {
                return line;
            }
        }
        return null;
    }

    private static boolean lineContainsMechanicalOwner(String line) {
        return line.contains("build-harness")
                || line.contains("Error Prone")
                || line.contains("PMD")
                || line.contains("ArchUnit");
    }

    private static boolean lineContainsRuleGroupStatus(String line) {
        return line.contains("Source-Pattern Enforced")
                || line.contains("Review-Owned")
                || line.contains("Candidate")
                || line.contains("Enforced");
    }

    private static void validateNoStaleContextBullets(
            String contextMapPath,
            String rule,
            Set<String> declaredContexts,
            Set<String> activeContexts,
            ViolationSink violations) {
        for (String declaredContext : declaredContexts) {
            if (!activeContexts.contains(declaredContext)) {
                violations.add(contextMapPath, rule,
                        "Domain layer standard must not declare stale context bullet '" + declaredContext
                                + "'. Active contexts are: " + String.join(", ", activeContexts) + ".");
            }
        }
    }

    private static boolean hasNonEmptySection(String content, String heading) {
        return !sectionBody(content, heading).trim().isBlank();
    }

    private static String sectionBody(String content, String heading) {
        int headingIndex = content.indexOf(heading);
        if (headingIndex < 0) {
            return "";
        }
        int bodyStart = headingIndex + heading.length();
        Matcher nextHeading = MARKDOWN_HEADING_PATTERN.matcher(content);
        int bodyEnd = content.length();
        if (nextHeading.find(bodyStart)) {
            bodyEnd = nextHeading.start();
        }
        return content.substring(bodyStart, bodyEnd);
    }
}
