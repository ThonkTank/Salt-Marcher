package saltmarcher.architecture;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.stream.Stream;

public final class ArchitectureChecker {

    private static final Pattern PACKAGE_PATTERN =
            Pattern.compile("(?m)^\\s*package\\s+([A-Za-z_][\\w.]*)\\s*;");
    private static final Pattern INCLUDED_BUILD_PATTERN =
            Pattern.compile("\\bincludeBuild\\s*\\(\\s*\"([^\"]+)\"\\s*\\)");
    private static final Pattern SELF_TEST_FILE_PATTERN =
            Pattern.compile(".*SelfTest.*\\.java$");
    private static final Pattern MARKDOWN_HEADING_PATTERN =
            Pattern.compile("(?m)^##\\s+.+$");
    private static final Pattern AGGREGATE_ROOT_MARKER_PATTERN =
            Pattern.compile("(?m)^\\s*Aggregate Root:\\s+([A-Z][A-Za-z0-9_]*)\\s*$");
    private static final Pattern WRITE_MODEL_NONE_PATTERN =
            Pattern.compile("(?m)^\\s*Write Model:\\s+None\\s*$");
    private static final Pattern BACKEND_PORT_CONTRACT_FILE_PATTERN =
            Pattern.compile(".*(?:Repository|Port)\\.java$");
    private static final Pattern SCHEMA_TABLE_NAME_PATTERN =
            Pattern.compile("\\btable\\s*\\(\\s*\"([^\"]+)\"");
    private static final Pattern SHELL_TAB_SPEC_CONSTRUCTOR_PATTERN =
            Pattern.compile("\\bnew\\s+(?:shell\\.api\\.)?ShellTabSpec\\s*\\(");
    private static final Set<String> DOMAIN_CONTEXT_TYPES =
            Set.of("Policy-Owning Bounded Context", "Supporting Read-Model Context");
    private static final List<String> POLICY_CONTEXT_REQUIRED_SECTIONS = List.of(
            "## Aggregate Model",
            "## Commands And Invariants",
            "## Consistency Model",
            "## Ubiquitous Language");
    private static final Set<String> ACTIVE_JAVA_ROOT_ALLOWLIST =
            Set.of("bootstrap", "shell", "src", "test", "tools", "salt-marcher");
    private static final Set<String> IGNORED_REPOSITORY_SCAN_SEGMENTS =
            Set.of(".codex", ".git", ".gradle", "build");
    private static final Set<String> SRC_DIRECT_CHILD_ALLOWLIST =
            Set.of("view", "domain", "data");
    private static final Set<String> SHELL_API_PUBLIC_SURFACE_ALLOWLIST =
            Set.of(
                    "ContributionKey.java",
                    "InspectorEntrySpec.java",
                    "InspectorSink.java",
                    "NavigationGraphicSupport.java",
                    "NavigationGroupSpec.java",
                    "ServiceContribution.java",
                    "ServiceRegistry.java",
                    "ShellContributionSpec.java",
                    "ShellRuntimeContext.java",
                    "ShellRuntimeStateSpec.java",
                    "ShellScreen.java",
                    "ShellSlot.java",
                    "ShellTabMode.java",
                    "ShellTabSpec.java",
                    "ShellTopBarSpec.java",
                    "ShellViewContribution.java");
    private static final Set<String> DOMAIN_FORBIDDEN_ROLE_BUCKETS =
            Set.of(
                    "aggregate",
                    "aggregates",
                    "application",
                    "applications",
                    "controller",
                    "controllers",
                    "datasource",
                    "datasources",
                    "entity",
                    "entities",
                    "event",
                    "events",
                    "factory",
                    "factories",
                    "gateway",
                    "gateways",
                    "interactor",
                    "interactors",
                    "mapper",
                    "mappers",
                    "model",
                    "models",
                    "query",
                    "queries",
                    "repository",
                    "repositories",
                    "service",
                    "services",
                    "specification",
                    "specifications",
                    "usecase",
                    "usecases",
                    "valueobject",
                    "valueobjects",
                    "view",
                    "viewmodel");
    private final Path repoRoot;

    public ArchitectureChecker(Path repoRoot) {
        this.repoRoot = repoRoot.normalize().toAbsolutePath();
    }

    public Result check() {
        List<Violation> violations = new ArrayList<>();
        validateBuildHarnessPolicy(violations);
        validateRepositoryTopology(violations);
        List<SourceFile> sourceFiles = loadSourceFiles(violations);

        for (SourceFile sourceFile : sourceFiles) {
            validatePathLayout(sourceFile, violations);
            validatePackageMatchesPath(sourceFile, violations);
        }

        Set<String> domainFeatures = collectDomainFeatures(sourceFiles);

        validateDomainFeatureBoundaries(sourceFiles, violations);
        validateDomainFeatureDirectories(violations);
        validateDomainContextMap(domainFeatures, violations);
        validateDomainContextDocuments(domainFeatures, violations);
        validateShellApiPublicSurface(sourceFiles, violations);
        validateViewContributionPlacementAndStartup(sourceFiles, violations);
        validateServiceContributionPlacement(sourceFiles, violations);
        validatePersistenceEntrypoints(sourceFiles, violations);
        validateSchemaTableNameOwnership(sourceFiles, violations);

        List<Violation> ordered = violations.stream()
                .sorted(Comparator.comparing(Violation::source)
                        .thenComparing(Violation::rule)
                        .thenComparing(Violation::details))
                .toList();
        return new Result(ordered);
    }

