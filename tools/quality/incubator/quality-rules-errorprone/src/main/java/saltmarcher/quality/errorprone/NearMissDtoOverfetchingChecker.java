package saltmarcher.quality.errorprone;

import com.google.errorprone.BugPattern;
import com.google.errorprone.VisitorState;
import com.google.errorprone.bugpatterns.BugChecker;
import com.google.errorprone.matchers.Description;
import com.google.errorprone.util.ASTHelpers;
import com.sun.source.tree.ExpressionTree;
import com.sun.source.tree.IdentifierTree;
import com.sun.source.tree.MemberSelectTree;
import com.sun.source.tree.MethodInvocationTree;
import com.sun.source.tree.MethodTree;
import com.sun.source.tree.VariableTree;
import com.sun.source.util.TreeScanner;
import com.sun.tools.javac.code.Symbol;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;

@BugPattern(
        name = "NearMissDtoOverfetching",
        summary = "DTO-like boundary carriers should be split when a method reads only one accessor from the carrier.",
        severity = BugPattern.SeverityLevel.ERROR)
public final class NearMissDtoOverfetchingChecker extends BugChecker
        implements BugChecker.MethodTreeMatcher {

    private static final List<Pattern> CARRIER_TYPE_PATTERNS = List.of(
            Pattern.compile("^src\\.domain\\..+\\.published\\..+$"),
            Pattern.compile("^src\\.data\\..+\\.model\\..+$"),
            Pattern.compile("^shell\\.api\\..+$")
    );

    @Override
    public Description matchMethod(MethodTree tree, VisitorState state) {
        List<String> violations = new ArrayList<>();
        for (VariableTree parameter : tree.getParameters()) {
            Symbol parameterSymbol = ASTHelpers.getSymbol(parameter);
            if (parameterSymbol == null || !isConfiguredCarrierType(parameterSymbol)) {
                continue;
            }
            Set<String> accessorNames = collectAccessorNames(tree, parameterSymbol);
            if (accessorNames.size() == 1) {
                violations.add(parameter.getName() + " reads only " + accessorNames.iterator().next() + "()");
            }
        }
        if (violations.isEmpty()) {
            return Description.NO_MATCH;
        }
        return buildDescription(tree)
                .setMessage("Boundary carrier overfetching candidate: " + String.join("; ", violations)
                        + ". Prefer a narrower carrier or parameter when only one accessor is needed.")
                .build();
    }

    private static boolean isConfiguredCarrierType(Symbol parameterSymbol) {
        String qualifiedName = parameterSymbol.type.tsym == null
                ? ""
                : parameterSymbol.type.tsym.getQualifiedName().toString();
        return CARRIER_TYPE_PATTERNS.stream().anyMatch(pattern -> pattern.matcher(qualifiedName).matches());
    }

    private static Set<String> collectAccessorNames(MethodTree tree, Symbol parameterSymbol) {
        Set<String> accessorNames = new LinkedHashSet<>();
        new TreeScanner<Void, Void>() {
            @Override
            public Void visitMethodInvocation(MethodInvocationTree invocation, Void unused) {
                Symbol symbol = ASTHelpers.getSymbol(invocation);
                if (symbol instanceof Symbol.MethodSymbol methodSymbol
                        && invocation.getArguments().isEmpty()
                        && !"getClass".contentEquals(methodSymbol.getSimpleName())
                        && isInvocationOnParameter(invocation, parameterSymbol)) {
                    accessorNames.add(methodSymbol.getSimpleName().toString());
                }
                return super.visitMethodInvocation(invocation, unused);
            }
        }.scan(tree.getBody(), null);
        return accessorNames;
    }

    private static boolean isInvocationOnParameter(MethodInvocationTree invocation, Symbol parameterSymbol) {
        ExpressionTree methodSelect = invocation.getMethodSelect();
        if (!(methodSelect instanceof MemberSelectTree memberSelect)) {
            return false;
        }
        ExpressionTree receiver = memberSelect.getExpression();
        return receiver instanceof IdentifierTree identifier
                && parameterSymbol.equals(ASTHelpers.getSymbol(identifier));
    }
}
