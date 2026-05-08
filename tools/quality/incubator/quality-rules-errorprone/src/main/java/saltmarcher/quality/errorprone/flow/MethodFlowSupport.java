package saltmarcher.quality.errorprone.flow;

import com.google.errorprone.util.ASTHelpers;
import com.sun.source.tree.BlockTree;
import com.sun.source.tree.CaseTree;
import com.sun.source.tree.CatchTree;
import com.sun.source.tree.ConditionalExpressionTree;
import com.sun.source.tree.DoWhileLoopTree;
import com.sun.source.tree.EnhancedForLoopTree;
import com.sun.source.tree.ExpressionStatementTree;
import com.sun.source.tree.ExpressionTree;
import com.sun.source.tree.ForLoopTree;
import com.sun.source.tree.IfTree;
import com.sun.source.tree.MethodInvocationTree;
import com.sun.source.tree.MethodTree;
import com.sun.source.tree.ReturnTree;
import com.sun.source.tree.StatementTree;
import com.sun.source.tree.SwitchTree;
import com.sun.source.tree.ThrowTree;
import com.sun.source.tree.Tree;
import com.sun.source.tree.TryTree;
import com.sun.source.tree.VariableTree;
import com.sun.source.tree.WhileLoopTree;
import com.sun.tools.javac.code.Symbol;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

/**
 * Small method-local definite-fact flow layer for architecture checkers.
 *
 * <p>The analysis is intentionally conservative:
 * it carries only facts that hold on all reachable paths and inlines only same-file helper
 * methods that are private, static, or final.
 */
public final class MethodFlowSupport<F> {

    private final Map<Symbol.MethodSymbol, MethodTree> localMethodBodies;
    private final InvocationTransfer<F> invocationTransfer;
    private final Deque<Symbol.MethodSymbol> activeInlineStack = new ArrayDeque<>();

    public MethodFlowSupport(
            Map<Symbol.MethodSymbol, MethodTree> localMethodBodies,
            InvocationTransfer<F> invocationTransfer
    ) {
        this.localMethodBodies = Map.copyOf(localMethodBodies);
        this.invocationTransfer = Objects.requireNonNull(invocationTransfer, "invocationTransfer");
    }

    public AnalysisOutcome<F> analyze(MethodTree methodTree, Set<F> initialFacts) {
        if (methodTree == null || methodTree.getBody() == null) {
            return AnalysisOutcome.continuing(initialFacts);
        }
        Symbol.MethodSymbol methodSymbol = ASTHelpers.getSymbol(methodTree);
        if (methodSymbol != null) {
            activeInlineStack.addLast(methodSymbol);
        }
        try {
            return analyzeBlock(methodTree.getBody(), copy(initialFacts));
        } finally {
            if (methodSymbol != null) {
                activeInlineStack.removeLastOccurrence(methodSymbol);
            }
        }
    }

    private AnalysisOutcome<F> analyzeBlock(BlockTree blockTree, Set<F> inputFacts) {
        Set<F> facts = copy(inputFacts);
        for (StatementTree statement : blockTree.getStatements()) {
            AnalysisOutcome<F> outcome = analyzeStatement(statement, facts);
            if (!outcome.continues()) {
                return outcome;
            }
            facts = outcome.facts();
        }
        return AnalysisOutcome.continuing(facts);
    }

    private AnalysisOutcome<F> analyzeStatement(StatementTree statement, Set<F> inputFacts) {
        if (statement instanceof BlockTree nestedBlock) {
            return analyzeBlock(nestedBlock, inputFacts);
        }
        if (statement instanceof ExpressionStatementTree expressionStatement) {
            return AnalysisOutcome.continuing(analyzeExpression(expressionStatement.getExpression(), inputFacts));
        }
        if (statement instanceof VariableTree variableTree) {
            return AnalysisOutcome.continuing(analyzeExpression(variableTree.getInitializer(), inputFacts));
        }
        if (statement instanceof ReturnTree returnTree) {
            return AnalysisOutcome.terminating(analyzeExpression(returnTree.getExpression(), inputFacts));
        }
        if (statement instanceof ThrowTree throwTree) {
            return AnalysisOutcome.terminating(analyzeExpression(throwTree.getExpression(), inputFacts));
        }
        if (statement instanceof IfTree ifTree) {
            return analyzeIf(ifTree, inputFacts);
        }
        if (statement instanceof TryTree tryTree) {
            return analyzeTry(tryTree, inputFacts);
        }
        if (statement instanceof ForLoopTree forLoopTree) {
            return analyzeForLoop(forLoopTree, inputFacts);
        }
        if (statement instanceof EnhancedForLoopTree enhancedForLoopTree) {
            Set<F> loopFacts = analyzeExpression(enhancedForLoopTree.getExpression(), inputFacts);
            analyzeStatement(enhancedForLoopTree.getStatement(), loopFacts);
            return AnalysisOutcome.continuing(copy(inputFacts));
        }
        if (statement instanceof WhileLoopTree whileLoopTree) {
            Set<F> loopFacts = analyzeExpression(whileLoopTree.getCondition(), inputFacts);
            analyzeStatement(whileLoopTree.getStatement(), loopFacts);
            return AnalysisOutcome.continuing(copy(inputFacts));
        }
        if (statement instanceof DoWhileLoopTree doWhileLoopTree) {
            AnalysisOutcome<F> bodyOutcome = analyzeStatement(doWhileLoopTree.getStatement(), inputFacts);
            if (bodyOutcome.continues()) {
                analyzeExpression(doWhileLoopTree.getCondition(), bodyOutcome.facts());
            }
            return AnalysisOutcome.continuing(copy(inputFacts));
        }
        if (statement instanceof SwitchTree switchTree) {
            return analyzeSwitch(switchTree, inputFacts);
        }
        return AnalysisOutcome.continuing(copy(inputFacts));
    }

