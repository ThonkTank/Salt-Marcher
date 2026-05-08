package saltmarcher.quality.errorprone.view.view;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.sun.source.tree.ClassTree;
import com.sun.source.tree.CompilationUnitTree;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.regex.Pattern;

@BugPattern(
        name = "ViewSourceTopologyPerimeter",
        summary = "View sources must use only the documented directories and top-level role file forms.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class ViewSourceTopologyPerimeterChecker extends BugChecker
        implements BugChecker.CompilationUnitTreeMatcher {

    private static final Pattern ACTIVE_ROOT_PACKAGE = Pattern.compile(
            "^src\\.view\\.(leftbartabs|statetabs|dropdowns)\\.[^.]+$");
    private static final Pattern SLOTCONTENT_PACKAGE = Pattern.compile(
            "^src\\.view\\.slotcontent\\.(controls|main|state|details|topbar|primitives)\\.[^.]+$");

    @Override
    public Description matchCompilationUnit(CompilationUnitTree tree, VisitorState state) {
        String sourcePath = sourcePath(tree);
        if (!isViewSourcePath(sourcePath)) {
            return Description.NO_MATCH;
        }

        String packageName = ViewArchitectureSupport.packageName(tree);
        String sourceFileName = sourceFileName(tree);
        ClassTree topLevelClass = ViewArchitectureSupport.topLevelClass(tree);
        Set<String> violations = new LinkedHashSet<>();

        String expectedPackage = expectedPackageFromPath(sourcePath);
        if (!expectedPackage.isBlank() && !expectedPackage.equals(packageName)) {
            violations.add("package '" + packageName + "' must match path package '" + expectedPackage + "'");
        }

        if (!isAllowedViewPackage(packageName)) {
            violations.add("view source must live only under src.view.leftbartabs.<entry>, src.view.statetabs.<entry>, src.view.dropdowns.<entry>, or src.view.slotcontent.<controls|main|state|details|topbar|primitives>.<entry>");
        } else if (!isAllowedRoleFile(packageName, sourceFileName)) {
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

    private static boolean isAllowedViewPackage(String packageName) {
        return ACTIVE_ROOT_PACKAGE.matcher(packageName).matches()
                || SLOTCONTENT_PACKAGE.matcher(packageName).matches();
    }

    private static boolean isAllowedRoleFile(String packageName, String sourceFileName) {
        if (ACTIVE_ROOT_PACKAGE.matcher(packageName).matches()) {
            return sourceFileName.endsWith("Contribution.java")
                    || sourceFileName.endsWith("Binder.java")
                    || sourceFileName.endsWith("ContributionModel.java")
                    || sourceFileName.endsWith("IntentHandler.java")
                    || sourceFileName.endsWith("ViewInputEvent.java")
                    || sourceFileName.endsWith("PublishedEvent.java")
                    || isPassiveViewFileName(sourceFileName);
        }
        if (SLOTCONTENT_PACKAGE.matcher(packageName).matches()) {
            return sourceFileName.endsWith("ContentModel.java")
                    || sourceFileName.endsWith("ViewInputEvent.java")
                    || isPassiveViewFileName(sourceFileName);
        }
        return false;
    }

    private static boolean isPassiveViewFileName(String sourceFileName) {
        return sourceFileName.endsWith("View.java")
                && !sourceFileName.endsWith("ViewModel.java")
                && !sourceFileName.endsWith("PresentationModel.java")
                && !sourceFileName.endsWith("ContributionModel.java")
                && !sourceFileName.endsWith("ContentModel.java");
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

    private static String sourceFileName(CompilationUnitTree tree) {
        if (tree.getSourceFile() == null) {
            return "";
        }
        String name = tree.getSourceFile().getName().replace('\\', '/');
        int separator = name.lastIndexOf('/');
        return separator < 0 ? name : name.substring(separator + 1);
    }
}
