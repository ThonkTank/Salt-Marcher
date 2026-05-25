package saltmarcher.quality.errorprone.view;

import com.google.errorprone.util.ASTHelpers;
import com.sun.source.tree.AssignmentTree;
import com.sun.source.tree.ClassTree;
import com.sun.source.tree.CompilationUnitTree;
import com.sun.source.tree.IdentifierTree;
import com.sun.source.tree.LambdaExpressionTree;
import com.sun.source.tree.MemberSelectTree;
import com.sun.source.tree.MethodInvocationTree;
import com.sun.source.tree.MethodTree;
import com.sun.source.tree.ReturnTree;
import com.sun.source.tree.Tree;
import com.sun.source.tree.VariableTree;
import com.sun.source.util.TreeScanner;
import com.sun.tools.javac.code.Symbol;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.function.Predicate;
import javax.lang.model.element.ElementKind;
import javax.lang.model.element.Modifier;

/**
 * Resolves method-local expression provenance for view-boundary checkers.
 *
 * <p>The support stays conservative: a local alias or helper call is treated as forbidden only when
 * every reachable same-method definition or inlinable helper return stays forbidden.
 */
public final class ViewExpressionProvenanceSupport {

    private final Map<Symbol.MethodSymbol, MethodContext> methodContexts;

    private ViewExpressionProvenanceSupport(Map<Symbol.MethodSymbol, MethodContext> methodContexts) {
        this.methodContexts = Map.copyOf(methodContexts);
    }

    public static ViewExpressionProvenanceSupport create(CompilationUnitTree tree) {
        Map<Symbol.MethodSymbol, MethodContext> contexts = new LinkedHashMap<>();
        Deque<ClassTree> classStack = new ArrayDeque<>();
        for (Tree typeDeclaration : tree.getTypeDecls()) {
            collectFromMember(typeDeclaration, classStack, contexts);
        }
        return new ViewExpressionProvenanceSupport(contexts);
    }

    public boolean definitelyReferencesSameViewModel(
            Tree expression,
            Symbol.MethodSymbol enclosingMethod,
            String sourcePackageName
    ) {
        return definitelyReferencesSameViewModel(
                expression,
                methodContexts.get(enclosingMethod),
                sourcePackageName,
                new LinkedHashSet<>(),
                new LinkedHashSet<>());
    }

    public SnapshotViolation findFirstSnapshotViolation(
            Tree expression,
            Symbol.MethodSymbol enclosingMethod,
            String sourcePackageName,
            String qualifiedViewName
    ) {
        return findFirstSnapshotViolation(
                expression,
                methodContexts.get(enclosingMethod),
                sourcePackageName,
                qualifiedViewName,
                new LinkedHashSet<>(),
                new LinkedHashSet<>());
    }

    private static void collectFromMember(
            Tree member,
            Deque<ClassTree> classStack,
            Map<Symbol.MethodSymbol, MethodContext> contexts
    ) {
        if (member instanceof ClassTree classTree) {
            classStack.addLast(classTree);
            try {
                for (Tree nestedMember : classTree.getMembers()) {
                    collectFromMember(nestedMember, classStack, contexts);
                }
            } finally {
                classStack.removeLast();
            }
            return;
        }
        if (!(member instanceof MethodTree methodTree) || classStack.isEmpty()) {
            return;
        }
        Symbol.MethodSymbol methodSymbol = ASTHelpers.getSymbol(methodTree);
        if (methodSymbol == null) {
            return;
        }
        contexts.put(methodSymbol, MethodContext.create(methodTree));
    }

    private boolean definitelyReferencesSameViewModel(
            Tree expression,
            MethodContext methodContext,
            String sourcePackageName,
            Set<Symbol> activeSymbols,
            Set<Symbol.MethodSymbol> activeMethods
    ) {
        if (expression == null) {
            return false;
        }
        if (directlyReferencesSameViewModel(expression, sourcePackageName)) {
            return true;
        }
        if ((expression instanceof IdentifierTree || expression instanceof MemberSelectTree)
                && methodContext != null) {
            Symbol symbol = ASTHelpers.getSymbol(expression);
            if (isTrackedLocalSymbol(symbol) && activeSymbols.add(symbol)) {
                try {
                    List<Tree> valueExpressions = methodContext.valueExpressions(symbol);
                    if (!valueExpressions.isEmpty()
                            && valueExpressions.stream().allMatch(valueExpression ->
                            definitelyReferencesSameViewModel(
                                    valueExpression,
                                    methodContext,
                                    sourcePackageName,
                                    activeSymbols,
                                    activeMethods))) {
                        return true;
                    }
                } finally {
                    activeSymbols.remove(symbol);
                }
            }
        }
        if (expression instanceof MethodInvocationTree methodInvocationTree) {
            Symbol.MethodSymbol methodSymbol = ASTHelpers.getSymbol(methodInvocationTree);
            if (isInlinableSameFileHelper(methodSymbol) && activeMethods.add(methodSymbol)) {
                try {
                    MethodContext helperContext = methodContexts.get(methodSymbol);
                    if (helperContext != null) {
                        List<Tree> returnExpressions = helperContext.returnExpressions();
                        if (!returnExpressions.isEmpty()
                                && returnExpressions.stream().allMatch(returnExpression ->
                                definitelyReferencesSameViewModel(
                                        returnExpression,
                                        helperContext,
                                        sourcePackageName,
                                        activeSymbols,
                                        activeMethods))) {
                            return true;
                        }
                    }
                } finally {
                    activeMethods.remove(methodSymbol);
                }
            }
        }
        return anyChildMatches(
                expression,
                child -> definitelyReferencesSameViewModel(
                        child,
                        methodContext,
                        sourcePackageName,
                        activeSymbols,
                        activeMethods));
    }

