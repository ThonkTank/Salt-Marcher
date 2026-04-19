package saltmarcher.quality.errorprone;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.sun.source.tree.ClassTree;
import java.util.regex.Pattern;

@BugPattern(
        name = "ViewModelOwnershipNaming",
        summary = "Presentation-state and presentation-model types must live in src.view.models.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class ViewModelOwnershipNamingChecker extends BugChecker implements BugChecker.ClassTreeMatcher {

    private static final Pattern PRESENTATION_TYPE_NAME =
            Pattern.compile(".*(ViewModel|ViewData|State|Status|Section|SelectionModel|FilterOptionsModel|FilterSelectionModel|Model)$");

    @Override
    public Description matchClass(ClassTree tree, VisitorState state) {
        if (tree.getSimpleName().isEmpty()) {
            return Description.NO_MATCH;
        }
        String packageName = ViewArchitectureSupport.packageName(state.getPath().getCompilationUnit());
        if (!packageName.startsWith("src.view.")
                || ViewArchitectureSupport.VIEW_MODEL_PACKAGE.matcher(packageName).matches()) {
            return Description.NO_MATCH;
        }
        String simpleName = tree.getSimpleName().toString();
        if (!PRESENTATION_TYPE_NAME.matcher(simpleName).matches()) {
            return Description.NO_MATCH;
        }
        return buildDescription(tree)
                .setMessage("Presentation-owned type '" + simpleName
                        + "' must live in src.view.models, not in package '"
                        + packageName + "'.")
                .build();
    }
}