    private void validateBuildHarnessPolicy(List<Violation> violations) {
        Path fixturesRoot = repoRoot.resolve("tools/gradle/build-harness/src/fixtures");
        if (Files.exists(fixturesRoot)) {
            violations.add(new Violation(relativize(fixturesRoot), "build-harness-no-selftests",
                    "build-harness fixtures are forbidden. Enforce repository policy directly in architectureCheck instead of fixture-based selftests."));
        }

        Path mainJavaRoot = repoRoot.resolve("tools/gradle/build-harness/src/main/java");
        if (!Files.isDirectory(mainJavaRoot)) {
            return;
        }
        try (Stream<Path> stream = Files.walk(mainJavaRoot)) {
            stream.filter(Files::isRegularFile)
                    .filter(path -> SELF_TEST_FILE_PATTERN.matcher(path.getFileName().toString()).matches())
                    .forEach(path -> violations.add(new Violation(relativize(path), "build-harness-no-selftests",
                            "build-harness self-test mains are forbidden. Keep verification in architectureCheck instead of a separate meta-test layer.")));
        } catch (IOException exception) {
            violations.add(new Violation(relativize(mainJavaRoot), "scan-root",
                    "Could not scan build-harness policy root: " + exception.getMessage()));
        }
    }

    private void validateRepositoryTopology(List<Violation> violations) {
        validateActiveJavaRootAllowlist(violations);
        validateSrcDirectChildAllowlist(violations);
        validateIncludedBuildTaxonomy(violations);
    }

    private void validateActiveJavaRootAllowlist(List<Violation> violations) {
        try (Stream<Path> stream = Files.walk(repoRoot)) {
            stream.filter(path -> !isIgnoredRepositoryScanPath(path))
                    .filter(Files::isRegularFile)
                    .filter(path -> path.getFileName().toString().endsWith(".java"))
                    .forEach(path -> {
                        List<String> segments = relativeSegments(path);
                        if (segments.isEmpty()) {
                            return;
                        }
                        String root = segments.getFirst();
                        if (!ACTIVE_JAVA_ROOT_ALLOWLIST.contains(root)) {
                            violations.add(new Violation(relativize(path), "repository-active-java-root-allowlist",
                                    "Java source files must live under bootstrap/, shell/, src/, test/, tools/,"
                                            + " or legacy salt-marcher/. Do not create alternate active feature-code roots."));
                        }
                    });
        } catch (IOException exception) {
            violations.add(new Violation(".", "scan-root",
                    "Could not scan repository Java source roots: " + exception.getMessage()));
        }
    }

    private void validateSrcDirectChildAllowlist(List<Violation> violations) {
        Path srcRoot = repoRoot.resolve("src");
        if (!Files.isDirectory(srcRoot)) {
            return;
        }
        try (Stream<Path> stream = Files.list(srcRoot)) {
            stream.filter(path -> !SRC_DIRECT_CHILD_ALLOWLIST.contains(path.getFileName().toString()))
                    .filter(this::hasRepositoryContent)
                    .forEach(path -> violations.add(new Violation(relativize(path), "repository-src-direct-child-allowlist",
                            "The src/ root may contain only view/, domain/, and data/ as non-empty direct children."
                                    + " Active feature code must be added inside one of those layer roots.")));
        } catch (IOException exception) {
            violations.add(new Violation(relativize(srcRoot), "scan-root",
                    "Could not scan src/ direct children: " + exception.getMessage()));
        }
    }

    private void validateIncludedBuildTaxonomy(List<Violation> violations) {
        Path settingsFile = repoRoot.resolve("settings.gradle.kts");
        if (!Files.isRegularFile(settingsFile)) {
            return;
        }

        String content;
        try {
            content = Files.readString(settingsFile, StandardCharsets.UTF_8);
        } catch (IOException exception) {
            violations.add(new Violation("settings.gradle.kts", "file-readable",
                    "Could not read Gradle settings file: " + exception.getMessage()));
            return;
        }

        Matcher matcher = INCLUDED_BUILD_PATTERN.matcher(content);
        while (matcher.find()) {
            String includedBuild = matcher.group(1);
            Path normalized = Path.of(includedBuild).normalize();
            if (normalized.isAbsolute() || normalized.startsWith("..")) {
                violations.add(new Violation("settings.gradle.kts", "repository-included-build-taxonomy",
                        "Included Gradle builds must use repository-relative paths under tools/gradle/ or tools/quality/. Found: "
                                + includedBuild));
                continue;
            }
            String normalizedPath = normalized.toString().replace('\\', '/');
            if (!normalizedPath.startsWith("tools/gradle/")
                    && !normalizedPath.startsWith("tools/quality/")) {
                violations.add(new Violation("settings.gradle.kts", "repository-included-build-taxonomy",
                        "Included Gradle builds must live under tools/gradle/ or tools/quality/. Found: "
                                + includedBuild));
            }
        }
    }

    private boolean isIgnoredRepositoryScanPath(Path path) {
        return relativeSegments(path).stream().anyMatch(IGNORED_REPOSITORY_SCAN_SEGMENTS::contains);
    }

    private boolean hasRepositoryContent(Path path) {
        if (isIgnoredRepositoryScanPath(path)) {
            return false;
        }
        if (Files.isRegularFile(path)) {
            return true;
        }
        if (!Files.isDirectory(path)) {
            return false;
        }
        try (Stream<Path> stream = Files.walk(path)) {
            return stream
                    .filter(candidate -> !candidate.equals(path))
                    .filter(candidate -> !isIgnoredRepositoryScanPath(candidate))
                    .anyMatch(Files::isRegularFile);
        } catch (IOException exception) {
            return true;
        }
    }

    private List<SourceFile> loadSourceFiles(List<Violation> violations) {
        List<SourceFile> files = new ArrayList<>();
        List<Path> roots = List.of(repoRoot.resolve("bootstrap"), repoRoot.resolve("shell"), repoRoot.resolve("src"));
        for (Path root : roots) {
            if (!Files.exists(root)) {
                continue;
            }
            try (Stream<Path> stream = Files.walk(root)) {
                stream.filter(Files::isRegularFile)
                        .filter(path -> path.getFileName().toString().endsWith(".java"))
                        .forEach(path -> {
                            try {
                                files.add(SourceFile.parse(repoRoot, path));
                            } catch (IOException exception) {
                                violations.add(new Violation(relativize(path), "file-readable",
                                        "Could not read source file: " + exception.getMessage()));
                            }
                        });
            } catch (IOException exception) {
                violations.add(new Violation(relativize(root), "scan-root",
                        "Could not scan source root: " + exception.getMessage()));
            }
        }
        return files.stream()
                .sorted(Comparator.comparing(SourceFile::relativePath))
                .toList();
    }

