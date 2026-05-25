package saltmarcher.quality.errorprone;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.sun.source.tree.ClassTree;
import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.Tree;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@BugPattern(
        name = "DomainSourceTopologyPerimeter",
        summary = "Domain source package declarations and top-level type names must match their source path.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class DomainSourceTopologyPerimeterChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    @Override
    public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
        String sourcePath = sourcePath(tree);
        if (!sourcePath.startsWith("src/domain/")) {
            return Description.NO_MATCH;
        }

        String packageName = DataArchitectureSupport.packageName(tree);
        String sourceFileName = sourceFileName(tree);
        List<ClassTree> topLevelTypes = topLevelTypes(tree);
        ClassTree firstMismatch = null;
        Set<String> violations = new LinkedHashSet<>();

        String expectedPackage = expectedPackageFromPath(sourcePath);
        if (!expectedPackage.isBlank() && !expectedPackage.equals(packageName)) {
            violations.add("package '" + packageName + "' must match path package '" + expectedPackage + "'");
        }

        for (ClassTree topLevelClass : topLevelTypes) {
            String topLevelSimpleName = topLevelClass.getSimpleName().toString();
            if (!topLevelSimpleName.isBlank() && !sourceFileName.equals(topLevelSimpleName + ".java")) {
                if (firstMismatch == null) {
                    firstMismatch = topLevelClass;
                }
                violations.add("file name '" + sourceFileName
                        + "' must match top-level domain-layer type '" + topLevelSimpleName + ".java'");
            }
        }

        if (violations.isEmpty()) {
            return Description.NO_MATCH;
        }
        return buildDescription(firstMismatch == null ? tree : firstMismatch)
                .setMessage("Domain source '" + sourcePath + "' violates the compiler-visible source identity perimeter: "
                        + String.join("; ", violations)
                        + ". Package and top-level type identity must match the source path so role-specific checks cannot be bypassed by mismatched declarations.")
                .build();
    }

    private static List<ClassTree> topLevelTypes(CompilationUnitTree tree) {
        List<ClassTree> result = new ArrayList<>();
        for (Tree declaration : tree.getTypeDecls()) {
            if (declaration instanceof ClassTree classTree) {
                result.add(classTree);
            }
        }
        return result;
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
