package saltmarcher.architecture.documentation.domaincontext;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.TreeMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import saltmarcher.architecture.ArchitectureContext;
import saltmarcher.architecture.ArchitectureRule;
import saltmarcher.architecture.ViolationSink;

public final class DomainContextDocumentationRules implements ArchitectureRule {

    private static final Pattern MARKDOWN_HEADING_PATTERN =
            Pattern.compile("(?m)^##\\s+.+$");
    private static final Pattern CONTEXT_BULLET_PATTERN =
            Pattern.compile("(?m)^\\s*-\\s+`([^`]+)`\\s*:\\s*(.+)$");
    private static final Pattern DOMAIN_CONTEXT_NAME_MARKER_PATTERN =
            Pattern.compile("(?m)^\\s*Context Name:\\s+([A-Z][A-Za-z0-9_]*)\\s*$");
    private static final Pattern DOMAIN_CONTEXT_ROLE_MARKER_PATTERN =
            Pattern.compile("(?m)^\\s*Context Role:\\s+(.+?)\\s*$");
    private static final Pattern APPLICATION_SERVICE_MARKER_PATTERN =
            Pattern.compile("(?m)^\\s*Application Service:\\s+([A-Z][A-Za-z0-9_]*)\\s*$");
    private static final Pattern AGGREGATE_ROOT_MARKER_PATTERN =
            Pattern.compile("(?m)^\\s*Aggregate Root:\\s+([A-Z][A-Za-z0-9_]*)\\s*$");
    private static final Pattern WRITE_MODEL_NONE_PATTERN =
            Pattern.compile("(?m)^\\s*Write Model:\\s+None\\s*$");
    private static final Set<String> DOMAIN_CONTEXT_ROLES =
            Set.of(
                    "Roster Truth Context",
                    "Party Character State Context",
                    "Reference Catalog Context",
                    "Generation Policy Context",
                    "Authored World-Space Context");
    private static final Set<String> AUTHORED_CONTEXT_ROLES =
            Set.of(
                    "Roster Truth Context",
                    "Party Character State Context",
                    "Authored World-Space Context");
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
        Set<String> domainFeatures = context.domainFeatures(violations);

        validateDomainContextRoles(context, domainFeatures, violations);
        validateDomainContextRelationships(context, domainFeatures, violations);
        validateDomainContextDocuments(context, domainFeatures, violations);
    }

    private void validateDomainContextRelationships(
            ArchitectureContext context,
            Set<String> domainFeatures,
            ViolationSink violations) {
        Path contextMapDocument = context.repoRoot().resolve("docs/project/architecture/patterns/domain-layer.md");
        String contextMapPath = "docs/project/architecture/patterns/domain-layer.md";
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
        Path contextMapDocument = context.repoRoot().resolve("docs/project/architecture/patterns/domain-layer.md");
        String contextMapPath = "docs/project/architecture/patterns/domain-layer.md";
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
                violations.add(documentPath, "domain-context-name-marker",
                        "DOMAIN.md must contain exactly one context name marker: 'Context Name: <PascalContext>'.");
            }

            List<String> declaredRoles = declaredDomainContextRoles(content);
            if (declaredRoles.size() != 1) {
                violations.add(documentPath, "domain-context-role-marker",
                        "DOMAIN.md must contain exactly one context marker: 'Context Role: <role>'. Allowed roles: "
                                + String.join(", ", DOMAIN_CONTEXT_ROLES) + ".");
                continue;
            }

            String role = declaredRoles.getFirst();
            if (!DOMAIN_CONTEXT_ROLES.contains(role)) {
                violations.add(documentPath, "domain-context-role-marker",
                        "DOMAIN.md declares unsupported context role '" + role
                                + "'. Allowed roles: " + String.join(", ", DOMAIN_CONTEXT_ROLES) + ".");
                continue;
            }
            validateBaseContextDocument(documentPath, content, violations);
            validateApplicationServiceMarkers(documentPath, content, violations);
            if (AUTHORED_CONTEXT_ROLES.contains(role)) {
                validateAggregateOwningContextDocument(context, featureName, documentPath, content, violations);
            }
            if ("Generation Policy Context".equals(role)) {
                validateGenerationPolicyContextDocument(documentPath, content, violations);
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

    private void validateBaseContextDocument(
            String documentPath,
            String content,
            ViolationSink violations) {
        for (String heading : BASE_CONTEXT_REQUIRED_SECTIONS) {
            if (!hasNonEmptySection(content, heading)) {
                violations.add(documentPath, "domain-context-base-sections",
                        "Every DOMAIN.md must include a non-empty '" + heading + "' section.");
            }
        }
    }

    private void validateApplicationServiceMarkers(
            String documentPath,
            String content,
            ViolationSink violations) {
        String boundarySection = sectionBody(content, "## Application Boundary");
        Matcher matcher = APPLICATION_SERVICE_MARKER_PATTERN.matcher(boundarySection);
        if (!matcher.find()) {
            violations.add(documentPath, "domain-context-application-service-marker",
                    "Every DOMAIN.md must declare at least one 'Application Service: <TypeName>' marker inside '## Application Boundary'.");
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
                violations.add(documentPath, "domain-context-authored-truth-required-sections",
                        "Aggregate-owning domain roles must include a non-empty '" + heading + "' section.");
            }
        }

        List<String> aggregateRoots = aggregateRootMarkers(content);
        boolean writeModelNone = WRITE_MODEL_NONE_PATTERN.matcher(content).find();
        if (writeModelNone) {
            violations.add(documentPath, "domain-context-authored-truth-write-model-required",
                    "Aggregate-owning domain roles must own authored truth and must not declare 'Write Model: None'.");
        }
        if (aggregateRoots.isEmpty()) {
            violations.add(documentPath, "domain-context-aggregate-root-marker-shape",
                    "Aggregate-owning domain roles must declare 'Aggregate Root: <TypeName>' for an existing module role type.");
            return;
        }

        for (String aggregateRoot : aggregateRoots) {
            if (!context.domainNamedModuleTypeExists(featureName, aggregateRoot)) {
                violations.add(documentPath, "domain-context-aggregate-root-marker-shape",
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
                violations.add(documentPath, "domain-context-generation-policy-required-sections",
                        "Generation policy contexts must include a non-empty '" + heading + "' section.");
            }
        }
        if (!WRITE_MODEL_NONE_PATTERN.matcher(content).find()) {
            violations.add(documentPath, "domain-context-generation-policy-write-model-none",
                    "Generation policy contexts must declare 'Write Model: None'.");
        }
        if (!hasNonEmptySection(content, "## Ephemeral Policy Rationale")) {
            violations.add(documentPath, "domain-context-generation-policy-ephemeral-rationale",
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
