package saltmarcher.quality.pmd.indirection;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;
import net.sourceforge.pmd.lang.document.TextRegion;
import net.sourceforge.pmd.lang.java.ast.ASTBlock;
import net.sourceforge.pmd.lang.java.ast.ASTClassDeclaration;
import net.sourceforge.pmd.lang.java.ast.ASTConstructorCall;
import net.sourceforge.pmd.lang.java.ast.ASTExpression;
import net.sourceforge.pmd.lang.java.ast.ASTExpressionStatement;
import net.sourceforge.pmd.lang.java.ast.ASTIfStatement;
import net.sourceforge.pmd.lang.java.ast.ASTLocalVariableDeclaration;
import net.sourceforge.pmd.lang.java.ast.ASTMethodCall;
import net.sourceforge.pmd.lang.java.ast.ASTMethodDeclaration;
import net.sourceforge.pmd.lang.java.ast.ASTReturnStatement;
import net.sourceforge.pmd.lang.java.ast.ASTStatement;
import net.sourceforge.pmd.lang.java.ast.ASTThrowStatement;
import net.sourceforge.pmd.lang.java.ast.ASTVariableDeclarator;
import saltmarcher.quality.pmd.support.SaltMarcherSourceFacts;

final class CeremonialMethodAnalysis {