    private AnalysisOutcome<F> analyzeIf(IfTree ifTree, Set<F> inputFacts) {
        Set<F> conditionFacts = analyzeExpression(ifTree.getCondition(), inputFacts);
        AnalysisOutcome<F> thenOutcome = analyzeStatement(ifTree.getThenStatement(), conditionFacts);
        AnalysisOutcome<F> elseOutcome = ifTree.getElseStatement() == null
                ? AnalysisOutcome.continuing(conditionFacts)
                : analyzeStatement(ifTree.getElseStatement(), conditionFacts);
        return mergeBranchOutcomes(thenOutcome, elseOutcome);
    }

    private AnalysisOutcome<F> analyzeTry(TryTree tryTree, Set<F> inputFacts) {
        Set<F> resourceFacts = copy(inputFacts);
        for (Tree resource : tryTree.getResources()) {
            if (resource instanceof VariableTree variableTree) {
                resourceFacts = analyzeExpression(variableTree.getInitializer(), resourceFacts);
            } else if (resource instanceof ExpressionTree expressionTree) {
                resourceFacts = analyzeExpression(expressionTree, resourceFacts);
            }
        }

        List<AnalysisOutcome<F>> reachableOutcomes = new ArrayList<>();
        reachableOutcomes.add(analyzeBlock(tryTree.getBlock(), resourceFacts));
        for (CatchTree catchTree : tryTree.getCatches()) {
            reachableOutcomes.add(analyzeBlock(catchTree.getBlock(), resourceFacts));
        }

        AnalysisOutcome<F> merged = mergeReachableOutcomes(reachableOutcomes);
        if (tryTree.getFinallyBlock() != null) {
            Set<F> finallyInput = merged.continues() ? merged.facts() : resourceFacts;
            AnalysisOutcome<F> finallyOutcome = analyzeBlock(tryTree.getFinallyBlock(), finallyInput);
            if (!finallyOutcome.continues()) {
                return finallyOutcome;
            }
            if (!merged.continues()) {
                return merged;
            }
            return AnalysisOutcome.continuing(finallyOutcome.facts());
        }
        return merged;
    }

    private AnalysisOutcome<F> analyzeForLoop(ForLoopTree forLoopTree, Set<F> inputFacts) {
        Set<F> loopFacts = copy(inputFacts);
        for (StatementTree initializer : forLoopTree.getInitializer()) {
            AnalysisOutcome<F> initializerOutcome = analyzeStatement(initializer, loopFacts);
            if (!initializerOutcome.continues()) {
                return initializerOutcome;
            }
            loopFacts = initializerOutcome.facts();
        }
        loopFacts = analyzeExpression(forLoopTree.getCondition(), loopFacts);
        analyzeStatement(forLoopTree.getStatement(), loopFacts);
        for (ExpressionStatementTree update : forLoopTree.getUpdate()) {
            analyzeExpression(update.getExpression(), loopFacts);
        }
        return AnalysisOutcome.continuing(copy(inputFacts));
    }

    private AnalysisOutcome<F> analyzeSwitch(SwitchTree switchTree, Set<F> inputFacts) {
        Set<F> selectorFacts = analyzeExpression(switchTree.getExpression(), inputFacts);
        List<AnalysisOutcome<F>> caseOutcomes = new ArrayList<>();
        for (CaseTree caseTree : switchTree.getCases()) {
            Set<F> caseFacts = copy(selectorFacts);
            for (StatementTree statement : caseTree.getStatements()) {
                AnalysisOutcome<F> statementOutcome = analyzeStatement(statement, caseFacts);
                if (!statementOutcome.continues()) {
                    caseOutcomes.add(statementOutcome);
                    caseFacts = null;
                    break;
                }
                caseFacts = statementOutcome.facts();
            }
            if (caseFacts != null) {
                caseOutcomes.add(AnalysisOutcome.continuing(caseFacts));
            }
        }
        if (caseOutcomes.isEmpty()) {
            return AnalysisOutcome.continuing(selectorFacts);
        }
        return mergeReachableOutcomes(caseOutcomes);
    }

