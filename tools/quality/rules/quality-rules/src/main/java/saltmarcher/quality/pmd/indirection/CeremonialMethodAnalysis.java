package saltmarcher.quality.pmd.indirection;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import net.sourceforge.pmd.lang.java.ast.ASTAmbiguousName;
import net.sourceforge.pmd.lang.java.ast.ASTArgumentList;
import net.sourceforge.pmd.lang.java.ast.ASTBlock;
import net.sourceforge.pmd.lang.java.ast.ASTBooleanLiteral;
import net.sourceforge.pmd.lang.java.ast.ASTCharLiteral;
import net.sourceforge.pmd.lang.java.ast.ASTClassDeclaration;
import net.sourceforge.pmd.lang.java.ast.ASTClassLiteral;
import net.sourceforge.pmd.lang.java.ast.ASTConstructorCall;
import net.sourceforge.pmd.lang.java.ast.ASTExpression;
import net.sourceforge.pmd.lang.java.ast.ASTExpressionStatement;
import net.sourceforge.pmd.lang.java.ast.ASTFieldAccess;
import net.sourceforge.pmd.lang.java.ast.ASTIfStatement;
import net.sourceforge.pmd.lang.java.ast.ASTInfixExpression;
import net.sourceforge.pmd.lang.java.ast.ASTLiteral;
import net.sourceforge.pmd.lang.java.ast.ASTLocalVariableDeclaration;
import net.sourceforge.pmd.lang.java.ast.ASTMethodCall;
import net.sourceforge.pmd.lang.java.ast.ASTMethodDeclaration;
import net.sourceforge.pmd.lang.java.ast.ASTNullLiteral;
import net.sourceforge.pmd.lang.java.ast.ASTNumericLiteral;
import net.sourceforge.pmd.lang.java.ast.ASTReturnStatement;
import net.sourceforge.pmd.lang.java.ast.ASTStatement;
import net.sourceforge.pmd.lang.java.ast.ASTStringLiteral;
import net.sourceforge.pmd.lang.java.ast.ASTSuperExpression;
import net.sourceforge.pmd.lang.java.ast.ASTThisExpression;
import net.sourceforge.pmd.lang.java.ast.ASTThrowStatement;
import net.sourceforge.pmd.lang.java.ast.ASTTypeExpression;
import net.sourceforge.pmd.lang.java.ast.BinaryOp;
import net.sourceforge.pmd.lang.java.ast.ASTVariableDeclarator;
import saltmarcher.quality.pmd.support.JavaSourceTextSupport;
import saltmarcher.quality.pmd.support.SaltMarcherSourceFacts;

final class CeremonialMethodAnalysis {

    private CeremonialMethodAnalysis() {
    }

    static Analysis analyze(ASTClassDeclaration node, SaltMarcherSourceFacts sourceFacts) {
        List<ASTMethodDeclaration> nonConstructorMethods = node.descendants(ASTMethodDeclaration.class)
                .filter(method -> enclosingTopLevelClass(method) == node)
                .toList();
        if (nonConstructorMethods.isEmpty()) {
            return Analysis.notCeremonial();
        }

        Set<String> localMethodNames = new LinkedHashSet<>();
        for (ASTMethodDeclaration method : nonConstructorMethods) {
            localMethodNames.add(method.getName());
        }

        Set<String> collaboratorTargets = new LinkedHashSet<>();
        List<String> trivialDescriptions = new ArrayList<>();
        for (ASTMethodDeclaration method : nonConstructorMethods) {
            MethodShape shape = classifyMethod(method, sourceFacts, localMethodNames);
            if (shape == null) {
                return Analysis.notCeremonial();
            }
            if (shape.externalTarget() != null) {
                collaboratorTargets.add(shape.externalTarget());
            }
            trivialDescriptions.add(method.getName() + " -> " + shape.description());
        }

        if (collaboratorTargets.isEmpty() || collaboratorTargets.size() > 1) {
            return Analysis.notCeremonial();
        }
        return new Analysis(true, collaboratorTargets.iterator().next(), List.copyOf(trivialDescriptions));
    }

