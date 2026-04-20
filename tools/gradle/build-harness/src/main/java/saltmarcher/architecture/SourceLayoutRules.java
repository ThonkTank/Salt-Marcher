package saltmarcher.architecture;

import static saltmarcher.architecture.ArchitectureNaming.expectedDataRootFileName;
import static saltmarcher.architecture.ArchitectureNaming.expectedDomainRootFileName;

import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;

final class SourceLayoutRules implements ArchitectureRule {

    private static final Pattern BACKEND_PORT_CONTRACT_FILE_PATTERN =
            Pattern.compile(".*(?:Repository|Port|Lookup)\\.java$");
    private static final Set<String> DOMAIN_ALLOWED_ROLE_PACKAGES =
            Set.of(
                    "aggregate",
                    "entity",
                    "value",
                    "policy",
                    "port",
                    "factory",
                    "service",
                    "event",
                    "specification");
    private static final Set<String> DOMAIN_TOP_LEVEL_FORBIDDEN_BUCKETS =
            Set.of(
                    "aggregate",
                    "aggregates",
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
                    "port",
                    "ports",
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

    @Override
    public void check(ArchitectureContext context, ViolationSink violations) {
        for (SourceFile sourceFile : context.sourceFiles(violations)) {
            validatePathLayout(sourceFile, violations);
            validatePackageMatchesPath(sourceFile, violations);
        }
    }

    private void validatePathLayout(SourceFile sourceFile, ViolationSink violations) {
        List<String> segments = sourceFile.relativeSegments();
        if (segments.isEmpty()) {
            return;
        }

        if ("bootstrap".equals(segments.getFirst())) {
            return;
        }

        if ("shell".equals(segments.getFirst())) {
            if (segments.size() < 2 || !Set.of("api", "host").contains(segments.get(1))) {
                violations.add(sourceFile.relativePath(), "shell-layout",
                        "Shell sources must live under shell/api or shell/host.");
            }
            return;
        }

        if (!"src".equals(segments.getFirst())) {
            violations.add(sourceFile.relativePath(), "root-layout",
                    "Sources must live under bootstrap/, shell/ or src/.");
            return;
        }

        if (segments.size() < 3) {
            violations.add(sourceFile.relativePath(), "src-layout",
                    "Sources under src/ must live in src/view, src/domain or src/data.");
            return;
        }

        switch (segments.get(1)) {
            case "view" -> {
                if (segments.size() < 3) {
                    violations.add(sourceFile.relativePath(), "view-layout",
                            "View sources must live under src/view/featuretabs, src/view/runtimetabs, src/view/dropdowns, or src/view/slotcontent.");
                    return;
                }
                String bucket = segments.get(2);
                if (bucket.equals("slotcontent")) {
                    if (segments.size() != 6 || !Set.of("controls", "main", "state", "details", "topbar").contains(segments.get(3))) {
                        violations.add(sourceFile.relativePath(), "view-layout",
                                "Slotcontent Java sources must be direct files under src/view/slotcontent/<slot>/<entry>/.");
                    }
                    return;
                }
                if (!Set.of("featuretabs", "runtimetabs", "dropdowns").contains(bucket)) {
                    violations.add(sourceFile.relativePath(), "view-layout",
                            "View Java sources must live under src/view/featuretabs, src/view/runtimetabs, src/view/dropdowns, or src/view/slotcontent.");
                    return;
                }
                if (segments.size() != 5) {
                    violations.add(sourceFile.relativePath(), "view-layout",
                            "Active view Java sources must be direct files under src/view/<area>/<entry>/.");
                }
            }
            case "domain" -> validateDomainLayout(sourceFile, violations);
            case "data" -> validateDataLayout(sourceFile, violations);
            default -> violations.add(sourceFile.relativePath(), "src-layout",
                    "Sources under src/ must live in src/view, src/domain or src/data.");
        }
    }

    private void validateDomainLayout(SourceFile sourceFile, ViolationSink violations) {
        List<String> segments = sourceFile.relativeSegments();
        if (segments.size() < 4) {
            violations.add(sourceFile.relativePath(), "domain-layout",
                    "Domain sources must live under src/domain/<feature>/...");
            return;
        }

        if (segments.size() == 4) {
            String feature = segments.get(2);
            String expected = expectedDomainRootFileName(feature);
            if (!sourceFile.fileName().equals(expected)) {
                violations.add(sourceFile.relativePath(), "domain-root-presence",
                        "Only <PascalFeatureName>ApplicationService.java may live directly under src/domain/<feature>/.");
            }
            return;
        }

        String bucket = segments.get(3);
        validateDomainBucket(sourceFile.relativePath(), bucket, violations);
        if (bucket.equals("published")) {
            validateDomainPublishedLayout(sourceFile, violations);
            return;
        }
        if (bucket.equals("application")) {
            validateDomainApplicationLayout(sourceFile, violations);
            return;
        }

        validateDomainRoleLayout(sourceFile, violations);
    }

    private void validateDomainPublishedLayout(SourceFile sourceFile, ViolationSink violations) {
        List<String> segments = sourceFile.relativeSegments();
        if (segments.size() != 5) {
            violations.add(sourceFile.relativePath(), "domain-published-direct-files",
                    "Domain published/ boundary carriers must be direct Java files under src/domain/<context>/published/.");
        }
        if (BACKEND_PORT_CONTRACT_FILE_PATTERN.matcher(sourceFile.fileName()).matches()) {
            violations.add(sourceFile.relativePath(), "domain-published-no-backend-port-contracts",
                    "Domain published/ packages are exported boundary-carrier surfaces. Backend port contracts such as *Repository, *Port or *Lookup belong in a named domain module port/ package.");
        }
    }

    private void validateDomainApplicationLayout(SourceFile sourceFile, ViolationSink violations) {
        List<String> segments = sourceFile.relativeSegments();
        if (segments.size() != 5) {
            violations.add(sourceFile.relativePath(), "domain-application-direct-usecases",
                    "Domain application/ code must be direct *UseCase.java files under src/domain/<context>/application/.");
        }
        if (!sourceFile.fileName().endsWith("UseCase.java")) {
            violations.add(sourceFile.relativePath(), "domain-application-direct-usecases",
                    "Domain application/ code must use *UseCase.java files.");
        }
        if (BACKEND_PORT_CONTRACT_FILE_PATTERN.matcher(sourceFile.fileName()).matches()) {
            violations.add(sourceFile.relativePath(), "domain-application-no-backend-port-contracts",
                    "Domain application/ packages coordinate use cases. Backend port contracts such as *Repository, *Port or *Lookup belong in a named domain module port/ package.");
        }
    }

    private void validateDomainRoleLayout(SourceFile sourceFile, ViolationSink violations) {
        List<String> segments = sourceFile.relativeSegments();
        if (segments.size() < 5) {
            violations.add(sourceFile.relativePath(), "domain-module-role-required",
                    "Named domain modules must place Java files under src/domain/<context>/<module>/<role>/.");
            return;
        }
        if (segments.size() != 6) {
            violations.add(sourceFile.relativePath(), "domain-role-direct-files",
                    "Domain role package Java files must be direct files under src/domain/<context>/<module>/<role>/.");
            return;
        }

        String role = segments.get(4);
        if (!DOMAIN_ALLOWED_ROLE_PACKAGES.contains(role)) {
            violations.add(sourceFile.relativePath(), "domain-role-package-name",
                    "Domain role packages must be one of: " + String.join(", ", DOMAIN_ALLOWED_ROLE_PACKAGES) + ".");
        }
    }

    private void validateDataLayout(SourceFile sourceFile, ViolationSink violations) {
        List<String> segments = sourceFile.relativeSegments();
        if (segments.size() == 4) {
            String expected = expectedDataRootFileName(segments.get(2));
            if (!sourceFile.fileName().equals(expected)) {
                violations.add(sourceFile.relativePath(), "data-layout",
                        "Only <PascalFeatureName>ServiceContribution.java may live directly under src/data/<feature>/.");
            }
            return;
        }
        if ("persistencecore".equals(segments.get(2))) {
            if (segments.size() < 5 || !Set.of("sqlite", "model").contains(segments.get(3))) {
                violations.add(sourceFile.relativePath(), "data-layout",
                        "Persistencecore sources must live under src/data/persistencecore/sqlite or src/data/persistencecore/model.");
            }
            return;
        }
        if (segments.size() < 5) {
            violations.add(sourceFile.relativePath(), "data-layout",
                    "Data sources must live under src/data/<feature>/<Feature>ServiceContribution.java,"
                            + " repository, query, gateway, model or mapper.");
            return;
        }

        String bucket = segments.get(3);
        switch (bucket) {
            case "repository", "query", "model", "mapper" -> {
            }
            case "gateway" -> {
                if (segments.size() < 6 || !Set.of("local", "remote").contains(segments.get(4))) {
                    violations.add(sourceFile.relativePath(), "data-layout",
                            "Gateways must live under gateway/local or gateway/remote.");
                }
            }
            default -> violations.add(sourceFile.relativePath(), "data-layout",
                    "Only a data root contribution, repository/, query/, gateway/local/, gateway/remote/, model/ and mapper/"
                            + " are allowed in data features.");
        }
    }

    private void validatePackageMatchesPath(SourceFile sourceFile, ViolationSink violations) {
        if (sourceFile.packageName().isBlank()) {
            violations.add(sourceFile.relativePath(), "package-declaration",
                    "Every Java source must declare a package.");
            return;
        }

        String expected = sourceFile.relativePath()
                .replace('\\', '/')
                .replaceAll("/[^/]+\\.java$", "")
                .replace('/', '.');
        if (!sourceFile.packageName().equals(expected)) {
            violations.add(sourceFile.relativePath(), "package-path-match",
                    "Package must match directory path. Expected '" + expected + "' but found '" + sourceFile.packageName() + "'.");
        }
    }

    static void validateDomainBucket(String source, String bucket, ViolationSink violations) {
        if (bucket.equals("published") || bucket.equals("application")) {
            return;
        }
        if (bucket.equals("api")) {
            violations.add(source, "domain-api-bucket-removed",
                    "Domain api/ packages have been replaced by published/.");
            return;
        }
        if (DOMAIN_TOP_LEVEL_FORBIDDEN_BUCKETS.contains(bucket)) {
            violations.add(source, "domain-top-level-role-bucket-ban",
                    "Top-level technical role buckets are forbidden under src/domain/<context>/. Use published/, application/, or a domain-concept module with role subpackages.");
            return;
        }
        if (!isNamedDomainModule(bucket)) {
            violations.add(source, "domain-module-name-shape",
                    "Named domain modules under src/domain/<context>/ must use lower-case package names matching [a-z][a-z0-9_]*.");
        }
    }

    static boolean isAllowedDomainRolePackage(String role) {
        return DOMAIN_ALLOWED_ROLE_PACKAGES.contains(role);
    }

    private static boolean isNamedDomainModule(String bucket) {
        return bucket.matches("[a-z][a-z0-9_]*")
                && !DOMAIN_TOP_LEVEL_FORBIDDEN_BUCKETS.contains(bucket)
                && !bucket.equals("api")
                && !bucket.equals("published")
                && !bucket.equals("application");
    }
}
