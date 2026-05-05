package saltmarcher.quality.pmd.indirection;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import net.sourceforge.pmd.lang.java.ast.ASTAmbiguousName;
import net.sourceforge.pmd.lang.java.ast.ASTAssignableExpr;
import net.sourceforge.pmd.lang.java.ast.ASTArgumentList;
import net.sourceforge.pmd.lang.java.ast.ASTBlock;
import net.sourceforge.pmd.lang.java.ast.ASTBooleanLiteral;
import net.sourceforge.pmd.lang.java.ast.ASTCastExpression;
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
        Map<String, SimpleReference> aliases = new LinkedHashMap<>();
        for (ASTStatement statement : body.children(ASTStatement.class).toList()) {
            if (isSkippableScaffolding(statement, sourceFacts, aliases)) {
                continue;
            }
            effectiveStatements.add(statement);
        }
        if (effectiveStatements.size() != 1) {
            return null;
        }
        return classifyEffectiveStatement(effectiveStatements.getFirst(), sourceFacts, localMethodNames, aliases);
    }

    private static boolean isSkippableScaffolding(
            ASTStatement statement,
            SaltMarcherSourceFacts sourceFacts,
            Map<String, SimpleReference> aliases
    ) {
        if (statement instanceof ASTLocalVariableDeclaration declaration) {
            ASTVariableDeclarator declarator = singleDeclarator(declaration);
            if (declarator == null || !declarator.hasInitializer()) {
                return false;
            }
            SimpleReference aliasTarget = trivialAliasTarget(declarator.getInitializer(), sourceFacts, aliases);
            if (aliasTarget != null) {
                aliases.put(declarator.getName(), aliasTarget);
                return true;
            }
            return false;
        }
        if (statement instanceof ASTExpressionStatement expressionStatement) {
            ASTMethodCall methodCall = directMethodCall(expressionStatement.getExpr());
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
        String qualifierText = qualifierText(methodCall, sourceFacts, Map.of());
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

    private static SimpleReference trivialAliasTarget(
            ASTExpression initializer,
            SaltMarcherSourceFacts sourceFacts,
            Map<String, SimpleReference> aliases
    ) {
        SimpleReference directReference = resolveSimpleReference(initializer, sourceFacts, aliases);
        if (directReference != null) {
            return directReference;
        }

        ASTMethodCall methodCall = directMethodCall(initializer);
        if (methodCall == null || !isRequireNonNullCall(methodCall, sourceFacts)) {
            return null;
        }
        List<ASTExpression> arguments = methodCall.getArguments().children(ASTExpression.class).toList();
        if (arguments.isEmpty()) {
            return null;
        }
        return resolveSimpleReference(arguments.getFirst(), sourceFacts, aliases);
    }

    private static MethodShape classifyEffectiveStatement(
            ASTStatement statement,
            SaltMarcherSourceFacts sourceFacts,
            Set<String> localMethodNames,
            Map<String, SimpleReference> aliases
    ) {
        if (statement instanceof ASTReturnStatement returnStatement) {
            ASTExpression expression = returnStatement.getExpr();
            if (expression == null) {
                return null;
            }
            MethodShape constructorShape = classifyConstructorReturn(expression, sourceFacts, aliases);
            if (constructorShape != null) {
                return constructorShape;
            }
            return classifyDelegatedCall(expression, sourceFacts, localMethodNames, aliases, true);
        }
        if (statement instanceof ASTExpressionStatement expressionStatement) {
            return classifyDelegatedCall(expressionStatement.getExpr(), sourceFacts, localMethodNames, aliases, false);
        }
        return null;
    }

    private static MethodShape classifyConstructorReturn(
            ASTExpression expression,
            SaltMarcherSourceFacts sourceFacts,
            Map<String, SimpleReference> aliases
    ) {
        ASTConstructorCall constructorCall = directConstructorCall(expression);
        if (constructorCall == null) {
            return null;
        }
        if (constructorCall.isAnonymousClass()) {
            return null;
        }
        ASTExpression qualifier = constructorCall.getQualifier();
        if (qualifier != null && resolveSimpleReference(qualifier, sourceFacts, aliases) == null) {
            return null;
        }
        if (!argumentsAreSimple(constructorCall.getArguments(), aliases)) {
            return null;
        }
        String constructedType = JavaSourceTextSupport.normalizedNodeText(constructorCall.getTypeNode(), sourceFacts);
        return new MethodShape("wraps constructor " + constructedType, "new:" + constructedType);
    }

    private static MethodShape classifyDelegatedCall(
            ASTExpression expression,
            SaltMarcherSourceFacts sourceFacts,
            Set<String> localMethodNames,
            Map<String, SimpleReference> aliases,
            boolean returnsValue
    ) {
        ASTMethodCall methodCall = directMethodCall(expression);
        if (methodCall == null) {
            return null;
        }
        ASTExpression qualifier = methodCall.getQualifier();
        if (qualifier != null && resolveSimpleReference(qualifier, sourceFacts, aliases) == null) {
            return null;
        }
        if (!argumentsAreSimple(methodCall.getArguments(), aliases)) {
            return null;
        }

        String callee = renderCallee(methodCall, sourceFacts, aliases);
        String externalTarget = externalTarget(methodCall, sourceFacts, localMethodNames, aliases);
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

    private static boolean argumentsAreSimple(ASTArgumentList arguments, Map<String, SimpleReference> aliases) {
        return arguments.children(ASTExpression.class).toList().stream()
                .allMatch(argument -> isSimpleDelegatedArgument(argument, aliases));
    }

    private static boolean isSimpleDelegatedArgument(ASTExpression argument, Map<String, SimpleReference> aliases) {
        if (containsInvocation(argument)) {
            return false;
        }
        return resolveSimpleReference(argument, null, aliases) != null || isSimpleLiteralLike(argument);
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

    private static SimpleReference resolveSimpleReference(
            ASTExpression expression,
            SaltMarcherSourceFacts sourceFacts,
            Map<String, SimpleReference> aliases
    ) {
        if (expression instanceof ASTCastExpression
                || expression instanceof ASTMethodCall
                || expression instanceof ASTConstructorCall) {
            return null;
        }
        if (containsInvocation(expression)) {
            return null;
        }
        if (expression instanceof ASTFieldAccess fieldAccess) {
            ASTExpression qualifier = fieldAccess.getQualifier();
            if (qualifier == null) {
                return SimpleReference.named(fieldAccess.getName());
            }
            SimpleReference qualifierReference = resolveSimpleReference(qualifier, sourceFacts, aliases);
            return qualifierReference == null ? null : qualifierReference.child(fieldAccess.getName());
        }
        if (expression instanceof ASTAssignableExpr.ASTNamedReferenceExpr namedReference) {
            SimpleReference aliasedReference = aliases.get(namedReference.getName());
            return aliasedReference != null ? aliasedReference : SimpleReference.named(namedReference.getName());
        }
        if (expression instanceof ASTAmbiguousName ambiguousName) {
            return SimpleReference.named(ambiguousName.getName());
        }
        if (expression instanceof ASTThisExpression) {
            return SimpleReference.named("this");
        }
        if (expression instanceof ASTSuperExpression) {
            return SimpleReference.named("super");
        }
        if (expression instanceof ASTTypeExpression && sourceFacts != null) {
            return SimpleReference.named(JavaSourceTextSupport.normalizedNodeText(expression, sourceFacts));
        }
        return null;
    }

    private static String renderCallee(
            ASTMethodCall methodCall,
            SaltMarcherSourceFacts sourceFacts,
            Map<String, SimpleReference> aliases
    ) {
        String qualifierText = qualifierText(methodCall, sourceFacts, aliases);
        return qualifierText == null || qualifierText.isBlank()
                ? methodCall.getMethodName()
                : qualifierText + "." + methodCall.getMethodName();
    }

    private static String externalTarget(
            ASTMethodCall methodCall,
            SaltMarcherSourceFacts sourceFacts,
            Set<String> localMethodNames,
            Map<String, SimpleReference> aliases
    ) {
        String methodName = methodCall.getMethodName();
        String qualifierText = qualifierText(methodCall, sourceFacts, aliases);
        if (qualifierText == null || qualifierText.isBlank()) {
            return localMethodNames.contains(methodName) ? null : methodName;
        }
        if (("this".equals(qualifierText) || "super".equals(qualifierText)) && localMethodNames.contains(methodName)) {
            return null;
        }
        return qualifierText;
    }

    private static String qualifierText(
            ASTMethodCall methodCall,
            SaltMarcherSourceFacts sourceFacts,
            Map<String, SimpleReference> aliases
    ) {
        ASTExpression qualifier = methodCall.getQualifier();
        if (qualifier == null) {
            return null;
        }
        SimpleReference simpleReference = resolveSimpleReference(qualifier, sourceFacts, aliases);
        return simpleReference != null
                ? simpleReference.display()
                : JavaSourceTextSupport.normalizedNodeText(qualifier, sourceFacts);
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
        return (left instanceof ASTNullLiteral && resolveSimpleReference(right, null, Map.of()) != null)
                || (right instanceof ASTNullLiteral && resolveSimpleReference(left, null, Map.of()) != null);
    }

    private static boolean containsInvocation(ASTExpression expression) {
        if (expression instanceof ASTMethodCall || expression instanceof ASTConstructorCall) {
            return true;
        }
        return expression.descendants(ASTMethodCall.class).first() != null
                || expression.descendants(ASTConstructorCall.class).first() != null;
    }

    record Analysis(boolean ceremonial, String collaboratorTarget, List<String> trivialDescriptions) {

        static Analysis notCeremonial() {
            return new Analysis(false, "", List.of());
        }
    }

    private record MethodShape(String description, String externalTarget) {
    }

    private record SimpleReference(String display) {

        static SimpleReference named(String display) {
            return new SimpleReference(display);
        }

        SimpleReference child(String memberName) {
            return new SimpleReference(display + "." + memberName);
        }
    }
}