    private static MethodShape classifyMethod(
            ASTMethodDeclaration method,
            SaltMarcherSourceFacts sourceFacts,
            Set<String> localMethodNames
    ) {
        ASTBlock body = method.firstChild(ASTBlock.class);
        if (body == null) {
            return null;
        }
        List<ASTStatement> effectiveStatements = new ArrayList<>();
        for (ASTStatement statement : body.children(ASTStatement.class).toList()) {
            if (isSkippableGuard(statement, sourceFacts) || isTrivialAlias(statement, sourceFacts)) {
                continue;
            }
            effectiveStatements.add(statement);
        }
        if (effectiveStatements.size() != 1) {
            return null;
        }
        return classifyEffectiveStatement(effectiveStatements.getFirst(), sourceFacts, localMethodNames);
    }

    private static boolean isSkippableGuard(ASTStatement statement, SaltMarcherSourceFacts sourceFacts) {
        if (statement instanceof ASTExpressionStatement expressionStatement) {
            ASTMethodCall methodCall = directMethodCall(expressionStatement.getExpr());
            return methodCall != null && isRequireNonNullCall(methodCall, sourceFacts);
        }
        if (statement instanceof ASTLocalVariableDeclaration declaration) {
            ASTVariableDeclarator declarator = singleDeclarator(declaration);
            if (declarator == null || !declarator.hasInitializer()) {
                return false;
            }
            ASTMethodCall methodCall = directMethodCall(declarator.getInitializer());
            return methodCall != null && isRequireNonNullCall(methodCall, sourceFacts);
        }
        if (statement instanceof ASTIfStatement ifStatement) {
            return isNullGuardIfStatement(ifStatement);
        }
        return false;
    }

    private static boolean isRequireNonNullCall(ASTMethodCall methodCall, SaltMarcherSourceFacts sourceFacts) {
        if (!"requireNonNull".equals(methodCall.getMethodName())) {
            return false;
        }
        String qualifierText = qualifierText(methodCall, sourceFacts);
        return qualifierText == null
                || qualifierText.isBlank()
                || "Objects".equals(qualifierText)
                || "java.util.Objects".equals(qualifierText);
    }

    private static boolean isNullGuardIfStatement(ASTIfStatement ifStatement) {
        if (ifStatement.hasElse()) {
            return false;
        }
        ASTStatement thenBranch = unwrapSingleStatement(ifStatement.getThenBranch());
        return thenBranch instanceof ASTThrowStatement && isSimpleNullCheck(ifStatement.getCondition());
    }

    private static boolean isTrivialAlias(ASTStatement statement, SaltMarcherSourceFacts sourceFacts) {
        if (!(statement instanceof ASTLocalVariableDeclaration declaration)) {
            return false;
        }
        ASTVariableDeclarator declarator = singleDeclarator(declaration);
        if (declarator == null || !declarator.hasInitializer()) {
            return false;
        }
        return isSimpleReferenceLike(declarator.getInitializer(), sourceFacts);
    }

    private static MethodShape classifyEffectiveStatement(
            ASTStatement statement,
            SaltMarcherSourceFacts sourceFacts,
            Set<String> localMethodNames
    ) {
        if (statement instanceof ASTReturnStatement returnStatement) {
            ASTExpression expression = returnStatement.getExpr();
            if (expression == null) {
                return null;
            }
            MethodShape constructorShape = classifyConstructorReturn(expression, sourceFacts);
            if (constructorShape != null) {
                return constructorShape;
            }
            return classifyDelegatedCall(expression, sourceFacts, localMethodNames, true);
        }
        if (statement instanceof ASTExpressionStatement expressionStatement) {
            return classifyDelegatedCall(expressionStatement.getExpr(), sourceFacts, localMethodNames, false);
        }
        return null;
    }