    private SnapshotViolation findFirstSnapshotViolation(
            Tree expression,
            MethodContext methodContext,
            String sourcePackageName,
            String qualifiedViewName,
            Set<Symbol> activeSymbols,
            Set<Symbol.MethodSymbol> activeMethods
    ) {
        if (expression == null) {
            return null;
        }
        SnapshotViolation directViolation = directSnapshotViolation(expression, sourcePackageName, qualifiedViewName);
        if (directViolation != null) {
            return directViolation;
        }
        if ((expression instanceof IdentifierTree || expression instanceof MemberSelectTree)
                && methodContext != null) {
            Symbol symbol = ASTHelpers.getSymbol(expression);
            if (isTrackedLocalSymbol(symbol) && activeSymbols.add(symbol)) {
                try {
                    List<Tree> valueExpressions = methodContext.valueExpressions(symbol);
                    if (!valueExpressions.isEmpty()) {
                        SnapshotViolation resolvedViolation = null;
                        for (Tree valueExpression : valueExpressions) {
                            SnapshotViolation candidate = findFirstSnapshotViolation(
                                    valueExpression,
                                    methodContext,
                                    sourcePackageName,
                                    qualifiedViewName,
                                    activeSymbols,
                                    activeMethods);
                            if (candidate == null) {
                                resolvedViolation = null;
                                break;
                            }
                            if (resolvedViolation == null) {
                                resolvedViolation = candidate;
                            }
                        }
                        if (resolvedViolation != null) {
                            return resolvedViolation;
                        }
                    }
                } finally {
                    activeSymbols.remove(symbol);
                }
            }
        }
        if (expression instanceof MethodInvocationTree methodInvocationTree) {
            Symbol.MethodSymbol methodSymbol = ASTHelpers.getSymbol(methodInvocationTree);
            if (isInlinableSameFileHelper(methodSymbol) && activeMethods.add(methodSymbol)) {
                try {
                    MethodContext helperContext = methodContexts.get(methodSymbol);
                    if (helperContext != null && !helperContext.returnExpressions().isEmpty()) {
                        SnapshotViolation resolvedViolation = null;
                        for (Tree returnExpression : helperContext.returnExpressions()) {
                            SnapshotViolation candidate = findFirstSnapshotViolation(
                                    returnExpression,
                                    helperContext,
                                    sourcePackageName,
                                    qualifiedViewName,
                                    activeSymbols,
                                    activeMethods);
                            if (candidate == null) {
                                resolvedViolation = null;
                                break;
                            }
                            if (resolvedViolation == null) {
                                resolvedViolation = candidate;
                            }
                        }
                        if (resolvedViolation != null) {
                            return resolvedViolation;
                        }
                    }
                } finally {
                    activeMethods.remove(methodSymbol);
                }
            }
        }
        return firstChildViolation(
                expression,
                child -> findFirstSnapshotViolation(
                        child,
                        methodContext,
                        sourcePackageName,
                        qualifiedViewName,
                        activeSymbols,
                        activeMethods));
    }

    private static boolean directlyReferencesSameViewModel(Tree tree, String sourcePackageName) {
        Set<String> referencedTypes = new LinkedHashSet<>();
        ViewArchitectureSupport.collectReferencedTypes(tree, referencedTypes);
        return referencedTypes.stream().anyMatch(referencedType ->
                ViewArchitectureSupport.isSameViewRootModelReference(sourcePackageName, referencedType));
    }