    private static final Pattern SIMPLE_REFERENCE = Pattern.compile(
            "^(?:this\\.)?[A-Za-z_][A-Za-z0-9_]*(?:\\.[A-Za-z_][A-Za-z0-9_]*)*$");
    private static final Pattern NULL_GUARD_CONDITION = Pattern.compile(
            "^(?:null\\s*==\\s*(?:this\\.)?[A-Za-z_][A-Za-z0-9_]*(?:\\.[A-Za-z_][A-Za-z0-9_]*)*|"
                    + "(?:this\\.)?[A-Za-z_][A-Za-z0-9_]*(?:\\.[A-Za-z_][A-Za-z0-9_]*)*\\s*==\\s*null)$");

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
            ASTMethodCall methodCall = singleMethodCall(expressionStatement.getExpr());
            return methodCall != null && isRequireNonNullCall(methodCall, sourceFacts);
        }
        if (statement instanceof ASTLocalVariableDeclaration declaration) {
            ASTVariableDeclarator declarator = singleDeclarator(declaration);
            if (declarator == null || !declarator.hasInitializer()) {
                return false;
            }
            ASTMethodCall methodCall = singleMethodCall(declarator.getInitializer());
            return methodCall != null && isRequireNonNullCall(methodCall, sourceFacts);
        }
        if (statement instanceof ASTIfStatement ifStatement) {
            return isNullGuardIfStatement(ifStatement, sourceFacts);
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

    private static boolean isNullGuardIfStatement(ASTIfStatement ifStatement, SaltMarcherSourceFacts sourceFacts) {
        if (ifStatement.hasElse()) {
            return false;
        }
        ASTStatement thenBranch = unwrapSingleStatement(ifStatement.getThenBranch());
        return thenBranch instanceof ASTThrowStatement
                && NULL_GUARD_CONDITION.matcher(normalizedNodeText(ifStatement.getCondition(), sourceFacts)).matches();
    }

    private static boolean isTrivialAlias(ASTStatement statement, SaltMarcherSourceFacts sourceFacts) {
        if (!(statement instanceof ASTLocalVariableDeclaration declaration)) {
            return false;
        }
        ASTVariableDeclarator declarator = singleDeclarator(declaration);
        if (declarator == null || !declarator.hasInitializer()) {
            return false;
        }
        return SIMPLE_REFERENCE.matcher(normalizedNodeText(declarator.getInitializer(), sourceFacts)).matches();
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
        if (expression instanceof ASTMethodCall || expression.descendants(ASTMethodCall.class).first() != null) {
            return null;
        }
        ASTConstructorCall constructorCall = singleOutermostConstructorCall(expression);
        if (constructorCall == null) {
            return null;
        }
        String constructedType = normalizedNodeText(constructorCall.getTypeNode(), sourceFacts);
        return new MethodShape("wraps constructor " + constructedType, "new:" + constructedType);
    }

    private static MethodShape classifyDelegatedCall(
            ASTExpression expression,
            SaltMarcherSourceFacts sourceFacts,
            Set<String> localMethodNames,
            boolean returnsValue
    ) {
        if (expression instanceof ASTConstructorCall || expression.descendants(ASTConstructorCall.class).first() != null) {
            return null;
        }
        ASTMethodCall methodCall = singleOutermostMethodCall(expression);
        if (methodCall == null) {
            return null;
        }
        ASTExpression qualifier = methodCall.getQualifier();
        if (qualifier != null && !isSimpleQualifier(qualifier, sourceFacts)) {
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

    private static ASTMethodCall singleOutermostMethodCall(ASTExpression expression) {
        if (expression instanceof ASTMethodCall methodCall) {
            return hasNestedInvocation(methodCall) ? null : methodCall;
        }
        List<ASTMethodCall> methodCalls = expression.descendants(ASTMethodCall.class)
                .filter(methodCall -> methodCall.ancestors(ASTMethodCall.class).first() == null)
                .toList();
        if (methodCalls.size() != 1) {
            return null;
        }
        ASTMethodCall methodCall = methodCalls.getFirst();
        return hasNestedInvocation(methodCall) ? null : methodCall;
    }

    private static ASTConstructorCall singleOutermostConstructorCall(ASTExpression expression) {
        if (expression instanceof ASTConstructorCall constructorCall) {
            return hasNestedInvocation(constructorCall) ? null : constructorCall;
        }
        List<ASTConstructorCall> constructorCalls = expression.descendants(ASTConstructorCall.class)
                .filter(constructorCall -> constructorCall.ancestors(ASTConstructorCall.class).first() == null)
                .toList();
        if (constructorCalls.size() != 1) {
            return null;
        }
        ASTConstructorCall constructorCall = constructorCalls.getFirst();
        return hasNestedInvocation(constructorCall) ? null : constructorCall;
    }

    private static boolean hasNestedInvocation(ASTMethodCall methodCall) {
        return methodCall.descendants(ASTMethodCall.class).first() != null
                || methodCall.descendants(ASTConstructorCall.class).first() != null;
    }

    private static boolean hasNestedInvocation(ASTConstructorCall constructorCall) {
        return constructorCall.descendants(ASTMethodCall.class).first() != null
                || constructorCall.descendants(ASTConstructorCall.class).first() != null;
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

    private static boolean isSimpleQualifier(ASTExpression qualifier, SaltMarcherSourceFacts sourceFacts) {
        return qualifier.descendants(ASTMethodCall.class).first() == null
                && qualifier.descendants(ASTConstructorCall.class).first() == null
                && SIMPLE_REFERENCE.matcher(normalizedNodeText(qualifier, sourceFacts)).matches();
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
        return qualifier == null ? null : normalizedNodeText(qualifier, sourceFacts);
    }

    private static String normalizedNodeText(Node node, SaltMarcherSourceFacts sourceFacts) {
        TextRegion region = node.getTextRegion();
        String rawText = sourceFacts.text().substring(region.getStartOffset(), region.getEndOffset());
        return stripCommentsAndStrings(rawText).replaceAll("\\s+", " ").trim();
    }

    private static String stripCommentsAndStrings(String text) {
        StringBuilder result = new StringBuilder(text.length());
        boolean inLineComment = false;
        boolean inBlockComment = false;
        boolean inString = false;
        boolean inChar = false;
        boolean escaped = false;
        for (int index = 0; index < text.length(); index++) {
            char current = text.charAt(index);
            char next = index + 1 < text.length() ? text.charAt(index + 1) : '\0';
            if (inLineComment) {
                if (current == '\n' || current == '\r') {
                    inLineComment = false;
                    result.append(current);
                } else {
                    result.append(' ');
                }
                continue;
            }
            if (inBlockComment) {
                if (current == '*' && next == '/') {
                    inBlockComment = false;
                    result.append("  ");
                    index++;
                } else {
                    result.append(current == '\n' || current == '\r' ? current : ' ');
                }
                continue;
            }
            if (escaped) {
                escaped = false;
                result.append(' ');
                continue;
            }
            if (current == '\\' && (inString || inChar)) {
                escaped = true;
                result.append(' ');
                continue;
            }
            if (inString) {
                if (current == '"') {
                    inString = false;
                }
                result.append(current == '\n' || current == '\r' ? current : ' ');
                continue;
            }
            if (inChar) {
                if (current == '\'') {
                    inChar = false;
                }
                result.append(current == '\n' || current == '\r' ? current : ' ');
                continue;
            }
            if (current == '/' && next == '/') {
                inLineComment = true;
                result.append("  ");
                index++;
                continue;
            }
            if (current == '/' && next == '*') {
                inBlockComment = true;
                result.append("  ");
                index++;
                continue;
            }
            if (current == '"') {
                inString = true;
                result.append(' ');
                continue;
            }
            if (current == '\'') {
                inChar = true;
                result.append(' ');
                continue;
            }
            result.append(current);
        }
        return result.toString();
    }

    record Analysis(boolean ceremonial, String collaboratorTarget, List<String> trivialDescriptions) {

        static Analysis notCeremonial() {
            return new Analysis(false, "", List.of());
        }
    }

    private record MethodShape(String description, String externalTarget) {
    }
}
