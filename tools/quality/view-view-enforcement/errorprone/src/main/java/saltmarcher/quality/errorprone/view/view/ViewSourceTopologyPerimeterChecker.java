package saltmarcher.quality.errorprone.view.view;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.sun.source.tree.ClassTree;
import com.sun.source.tree.CompilationUnitTree;
import java.util.LinkedHashSet;
import java.util.Set;
import saltmarcher.quality.errorprone.view.ViewSourceDescriptor;

@BugPattern(
        name = "ViewSourceTopologyPerimeter",
        summary = "View sources must use only the documented directories and top-level role file forms.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class ViewSourceTopologyPerimeterChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    @Override
    public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
        String sourcePath = sourcePath(tree);
        if (!isViewSourcePath(sourcePath)) {
            return Description.NO_MATCH;
        }

        ViewSourceDescriptor source = ViewSourceDescriptor.describe(tree);
        String packageName = source.packageName();
        String sourceFileName = source.sourceFileName();
        ClassTree topLevelClass = ViewArchitectureSupport.topLevelClass(tree);
        Set<String> violations = new LinkedHashSet<>();

        String expectedPackage = expectedPackageFromPath(sourcePath);
        if (!expectedPackage.isBlank() && !expectedPackage.equals(packageName)) {
            violations.add("package '" + packageName + "' must match path package '" + expectedPackage + "'");
        }

        if (!source.isRecognizedViewSource()) {
            violations.add("source must use only the documented view directories, depths, and top-level role file forms; offending file is '"
                    + sourceFileName + "' in package '" + packageName + "'");
        }

        if (topLevelClass != null) {
            String topLevelSimpleName = topLevelClass.getSimpleName().toString();
            if (!topLevelSimpleName.isBlank() && !sourceFileName.equals(topLevelSimpleName + ".java")) {
                violations.add("file name '" + sourceFileName + "' must match top-level view-layer type '" + topLevelSimpleName + ".java'");
            }
        }

        if (violations.isEmpty()) {
            return Description.NO_MATCH;
        }
        return buildDescription(topLevelClass == null ? tree : topLevelClass)
                .setMessage("View source '" + sourcePath + "' violates the closed view-layer topology perimeter: "
                        + String.join("; ", violations)
                        + ". Only the documented view directories and role file forms are legal, so role-specific checks cannot be bypassed by renaming or moving a file.")
                .build();
    }

    private static boolean isViewSourcePath(String sourcePath) {
        return sourcePath.startsWith("src/view/");
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

    private static String sourcePath(CompilationUnitTree tree) {
        if (tree.getSourceFile() == null) {
            return "";
        }
        String absoluteOrRelative = tree.getSourceFile().getName().replace('\\', '/');
        int viewRoot = absoluteOrRelative.indexOf("src/view/");
        return viewRoot < 0 ? absoluteOrRelative : absoluteOrRelative.substring(viewRoot);
    }
}
