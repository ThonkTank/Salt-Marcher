package saltmarcher.architecture.feature;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import saltmarcher.architecture.ArchitectureContext;
import saltmarcher.architecture.ArchitectureRule;
import saltmarcher.architecture.SourceFile;
import saltmarcher.architecture.ViolationSink;

public final class FeatureRuntimeFitnessRules implements ArchitectureRule {

    private static final String PACKAGE_FAMILY_RULE = "feature-runtime-package-family-shape";
    private static final String RUNTIME_ROOT_RULE = "feature-runtime-runtime-root-presence";
    private static final String SHELL_BINDING_RULE = "feature-runtime-shell-binding-narrowness";
    private static final String COMPATIBILITY_SEAM_RULE = "feature-runtime-compatibility-seam-locality";
    private static final Set<String> ALLOWED_PACKAGE_FAMILIES = Set.of("runtime", "ui", "storage", "shell");
    private static final Pattern IMPORT_PATTERN = Pattern.compile("(?m)^\\s*import\\s+([^;]+);");

    @Override
    public void check(ArchitectureContext context, ViolationSink violations) {
        List<SourceFile> featureSources = featureSources(context, violations);
        validatePackageFamilies(featureSources, violations);
        for (Map.Entry<String, List<SourceFile>> entry : sourcesByFeatureRoot(featureSources).entrySet()) {
            validateRuntimeRoot(entry.getKey(), entry.getValue(), violations);
            validateShellBindings(entry.getKey(), entry.getValue(), violations);
            validateCompatibilitySeams(entry.getKey(), entry.getValue(), violations);
        }
    }

    private static List<SourceFile> featureSources(ArchitectureContext context, ViolationSink violations) {
        List<SourceFile> result = new ArrayList<>();
        for (SourceFile sourceFile : context.sourceFiles(violations)) {
            if (isFeatureRuntimeSource(sourceFile)) {
                result.add(sourceFile);
            }
        }
        return result;
    }

    private static boolean isFeatureRuntimeSource(SourceFile sourceFile) {
        List<String> segments = sourceFile.relativeSegments();
        return segments.size() >= 4
                && "src".equals(segments.get(0))
                && "features".equals(segments.get(1));
    }

    private static Map<String, List<SourceFile>> sourcesByFeatureRoot(List<SourceFile> featureSources) {
        Map<String, List<SourceFile>> result = new LinkedHashMap<>();
        for (SourceFile sourceFile : featureSources) {
            result.computeIfAbsent(featureRoot(sourceFile), ignored -> new ArrayList<>()).add(sourceFile);
        }
        return result;
    }

    private static String featureRoot(SourceFile sourceFile) {
        return "src/features/" + featureName(sourceFile);
    }

    private static String featureName(SourceFile sourceFile) {
        return sourceFile.relativeSegments().get(2);
    }

    private static String packageFamily(SourceFile sourceFile) {
        return sourceFile.relativeSegments().size() >= 4 ? sourceFile.relativeSegments().get(3) : "";
    }

    private static void validatePackageFamilies(List<SourceFile> featureSources, ViolationSink violations) {
        for (SourceFile sourceFile : featureSources) {
            if (!ALLOWED_PACKAGE_FAMILIES.contains(packageFamily(sourceFile))) {
                violations.add(sourceFile.relativePath(), PACKAGE_FAMILY_RULE,
                        "Feature-runtime source files must live under runtime/, ui/, storage/, or shell/.");
            }
        }
    }

    private static void validateRuntimeRoot(
            String featureRoot,
            List<SourceFile> featureSources,
            ViolationSink violations
    ) {
        List<SourceFile> runtimeSources = featureSources.stream()
                .filter(sourceFile -> "runtime".equals(packageFamily(sourceFile)))
                .toList();
        if (runtimeSources.isEmpty()) {
            return;
        }

        List<SourceFile> runtimeRoots = runtimeSources.stream()
                .filter(sourceFile -> sourceFile.fileName().endsWith("FeatureRuntimeRoot.java"))
                .toList();
        if (runtimeRoots.size() != 1) {
            violations.add(featureRoot, RUNTIME_ROOT_RULE,
                    "An active feature runtime root with runtime sources must declare exactly one "
                            + "runtime/*FeatureRuntimeRoot.java owner.");
            return;
        }

        SourceFile runtimeRoot = runtimeRoots.getFirst();
        String simpleName = simpleTypeName(runtimeRoot);
        if (!runtimeRoot.content().contains("public final class " + simpleName)) {
            violations.add(runtimeRoot.relativePath(), RUNTIME_ROOT_RULE,
                    "Feature runtime roots must be public final classes.");
        }
        if (!runtimeRoot.content().contains(" implements ")
                || !runtimeRoot.content().contains("RuntimeOperations")) {
            violations.add(runtimeRoot.relativePath(), RUNTIME_ROOT_RULE,
                    "Feature runtime roots must expose the migrated runtime operations boundary directly.");
        }
        if (!runtimeRoot.content().contains("static " + simpleName + " create(")
                || !runtimeRoot.content().contains("RuntimeDependencies")) {
            violations.add(runtimeRoot.relativePath(), RUNTIME_ROOT_RULE,
                    "Feature runtime roots must have a static create(...) factory that consumes runtime dependencies.");
        }
    }

