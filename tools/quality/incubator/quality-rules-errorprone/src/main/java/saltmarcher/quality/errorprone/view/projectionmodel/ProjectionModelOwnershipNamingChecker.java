package saltmarcher.quality.errorprone.view.projectionmodel;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.google.errorprone.util.ASTHelpers;
import com.sun.source.tree.ClassTree;
import com.sun.tools.javac.code.Symbol;
import java.util.regex.Pattern;
import saltmarcher.quality.errorprone.view.ViewArchitectureSupport;

@BugPattern(
        name = "ProjectionModelOwnershipNaming",
        summary = "Projection-model-owned state types must live next to their owning contribution or reusable content unit.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class ProjectionModelOwnershipNamingChecker extends BugChecker implements BugChecker.ClassTreeMatcher {

    private static final Pattern PRESENTATION_TYPE_NAME =
            Pattern.compile(".*(ViewModel|ViewData|State|Status|Section|SelectionModel|FilterOptionsModel|FilterSelectionModel|Model)$");

    @Override
    public Description matchClass(ClassTree tree, VisitorState state) {
        if (tree.getSimpleName().isEmpty()) {
            return Description.NO_MATCH;
        }
        String packageName = ViewArchitectureSupport.packageName(state.getPath().getCompilationUnit());
        if (!packageName.startsWith("src.view.")
                || ViewArchitectureSupport.isViewModelSource(state.getPath().getCompilationUnit())) {
            return Description.NO_MATCH;
        }
        if (packageName.startsWith("src.view.slotcontent.primitives.")) {
            return Description.NO_MATCH;
        }
        String simpleName = tree.getSimpleName().toString();
        if (!PRESENTATION_TYPE_NAME.matcher(simpleName).matches()) {
            return Description.NO_MATCH;
        }
        if (packageName.startsWith("src.view.slotcontent.") && simpleName.endsWith("DisplayModel")) {
            return Description.NO_MATCH;
        }
        if (isNestedInsidePassiveView(tree)) {
            return Description.NO_MATCH;
        }
        return buildDescription(tree)
                .setMessage("Projection-model-owned type '" + simpleName
                        + "' must live next to its owning contribution or reusable content unit, not in package '"
                        + packageName + "'.")
                .build();
    }

    private static boolean isNestedInsidePassiveView(ClassTree tree) {
        Symbol symbol = ASTHelpers.getSymbol(tree);
        if (symbol == null || !(symbol.owner instanceof Symbol.ClassSymbol)) {
            return false;
        }
        Symbol.ClassSymbol owner = (Symbol.ClassSymbol) symbol.owner;
        String ownerName = owner.getSimpleName().toString();
        return ownerName.endsWith("View") && !ownerName.endsWith("ViewModel");
    }
}
