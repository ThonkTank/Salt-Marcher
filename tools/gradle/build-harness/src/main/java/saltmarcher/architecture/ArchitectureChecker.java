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
    private static final Pattern SELF_TEST_FILE_PATTERN =
            Pattern.compile(".*SelfTest.*\\.java$");
    private static final Set<String> DOMAIN_TOLERATED_LEGACY_BUCKETS =
            Set.of("entity", "service", "valueobject", "repository", "query");
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
        List<SourceFile> sourceFiles = loadSourceFiles(violations);

        for (SourceFile sourceFile : sourceFiles) {
            validatePathLayout(sourceFile, violations);
            validatePackageMatchesPath(sourceFile, violations);
        }

        validateDomainFeatureBoundaries(sourceFiles, violations);
        validatePersistenceEntrypoints(sourceFiles, violations);

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
                violations.add(new Violation(sourceFile.relativePath(), "domain-layout",
                        "Only <PascalFeatureName>ApplicationService.java may live directly under src/domain/<feature>/."));
            }
            return;
        }

        String bucket = segments.get(3);
        if (bucket.equals("services")) {
            violations.add(new Violation(sourceFile.relativePath(), "domain-no-service",
                    "Domain services/ directories are forbidden. Use api/, application/, a named domain module,"
                            + " or a tolerated legacy role bucket during migration."));
        }
        if (!isAllowedDomainBucket(bucket)) {
            violations.add(new Violation(sourceFile.relativePath(), "domain-layout",
                    "Only api/, application/, named domain modules, and tolerated legacy root role buckets"
                            + " (entity/, service/, valueobject/, repository/, query/) are allowed in a domain feature."));
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
            violations.add(new Violation("src/domain/" + featureName, "application-service-root",
                    "Domain feature '" + featureName + "' must expose exactly one root application service."
                            + " Expected " + expectedDomainRootFileName(featureName) + ". Found: " + files));
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

    private static boolean isAllowedDomainBucket(String bucket) {
        return bucket.equals("api")
                || bucket.equals("application")
                || DOMAIN_TOLERATED_LEGACY_BUCKETS.contains(bucket)
                || isNamedDomainModule(bucket);
    }

    private static boolean isNamedDomainModule(String bucket) {
        if (!bucket.matches("[a-z][a-z0-9_]*")) {
            return false;
        }
        return !DOMAIN_FORBIDDEN_ROLE_BUCKETS.contains(bucket);
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

    private Set<String> collectDomainFeatures(List<SourceFile> sourceFiles) {
        return sourceFiles.stream()
                .filter(sourceFile -> sourceFile.kind().isDomain())
                .map(SourceFile::featureName)
                .filter(Objects::nonNull)
                .collect(Collectors.toCollection(TreeSet::new));
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
            return new SourceFile(relativePath, relativeSegments, fileName, packageName, kind, featureName);
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
    }
}
