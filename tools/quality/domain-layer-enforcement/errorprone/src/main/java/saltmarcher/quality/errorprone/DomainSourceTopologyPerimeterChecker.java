package saltmarcher.quality.errorprone;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.sun.source.tree.ClassTree;
import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.util.TreeScanner;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@BugPattern(
        name = "DomainSourceTopologyPerimeter",
        summary = "Domain sources must use only the documented directories and top-level role file forms.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class DomainSourceTopologyPerimeterChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    private static final Set<String> MODEL_FAMILY_ROLE_BUCKETS = Set.of(
            "model",
            "usecase",
            "helper",
            "constants",
            "port",
            "repository");
    private static final Set<String> FORBIDDEN_MODEL_SUBTREE_TECHNICAL_BUCKETS = Set.of(
            "aggregate",
            "application",
            "constants",
            "entity",
            "event",
            "factory",
            "helper",
            "policy",
            "port",
            "published",
            "repository",
            "service",
            "specification",
            "usecase",
            "value");
    private static final List<String> LEGACY_ROLE_SUFFIXES = List.of(
            "Aggregate.java",
            "BoundaryTranslator.java",
            "Entity.java",
            "Factory.java",
            "Policy.java",
            "Projector.java",
            "RuntimeAccess.java",
            "RuntimeAdapter.java",
            "Service.java",
            "Specification.java");

    @Override
    public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
        String sourcePath = sourcePath(tree);
        if (!sourcePath.startsWith("src/domain/")) {
            return Description.NO_MATCH;
        }

        String packageName = DataArchitectureSupport.packageName(tree);
        String sourceFileName = sourceFileName(tree);
        ClassTree topLevelClass = topLevelClass(tree);
        Set<String> violations = new LinkedHashSet<>();

        String expectedPackage = expectedPackageFromPath(sourcePath);
        if (!expectedPackage.isBlank() && !expectedPackage.equals(packageName)) {
            violations.add("package '" + packageName + "' must match path package '" + expectedPackage + "'");
        }

        List<String> segments = List.of(sourcePath.split("/"));
        validateClosedDomainTopology(segments, sourceFileName, violations);
        validateLegacyRoleSuffixRejection(sourceFileName, violations);

        if (topLevelClass != null) {
            String topLevelSimpleName = topLevelClass.getSimpleName().toString();
            if (!topLevelSimpleName.isBlank() && !sourceFileName.equals(topLevelSimpleName + ".java")) {
                violations.add("file name '" + sourceFileName
                        + "' must match top-level domain-layer type '" + topLevelSimpleName + ".java'");
            }
        }

        if (violations.isEmpty()) {
            return Description.NO_MATCH;
        }
        return buildDescription(topLevelClass == null ? tree : topLevelClass)
                .setMessage("Domain source '" + sourcePath + "' violates the closed domain-layer topology perimeter: "
                        + String.join("; ", violations)
                        + ". Only the documented domain directories and role file forms are legal, so role-specific checks cannot be bypassed by renaming or moving a file.")
                .build();
    }

    private static void validateClosedDomainTopology(
            List<String> segments,
            String sourceFileName,
            Set<String> violations) {
        if (segments.size() < 4) {
            violations.add("domain source must live under src/domain/<context>/...");
            return;
        }

        if (segments.size() == 4) {
            if (!sourceFileName.endsWith("ApplicationService.java")) {
                violations.add("direct root domain files must be *ApplicationService.java only");
            }
            return;
        }

        String bucket = segments.get(3);
        switch (bucket) {
            case "published" -> validatePublishedPath(segments, violations);
            case "application" -> validateApplicationPath(segments, sourceFileName, violations);
            case "model" -> validateModelPath(segments, sourceFileName, violations);
            default -> violations.add("domain sources may use only direct root ApplicationService files, published/, application/, or model/");
        }
    }

    private static void validatePublishedPath(List<String> segments, Set<String> violations) {
        if (segments.size() != 5) {
            violations.add("published/ carriers must stay as direct files under src/domain/<context>/published/");
        }
    }

    private static void validateApplicationPath(
            List<String> segments,
            String sourceFileName,
            Set<String> violations) {
        if (segments.size() != 5 || !sourceFileName.endsWith("UseCase.java")) {
            violations.add("root application/ orchestration files must stay as direct *UseCase.java files under src/domain/<context>/application/");
        }
    }

    private static void validateModelPath(
            List<String> segments,
            String sourceFileName,
            Set<String> violations) {
        if (segments.size() == 5) {
            violations.add("src/domain/<context>/model/ may contain only lower-case family directories, not direct Java files");
            return;
        }

        String family = segments.get(4);
        if (!family.matches("[a-z][a-z0-9_]*")) {
            violations.add("model family directories must be lower-case names matching [a-z][a-z0-9_]*");
            return;
        }

        if (segments.size() == 6) {
            violations.add("model families must place Java files under src/domain/<context>/model/<family>/<role>/");
            return;
        }

        String role = segments.get(5);
        if (!MODEL_FAMILY_ROLE_BUCKETS.contains(role)) {
            violations.add("model-family role packages must be one of: model, usecase, helper, constants, port, repository");
            return;
        }

        if ("model".equals(role)) {
            for (int index = 6; index < segments.size() - 1; index++) {
                if (FORBIDDEN_MODEL_SUBTREE_TECHNICAL_BUCKETS.contains(segments.get(index))) {
                    violations.add("nested technical buckets are forbidden inside src/domain/<context>/model/<family>/model/**");
                    return;
                }
            }
            validateReservedRoleSuffix(role, sourceFileName, violations);
            return;
        }

        if (segments.size() != 7) {
            violations.add("model-family non-model role buckets must keep Java files as direct files under src/domain/<context>/model/<family>/<role>/");
            return;
        }

        validateRequiredRoleSuffix(role, sourceFileName, violations);
    }

    private static void validateRequiredRoleSuffix(String role, String sourceFileName, Set<String> violations) {
        switch (role) {
            case "usecase" -> requireSuffix(role, sourceFileName, "UseCase.java", violations);
            case "helper" -> requireSuffix(role, sourceFileName, "Helper.java", violations);
            case "constants" -> requireSuffix(role, sourceFileName, "Constants.java", violations);
            case "port" -> requireSuffix(role, sourceFileName, "Port.java", violations);
            case "repository" -> requireSuffix(role, sourceFileName, "Repository.java", violations);
            default -> {
                // model/ is handled separately above.
            }
        }
    }

    private static void requireSuffix(
            String role,
            String sourceFileName,
            String requiredSuffix,
            Set<String> violations) {
        if (!sourceFileName.endsWith(requiredSuffix)) {
            violations.add("files under " + role + "/ must use the top-level role form *" + requiredSuffix);
        }
    }

    private static void validateReservedRoleSuffix(String role, String sourceFileName, Set<String> violations) {
        if (sourceFileName.endsWith("ApplicationService.java")) {
            violations.add("reserved role suffix ApplicationService may appear only as a direct root file under src/domain/<context>/");
        } else if (sourceFileName.endsWith("UseCase.java")) {
            violations.add("reserved role suffix UseCase may appear only under application/ or model/<family>/usecase/");
        } else if (sourceFileName.endsWith("Helper.java")) {
            violations.add("reserved role suffix Helper may appear only under model/<family>/helper/");
        } else if (sourceFileName.endsWith("Constants.java")) {
            violations.add("reserved role suffix Constants may appear only under model/<family>/constants/");
        } else if (sourceFileName.endsWith("Port.java")) {
            violations.add("reserved role suffix Port may appear only under model/<family>/port/");
        } else if (sourceFileName.endsWith("Repository.java")) {
            violations.add("reserved role suffix Repository may appear only under model/<family>/repository/");
        }
    }

    private static void validateLegacyRoleSuffixRejection(String sourceFileName, Set<String> violations) {
        for (String legacySuffix : LEGACY_ROLE_SUFFIXES) {
            if (sourceFileName.endsWith(legacySuffix)) {
                violations.add("legacy role/helper suffixes such as *BoundaryTranslator, *Projector, *RuntimeAccess, *RuntimeAdapter, *Policy, *Service, *Factory, *Aggregate, *Entity, and *Specification are forbidden");
                return;
            }
        }
    }

    private static ClassTree topLevelClass(CompilationUnitTree tree) {
        ClassTree[] result = {null};
        new TreeScanner<Void, Void>() {
            @Override
            public Void visitClass(ClassTree classTree, Void unused) {
                if (result[0] == null) {
                    result[0] = classTree;
                }
                return null;
            }
        }.scan(tree, null);
        return result[0];
    }

    private static String expectedPackageFromPath(String sourcePath) {
        if (sourcePath.isBlank() || !sourcePath.endsWith(".java")) {
            return "";
        }
        int separator = sourcePath.lastIndexOf('/');
        if (separator < 0) {
            return "";
        }
        return sourcePath.substring(0, separator).replace('/', '.');
    }

    private static String sourceFileName(CompilationUnitTree tree) {
        if (tree.getSourceFile() == null) {
            return "";
        }
        String absoluteOrRelative = tree.getSourceFile().getName().replace('\\', '/');
        int separator = absoluteOrRelative.lastIndexOf('/');
        return separator < 0 ? absoluteOrRelative : absoluteOrRelative.substring(separator + 1);
    }

    private static String sourcePath(CompilationUnitTree tree) {
        if (tree.getSourceFile() == null) {
            return "";
        }
        String absoluteOrRelative = tree.getSourceFile().getName().replace('\\', '/');
        int domainRoot = absoluteOrRelative.indexOf("src/domain/");
        return domainRoot < 0 ? absoluteOrRelative : absoluteOrRelative.substring(domainRoot);
    }
}
