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

    private static final Pattern MARKDOWN_HEADING_PATTERN =
            Pattern.compile("(?m)^##\\s+.+$");
    private static final Pattern AGGREGATE_ROOT_MARKER_PATTERN =
            Pattern.compile("(?m)^\\s*Aggregate Root:\\s+([A-Z][A-Za-z0-9_]*)\\s*$");
    private static final Pattern WRITE_MODEL_NONE_PATTERN =
            Pattern.compile("(?m)^\\s*Write Model:\\s+None\\s*$");
    private static final Set<String> DOMAIN_CONTEXT_TYPES =
            Set.of("Policy-Owning Bounded Context", "Supporting Read-Model Context");
    private static final List<String> POLICY_CONTEXT_REQUIRED_SECTIONS = List.of(
            "## Aggregate Model",
            "## Commands And Invariants",
            "## Consistency Model",
            "## Ubiquitous Language");

    @Override
    public void check(ArchitectureContext context, ViolationSink violations) {
        List<SourceFile> sourceFiles = context.sourceFiles(violations);
        Set<String> domainFeatures = context.domainFeatures(violations);

        validateDomainFeatureBoundaries(domainFeatures, sourceFiles, violations);
        validateDomainFeatureDirectories(context, violations);
        validateDomainContextMap(context, domainFeatures, violations);
        validateDomainContextDocuments(context, domainFeatures, violations);
    }

    private void validateDomainFeatureBoundaries(
            Set<String> domainFeatures,
            List<SourceFile> sourceFiles,
            ViolationSink violations) {
        TreeMap<String, List<SourceFile>> rootsByFeature = new TreeMap<>();
        for (SourceFile sourceFile : sourceFiles) {
            if (sourceFile.kind() == SourceKind.DOMAIN_API_ROOT) {
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
                            + " Expected " + expectedDomainRootFileName(featureName) + ". Found: " + files);
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

    private void validateDomainContextMap(
            ArchitectureContext context,
            Set<String> domainFeatures,
            ViolationSink violations) {
        Path overview = context.repoRoot().resolve("docs/architecture/overview.md");
        String overviewPath = "docs/architecture/overview.md";
        if (!Files.isRegularFile(overview)) {
            violations.add(overviewPath, "domain-context-map-complete",
                    "Architecture overview must define a '## Domain Context Map' section covering every domain feature.");
            return;
        }

        String content;
        try {
            content = Files.readString(overview, StandardCharsets.UTF_8);
        } catch (IOException exception) {
            violations.add(overviewPath, "file-readable",
                    "Could not read architecture overview: " + exception.getMessage());
            return;
        }

        String section = sectionBody(content, "## Domain Context Map");
        if (section.trim().isBlank()) {
            violations.add(overviewPath, "domain-context-map-complete",
                    "Architecture overview must include a non-empty '## Domain Context Map' section.");
            return;
        }

        for (String featureName : domainFeatures) {
            Pattern featureLine = Pattern.compile("(?m)^\\s*-\\s+`" + Pattern.quote(featureName) + "`\\s*:\\s*(.+)$");
            Matcher matcher = featureLine.matcher(section);
            if (!matcher.find()) {
                violations.add(overviewPath, "domain-context-map-complete",
                        "Domain context map must include a bullet for src/domain/" + featureName
                                + " using '- `" + featureName + "`: ...'.");
                continue;
            }
            String declaredContextType = declaredDomainContextType(context, featureName);
            if (declaredContextType != null && !matcher.group(1).contains(declaredContextType)) {
                violations.add(overviewPath, "domain-context-map-role-matches",
                        "Domain context map bullet for src/domain/" + featureName
                                + " must include its declared context type '" + declaredContextType + "'.");
            }
        }
    }

    private String declaredDomainContextType(ArchitectureContext context, String featureName) {
        Path document = context.repoRoot().resolve("src/domain").resolve(featureName).resolve("DOMAIN.md");
        if (!Files.isRegularFile(document)) {
            return null;
        }
        try {
            List<String> declaredTypes = declaredDomainContextTypes(Files.readString(document, StandardCharsets.UTF_8));
            return declaredTypes.size() == 1 ? declaredTypes.getFirst() : null;
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

            List<String> declaredTypes = declaredDomainContextTypes(content);
            if (declaredTypes.size() != 1) {
                violations.add(documentPath, "domain-context-shape-declared",
                        "DOMAIN.md must contain exactly one context marker: 'Context Type: Policy-Owning Bounded Context'"
                                + " or 'Context Type: Supporting Read-Model Context'.");
                continue;
            }

            if ("Supporting Read-Model Context".equals(declaredTypes.getFirst())
                    && !hasNonEmptySection(content, "## Read-Model Boundary")) {
                violations.add(documentPath, "domain-supporting-context-rationale",
                        "Supporting read-model contexts must include a non-empty '## Read-Model Boundary' rationale section.");
            }
            if ("Supporting Read-Model Context".equals(declaredTypes.getFirst())
                    && !hasNonEmptySection(content, "## Promotion Triggers")) {
                violations.add(documentPath, "domain-supporting-context-promotion-triggers",
                        "Supporting read-model contexts must include a non-empty '## Promotion Triggers' section.");
            }
            if ("Policy-Owning Bounded Context".equals(declaredTypes.getFirst())) {
                validatePolicyContextDocument(context, featureName, documentPath, content, violations);
            }
        }
    }

    private void validatePolicyContextDocument(
            ArchitectureContext context,
            String featureName,
            String documentPath,
            String content,
            ViolationSink violations) {
        for (String heading : POLICY_CONTEXT_REQUIRED_SECTIONS) {
            if (!hasNonEmptySection(content, heading)) {
                violations.add(documentPath, "domain-policy-context-required-sections",
                        "Policy-owning bounded contexts must include a non-empty '" + heading + "' section.");
            }
        }

        List<String> aggregateRoots = aggregateRootMarkers(content);
        boolean writeModelNone = WRITE_MODEL_NONE_PATTERN.matcher(content).find();
        if (aggregateRoots.isEmpty()) {
            if (!writeModelNone || !hasNonEmptySection(content, "## Ephemeral Policy Rationale")) {
                violations.add(documentPath, "domain-aggregate-marker-shape",
                        "Policy-owning contexts must declare 'Aggregate Root: <TypeName>' for an existing named-module type,"
                                + " or declare 'Write Model: None' plus a non-empty '## Ephemeral Policy Rationale'.");
            }
            return;
        }

        for (String aggregateRoot : aggregateRoots) {
            if (!context.domainNamedModuleTypeExists(featureName, aggregateRoot)) {
                violations.add(documentPath, "domain-aggregate-marker-shape",
                        "Declared aggregate root '" + aggregateRoot
                                + "' must exist as a Java type under src/domain/" + featureName
                                + "/<named-domain-module>/, not under api/, application/, or the feature root.");
            }
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

    private static List<String> declaredDomainContextTypes(String content) {
        List<String> result = new ArrayList<>();
        for (String type : DOMAIN_CONTEXT_TYPES) {
            Matcher matcher = Pattern.compile("(?m)^\\s*Context Type:\\s+" + Pattern.quote(type) + "\\s*$")
                    .matcher(content);
            while (matcher.find()) {
                result.add(type);
            }
        }
        return result.stream().sorted().toList();
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
