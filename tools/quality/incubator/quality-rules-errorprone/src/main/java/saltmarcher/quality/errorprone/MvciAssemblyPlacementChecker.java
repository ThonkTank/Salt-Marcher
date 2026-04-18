package saltmarcher.quality.errorprone;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.sun.source.tree.ClassTree;

@BugPattern(
        name = "MvciAssemblyPlacement",
        summary = "Runtime-session and shell-adapter classes must live in assembly packages.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class MvciAssemblyPlacementChecker extends BugChecker implements BugChecker.ClassTreeMatcher {

    @Override
    public Description matchClass(ClassTree tree, VisitorState state) {
        String packageName = state.getPath().getCompilationUnit().getPackageName() == null
                ? ""
                : state.getPath().getCompilationUnit().getPackageName().toString();
        if (!packageName.startsWith("src.view.")) {
            return Description.NO_MATCH;
        }
        String simpleName = tree.getSimpleName().toString();
        if (!requiresAssembly(simpleName)) {
            return Description.NO_MATCH;
        }
        if (packageName.matches("^src\\.view\\.[^.]+\\.assembly(\\..*)?$")) {
            return Description.NO_MATCH;
        }
        return buildDescription(tree)
                .setMessage("Class '" + simpleName + "' must live under src/view/<component>/assembly/ to preserve strict MVCI assembly boundaries.")
                .build();
    }

    private static boolean requiresAssembly(String simpleName) {
        return simpleName.endsWith("RuntimeSession")
                || simpleName.endsWith("ScreenAssembly")
                || simpleName.endsWith("ShellAdapter");
    }
}
