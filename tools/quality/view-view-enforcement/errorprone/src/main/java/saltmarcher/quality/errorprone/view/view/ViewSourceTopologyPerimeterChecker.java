package saltmarcher.quality.errorprone.view.view;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.sun.source.tree.ClassTree;
import com.sun.source.tree.CompilationUnitTree;
import java.util.LinkedHashSet;
import java.util.Set;
import saltmarcher.quality.errorprone.view.ViewRole;
import saltmarcher.quality.errorprone.view.ViewSourceDescriptor;
import saltmarcher.quality.errorprone.view.ViewUnitKind;

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
            violations.add("view source must live only under src.view.leftbartabs.<entry>, src.view.statetabs.<entry>, src.view.dropdowns.<entry>, or src.view.slotcontent.<controls|main|state|details|topbar|primitives>.<entry>");
        } else if (!isAllowedRole(source)) {
            violations.add("file '" + sourceFileName + "' is not an allowed top-level role in package '" + packageName + "'");
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

    private static boolean isAllowedRole(ViewSourceDescriptor source) {
        if (source.role() == ViewRole.UNKNOWN) {
            return false;
        }
        if (source.unitKind() == ViewUnitKind.ACTIVE_ROOT) {
            return source.role() != ViewRole.CONTENT_MODEL
                    && source.role() != ViewRole.INSPECTOR_ENTRY
                    && source.role() != ViewRole.LEGACY_VIEW_MODEL
                    && source.role() != ViewRole.PROJECTOR;
        }
        return source.role() == ViewRole.CONTENT_MODEL
                || source.role() == ViewRole.VIEW_INPUT_EVENT
                || source.role() == ViewRole.VIEW;
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