    private static SnapshotViolation directSnapshotViolation(
            Tree tree,
            String sourcePackageName,
            String qualifiedViewName
    ) {
        if (tree instanceof MethodInvocationTree methodInvocationTree) {
            Symbol.MethodSymbol symbol = ASTHelpers.getSymbol(methodInvocationTree);
            if (symbol != null) {
                String ownerType = ViewArchitectureSupport.getQualifiedOwnerTypeName(symbol);
                if (isSameViewHelperOwner(ownerType, qualifiedViewName) && !isRawSnapshotHelper(symbol)) {
                    return new SnapshotViolation(
                            methodInvocationTree,
                            "same-view helper " + ownerType + "." + symbol.getSimpleName() + "()");
                }
                String forbiddenReference = firstForbiddenSnapshotReference(methodInvocationTree, sourcePackageName);
                if (forbiddenReference != null) {
                    return new SnapshotViolation(
                            methodInvocationTree,
                            "forbidden snapshot dependency " + forbiddenReference);
                }
            }
        }
        if (tree instanceof IdentifierTree || tree instanceof MemberSelectTree || tree instanceof VariableTree) {
            String forbiddenReference = firstForbiddenSnapshotReference(tree, sourcePackageName);
            if (forbiddenReference != null) {
                return new SnapshotViolation(tree, "forbidden snapshot dependency " + forbiddenReference);
            }
            Symbol symbol = ASTHelpers.getSymbol(tree);
            String ownerType = ViewArchitectureSupport.getQualifiedOwnerTypeName(symbol);
            if (symbol instanceof Symbol.VarSymbol fieldSymbol
                    && fieldSymbol.getModifiers().contains(Modifier.STATIC)
                    && fieldSymbol.getModifiers().contains(Modifier.FINAL)
                    && isSameViewHelperOwner(ownerType, qualifiedViewName)
                    && isSentinelName(fieldSymbol.getSimpleName().toString())) {
                return new SnapshotViolation(
                        tree,
                        "same-view sentinel " + ownerType + "." + fieldSymbol.getSimpleName());
            }
        }
        if (tree instanceof com.sun.source.tree.NewClassTree newClassTree) {
            String forbiddenReference = firstForbiddenSnapshotReference(newClassTree, sourcePackageName);
            if (forbiddenReference != null) {
                return new SnapshotViolation(newClassTree, "forbidden snapshot dependency " + forbiddenReference);
            }
        }
        return null;
    }

    private static String firstForbiddenSnapshotReference(Tree tree, String sourcePackageName) {
        Set<String> referencedTypes = new LinkedHashSet<>();
        ViewArchitectureSupport.collectReferencedTypes(tree, referencedTypes);
        return referencedTypes.stream()
                .filter(referencedType -> isForbiddenSnapshotReference(referencedType, sourcePackageName))
                .findFirst()
                .orElse(null);
    }

    private static boolean isForbiddenSnapshotReference(String referencedType, String sourcePackageName) {
        if (referencedType == null || referencedType.isBlank()) {
            return false;
        }
        return referencedType.startsWith("src.domain.")
                || referencedType.startsWith("src.data.")
                || ViewArchitectureSupport.isApplicationServiceReference(referencedType)
                || ViewArchitectureSupport.isSameViewRootModelReference(sourcePackageName, referencedType)
                || ViewArchitectureSupport.isTargetPublishedEventReference(referencedType);
    }

    private static boolean isSameViewHelperOwner(String ownerType, String qualifiedViewName) {
        return ownerType != null
                && (ownerType.equals(qualifiedViewName)
                || ownerType.startsWith(qualifiedViewName + "$")
                || ownerType.startsWith(qualifiedViewName + "."));
    }

    private static boolean isRawSnapshotHelper(Symbol.MethodSymbol methodSymbol) {
        return methodSymbol != null
                && methodSymbol.getModifiers().contains(Modifier.PRIVATE)
                && methodSymbol.getSimpleName().toString().startsWith("raw");
    }

    private static boolean isTrackedLocalSymbol(Symbol symbol) {
        if (!(symbol instanceof Symbol.VarSymbol varSymbol)) {
            return false;
        }
        ElementKind kind = varSymbol.getKind();
        return kind == ElementKind.LOCAL_VARIABLE
                || kind == ElementKind.PARAMETER
                || kind == ElementKind.RESOURCE_VARIABLE
                || kind == ElementKind.EXCEPTION_PARAMETER;
    }

    private static boolean isInlinableSameFileHelper(Symbol.MethodSymbol methodSymbol) {
        if (methodSymbol == null) {
            return false;
        }
        return methodSymbol.getModifiers().contains(Modifier.PRIVATE)
                || methodSymbol.getModifiers().contains(Modifier.STATIC)
                || methodSymbol.getModifiers().contains(Modifier.FINAL)
                || ownerClassIsEffectivelyNonOverridable(methodSymbol);
    }

    private static boolean ownerClassIsEffectivelyNonOverridable(Symbol.MethodSymbol methodSymbol) {
        return methodSymbol.owner instanceof Symbol.ClassSymbol classSymbol
                && classSymbol.getModifiers().contains(Modifier.FINAL);
    }

