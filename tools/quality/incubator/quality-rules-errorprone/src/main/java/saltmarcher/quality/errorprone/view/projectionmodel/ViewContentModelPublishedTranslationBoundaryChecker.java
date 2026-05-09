package saltmarcher.quality.errorprone.view.projectionmodel;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.google.errorprone.util.ASTHelpers;
import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.NewClassTree;
import com.sun.tools.javac.code.Symbol;
import com.sun.tools.javac.code.Type;
import saltmarcher.quality.errorprone.view.ViewArchitectureSupport;

@BugPattern(
        name = "ViewContentModelPublishedTranslationBoundary",
        summary = "ContentModels must not construct domain published carriers; published-to-published translation belongs upstream.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class ViewContentModelPublishedTranslationBoundaryChecker extends BugChecker
        implements BugChecker.NewClassTreeMatcher {

    @Override
    public Description matchNewClass(NewClassTree tree, VisitorState state) {
        CompilationUnitTree compilationUnit = state.getPath().getCompilationUnit();
        if (!ViewArchitectureSupport.isViewModelSource(compilationUnit)
                || !ViewArchitectureSupport.topLevelSimpleName(compilationUnit).endsWith("ContentModel")) {
            return Description.NO_MATCH;
        }

        String constructedType = constructedType(tree);
        if (!isPublishedCarrier(constructedType)) {
            return Description.NO_MATCH;
        }
        return buildDescription(tree)
                .setMessage("ContentModels must not construct domain published carriers such as '"
                        + constructedType
                        + "'. Move published-to-published translation into the owning application-service or"
                        + " runtime projection boundary.")
                .build();
    }

    private static boolean isPublishedCarrier(String constructedType) {
        return constructedType != null
                && constructedType.matches("^src\\.domain\\.[^.]+\\.published\\.[^.]+(?:\\$.*)?$");
    }

    private static String constructedType(NewClassTree tree) {
        Type type = ASTHelpers.getType(tree);
        if (type != null && type.tsym instanceof Symbol.ClassSymbol classSymbol) {
            return classSymbol.getQualifiedName().toString();
        }
        Symbol symbol = ASTHelpers.getSymbol(tree);
        return ViewArchitectureSupport.getQualifiedOwnerTypeName(symbol);
    }
}