    private static void validateShellBindings(
            String featureRoot,
            List<SourceFile> featureSources,
            ViolationSink violations
    ) {
        for (SourceFile sourceFile : featureSources) {
            if (!"shell".equals(packageFamily(sourceFile))) {
                continue;
            }
            validateShellBindingName(featureRoot, sourceFile, violations);
            validateShellBindingImports(sourceFile, violations);
        }
    }

    private static void validateShellBindingName(
            String featureRoot,
            SourceFile sourceFile,
            ViolationSink violations
    ) {
        if (sourceFile.fileName().endsWith("FeatureShellBinding.java")
                || sourceFile.fileName().endsWith("Operations.java")) {
            return;
        }
        violations.add(featureRoot, SHELL_BINDING_RULE,
                "Feature-runtime shell sources must stay at the binding or narrow shell-operations seam.");
    }

    private static void validateShellBindingImports(SourceFile sourceFile, ViolationSink violations) {
        Matcher matcher = IMPORT_PATTERN.matcher(sourceFile.content());
        while (matcher.find()) {
            String imported = matcher.group(1);
            if (isAllowedShellImport(sourceFile, imported)) {
                continue;
            }
            violations.add(sourceFile.relativePath(), SHELL_BINDING_RULE,
                    "Feature-runtime shell bindings may import only JDK/JavaFX delivery APIs, shell public contracts, "
                            + "same-feature runtime APIs, and same-feature domain readback/persistence seams. Found: "
                            + imported);
        }
    }

    private static boolean isAllowedShellImport(SourceFile sourceFile, String imported) {
        String featureName = featureName(sourceFile);
        return imported.startsWith("java.")
                || imported.equals("javafx.application.Platform")
                || imported.startsWith("shell.api.")
                || imported.startsWith("src.features." + featureName + ".runtime.")
                || imported.startsWith("src.domain." + featureName + ".published.")
                || imported.startsWith("src.domain." + featureName + ".model.");
    }

    private static void validateCompatibilitySeams(
            String featureRoot,
            List<SourceFile> featureSources,
            ViolationSink violations
    ) {
        List<SourceFile> compatibilitySeams = featureSources.stream()
                .filter(sourceFile -> sourceFile.fileName().endsWith("Compatibility.java"))
                .toList();
        for (SourceFile compatibilitySeam : compatibilitySeams) {
            if (!"runtime".equals(packageFamily(compatibilitySeam))) {
                violations.add(compatibilitySeam.relativePath(), COMPATIBILITY_SEAM_RULE,
                        "Feature-runtime compatibility seams must stay inside runtime/.");
            }
            if (!compatibilitySeam.content().contains("LEGACY_REMOVE_ON_TOUCH")) {
                violations.add(compatibilitySeam.relativePath(), COMPATIBILITY_SEAM_RULE,
                        "Retained feature-runtime compatibility seams must keep a LEGACY_REMOVE_ON_TOUCH removal marker.");
            }
            if (compatibilitySeam.content().contains("public ")) {
                violations.add(compatibilitySeam.relativePath(), COMPATIBILITY_SEAM_RULE,
                        "Retained feature-runtime compatibility seams must remain package-private.");
            }
            validateCompatibilitySeamConsumers(featureRoot, compatibilitySeam, featureSources, violations);
        }
    }

    private static void validateCompatibilitySeamConsumers(
            String featureRoot,
            SourceFile compatibilitySeam,
            List<SourceFile> featureSources,
            ViolationSink violations
    ) {
        String simpleName = simpleTypeName(compatibilitySeam);
        for (SourceFile sourceFile : featureSources) {
            if (sourceFile.relativePath().equals(compatibilitySeam.relativePath())
                    || !sourceFile.content().contains(simpleName)) {
                continue;
            }
            if ("runtime".equals(packageFamily(sourceFile))) {
                continue;
            }
            violations.add(featureRoot, COMPATIBILITY_SEAM_RULE,
                    "Compatibility seam " + simpleName + " may be referenced only by same-feature runtime sources; "
                            + "found reference in " + sourceFile.relativePath() + ".");
        }
    }

    private static String simpleTypeName(SourceFile sourceFile) {
        return sourceFile.fileName().substring(0, sourceFile.fileName().length() - ".java".length());
    }
}