    private void validatePathLayout(SourceFile sourceFile, List<Violation> violations) {
        List<String> segments = sourceFile.relativeSegments();
        if (segments.isEmpty()) {
            return;
        }

        if ("bootstrap".equals(segments.getFirst())) {
            return;
        }

        if ("shell".equals(segments.getFirst())) {
            if (segments.size() < 2 || !Set.of("api", "host").contains(segments.get(1))) {
                violations.add(new Violation(sourceFile.relativePath(), "shell-layout",
                        "Shell sources must live under shell/api or shell/host."));
            }
            return;
        }

        if (!"src".equals(segments.getFirst())) {
            violations.add(new Violation(sourceFile.relativePath(), "root-layout",
                    "Sources must live under bootstrap/, shell/ or src/."));
            return;
        }

        if (segments.size() < 3) {
            violations.add(new Violation(sourceFile.relativePath(), "src-layout",
                    "Sources under src/ must live in src/view, src/domain or src/data."));
            return;
        }

        switch (segments.get(1)) {
            case "view" -> {
                if (segments.size() < 4) {
                    violations.add(new Violation(sourceFile.relativePath(), "view-layout",
                            "View sources must live under src/view/<component>/..."));
                }
            }
            case "domain" -> validateDomainLayout(sourceFile, violations);
            case "data" -> validateDataLayout(sourceFile, violations);
            default -> violations.add(new Violation(sourceFile.relativePath(), "src-layout",
                    "Sources under src/ must live in src/view, src/domain or src/data."));
        }
    }

    private void validateDomainLayout(SourceFile sourceFile, List<Violation> violations) {
        List<String> segments = sourceFile.relativeSegments();
        if (segments.size() < 4) {
            violations.add(new Violation(sourceFile.relativePath(), "domain-layout",
                    "Domain sources must live under src/domain/<feature>/..."));
            return;
        }

        if (segments.size() == 4) {
            String feature = segments.get(2);
            String expected = expectedDomainRootFileName(feature);
            if (!sourceFile.fileName().equals(expected)) {
                violations.add(new Violation(sourceFile.relativePath(), "domain-root-presence",
                        "Only <PascalFeatureName>ApplicationService.java may live directly under src/domain/<feature>/."));
            }
            return;
        }

        String bucket = segments.get(3);
        validateDomainBucket(sourceFile.relativePath(), bucket, violations);
        if (bucket.equals("api")
                && BACKEND_PORT_CONTRACT_FILE_PATTERN.matcher(sourceFile.fileName()).matches()) {
            violations.add(new Violation(sourceFile.relativePath(), "domain-api-no-backend-port-contracts",
                    "Domain api/ packages are exported boundary-carrier surfaces. Backend port contracts such as *Repository or *Port belong in a named domain module."));
        }
        if (bucket.equals("application")
                && BACKEND_PORT_CONTRACT_FILE_PATTERN.matcher(sourceFile.fileName()).matches()) {
            violations.add(new Violation(sourceFile.relativePath(), "domain-application-no-backend-port-contracts",
                    "Domain application/ packages coordinate use cases. Backend port contracts such as *Repository or *Port belong in a named domain module."));
        }
    }

    private void validateDataLayout(SourceFile sourceFile, List<Violation> violations) {
        List<String> segments = sourceFile.relativeSegments();
        if (segments.size() == 4) {
            String expected = expectedDataRootFileName(segments.get(2));
            if (!sourceFile.fileName().equals(expected)) {
                violations.add(new Violation(sourceFile.relativePath(), "data-layout",
                        "Only <PascalFeatureName>ServiceContribution.java may live directly under src/data/<feature>/."));
            }
            return;
        }
        if ("persistencecore".equals(segments.get(2))) {
            if (segments.size() < 5 || !Set.of("sqlite", "model").contains(segments.get(3))) {
                violations.add(new Violation(sourceFile.relativePath(), "data-layout",
                        "Persistencecore sources must live under src/data/persistencecore/sqlite or src/data/persistencecore/model."));
            }
            return;
        }
        if (segments.size() < 5) {
            violations.add(new Violation(sourceFile.relativePath(), "data-layout",
                    "Data sources must live under src/data/<feature>/<Feature>ServiceContribution.java,"
                            + " repository, query, gateway, model or mapper."));
            return;
        }

        String bucket = segments.get(3);
        switch (bucket) {
            case "repository", "query", "model", "mapper" -> {
            }
            case "gateway" -> {
                if (segments.size() < 6 || !Set.of("local", "remote").contains(segments.get(4))) {
                    violations.add(new Violation(sourceFile.relativePath(), "data-layout",
                            "Gateways must live under gateway/local or gateway/remote."));
                }
            }
            default -> violations.add(new Violation(sourceFile.relativePath(), "data-layout",
                    "Only a data root contribution, repository/, query/, gateway/local/, gateway/remote/, model/ and mapper/"
                            + " are allowed in data features."));
        }
    }

    private void validatePackageMatchesPath(SourceFile sourceFile, List<Violation> violations) {
        if (sourceFile.packageName().isBlank()) {
            violations.add(new Violation(sourceFile.relativePath(), "package-declaration",
                    "Every Java source must declare a package."));
            return;
        }

        String expected = sourceFile.relativePath()
                .replace('\\', '/')
                .replaceAll("/[^/]+\\.java$", "")
                .replace('/', '.');
        if (!sourceFile.packageName().equals(expected)) {
            violations.add(new Violation(sourceFile.relativePath(), "package-path-match",
                    "Package must match directory path. Expected '" + expected + "' but found '" + sourceFile.packageName() + "'."));
        }
    }