    private static MethodShape classifyConstructorReturn(ASTExpression expression, SaltMarcherSourceFacts sourceFacts) {
        ASTConstructorCall constructorCall = directConstructorCall(expression);
        if (constructorCall == null) {
            return null;
        }
        if (constructorCall.isAnonymousClass()) {
            return null;
        }
        ASTExpression qualifier = constructorCall.getQualifier();
        if (qualifier != null && !isSimpleReferenceLike(qualifier, sourceFacts)) {
            return null;
        }
        if (!argumentsAreSimple(constructorCall.getArguments(), sourceFacts)) {
            return null;
        }
        String constructedType = JavaSourceTextSupport.normalizedNodeText(constructorCall.getTypeNode(), sourceFacts);
        return new MethodShape("wraps constructor " + constructedType, "new:" + constructedType);
    }

    private static MethodShape classifyDelegatedCall(
            ASTExpression expression,
            SaltMarcherSourceFacts sourceFacts,
            Set<String> localMethodNames,
            boolean returnsValue
    ) {
        ASTMethodCall methodCall = directMethodCall(expression);
        if (methodCall == null) {
            return null;
        }
        ASTExpression qualifier = methodCall.getQualifier();
        if (qualifier != null && !isSimpleReferenceLike(qualifier, sourceFacts)) {
            return null;
        }
        if (!argumentsAreSimple(methodCall.getArguments(), sourceFacts)) {
            return null;
        }

        String callee = renderCallee(methodCall, sourceFacts);
        String externalTarget = externalTarget(methodCall, sourceFacts, localMethodNames);
        String description = returnsValue
                ? "returns delegated call " + callee + "(...)"
                : "forwards delegated call " + callee + "(...)";
        return new MethodShape(description, externalTarget);
    }

    private static ASTClassDeclaration enclosingTopLevelClass(ASTMethodDeclaration method) {
        return method.ancestors(ASTClassDeclaration.class).last();
    }

    private static ASTMethodCall directMethodCall(ASTExpression expression) {
        return expression instanceof ASTMethodCall methodCall ? methodCall : null;
    }

    private static ASTConstructorCall directConstructorCall(ASTExpression expression) {
        return expression instanceof ASTConstructorCall constructorCall ? constructorCall : null;
    }

    private static boolean argumentsAreSimple(ASTArgumentList arguments, SaltMarcherSourceFacts sourceFacts) {
        return arguments.children(ASTExpression.class).toList().stream()
                .allMatch(argument -> isSimpleDelegatedArgument(argument, sourceFacts));
    }

    private static boolean isSimpleDelegatedArgument(ASTExpression argument, SaltMarcherSourceFacts sourceFacts) {
        if (containsInvocation(argument)) {
            return false;
        }
        return isSimpleReferenceLike(argument, sourceFacts) || isSimpleLiteralLike(argument);
    }

    private static ASTVariableDeclarator singleDeclarator(ASTLocalVariableDeclaration declaration) {
        List<ASTVariableDeclarator> declarators = declaration.children(ASTVariableDeclarator.class).toList();
        return declarators.size() == 1 ? declarators.getFirst() : null;
    }

    private static ASTStatement unwrapSingleStatement(ASTStatement statement) {
        if (!(statement instanceof ASTBlock block)) {
            return statement;
        }
        List<ASTStatement> statements = block.children(ASTStatement.class).toList();
        return statements.size() == 1 ? statements.getFirst() : statement;
    }