    private static boolean isSentinelName(String fieldName) {
        return fieldName.startsWith("AUTO_")
                || fieldName.startsWith("NO_")
                || fieldName.startsWith("EMPTY_")
                || fieldName.startsWith("DEFAULT_");
    }

    private static boolean anyChildMatches(Tree root, Predicate<Tree> childMatcher) {
        boolean[] found = {false};
        new TreeScanner<Void, Void>() {
            @Override
            public Void scan(Tree tree, Void unused) {
                if (tree == null || found[0]) {
                    return null;
                }
                if (tree != root && childMatcher.test(tree)) {
                    found[0] = true;
                    return null;
                }
                return super.scan(tree, unused);
            }

            @Override
            public Void visitClass(ClassTree classTree, Void unused) {
                return classTree == root ? super.visitClass(classTree, unused) : null;
            }

            @Override
            public Void visitLambdaExpression(LambdaExpressionTree lambdaExpressionTree, Void unused) {
                return lambdaExpressionTree == root ? super.visitLambdaExpression(lambdaExpressionTree, unused) : null;
            }
        }.scan(root, null);
        return found[0];
    }

    private static SnapshotViolation firstChildViolation(
            Tree root,
            Function<Tree, SnapshotViolation> childResolver
    ) {
        SnapshotViolation[] found = {null};
        new TreeScanner<Void, Void>() {
            @Override
            public Void scan(Tree tree, Void unused) {
                if (tree == null || found[0] != null) {
                    return null;
                }
                if (tree != root) {
                    found[0] = childResolver.apply(tree);
                    return null;
                }
                return super.scan(tree, unused);
            }

            @Override
            public Void visitClass(ClassTree classTree, Void unused) {
                return classTree == root ? super.visitClass(classTree, unused) : null;
            }

            @Override
            public Void visitLambdaExpression(LambdaExpressionTree lambdaExpressionTree, Void unused) {
                return lambdaExpressionTree == root ? super.visitLambdaExpression(lambdaExpressionTree, unused) : null;
            }
        }.scan(root, null);
        return found[0];
    }

    public record SnapshotViolation(Tree anchor, String description) {
    }

    private record MethodContext(
            Map<Symbol, List<Tree>> valueExpressions,
            List<Tree> returnExpressions
    ) {

        private static MethodContext create(MethodTree methodTree) {
            Map<Symbol, List<Tree>> valueExpressions = new LinkedHashMap<>();
            List<Tree> returnExpressions = new ArrayList<>();
            Tree body = methodTree.getBody();
            if (body != null) {
                new TreeScanner<Void, Void>() {
                    @Override
                    public Void visitClass(ClassTree classTree, Void unused) {
                        return null;
                    }

                    @Override
                    public Void visitLambdaExpression(LambdaExpressionTree lambdaExpressionTree, Void unused) {
                        return null;
                    }

                    @Override
                    public Void visitVariable(VariableTree variableTree, Void unused) {
                        Symbol symbol = ASTHelpers.getSymbol(variableTree);
                        if (isTrackedLocalSymbol(symbol) && variableTree.getInitializer() != null) {
                            addValueExpression(valueExpressions, symbol, variableTree.getInitializer());
                        }
                        return super.visitVariable(variableTree, unused);
                    }

                    @Override
                    public Void visitAssignment(AssignmentTree assignmentTree, Void unused) {
                        Symbol symbol = ASTHelpers.getSymbol(assignmentTree.getVariable());
                        if (isTrackedLocalSymbol(symbol)) {
                            addValueExpression(valueExpressions, symbol, assignmentTree.getExpression());
                        }
                        return super.visitAssignment(assignmentTree, unused);
                    }

                    @Override
                    public Void visitReturn(ReturnTree returnTree, Void unused) {
                        if (returnTree.getExpression() != null) {
                            returnExpressions.add(returnTree.getExpression());
                        }
                        return super.visitReturn(returnTree, unused);
                    }
                }.scan(body, null);
            }
            return new MethodContext(
                    valueExpressions.entrySet().stream()
                            .collect(LinkedHashMap::new,
                                    (map, entry) -> map.put(entry.getKey(), List.copyOf(entry.getValue())),
                                    LinkedHashMap::putAll),
                    List.copyOf(returnExpressions));
        }

        private List<Tree> valueExpressions(Symbol symbol) {
            return valueExpressions.getOrDefault(symbol, List.of());
        }
    }

    private static void addValueExpression(Map<Symbol, List<Tree>> expressionsBySymbol, Symbol symbol, Tree expression) {
        expressionsBySymbol.computeIfAbsent(symbol, unused -> new ArrayList<>()).add(expression);
    }
}