    private void validateDomainFeatureBoundaries(List<SourceFile> sourceFiles, List<Violation> violations) {
        TreeMap<String, List<SourceFile>> rootsByFeature = new TreeMap<>();
        for (SourceFile sourceFile : sourceFiles) {
            if (sourceFile.kind() == SourceKind.DOMAIN_API_ROOT) {
                rootsByFeature.computeIfAbsent(sourceFile.featureName(), ignored -> new ArrayList<>()).add(sourceFile);
            }
        }

        for (String featureName : collectDomainFeatures(sourceFiles)) {
            List<SourceFile> roots = rootsByFeature.getOrDefault(featureName, List.of()).stream()
                    .sorted(Comparator.comparing(SourceFile::relativePath))
                    .toList();
            if (roots.size() == 1) {
                continue;
            }
            String files = roots.isEmpty()
                    ? "none found"
                    : roots.stream().map(SourceFile::relativePath).collect(Collectors.joining(", "));
            violations.add(new Violation("src/domain/" + featureName, "domain-root-presence",
                    "Domain feature '" + featureName + "' must expose exactly one root application service."
                            + " Expected " + expectedDomainRootFileName(featureName) + ". Found: " + files));
        }
    }

    private void validateDomainFeatureDirectories(List<Violation> violations) {
        Path domainRoot = repoRoot.resolve("src/domain");
        if (!Files.isDirectory(domainRoot)) {
            return;
        }
        try (Stream<Path> stream = Files.list(domainRoot)) {
            stream.filter(Files::isDirectory)
                    .sorted()
                    .forEach(featureRoot -> validateDomainFeatureDirectory(featureRoot, violations));
        } catch (IOException exception) {
            violations.add(new Violation(relativize(domainRoot), "scan-root",
                    "Could not scan domain feature root: " + exception.getMessage()));
        }
    }

    private void validateDomainFeatureDirectory(Path featureRoot, List<Violation> violations) {
        try (Stream<Path> stream = Files.list(featureRoot)) {
            stream.filter(Files::isDirectory)
                    .sorted()
                    .forEach(directory -> {
                        String bucket = directory.getFileName().toString();
                        validateDomainBucket(relativize(directory), bucket, violations);
                    });
        } catch (IOException exception) {
            violations.add(new Violation(relativize(featureRoot), "scan-root",
                    "Could not scan domain feature directory: " + exception.getMessage()));
        }
    }

    private void validateDomainContextMap(Set<String> domainFeatures, List<Violation> violations) {
        Path overview = repoRoot.resolve("docs/architecture/overview.md");
        String overviewPath = "docs/architecture/overview.md";
        if (!Files.isRegularFile(overview)) {
            violations.add(new Violation(overviewPath, "domain-context-map-complete",
                    "Architecture overview must define a '## Domain Context Map' section covering every domain feature."));
            return;
        }

        String content;
        try {
            content = Files.readString(overview, StandardCharsets.UTF_8);
        } catch (IOException exception) {
            violations.add(new Violation(overviewPath, "file-readable",
                    "Could not read architecture overview: " + exception.getMessage()));
            return;
        }

        String section = sectionBody(content, "## Domain Context Map");
        if (section.trim().isBlank()) {
            violations.add(new Violation(overviewPath, "domain-context-map-complete",
                    "Architecture overview must include a non-empty '## Domain Context Map' section."));
            return;
        }

        for (String featureName : domainFeatures) {
            Pattern featureLine = Pattern.compile("(?m)^\\s*-\\s+`" + Pattern.quote(featureName) + "`\\s*:");
            if (!featureLine.matcher(section).find()) {
                violations.add(new Violation(overviewPath, "domain-context-map-complete",
                        "Domain context map must include a bullet for src/domain/" + featureName
                                + " using '- `" + featureName + "`: ...'."));
            }
        }
    }

    private void validateDomainContextDocuments(Set<String> domainFeatures, List<Violation> violations) {
        for (String featureName : domainFeatures) {
            Path document = repoRoot.resolve("src/domain").resolve(featureName).resolve("DOMAIN.md");
            String documentPath = "src/domain/" + featureName + "/DOMAIN.md";
            if (!Files.isRegularFile(document)) {
                violations.add(new Violation(documentPath, "domain-context-document-presence",
                        "Every domain feature must declare its context type in DOMAIN.md."));
                continue;
            }

            String content;
            try {
                content = Files.readString(document, StandardCharsets.UTF_8);
            } catch (IOException exception) {
                violations.add(new Violation(documentPath, "file-readable",
                        "Could not read domain context document: " + exception.getMessage()));
                continue;
            }

            List<String> declaredTypes = declaredDomainContextTypes(content);
            if (declaredTypes.size() != 1) {
                violations.add(new Violation(documentPath, "domain-context-shape-declared",
                        "DOMAIN.md must contain exactly one context marker: 'Context Type: Policy-Owning Bounded Context'"
                                + " or 'Context Type: Supporting Read-Model Context'."));
                continue;
            }

            if ("Supporting Read-Model Context".equals(declaredTypes.getFirst())
                    && !hasNonEmptySection(content, "## Read-Model Boundary")) {
                violations.add(new Violation(documentPath, "domain-supporting-context-rationale",
                        "Supporting read-model contexts must include a non-empty '## Read-Model Boundary' rationale section."));
            }
            if ("Supporting Read-Model Context".equals(declaredTypes.getFirst())
                    && !hasNonEmptySection(content, "## Promotion Triggers")) {
                violations.add(new Violation(documentPath, "domain-supporting-context-promotion-triggers",
                        "Supporting read-model contexts must include a non-empty '## Promotion Triggers' section."));
            }
            if ("Policy-Owning Bounded Context".equals(declaredTypes.getFirst())) {
                validatePolicyContextDocument(featureName, documentPath, content, violations);
            }
        }
    }

