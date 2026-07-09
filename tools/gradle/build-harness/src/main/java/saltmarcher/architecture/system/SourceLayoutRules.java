package saltmarcher.architecture.system;

import java.util.List;
import saltmarcher.architecture.ArchitectureRule;
import saltmarcher.architecture.SourceFile;
import saltmarcher.architecture.ViolationSink;
import saltmarcher.architecture.ArchitectureContext;

public final class SourceLayoutRules implements ArchitectureRule {
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
                    "Sources must live under bootstrap/, shell/, or src/.");
            return;
        }

        if (segments.size() < 3) {
            violations.add(sourceFile.relativePath(), "src-layout",
                    "Sources under src/ must live in src/features, src/view, src/domain, or src/data.");
            return;
        }

        switch (segments.get(1)) {
            case "features" -> {
                // Root ownership only; migration designs own feature internals.
            }
            case "view" -> {
                // Root ownership only; view form roles were retired by M0.4.
            }
            case "domain" -> {
                if (segments.size() < 4) {
                    violations.add(sourceFile.relativePath(), "domain-layout",
                            "Domain sources must live under src/domain/<feature>/...");
                }
            }
            case "data" -> {
                // Root ownership only; data form roles were retired by M0.4.
            }
            default -> violations.add(sourceFile.relativePath(), "src-layout",
                    "Sources under src/ must live in src/features, src/view, src/domain, or src/data.");
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
}
