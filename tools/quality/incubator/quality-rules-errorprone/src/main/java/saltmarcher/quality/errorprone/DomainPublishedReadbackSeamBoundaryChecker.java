package saltmarcher.quality.errorprone;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.google.errorprone.util.ASTHelpers;
import com.sun.source.tree.ClassTree;
import com.sun.source.tree.MethodTree;
import com.sun.source.tree.Tree;
import com.sun.tools.javac.code.Symbol;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Pattern;
import javax.lang.model.element.Modifier;
import javax.lang.model.element.TypeElement;

@BugPattern(
        name = "DomainPublishedReadbackSeamBoundary",
        summary = "Domain readback through current()/subscribe() belongs only to published/*Model handles.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class DomainPublishedReadbackSeamBoundaryChecker extends BugChecker
        implements BugChecker.ClassTreeMatcher {

    private static final Pattern PUBLISHED_MODEL_PACKAGE =
            Pattern.compile("^src\\.domain\\.[^.]+\\.published$");

    @Override
    public Description matchClass(ClassTree tree, VisitorState state) {
        String packageName = DataArchitectureSupport.packageName(state.getPath().getCompilationUnit());
        if (!packageName.startsWith("src.domain.")) {
            return Description.NO_MATCH;
        }
        TypeElement typeElement = ASTHelpers.getSymbol(tree);
        if (typeElement == null) {
            return Description.NO_MATCH;
        }
        if (typeElement.getNestingKind().isNested()
                && !typeElement.getModifiers().contains(Modifier.PUBLIC)) {
            return Description.NO_MATCH;
        }
        if (isPublishedModelHandle(packageName, typeElement)) {
            return Description.NO_MATCH;
        }

        List<String> readbackMethods = new ArrayList<>();
        for (Tree member : tree.getMembers()) {
            if (member instanceof MethodTree methodTree) {
                Symbol.MethodSymbol methodSymbol = ASTHelpers.getSymbol(methodTree);
                if (methodSymbol != null
                        && methodSymbol.getModifiers().contains(Modifier.PUBLIC)
                        && !methodSymbol.isConstructor()
                        && (methodSymbol.getSimpleName().contentEquals("current")
                        || methodSymbol.getSimpleName().contentEquals("subscribe"))) {
                    readbackMethods.add(methodSymbol.getSimpleName().toString() + "()");
                }
            }
        }
        if (readbackMethods.isEmpty()) {
            return Description.NO_MATCH;
        }
        return buildDescription(tree)
                .setMessage("Domain type '" + typeElement.getQualifiedName()
                        + "' exposes readback method(s) " + String.join(", ", readbackMethods)
                        + ". Public current()/subscribe() readback is exclusive to same-context published/*Model handles.")
                .build();
    }

    private static boolean isPublishedModelHandle(String packageName, TypeElement typeElement) {
        return PUBLISHED_MODEL_PACKAGE.matcher(packageName).matches()
                && !typeElement.getNestingKind().isNested()
                && typeElement.getSimpleName().toString().endsWith("Model");
    }
}