    private void validatePolicyContextDocument(
            String featureName,
            String documentPath,
            String content,
            List<Violation> violations) {
        for (String heading : POLICY_CONTEXT_REQUIRED_SECTIONS) {
            if (!hasNonEmptySection(content, heading)) {
                violations.add(new Violation(documentPath, "domain-policy-context-required-sections",
                        "Policy-owning bounded contexts must include a non-empty '" + heading + "' section."));
            }
        }

        List<String> aggregateRoots = aggregateRootMarkers(content);
        boolean writeModelNone = WRITE_MODEL_NONE_PATTERN.matcher(content).find();
        if (aggregateRoots.isEmpty()) {
            if (!writeModelNone || !hasNonEmptySection(content, "## Ephemeral Policy Rationale")) {
                violations.add(new Violation(documentPath, "domain-aggregate-marker-shape",
                        "Policy-owning contexts must declare 'Aggregate Root: <TypeName>' for an existing named-module type,"
                                + " or declare 'Write Model: None' plus a non-empty '## Ephemeral Policy Rationale'."));
            }
            return;
        }

        for (String aggregateRoot : aggregateRoots) {
            if (!domainNamedModuleTypeExists(featureName, aggregateRoot)) {
                violations.add(new Violation(documentPath, "domain-aggregate-marker-shape",
                        "Declared aggregate root '" + aggregateRoot
                                + "' must exist as a Java type under src/domain/" + featureName
                                + "/<named-domain-module>/, not under api/, application/, or the feature root."));
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

    private boolean domainNamedModuleTypeExists(String featureName, String simpleTypeName) {
        Path featureRoot = repoRoot.resolve("src/domain").resolve(featureName);
        if (!Files.isDirectory(featureRoot)) {
            return false;
        }
        try (Stream<Path> stream = Files.walk(featureRoot)) {
            return stream
                    .filter(Files::isRegularFile)
                    .filter(path -> path.getFileName().toString().equals(simpleTypeName + ".java"))
                    .map(this::relativeSegments)
                    .anyMatch(segments -> segments.size() >= 5
                            && "src".equals(segments.get(0))
                            && "domain".equals(segments.get(1))
                            && featureName.equals(segments.get(2))
                            && !Set.of("api", "application").contains(segments.get(3)));
        } catch (IOException ignored) {
            return false;
        }
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

    private void validateShellApiPublicSurface(List<SourceFile> sourceFiles, List<Violation> violations) {
        TreeSet<String> actualFiles = sourceFiles.stream()
                .filter(sourceFile -> sourceFile.relativeSegments().size() == 3)
                .filter(sourceFile -> sourceFile.relativeSegments().get(0).equals("shell"))
                .filter(sourceFile -> sourceFile.relativeSegments().get(1).equals("api"))
                .map(SourceFile::fileName)
                .collect(Collectors.toCollection(TreeSet::new));

        TreeSet<String> missingFiles = new TreeSet<>(SHELL_API_PUBLIC_SURFACE_ALLOWLIST);
        missingFiles.removeAll(actualFiles);
        for (String missingFile : missingFiles) {
            violations.add(new Violation("shell/api/" + missingFile, "shell-api-public-surface-allowlist",
                    "The public shell workbench contract must keep the fixed shell/api surface. Missing expected API file."));
        }

        TreeSet<String> extraFiles = new TreeSet<>(actualFiles);
        extraFiles.removeAll(SHELL_API_PUBLIC_SURFACE_ALLOWLIST);
        for (String extraFile : extraFiles) {
            violations.add(new Violation("shell/api/" + extraFile, "shell-api-public-surface-allowlist",
                    "Do not add new public shell/api extension points without updating the passive workbench contract and enforcement coverage."));
        }
    }

    private static String expectedDomainRootFileName(String feature) {
        if (feature == null || feature.isBlank()) {
            return "ApplicationService.java";
        }
        return feature.substring(0, 1).toUpperCase(Locale.ROOT)
                + feature.substring(1)
                + "ApplicationService.java";
    }

    private static void validateDomainBucket(String source, String bucket, List<Violation> violations) {
        if (bucket.equals("api") || bucket.equals("application")) {
            return;
        }
        if (DOMAIN_FORBIDDEN_ROLE_BUCKETS.contains(bucket)) {
            violations.add(new Violation(source, "domain-top-level-role-bucket-ban",
                    "Top-level technical role buckets are forbidden under src/domain/<feature>/. Use api/, application/, or a named domain module."));
            return;
        }
        if (!isNamedDomainModule(bucket)) {
            violations.add(new Violation(source, "domain-module-name-shape",
                    "Named domain modules under src/domain/<feature>/ must use lower-case package names matching [a-z][a-z0-9_]*."));
        }
    }

    private static boolean isNamedDomainModule(String bucket) {
        return bucket.matches("[a-z][a-z0-9_]*")
                && !DOMAIN_FORBIDDEN_ROLE_BUCKETS.contains(bucket);
    }

    private static String expectedViewRootFileName(String component) {
        if (component == null || component.isBlank()) {
            return "ViewContribution.java";
        }
        return component.substring(0, 1).toUpperCase(Locale.ROOT)
                + component.substring(1)
                + "ViewContribution.java";
    }

    private static String expectedDataRootFileName(String feature) {
        if (feature == null || feature.isBlank()) {
            return "ServiceContribution.java";
        }
        return feature.substring(0, 1).toUpperCase(Locale.ROOT)
                + feature.substring(1)
                + "ServiceContribution.java";
    }

    private static String expectedDataSchemaFileName(String feature) {
        if (feature == null || feature.isBlank()) {
            return "PersistenceSchema.java";
        }
        return feature.substring(0, 1).toUpperCase(Locale.ROOT)
                + feature.substring(1)
                + "PersistenceSchema.java";
    }

    private void validatePersistenceEntrypoints(List<SourceFile> sourceFiles, List<Violation> violations) {
        TreeMap<String, List<SourceFile>> rootsByFeature = new TreeMap<>();
        TreeMap<String, List<SourceFile>> schemasByFeature = new TreeMap<>();
        for (SourceFile sourceFile : sourceFiles) {
            if (sourceFile.kind() == SourceKind.DATA_ROOT) {
                rootsByFeature.computeIfAbsent(sourceFile.featureName(), ignored -> new ArrayList<>()).add(sourceFile);
            }
            if (sourceFile.kind() == SourceKind.DATA_SCHEMA) {
                schemasByFeature.computeIfAbsent(sourceFile.featureName(), ignored -> new ArrayList<>()).add(sourceFile);
            }
        }

        for (String featureName : collectDataFeatures(sourceFiles)) {
            List<SourceFile> roots = rootsByFeature.getOrDefault(featureName, List.of()).stream()
                    .sorted(Comparator.comparing(SourceFile::relativePath))
                    .toList();
            List<SourceFile> schemas = schemasByFeature.getOrDefault(featureName, List.of()).stream()
                    .sorted(Comparator.comparing(SourceFile::relativePath))
                    .toList();

            if (roots.size() != 1) {
                String files = roots.isEmpty()
                        ? "none found"
                        : roots.stream().map(SourceFile::relativePath).collect(Collectors.joining(", "));
                violations.add(new Violation("src/data/" + featureName, "persistence-root-entrypoint",
                        "Persistently wired data feature '" + featureName + "' must expose exactly one root persistence contribution."
                                + " Found: " + files));
            }

            if (schemas.size() != 1) {
                String files = schemas.isEmpty()
                        ? "none found"
                        : schemas.stream().map(SourceFile::relativePath).collect(Collectors.joining(", "));
                violations.add(new Violation("src/data/" + featureName, "persistence-schema-contract",
                        "Persistently wired data feature '" + featureName + "' must expose exactly one schema declaration."
                                + " Found: " + files));
            }
        }
    }

    private void validateViewContributionPlacementAndStartup(List<SourceFile> sourceFiles, List<Violation> violations) {
        List<SourceFile> defaultLandingRoots = new ArrayList<>();
        for (SourceFile sourceFile : sourceFiles) {
            if (sourceFile.fileName().endsWith("ViewContribution.java")
                    && !sourceFile.relativePath().equals("shell/api/ShellViewContribution.java")
                    && !sourceFile.isCanonicalViewRootContribution()) {
                violations.add(new Violation(sourceFile.relativePath(), "shell-view-contribution-placement",
                        "Shell view contribution roots must live at src/view/<component>/<PascalComponentName>ViewContribution.java."));
            }

            if (sourceFile.kind() != SourceKind.VIEW_ROOT) {
                continue;
            }
            for (List<String> arguments : shellTabSpecArgumentLists(sourceFile.content())) {
                if (arguments.size() < 4) {
                    violations.add(new Violation(sourceFile.relativePath(), "shell-tab-default-landing-literal",
                            "ShellTabSpec root metadata must expose a literal defaultLanding argument."));
                    continue;
                }
                String defaultLanding = arguments.get(3).trim();
                if (defaultLanding.equals("true")) {
                    defaultLandingRoots.add(sourceFile);
                    continue;
                }
                if (!defaultLanding.equals("false")) {
                    violations.add(new Violation(sourceFile.relativePath(), "shell-tab-default-landing-literal",
                            "ShellTabSpec defaultLanding must be the literal true or false so startup uniqueness can be enforced."));
                }
            }
        }

        if (defaultLandingRoots.size() > 1) {
            String files = defaultLandingRoots.stream()
                    .map(SourceFile::relativePath)
                    .sorted()
                    .collect(Collectors.joining(", "));
            violations.add(new Violation("src/view", "shell-default-landing-uniqueness",
                    "At most one ShellTabSpec root may declare defaultLanding=true. Found: " + files));
        }
    }

    private static List<List<String>> shellTabSpecArgumentLists(String sourceText) {
        List<List<String>> arguments = new ArrayList<>();
        Matcher matcher = SHELL_TAB_SPEC_CONSTRUCTOR_PATTERN.matcher(sourceText);
        while (matcher.find()) {
            int openParenthesis = matcher.end() - 1;
            int closeParenthesis = findClosingParenthesis(sourceText, openParenthesis);
            if (closeParenthesis < 0) {
                arguments.add(List.of());
                continue;
            }
            arguments.add(splitTopLevelArguments(sourceText.substring(openParenthesis + 1, closeParenthesis)));
        }
        return arguments;
    }

    private static int findClosingParenthesis(String sourceText, int openParenthesis) {
        int depth = 0;
        boolean inString = false;
        boolean inCharacter = false;
        boolean escaped = false;
        for (int index = openParenthesis; index < sourceText.length(); index++) {
            char character = sourceText.charAt(index);
            if (escaped) {
                escaped = false;
                continue;
            }
            if (inString || inCharacter) {
                if (character == '\\') {
                    escaped = true;
                    continue;
                }
                if (inString && character == '"') {
                    inString = false;
                }
                if (inCharacter && character == '\'') {
                    inCharacter = false;
                }
                continue;
            }
            if (character == '"') {
                inString = true;
                continue;
            }
            if (character == '\'') {
                inCharacter = true;
                continue;
            }
            if (character == '(') {
                depth++;
                continue;
            }
            if (character == ')') {
                depth--;
                if (depth == 0) {
                    return index;
                }
            }
        }
        return -1;
    }

    private static List<String> splitTopLevelArguments(String argumentsText) {
        List<String> arguments = new ArrayList<>();
        int start = 0;
        int depth = 0;
        boolean inString = false;
        boolean inCharacter = false;
        boolean escaped = false;
        for (int index = 0; index < argumentsText.length(); index++) {
            char character = argumentsText.charAt(index);
            if (escaped) {
                escaped = false;
                continue;
            }
            if (inString || inCharacter) {
                if (character == '\\') {
                    escaped = true;
                    continue;
                }
                if (inString && character == '"') {
                    inString = false;
                }
                if (inCharacter && character == '\'') {
                    inCharacter = false;
                }
                continue;
            }
            if (character == '"') {
                inString = true;
                continue;
            }
            if (character == '\'') {
                inCharacter = true;
                continue;
            }
            if (character == '(' || character == '[' || character == '{') {
                depth++;
                continue;
            }
            if (character == ')' || character == ']' || character == '}') {
                depth--;
                continue;
            }
            if (character == ',' && depth == 0) {
                arguments.add(argumentsText.substring(start, index).trim());
                start = index + 1;
            }
        }
        arguments.add(argumentsText.substring(start).trim());
        return arguments;
    }

    private void validateServiceContributionPlacement(List<SourceFile> sourceFiles, List<Violation> violations) {
        for (SourceFile sourceFile : sourceFiles) {
            if (!sourceFile.fileName().endsWith("ServiceContribution.java")) {
                continue;
            }
            if (sourceFile.relativePath().equals("shell/api/ServiceContribution.java")
                    || sourceFile.kind() == SourceKind.DATA_ROOT) {
                continue;
            }
            violations.add(new Violation(sourceFile.relativePath(), "service-contribution-placement",
                    "ServiceContribution roots are a data-feature registration boundary. Place them at src/data/<feature>/<Feature>ServiceContribution.java."));
        }
    }

    private void validateSchemaTableNameOwnership(List<SourceFile> sourceFiles, List<Violation> violations) {
        TreeMap<String, Set<String>> tableNamesByFeature = new TreeMap<>();
        for (SourceFile sourceFile : sourceFiles) {
            if (sourceFile.kind() != SourceKind.DATA_SCHEMA) {
                continue;
            }
            Matcher matcher = SCHEMA_TABLE_NAME_PATTERN.matcher(sourceFile.content());
            while (matcher.find()) {
                tableNamesByFeature
                        .computeIfAbsent(sourceFile.featureName(), ignored -> new TreeSet<>())
                        .add(matcher.group(1));
            }
        }

        for (SourceFile sourceFile : sourceFiles) {
            if (!sourceFile.isUnderDataFeatureRoot() || sourceFile.kind() == SourceKind.DATA_SCHEMA) {
                continue;
            }
            Set<String> tableNames = tableNamesByFeature.getOrDefault(sourceFile.featureName(), Set.of());
            for (String tableName : tableNames) {
                if (sourceFile.content().contains("\"" + tableName + "\"")) {
                    violations.add(new Violation(sourceFile.relativePath(), "data-schema-table-name-owned-by-schema",
                            "Table name literal '" + tableName
                                    + "' must be owned by the feature persistence schema. Reference the schema constant instead of duplicating the literal."));
                }
            }
        }
    }

    private Set<String> collectDomainFeatures(List<SourceFile> sourceFiles) {
        TreeSet<String> features = sourceFiles.stream()
                .filter(SourceFile::isUnderDomainFeatureRoot)
                .map(SourceFile::featureName)
                .filter(Objects::nonNull)
                .collect(Collectors.toCollection(TreeSet::new));
        Path domainRoot = repoRoot.resolve("src/domain");
        if (!Files.isDirectory(domainRoot)) {
            return features;
        }
        try (Stream<Path> stream = Files.list(domainRoot)) {
            stream.filter(Files::isDirectory)
                    .map(path -> path.getFileName().toString())
                    .forEach(features::add);
        } catch (IOException ignored) {
            // A scan-root violation is emitted by the directory validation pass.
        }
        return features;
    }

    private Set<String> collectDataFeatures(List<SourceFile> sourceFiles) {
        return sourceFiles.stream()
                .filter(SourceFile::isUnderDataFeatureRoot)
                .map(SourceFile::featureName)
                .filter(Objects::nonNull)
                .filter(featureName -> !featureName.equals("persistencecore"))
                .collect(Collectors.toCollection(TreeSet::new));
    }

    private String relativize(Path path) {
        return repoRoot.relativize(path.toAbsolutePath().normalize()).toString().replace('\\', '/');
    }

    private List<String> relativeSegments(Path path) {
        String relativePath = relativize(path);
        if (relativePath.isBlank()) {
            return List.of();
        }
        return Arrays.asList(relativePath.split("/"));
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
            return "Architecture check failed with " + violations.size() + " violation(s):" + System.lineSeparator() + body;
        }
    }

    public record Violation(String source, String rule, String details) {
    }

    private enum SourceKind {
        BOOTSTRAP,
        SHELL_HOST,
        SHELL_PANEL,
        VIEW_ROOT,
        ASSEMBLY,
        VIEW,
        CONTROLLER,
        MODEL,
        INTERACTOR,
        DOMAIN_API_ROOT,
        DOMAIN_API_EXPORTED,
        DOMAIN_APPLICATION,
        DOMAIN_ENTITY,
        DOMAIN_SERVICE,
        DOMAIN_QUERY,
        DOMAIN_VALUEOBJECT,
        DOMAIN_REPOSITORY,
        DATA_ROOT,
        DATA_REPOSITORY,
        DATA_QUERY,
        DATA_GATEWAY_LOCAL,
        DATA_GATEWAY_REMOTE,
        DATA_PERSISTENCECORE_SQLITE,
        DATA_SCHEMA,
        DATA_MODEL,
        DATA_MAPPER,
        UNKNOWN;

        boolean isDomain() {
            return switch (this) {
                case DOMAIN_API_ROOT, DOMAIN_API_EXPORTED, DOMAIN_APPLICATION, DOMAIN_ENTITY,
                        DOMAIN_SERVICE, DOMAIN_QUERY, DOMAIN_VALUEOBJECT, DOMAIN_REPOSITORY -> true;
                default -> false;
            };
        }

        boolean isDataFeature() {
            return switch (this) {
                case DATA_ROOT, DATA_REPOSITORY, DATA_QUERY, DATA_GATEWAY_LOCAL, DATA_GATEWAY_REMOTE,
                        DATA_SCHEMA, DATA_MODEL, DATA_MAPPER -> true;
                default -> false;
            };
        }

    }

    private record SourceFile(
            String relativePath,
            List<String> relativeSegments,
            String fileName,
            String content,
            String packageName,
            SourceKind kind,
            String featureName
    ) {
        static SourceFile parse(Path repoRoot, Path path) throws IOException {
            String content = Files.readString(path, StandardCharsets.UTF_8);
            String relativePath = repoRoot.relativize(path.toAbsolutePath().normalize()).toString().replace('\\', '/');
            List<String> relativeSegments = Arrays.asList(relativePath.split("/"));
            String fileName = path.getFileName().toString();
            String packageName = extractPackage(content);
            SourceKind kind = classify(relativeSegments, fileName);
            String featureName = extractFeatureName(relativeSegments);
            return new SourceFile(relativePath, relativeSegments, fileName, content, packageName, kind, featureName);
        }

        private static String extractPackage(String content) {
            Matcher matcher = PACKAGE_PATTERN.matcher(content);
            return matcher.find() ? matcher.group(1) : "";
        }

        private static SourceKind classify(List<String> segments, String fileName) {
            if (segments.isEmpty()) {
                return SourceKind.UNKNOWN;
            }
            String root = segments.getFirst();
            if ("bootstrap".equals(root)) {
                return SourceKind.BOOTSTRAP;
            }
            if ("shell".equals(root) && segments.size() >= 2) {
                return "host".equals(segments.get(1)) ? SourceKind.SHELL_HOST
                        : "panel".equals(segments.get(1)) ? SourceKind.SHELL_PANEL : SourceKind.UNKNOWN;
            }
            if (segments.size() < 3 || !"src".equals(root)) {
                return SourceKind.UNKNOWN;
            }
            return switch (segments.get(1)) {
                case "view" -> {
                    if (segments.size() == 4) {
                        yield SourceKind.VIEW_ROOT;
                    }
                    yield switch (segments.get(3)) {
                        case "assembly" -> SourceKind.ASSEMBLY;
                        case "View" -> SourceKind.VIEW;
                        case "Controller" -> SourceKind.CONTROLLER;
                        case "Model" -> SourceKind.MODEL;
                        case "interactor" -> SourceKind.INTERACTOR;
                        default -> SourceKind.UNKNOWN;
                    };
                }
                case "domain" -> {
                    if (segments.size() == 4) {
                        yield SourceKind.DOMAIN_API_ROOT;
                    }
                    yield switch (segments.get(3)) {
                        case "api" -> SourceKind.DOMAIN_API_EXPORTED;
                        case "application" -> SourceKind.DOMAIN_APPLICATION;
                        case "entity" -> SourceKind.DOMAIN_ENTITY;
                        case "service" -> SourceKind.DOMAIN_SERVICE;
                        case "query" -> SourceKind.DOMAIN_QUERY;
                        case "valueobject" -> SourceKind.DOMAIN_VALUEOBJECT;
                        case "repository" -> SourceKind.DOMAIN_REPOSITORY;
                        default -> SourceKind.UNKNOWN;
                    };
                }
                case "data" -> {
                    if (segments.size() == 4) {
                        yield fileName.equals(expectedDataRootFileName(extractFeatureName(segments)))
                                ? SourceKind.DATA_ROOT
                                : SourceKind.UNKNOWN;
                    }
                    if (segments.size() < 5) {
                        yield SourceKind.UNKNOWN;
                    }
                    if ("persistencecore".equals(segments.get(2))) {
                        yield switch (segments.get(3)) {
                            case "sqlite" -> SourceKind.DATA_PERSISTENCECORE_SQLITE;
                            case "model" -> fileName.equals(expectedDataSchemaFileName(extractFeatureName(segments)))
                                    ? SourceKind.DATA_SCHEMA
                                    : SourceKind.DATA_MODEL;
                            default -> SourceKind.UNKNOWN;
                        };
                    }
                    yield switch (segments.get(3)) {
                        case "repository" -> SourceKind.DATA_REPOSITORY;
                        case "query" -> SourceKind.DATA_QUERY;
                        case "model" -> fileName.equals(expectedDataSchemaFileName(extractFeatureName(segments)))
                                ? SourceKind.DATA_SCHEMA
                                : SourceKind.DATA_MODEL;
                        case "mapper" -> SourceKind.DATA_MAPPER;
                        case "gateway" -> {
                            if (segments.size() < 6) {
                                yield SourceKind.UNKNOWN;
                            }
                            yield switch (segments.get(4)) {
                                case "local" -> SourceKind.DATA_GATEWAY_LOCAL;
                                case "remote" -> SourceKind.DATA_GATEWAY_REMOTE;
                                default -> SourceKind.UNKNOWN;
                            };
                        }
                        default -> SourceKind.UNKNOWN;
                    };
                }
                default -> SourceKind.UNKNOWN;
            };
        }

        private static String extractFeatureName(List<String> segments) {
            if (segments.size() < 3) {
                return null;
            }
            if ("src".equals(segments.get(0))
                    && Set.of("domain", "data", "view").contains(segments.get(1))) {
                return segments.get(2);
            }
            return null;
        }

        private boolean isUnderDataFeatureRoot() {
            return relativeSegments.size() >= 3
                    && "src".equals(relativeSegments.get(0))
                    && "data".equals(relativeSegments.get(1))
                    && !"persistencecore".equals(relativeSegments.get(2));
        }

        private boolean isUnderDomainFeatureRoot() {
            return relativeSegments.size() >= 3
                    && "src".equals(relativeSegments.get(0))
                    && "domain".equals(relativeSegments.get(1));
        }

        private boolean isCanonicalViewRootContribution() {
            return kind == SourceKind.VIEW_ROOT && fileName.equals(expectedViewRootFileName(featureName));
        }
    }
}
