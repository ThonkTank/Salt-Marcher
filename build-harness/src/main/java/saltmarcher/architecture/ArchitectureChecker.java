package saltmarcher.architecture;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collection;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
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
    private static final Pattern IMPORT_PATTERN =
            Pattern.compile("(?m)^\\s*import\\s+(?:static\\s+)?([A-Za-z_][\\w.*]*)\\s*;");
    private static final Pattern SHELL_CONTRIBUTION_PATTERN =
            Pattern.compile("\\bimplements\\b[^\\{;]*\\b(?:shell\\.host\\.)?ShellViewContribution\\b");
    private static final Pattern SHELL_SCREEN_PATTERN =
            Pattern.compile("\\b(?:shell\\.host\\.)?ShellScreen\\b");
    private static final Set<String> DOMAIN_BANNED_TOKENS = Set.of(
            "javafx.",
            "javax.json",
            "jakarta.json",
            "com.fasterxml.jackson",
            "org.json",
            "java.sql.",
            "javax.sql.",
            "java.net.http",
            "okhttp3.",
            "retrofit2.",
            "java.io.",
            "java.nio.file."
    );
    private static final Set<String> VIEW_LEGACY_SHELL_TYPES = Set.of(
            "shell.host.AppShell",
            "shell.host.AppView",
            "shell.host.ShellServices",
            "shell.panel.DetailsNavigator",
            "shell.panel.SceneRegistry",
            "shell.panel.InspectorPane",
            "shell.panel.ScenePane",
            "shell.panel.RuntimeStatePane"
    );

    private final Path repoRoot;

    public ArchitectureChecker(Path repoRoot) {
        this.repoRoot = repoRoot.normalize().toAbsolutePath();
    }

    public Result check() {
        List<Violation> violations = new ArrayList<>();
        List<SourceFile> sourceFiles = loadSourceFiles(violations);
        Map<String, SourceFile> typeIndex = buildTypeIndex(sourceFiles);

        for (SourceFile sourceFile : sourceFiles) {
            validatePathLayout(sourceFile, violations);
            validatePackageMatchesPath(sourceFile, violations);
        }

        validateDomainFeatureBoundaries(sourceFiles, violations);
        validateViewRootEntrypoints(sourceFiles, violations);

        for (SourceFile sourceFile : sourceFiles) {
            List<SourceFile> projectDependencies = resolveProjectDependencies(sourceFile, typeIndex);
            validateDependencies(sourceFile, projectDependencies, violations);
            validateTextualRules(sourceFile, violations);
        }

        List<Violation> ordered = violations.stream()
                .sorted(Comparator.comparing(Violation::source)
                        .thenComparing(Violation::rule)
                        .thenComparing(Violation::details))
                .toList();
        return new Result(ordered);
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

    private static Map<String, SourceFile> buildTypeIndex(List<SourceFile> sourceFiles) {
        Map<String, SourceFile> typeIndex = new LinkedHashMap<>();
        for (SourceFile sourceFile : sourceFiles) {
            typeIndex.putIfAbsent(sourceFile.qualifiedTypeName(), sourceFile);
        }
        return typeIndex;
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
            if (segments.size() < 2 || !Set.of("host", "panel").contains(segments.get(1))) {
                violations.add(new Violation(sourceFile.relativePath(), "shell-layout",
                        "Shell sources must live under shell/host or shell/panel."));
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
            case "view" -> validateViewLayout(sourceFile, violations);
            case "domain" -> validateDomainLayout(sourceFile, violations);
            case "data" -> validateDataLayout(sourceFile, violations);
            default -> violations.add(new Violation(sourceFile.relativePath(), "src-layout",
                    "Sources under src/ must live in src/view, src/domain or src/data."));
        }
    }

    private void validateViewLayout(SourceFile sourceFile, List<Violation> violations) {
        List<String> segments = sourceFile.relativeSegments();
        if (segments.size() < 4) {
            violations.add(new Violation(sourceFile.relativePath(), "view-layout",
                    "View sources must live under src/view/<component>/..."));
            return;
        }

        if (segments.size() == 4) {
            return;
        }

        String bucket = segments.get(3);
        if (!Set.of("Model", "Controller", "View", "interactor").contains(bucket)) {
            violations.add(new Violation(sourceFile.relativePath(), "view-layout",
                    "Only Model/, Controller/, View/, interactor/ or a component root startup entrypoint are allowed."));
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
            String fileName = sourceFile.fileName();
            String feature = segments.get(2);
            String expected = feature + "API.java";
            if (!fileName.equals(expected)) {
                violations.add(new Violation(sourceFile.relativePath(), "domain-layout",
                        "Only <feature>API.java may live directly under src/domain/<feature>/."));
            }
            return;
        }

        String bucket = segments.get(3);
        if (!Set.of("api", "entity", "valueobject", "usecase", "repository").contains(bucket)) {
            violations.add(new Violation(sourceFile.relativePath(), "domain-layout",
                    "Only api/, entity/, valueobject/, usecase/ and repository/ are allowed in a feature."));
        }
        if (bucket.equals("service") || bucket.equals("services")) {
            violations.add(new Violation(sourceFile.relativePath(), "domain-no-service",
                    "Domain service/ or services/ directories are forbidden."));
        }
    }

    private void validateDataLayout(SourceFile sourceFile, List<Violation> violations) {
        List<String> segments = sourceFile.relativeSegments();
        if (segments.size() < 5) {
            violations.add(new Violation(sourceFile.relativePath(), "data-layout",
                    "Data sources must live under src/data/<feature>/repository, datasource, model or mapper."));
            return;
        }

        String bucket = segments.get(3);
        switch (bucket) {
            case "repository", "model", "mapper" -> {
            }
            case "datasource" -> {
                if (segments.size() < 6 || !Set.of("local", "remote").contains(segments.get(4))) {
                    violations.add(new Violation(sourceFile.relativePath(), "data-layout",
                            "Data sources must live under datasource/local or datasource/remote."));
                }
            }
            default -> violations.add(new Violation(sourceFile.relativePath(), "data-layout",
                    "Only repository/, datasource/local/, datasource/remote/, model/ and mapper/ are allowed in data features."))
            ;
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
        Map<String, Boolean> apiRoots = new HashMap<>();
        for (SourceFile sourceFile : sourceFiles) {
            if (sourceFile.kind() == SourceKind.DOMAIN_API_ROOT) {
                apiRoots.put(sourceFile.featureName(), Boolean.TRUE);
            }
        }
        for (SourceFile sourceFile : sourceFiles) {
            if (sourceFile.kind().isDomain() && sourceFile.featureName() != null && !apiRoots.containsKey(sourceFile.featureName())) {
                violations.add(new Violation(sourceFile.relativePath(), "feature-api-root",
                        "Feature '" + sourceFile.featureName() + "' is missing " + sourceFile.featureName() + "API.java at its root."));
            }
        }
    }

    private void validateViewRootEntrypoints(List<SourceFile> sourceFiles, List<Violation> violations) {
        Map<String, List<SourceFile>> rootsByComponent = new TreeMap<>();
        for (SourceFile sourceFile : sourceFiles) {
            if (sourceFile.kind() == SourceKind.VIEW_ROOT) {
                rootsByComponent.computeIfAbsent(sourceFile.featureName(), ignored -> new ArrayList<>()).add(sourceFile);
            }
        }

        for (Map.Entry<String, List<SourceFile>> entry : rootsByComponent.entrySet()) {
            String componentName = entry.getKey();
            List<SourceFile> roots = entry.getValue().stream()
                    .sorted(Comparator.comparing(SourceFile::relativePath))
                    .toList();
            if (roots.size() != 1) {
                String files = roots.stream().map(SourceFile::relativePath).collect(Collectors.joining(", "));
                violations.add(new Violation("src/view/" + componentName, "view-root-entrypoint",
                        "Each component must expose exactly one root entrypoint. Found: " + files));
            }

            for (SourceFile root : roots) {
                String expectedFileName = toContributionClassName(componentName) + ".java";
                if (!root.fileName().equals(expectedFileName)) {
                    violations.add(new Violation(root.relativePath(), "view-root-name",
                            "Root view entrypoint must be named '" + expectedFileName + "'."));
                }
                if (!SHELL_CONTRIBUTION_PATTERN.matcher(root.content()).find()) {
                    violations.add(new Violation(root.relativePath(), "view-root-contract",
                            "Root view entrypoint must implement shell.host.ShellViewContribution."));
                }
                if (!SHELL_SCREEN_PATTERN.matcher(root.content()).find() || !root.content().contains("createScreen(")) {
                    violations.add(new Violation(root.relativePath(), "view-root-wiring-path",
                            "Root view entrypoint must use the single wiring path ShellViewContribution -> ShellScreen -> ShellSlot."));
                }
            }
        }
    }

    private List<SourceFile> resolveProjectDependencies(SourceFile sourceFile, Map<String, SourceFile> typeIndex) {
        Set<SourceFile> dependencies = new LinkedHashSet<>();
        for (String imported : sourceFile.imports()) {
            if (imported.endsWith(".*")) {
                String packagePrefix = imported.substring(0, imported.length() - 2);
                typeIndex.values().stream()
                        .filter(candidate -> candidate.packageName().equals(packagePrefix))
                        .forEach(dependencies::add);
                continue;
            }
            SourceFile dependency = typeIndex.get(imported);
            if (dependency != null) {
                dependencies.add(dependency);
            }
        }

        for (SourceFile candidate : typeIndex.values()) {
            if (candidate.equals(sourceFile)) {
                continue;
            }
            if (sourceFile.content().contains(candidate.qualifiedTypeName())) {
                dependencies.add(candidate);
            }
        }

        return dependencies.stream()
                .sorted(Comparator.comparing(SourceFile::relativePath))
                .toList();
    }

    private void validateDependencies(SourceFile sourceFile, List<SourceFile> dependencies, List<Violation> violations) {
        for (SourceFile dependency : dependencies) {
            if (createsBootstrapViewCoupling(sourceFile, dependency)) {
                violations.add(new Violation(sourceFile.relativePath(), "bootstrap-view-coupling",
                        "Bootstrap must stay generic and must not depend on concrete view classes such as "
                                + dependency.relativePath()));
            }
            if (violatesLayerRule(sourceFile, dependency)) {
                violations.add(new Violation(sourceFile.relativePath(), "layer-dependency",
                        "Forbidden dependency on " + dependency.relativePath()));
            }
            if (violatesInteractorBoundary(sourceFile, dependency)) {
                violations.add(new Violation(sourceFile.relativePath(), "interactor-boundary",
                        "Interactor may only access <feature>API.java and domain/<feature>/api types, but references "
                                + dependency.relativePath()));
            }
            if (violatesFeatureVisibility(sourceFile, dependency)) {
                violations.add(new Violation(sourceFile.relativePath(), "feature-visibility",
                        "Only " + dependency.featureName() + "API.java and " + dependency.featureName()
                                + "/api types may be referenced from outside feature '" + dependency.featureName() + "'."));
            }
            if (createsDomainFeatureCrossReference(sourceFile, dependency)) {
                violations.add(new Violation(sourceFile.relativePath(), "data-feature-isolation",
                        "Data feature '" + sourceFile.featureName() + "' must not depend on another feature's domain internals: "
                                + dependency.relativePath()));
            }
        }
    }

    private void validateTextualRules(SourceFile sourceFile, List<Violation> violations) {
        if (sourceFile.kind().isViewAny()) {
            for (String legacyType : VIEW_LEGACY_SHELL_TYPES) {
                if (sourceFile.content().contains(legacyType)) {
                    violations.add(new Violation(sourceFile.relativePath(), "view-legacy-wiring-path",
                            "View code must not use legacy shell wiring type '" + legacyType + "'."));
                }
            }
        }
        if (sourceFile.kind().isDomain()) {
            for (String token : DOMAIN_BANNED_TOKENS) {
                if (sourceFile.content().contains(token)) {
                    violations.add(new Violation(sourceFile.relativePath(), "domain-framework-ban",
                            "Domain code must not reference '" + token + "'."));
                }
            }
        }
    }

    private boolean violatesLayerRule(SourceFile source, SourceFile target) {
        SourceKind sourceKind = source.kind();
        SourceKind targetKind = target.kind();

        if (sourceKind == SourceKind.BOOTSTRAP && targetKind.isDomainOrData()) {
            return true;
        }
        if (sourceKind.isShell() && !targetKind.isShell()) {
            return true;
        }
        if ((sourceKind == SourceKind.VIEW || sourceKind == SourceKind.CONTROLLER) && targetKind.isDomainOrData()) {
            return true;
        }
        if (sourceKind.isViewAny() && targetKind.isData()) {
            return true;
        }
        if (sourceKind.isDomain() && (targetKind.isViewAny() || targetKind.isShell() || targetKind.isData())) {
            return true;
        }
        return false;
    }

    private boolean createsBootstrapViewCoupling(SourceFile source, SourceFile target) {
        return source.kind() == SourceKind.BOOTSTRAP && target.kind().isViewAny();
    }

    private boolean violatesInteractorBoundary(SourceFile source, SourceFile target) {
        if (source.kind() != SourceKind.INTERACTOR || !target.kind().isDomain()) {
            return false;
        }
        return !(target.kind() == SourceKind.DOMAIN_API_ROOT || target.kind() == SourceKind.DOMAIN_API_EXPORTED);
    }

    private boolean violatesFeatureVisibility(SourceFile source, SourceFile target) {
        if (!target.kind().isDomain()) {
            return false;
        }
        if (Objects.equals(source.featureName(), target.featureName())) {
            return false;
        }
        if (source.kind().isSameFeatureDomain(target.featureName())) {
            return false;
        }
        return !(target.kind() == SourceKind.DOMAIN_API_ROOT || target.kind() == SourceKind.DOMAIN_API_EXPORTED);
    }

    private boolean createsDomainFeatureCrossReference(SourceFile source, SourceFile target) {
        if (!source.kind().isData() || !target.kind().isDomain()) {
            return false;
        }
        return !Objects.equals(source.featureName(), target.featureName());
    }

    private String relativize(Path path) {
        return repoRoot.relativize(path.toAbsolutePath().normalize()).toString().replace('\\', '/');
    }

    private static String toContributionClassName(String componentName) {
        StringBuilder result = new StringBuilder();
        boolean capitalizeNext = true;
        for (char character : componentName.toCharArray()) {
            if (!Character.isLetterOrDigit(character)) {
                capitalizeNext = true;
                continue;
            }
            if (capitalizeNext) {
                result.append(Character.toUpperCase(character));
                capitalizeNext = false;
            } else {
                result.append(character);
            }
        }
        result.append("ViewContribution");
        return result.toString();
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
        VIEW,
        CONTROLLER,
        MODEL,
        INTERACTOR,
        DOMAIN_API_ROOT,
        DOMAIN_API_EXPORTED,
        DOMAIN_ENTITY,
        DOMAIN_VALUEOBJECT,
        DOMAIN_USECASE,
        DOMAIN_REPOSITORY,
        DATA_REPOSITORY,
        DATA_DATASOURCE_LOCAL,
        DATA_DATASOURCE_REMOTE,
        DATA_MODEL,
        DATA_MAPPER,
        UNKNOWN;

        boolean isShell() {
            return this == SHELL_HOST || this == SHELL_PANEL;
        }

        boolean isViewAny() {
            return EnumSet.of(VIEW_ROOT, VIEW, CONTROLLER, MODEL, INTERACTOR).contains(this);
        }

        boolean isDomain() {
            return EnumSet.of(DOMAIN_API_ROOT, DOMAIN_API_EXPORTED, DOMAIN_ENTITY, DOMAIN_VALUEOBJECT, DOMAIN_USECASE, DOMAIN_REPOSITORY)
                    .contains(this);
        }

        boolean isData() {
            return EnumSet.of(DATA_REPOSITORY, DATA_DATASOURCE_LOCAL, DATA_DATASOURCE_REMOTE, DATA_MODEL, DATA_MAPPER)
                    .contains(this);
        }

        boolean isDomainOrData() {
            return isDomain() || isData();
        }

        boolean isSameFeatureDomain(String featureName) {
            return isDomain();
        }
    }

    private record SourceFile(
            Path absolutePath,
            String relativePath,
            List<String> relativeSegments,
            String fileName,
            String packageName,
            List<String> imports,
            String content,
            SourceKind kind,
            String featureName,
            String qualifiedTypeName
    ) {
        static SourceFile parse(Path repoRoot, Path path) throws IOException {
            String content = Files.readString(path, StandardCharsets.UTF_8);
            String relativePath = repoRoot.relativize(path.toAbsolutePath().normalize()).toString().replace('\\', '/');
            List<String> relativeSegments = Arrays.asList(relativePath.split("/"));
            String fileName = path.getFileName().toString();
            String packageName = extractPackage(content);
            List<String> imports = extractImports(content);
            SourceKind kind = classify(relativeSegments, fileName);
            String featureName = extractFeatureName(relativeSegments);
            String qualifiedTypeName = packageName.isBlank()
                    ? fileName.replace(".java", "")
                    : packageName + "." + fileName.replace(".java", "");
            return new SourceFile(path, relativePath, relativeSegments, fileName, packageName, imports, content, kind, featureName,
                    qualifiedTypeName);
        }

        private static String extractPackage(String content) {
            Matcher matcher = PACKAGE_PATTERN.matcher(content);
            return matcher.find() ? matcher.group(1) : "";
        }

        private static List<String> extractImports(String content) {
            Matcher matcher = IMPORT_PATTERN.matcher(content);
            List<String> imports = new ArrayList<>();
            while (matcher.find()) {
                imports.add(matcher.group(1));
            }
            return imports;
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
                        case "entity" -> SourceKind.DOMAIN_ENTITY;
                        case "valueobject" -> SourceKind.DOMAIN_VALUEOBJECT;
                        case "usecase" -> SourceKind.DOMAIN_USECASE;
                        case "repository" -> SourceKind.DOMAIN_REPOSITORY;
                        default -> SourceKind.UNKNOWN;
                    };
                }
                case "data" -> {
                    if (segments.size() < 5) {
                        yield SourceKind.UNKNOWN;
                    }
                    yield switch (segments.get(3)) {
                        case "repository" -> SourceKind.DATA_REPOSITORY;
                        case "model" -> SourceKind.DATA_MODEL;
                        case "mapper" -> SourceKind.DATA_MAPPER;
                        case "datasource" -> {
                            if (segments.size() < 6) {
                                yield SourceKind.UNKNOWN;
                            }
                            yield switch (segments.get(4)) {
                                case "local" -> SourceKind.DATA_DATASOURCE_LOCAL;
                                case "remote" -> SourceKind.DATA_DATASOURCE_REMOTE;
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
            if ("src".equals(segments.get(0)) && Set.of("domain", "data").contains(segments.get(1))) {
                return segments.get(2);
            }
            if ("src".equals(segments.get(0)) && "view".equals(segments.get(1))) {
                return segments.get(2);
            }
            return null;
        }
    }
}
