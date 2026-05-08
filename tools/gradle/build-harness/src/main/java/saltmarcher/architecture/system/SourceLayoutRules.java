package saltmarcher.architecture.system;

import java.util.List;
import java.util.Set;
import saltmarcher.architecture.ArchitectureContext;
import saltmarcher.architecture.ArchitectureRule;
import saltmarcher.architecture.SourceFile;
import saltmarcher.architecture.ViolationSink;
import saltmarcher.architecture.view.ViewTopologyCatalog;

public final class SourceLayoutRules implements ArchitectureRule {

    private static final Set<String> DOMAIN_TARGET_ROLE_PACKAGES =
            Set.of(
                    "model",
                    "constants",
                    "helper",
                    "port",
                    "repository",
                    "usecase");
    private static final Set<String> DOMAIN_LEGACY_ROLE_PACKAGES =
            Set.of(
                    "aggregate",
                    "entity",
                    "value",
                    "policy",
                    "factory",
                    "service",
                    "event",
                    "specification");
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
            case "view" -> validateViewLayout(sourceFile, violations);
            case "domain" -> validateDomainLayout(sourceFile, violations);
            case "data" -> {
                // Data layer layout and feature-root topology live in the dedicated data-layer bundle.
            }
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
            return;
        }

        String bucket = segments.get(3);
        if (bucket.equals("published")) {
            return;
        }
        if (bucket.equals("application")) {
            validateDomainApplicationLayout(sourceFile, violations);
            return;
        }
    }

    private void validateViewLayout(SourceFile sourceFile, ViolationSink violations) {
        List<String> segments = sourceFile.relativeSegments();
        if (segments.size() < 3) {
            violations.add(sourceFile.relativePath(), "view-layout",
                    "View sources must live under src/view/leftbartabs, src/view/statetabs, src/view/dropdowns, or src/view/slotcontent.");
            return;
        }

        if (ViewTopologyCatalog.describe(sourceFile).isRecognizedViewSource()) {
            return;
        }

        if ("slotcontent".equals(segments.get(2))) {
            violations.add(sourceFile.relativePath(), "view-layout",
                    "Slotcontent Java sources must be direct files under src/view/slotcontent/<slot>/<entry>/.");
            return;
        }

        violations.add(sourceFile.relativePath(), "view-layout",
                "View Java sources must live under src/view/leftbartabs, src/view/statetabs, src/view/dropdowns, or src/view/slotcontent.");
    }
    private void validateDomainApplicationLayout(SourceFile sourceFile, ViolationSink violations) {
        // Domain UseCase bundle owns all application/*UseCase layout and naming enforcement.
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

    public static boolean isAllowedDomainRolePackage(String role) {
        return isAllowedTargetDomainRolePackage(role) || isLegacyDomainRolePackage(role);
    }

    public static boolean isAllowedTargetDomainRolePackage(String role) {
        return DOMAIN_TARGET_ROLE_PACKAGES.contains(role);
    }

    public static boolean isLegacyDomainRolePackage(String role) {
        return DOMAIN_LEGACY_ROLE_PACKAGES.contains(role);
    }
}
