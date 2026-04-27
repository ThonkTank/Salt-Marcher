package saltmarcher.quality.errorprone;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.google.errorprone.util.ASTHelpers;
import com.sun.source.tree.ClassTree;
import com.sun.tools.javac.code.Symbol;
import java.util.regex.Pattern;

@BugPattern(
        name = "PresentationOwnershipNaming",
        summary = "Presentation-state and presentation-model types must live next to their owning view contribution.",
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
                || ViewArchitectureSupport.isViewModelSource(state.getPath().getCompilationUnit())) {
            return Description.NO_MATCH;
        }
        if (packageName.startsWith("src.view.primitives.")) {
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
                .setMessage("Presentation-owned type '" + simpleName
                        + "' must live next to its owning view contribution, not in package '"
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
