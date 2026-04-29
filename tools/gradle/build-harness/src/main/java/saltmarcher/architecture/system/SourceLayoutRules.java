package saltmarcher.architecture.system;

import static saltmarcher.architecture.ArchitectureNaming.isFeatureFileName;

import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;
import saltmarcher.architecture.ArchitectureContext;
import saltmarcher.architecture.ArchitectureRule;
import saltmarcher.architecture.SourceFile;
import saltmarcher.architecture.ViolationSink;

public final class SourceLayoutRules implements ArchitectureRule {

    private static final Pattern BACKEND_PORT_CONTRACT_FILE_PATTERN =
            Pattern.compile(".*(?:Repository|Lookup|Catalog|Search)\\.java$");
    private static final Pattern GENERIC_USE_CASE_FILE_PATTERN =
            Pattern.compile(".*(?:Operations|Helper|Adapter|Repository|Mapper|Policy)UseCase\\.java$");
    private static final Pattern PUBLISHED_CALLABLE_CONTRACT_FILE_PATTERN =
            Pattern.compile(".*(?:ApplicationService|Service|Facade|Repository|Lookup|Catalog|Search|Port|Gateway|Factory|Locator|Policy)\\.java$");
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
                    "adapter",
                    "adapters",
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
                    "record",
                    "records",
                    "repository",
                    "repositories",
                    "schema",
                    "schemas",
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
            validatePathLayout(context, sourceFile, violations);
            validatePackageMatchesPath(sourceFile, violations);
        }
    }

    private void validatePathLayout(ArchitectureContext context, SourceFile sourceFile, ViolationSink violations) {
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
                            "View sources must live under src/view/leftbartabs, src/view/statetabs, src/view/dropdowns, or src/view/slotcontent.");
                    return;
                }
                String bucket = segments.get(2);
                if (bucket.equals("slotcontent")) {
                    if (segments.size() != 6
                            || !Set.of("controls", "main", "state", "details", "topbar", "primitives")
                            .contains(segments.get(3))) {
                        violations.add(sourceFile.relativePath(), "view-layout",
                                "Slotcontent Java sources must be direct files under src/view/slotcontent/<slot>/<entry>/.");
                    }
                    return;
                }
                if (!Set.of("leftbartabs", "statetabs", "dropdowns").contains(bucket)) {
                    violations.add(sourceFile.relativePath(), "view-layout",
                            "View Java sources must live under src/view/leftbartabs, src/view/statetabs, src/view/dropdowns, or src/view/slotcontent.");
                    return;
                }
                if (segments.size() != 5) {
                    violations.add(sourceFile.relativePath(), "view-layout",
                            "Active view Java sources must be direct files under src/view/<area>/<entry>/.");
                }
            }
            case "domain" -> validateDomainLayout(context, sourceFile, violations);
            case "data" -> validateDataLayout(context, sourceFile, violations);
            default -> violations.add(sourceFile.relativePath(), "src-layout",
                    "Sources under src/ must live in src/view, src/domain or src/data.");
        }
    }

    private void validateDomainLayout(ArchitectureContext context, SourceFile sourceFile, ViolationSink violations) {
        List<String> segments = sourceFile.relativeSegments();
        if (segments.size() < 4) {
            violations.add(sourceFile.relativePath(), "domain-layout",
                    "Domain sources must live under src/domain/<feature>/...");
            return;
        }

        if (segments.size() == 4) {
            String feature = segments.get(2);
            String contextName = context.domainContextName(feature);
            if (!isFeatureFileName(feature, contextName, sourceFile.fileName(), "ApplicationService")) {
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
        if (PUBLISHED_CALLABLE_CONTRACT_FILE_PATTERN.matcher(sourceFile.fileName()).matches()) {
            violations.add(sourceFile.relativePath(), "domain-published-no-callable-contracts",
                    "Domain published/ packages are exported boundary-carrier surfaces. Callable services, facades, ports, gateways, factories, policies, and backend port contracts belong outside published/.");
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
        if (GENERIC_USE_CASE_FILE_PATTERN.matcher(sourceFile.fileName()).matches()) {
            violations.add(sourceFile.relativePath(), "domain-application-no-generic-usecase-names",
                    "Domain application/ use cases must be named for a specific user or application action, not generic operations, helper, adapter, repository, mapper, or policy buckets.");
        }
        if (BACKEND_PORT_CONTRACT_FILE_PATTERN.matcher(sourceFile.fileName()).matches()) {
            violations.add(sourceFile.relativePath(), "domain-application-no-backend-port-contracts",
                    "Domain application/ packages coordinate use cases. Backend port contracts such as *Repository, *Lookup, *Catalog, or *Search belong in a named domain module port/ package.");
        }
    }

    private void validateDomainRoleLayout(SourceFile sourceFile, ViolationSink violations) {
        List<String> segments = sourceFile.relativeSegments();
        if (segments.size() < 5) {
            violations.add(sourceFile.relativePath(), "domain-module-role-required",
                    "Named domain modules must place Java files under an allowed tactical role package at src/domain/<context>/<module>/<role>/. This is a package allowlist, not a required role inventory.");
            return;
        }
        if (segments.size() != 6) {
            violations.add(sourceFile.relativePath(), "domain-role-direct-files",
                    "Domain tactical role package Java files must be direct files under src/domain/<context>/<module>/<role>/.");
            return;
        }

        String role = segments.get(4);
        if (!DOMAIN_ALLOWED_ROLE_PACKAGES.contains(role)) {
            violations.add(sourceFile.relativePath(), "domain-role-package-name",
                    "Domain tactical role packages must be one of: " + String.join(", ", DOMAIN_ALLOWED_ROLE_PACKAGES) + ".");
        }
    }

    private void validateDataLayout(ArchitectureContext context, SourceFile sourceFile, ViolationSink violations) {
        List<String> segments = sourceFile.relativeSegments();
        if (segments.size() == 4) {
            String feature = segments.get(2);
            String contextName = context.domainContextName(feature);
            if (!isFeatureFileName(feature, contextName, sourceFile.fileName(), "ServiceContribution")) {
                violations.add(sourceFile.relativePath(), "data-root-service-contribution-only",
                        "Only <PascalFeatureName>ServiceContribution.java may live directly under src/data/<feature>/.");
            }
            return;
        }
        if ("persistencecore".equals(segments.get(2))) {
            if (segments.size() < 5 || !Set.of("sqlite", "model").contains(segments.get(3))) {
                violations.add(sourceFile.relativePath(), "data-feature-bucket-layout",
                        "Persistencecore sources must live under src/data/persistencecore/sqlite or src/data/persistencecore/model.");
            }
            return;
        }
        if (segments.size() < 5) {
            violations.add(sourceFile.relativePath(), "data-feature-bucket-layout",
                    "Data sources must live under src/data/<feature>/<Feature>ServiceContribution.java,"
                            + " repository, query, gateway, model, or mapper according to the current adapter layout.");
            return;
        }

        String bucket = segments.get(3);
        switch (bucket) {
            case "repository", "query", "model", "mapper" -> {
            }
            case "gateway" -> {
                if (segments.size() < 6 || !Set.of("local", "remote").contains(segments.get(4))) {
                    violations.add(sourceFile.relativePath(), "data-feature-bucket-layout",
                            "Source adapters in the physical gateway/ package must live under gateway/local or gateway/remote.");
                }
            }
            default -> violations.add(sourceFile.relativePath(), "data-feature-bucket-layout",
                    "Only a composition adapter root, repository/ and query/ port adapters, gateway/local/ and gateway/remote/ source adapters, model/ source models, and mapper/ translators are allowed in data features.");
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

    public static void validateDomainBucket(String source, String bucket, ViolationSink violations) {
        if (bucket.equals("published") || bucket.equals("application")) {
            return;
        }
        if (bucket.equals("api")) {
            violations.add(source, "domain-forbidden-top-level-bucket",
                    "Domain api/ packages have been replaced by published/.");
            return;
        }
        if (DOMAIN_TOP_LEVEL_FORBIDDEN_BUCKETS.contains(bucket)) {
            violations.add(source, "domain-forbidden-top-level-bucket",
                    "Top-level technical role buckets are forbidden under src/domain/<context>/. Use published/, application/, or a domain-concept module with role subpackages.");
            return;
        }
        if (!isNamedDomainModule(bucket)) {
            violations.add(source, "domain-module-name-shape",
                    "Named domain modules under src/domain/<context>/ must use lower-case package names matching [a-z][a-z0-9_]*.");
        }
    }

    public static boolean isAllowedDomainRolePackage(String role) {
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
