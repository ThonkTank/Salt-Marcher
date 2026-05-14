package saltmarcher.quality.errorprone;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.google.errorprone.util.ASTHelpers;
import com.sun.source.tree.BinaryTree;
import com.sun.source.tree.ExpressionTree;
import com.sun.source.tree.Kind;
import com.sun.source.tree.MethodInvocationTree;
import com.sun.source.tree.Tree;
import com.sun.tools.javac.code.Symbol;
import com.sun.tools.javac.code.Type;

@BugPattern(
        name = "NearMissUseMapContainsKey",
        summary = "Map key-presence checks must use containsKey instead of comparing get(...) with null.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class NearMissUseMapContainsKeyChecker extends BugChecker
        implements BugChecker.BinaryTreeMatcher {

    @Override
    public Description matchBinary(BinaryTree tree, VisitorState state) {
        if (tree.getKind() != Kind.EQUAL_TO && tree.getKind() != Kind.NOT_EQUAL_TO) {
            return Description.NO_MATCH;
        }
        if (!isNullLiteral(tree.getLeftOperand()) && !isNullLiteral(tree.getRightOperand())) {
            return Description.NO_MATCH;
        }
        ExpressionTree comparedExpression = isNullLiteral(tree.getLeftOperand())
                ? tree.getRightOperand()
                : tree.getLeftOperand();
        if (!isMapGetInvocation(comparedExpression, state)) {
            return Description.NO_MATCH;
        }
        return buildDescription(tree)
                .setMessage("Use Map.containsKey(...) for key-presence checks instead of comparing Map.get(...) with null.")
                .build();
    }

    private static boolean isNullLiteral(Tree tree) {
        return tree != null && tree.getKind() == Kind.NULL_LITERAL;
    }

    private static boolean isMapGetInvocation(Tree tree, VisitorState state) {
        if (!(tree instanceof MethodInvocationTree invocation)) {
            return false;
        }
        Symbol symbol = ASTHelpers.getSymbol(invocation);
        if (!(symbol instanceof Symbol.MethodSymbol methodSymbol)
                || !"get".contentEquals(methodSymbol.getSimpleName())
                || invocation.getArguments().size() != 1) {
            return false;
        }
        Type mapType = state.getTypeFromString("java.util.Map");
        return mapType != null
                && methodSymbol.owner instanceof Symbol.ClassSymbol owner
                && ASTHelpers.isSubtype(owner.type, mapType, state);
    }
}