    private Set<F> analyzeExpression(ExpressionTree expressionTree, Set<F> inputFacts) {
        if (expressionTree == null) {
            return copy(inputFacts);
        }
        if (expressionTree instanceof MethodInvocationTree methodInvocationTree) {
            Set<F> facts = copy(inputFacts);
            ExpressionTree receiver = ASTHelpers.getReceiver(methodInvocationTree);
            facts = analyzeExpression(receiver, facts);
            for (ExpressionTree argument : methodInvocationTree.getArguments()) {
                facts = analyzeExpression(argument, facts);
            }
            Symbol.MethodSymbol symbol = ASTHelpers.getSymbol(methodInvocationTree);
            if (symbol == null) {
                return facts;
            }
            Set<F> afterInvocationFacts = invocationTransfer.afterInvocation(methodInvocationTree, symbol, facts);
            AnalysisOutcome<F> inlineOutcome = maybeInline(symbol, afterInvocationFacts);
            return inlineOutcome.continues() ? inlineOutcome.facts() : afterInvocationFacts;
        }
        if (expressionTree instanceof ConditionalExpressionTree conditionalExpressionTree) {
            Set<F> conditionFacts = analyzeExpression(conditionalExpressionTree.getCondition(), inputFacts);
            Set<F> trueFacts = analyzeExpression(conditionalExpressionTree.getTrueExpression(), conditionFacts);
            Set<F> falseFacts = analyzeExpression(conditionalExpressionTree.getFalseExpression(), conditionFacts);
            return intersect(trueFacts, falseFacts);
        }

        Set<F> facts = copy(inputFacts);
        for (Tree child : invocationTransfer.childExpressions(expressionTree)) {
            if (child instanceof ExpressionTree childExpression) {
                facts = analyzeExpression(childExpression, facts);
            }
        }
        return facts;
    }

    private AnalysisOutcome<F> maybeInline(Symbol.MethodSymbol symbol, Set<F> factsAfterInvocation) {
        if (!invocationTransfer.shouldInline(symbol) || activeInlineStack.contains(symbol)) {
            return AnalysisOutcome.continuing(factsAfterInvocation);
        }
        MethodTree helper = localMethodBodies.get(symbol);
        if (helper == null || helper.getBody() == null) {
            return AnalysisOutcome.continuing(factsAfterInvocation);
        }
        activeInlineStack.addLast(symbol);
        try {
            return analyzeBlock(helper.getBody(), factsAfterInvocation);
        } finally {
            activeInlineStack.removeLastOccurrence(symbol);
        }
    }

    private AnalysisOutcome<F> mergeBranchOutcomes(AnalysisOutcome<F> left, AnalysisOutcome<F> right) {
        return mergeReachableOutcomes(List.of(left, right));
    }

    private AnalysisOutcome<F> mergeReachableOutcomes(List<AnalysisOutcome<F>> outcomes) {
        List<Set<F>> reachableFacts = outcomes.stream()
                .filter(AnalysisOutcome::continues)
                .map(AnalysisOutcome::facts)
                .toList();
        if (reachableFacts.isEmpty()) {
            Set<F> terminatedFacts = outcomes.isEmpty() ? Set.of() : outcomes.getFirst().facts();
            return AnalysisOutcome.terminating(terminatedFacts);
        }
        Set<F> merged = copy(reachableFacts.getFirst());
        for (int index = 1; index < reachableFacts.size(); index++) {
            merged = intersect(merged, reachableFacts.get(index));
        }
        return AnalysisOutcome.continuing(merged);
    }

    private static <F> Set<F> copy(Set<F> facts) {
        return new LinkedHashSet<>(facts);
    }

    private static <F> Set<F> intersect(Set<F> left, Set<F> right) {
        Set<F> intersection = copy(left);
        intersection.retainAll(right);
        return intersection;
    }

    public interface InvocationTransfer<F> {

        Set<F> afterInvocation(MethodInvocationTree invocationTree, Symbol.MethodSymbol symbol, Set<F> incomingFacts);

        default Iterable<? extends Tree> childExpressions(ExpressionTree expressionTree) {
            return List.of();
        }

        default boolean shouldInline(Symbol.MethodSymbol symbol) {
            return false;
        }
    }

    public record AnalysisOutcome<F>(Set<F> facts, boolean continues) {

        public AnalysisOutcome {
            facts = Set.copyOf(facts);
        }

        public static <F> AnalysisOutcome<F> continuing(Set<F> facts) {
            return new AnalysisOutcome<>(facts, true);
        }

        public static <F> AnalysisOutcome<F> terminating(Set<F> facts) {
            return new AnalysisOutcome<>(facts, false);
        }
    }
}