    private static boolean isSimpleReferenceLike(ASTExpression expression, SaltMarcherSourceFacts sourceFacts) {
        if (containsInvocation(expression)) {
            return false;
        }
        if (expression instanceof ASTAmbiguousName
                || expression instanceof ASTThisExpression
                || expression instanceof ASTSuperExpression) {
            return true;
        }
        if (expression instanceof ASTFieldAccess fieldAccess) {
            ASTExpression qualifier = fieldAccess.getQualifier();
            return qualifier != null && isSimpleReferenceLike(qualifier, sourceFacts);
        }
        return sourceFacts != null
                && expression.isParenthesized()
                && JavaSourceTextSupport.normalizedNodeText(expression, sourceFacts)
                .startsWith("(")
                && looksLikeSimpleReferenceText(JavaSourceTextSupport.normalizedNodeText(expression, sourceFacts));
    }

    private static String renderCallee(ASTMethodCall methodCall, SaltMarcherSourceFacts sourceFacts) {
        String qualifierText = qualifierText(methodCall, sourceFacts);
        return qualifierText == null || qualifierText.isBlank()
                ? methodCall.getMethodName()
                : qualifierText + "." + methodCall.getMethodName();
    }

    private static String externalTarget(
            ASTMethodCall methodCall,
            SaltMarcherSourceFacts sourceFacts,
            Set<String> localMethodNames
    ) {
        String methodName = methodCall.getMethodName();
        String qualifierText = qualifierText(methodCall, sourceFacts);
        if (qualifierText == null || qualifierText.isBlank()) {
            return localMethodNames.contains(methodName) ? null : methodName;
        }
        if (("this".equals(qualifierText) || "super".equals(qualifierText)) && localMethodNames.contains(methodName)) {
            return null;
        }
        return qualifierText;
    }

    private static String qualifierText(ASTMethodCall methodCall, SaltMarcherSourceFacts sourceFacts) {
        ASTExpression qualifier = methodCall.getQualifier();
        return qualifier == null ? null : JavaSourceTextSupport.normalizedNodeText(qualifier, sourceFacts);
    }

    private static boolean isSimpleLiteralLike(ASTExpression expression) {
        return expression instanceof ASTLiteral
                || expression instanceof ASTBooleanLiteral
                || expression instanceof ASTNumericLiteral
                || expression instanceof ASTStringLiteral
                || expression instanceof ASTCharLiteral
                || expression instanceof ASTNullLiteral
                || expression instanceof ASTClassLiteral
                || expression instanceof ASTTypeExpression;
    }

    private static boolean isSimpleNullCheck(ASTExpression expression) {
        if (!(expression instanceof ASTInfixExpression infixExpression) || infixExpression.getOperator() != BinaryOp.EQ) {
            return false;
        }
        List<ASTExpression> operands = infixExpression.children(ASTExpression.class).toList();
        if (operands.size() != 2) {
            return false;
        }
        ASTExpression left = operands.getFirst();
        ASTExpression right = operands.get(1);
        return (left instanceof ASTNullLiteral && isSimpleReferenceLike(right, null))
                || (right instanceof ASTNullLiteral && isSimpleReferenceLike(left, null));
    }

    private static boolean containsInvocation(ASTExpression expression) {
        if (expression instanceof ASTMethodCall || expression instanceof ASTConstructorCall) {
            return true;
        }
        return expression.descendants(ASTMethodCall.class).first() != null
                || expression.descendants(ASTConstructorCall.class).first() != null;
    }

    private static boolean looksLikeSimpleReferenceText(String text) {
        if (text == null || text.isBlank()) {
            return false;
        }
        String normalized = text;
        while (normalized.startsWith("(") && normalized.endsWith(")")) {
            normalized = normalized.substring(1, normalized.length() - 1).trim();
        }
        return normalized.matches("(?:this\\.|super\\.)?[A-Za-z_][A-Za-z0-9_]*(?:\\.[A-Za-z_][A-Za-z0-9_]*)*");
    }

    record Analysis(boolean ceremonial, String collaboratorTarget, List<String> trivialDescriptions) {

        static Analysis notCeremonial() {
            return new Analysis(false, "", List.of());
        }
    }

    private record MethodShape(String description, String externalTarget) {
    }
}
