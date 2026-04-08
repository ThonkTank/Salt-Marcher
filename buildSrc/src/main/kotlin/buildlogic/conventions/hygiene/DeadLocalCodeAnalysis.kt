package buildlogic.conventions.hygiene

import buildlogic.conventions.heuristic.owner.OwnerConventionParsedJavaSource
import buildlogic.conventions.heuristic.owner.parseOwnerConventionJavaSources
import com.sun.source.tree.AssignmentTree
import com.sun.source.tree.BlockTree
import com.sun.source.tree.ClassTree
import com.sun.source.tree.CompoundAssignmentTree
import com.sun.source.tree.ConditionalExpressionTree
import com.sun.source.tree.DoWhileLoopTree
import com.sun.source.tree.ExpressionTree
import com.sun.source.tree.ForLoopTree
import com.sun.source.tree.IdentifierTree
import com.sun.source.tree.IfTree
import com.sun.source.tree.LiteralTree
import com.sun.source.tree.MethodTree
import com.sun.source.tree.ParenthesizedTree
import com.sun.source.tree.Tree
import com.sun.source.tree.UnaryTree
import com.sun.source.tree.VariableTree
import com.sun.source.tree.WhileLoopTree
import com.sun.source.util.SourcePositions
import com.sun.source.util.TreePath
import com.sun.source.util.TreePathScanner
import com.sun.source.util.Trees
import java.util.ArrayDeque
import javax.lang.model.element.ElementKind
import javax.lang.model.element.Modifier
import javax.lang.model.element.VariableElement
import org.gradle.api.GradleException
import org.gradle.api.Project

private data class DeadLocalWrite(
    val line: Long,
    val description: String
)

private data class DeadLocalVariableState(
    val name: String,
    val declarationLine: Long,
    var everRead: Boolean = false,
    var pendingWrite: DeadLocalWrite? = null,
    var constantBoolean: Boolean? = null
)

internal fun Project.deadLocalCodeReasons(): List<String> {
    val touchedPaths = touchedJavaPaths()
    if (touchedPaths.isEmpty()) {
        return emptyList()
    }
    val projectRoot = layout.projectDirectory.asFile.toPath()
    val parsedSources = parseOwnerConventionJavaSources(
        projectRoot = projectRoot,
        files = mainJavaSourceFiles(),
        classpath = mainJavaCompileClasspath()
    )
    val trees = parsedSources.semanticModel.trees
    val sourcePositions = trees.sourcePositions
    return parsedSources.sourcesByPath.values
        .asSequence()
        .filter { parsedSource -> parsedSource.path in touchedPaths }
        .flatMap { parsedSource ->
            val offenders = mutableListOf<String>()
            DeadLocalCodeEntryScanner(
                parsedSource = parsedSource,
                trees = trees,
                sourcePositions = sourcePositions,
                offenders = offenders
            ).scan(parsedSource.compilationUnit, null)
            offenders.asSequence()
        }
        .sorted()
        .toList()
}

private class DeadLocalCodeEntryScanner(
    private val parsedSource: OwnerConventionParsedJavaSource,
    private val trees: Trees,
    private val sourcePositions: SourcePositions,
    private val offenders: MutableList<String>
) : TreePathScanner<Unit, Nothing?>() {

    override fun visitClass(node: ClassTree, p: Nothing?) {
        node.members.forEach { member ->
            when (member) {
                is ClassTree -> scan(member, null)
                is MethodTree -> {
                    val body = member.body ?: return@forEach
                    DeadLocalBlockScanner(parsedSource, trees, sourcePositions, offenders)
                        .scan(TreePath(currentPath, body), null)
                }
                is BlockTree -> DeadLocalBlockScanner(parsedSource, trees, sourcePositions, offenders)
                    .scan(TreePath(currentPath, member), null)
                else -> Unit
            }
        }
    }
}

private class DeadLocalBlockScanner(
    private val parsedSource: OwnerConventionParsedJavaSource,
    private val trees: Trees,
    private val sourcePositions: SourcePositions,
    private val offenders: MutableList<String>
) : TreePathScanner<Unit, Nothing?>() {
    private val scopes = ArrayDeque<MutableMap<VariableElement, DeadLocalVariableState>>()

    override fun visitBlock(node: BlockTree, p: Nothing?) {
        scopes.addLast(linkedMapOf())
        super.visitBlock(node, p)
        finishScope()
    }

    override fun visitVariable(node: VariableTree, p: Nothing?) {
        val variableElement = trees.getElement(currentPath) as? VariableElement
        if (variableElement != null && isTrackedLocal(variableElement)) {
            currentScope()[variableElement] = DeadLocalVariableState(
                name = variableElement.simpleName.toString(),
                declarationLine = lineOf(node),
                pendingWrite = node.initializer?.let {
                    DeadLocalWrite(
                        line = lineOf(it),
                        description = "assignment to local ${variableElement.simpleName}"
                    )
                },
                constantBoolean = booleanConstant(node.initializer, currentPath)
                    ?.takeIf { variableElement.modifiers.contains(Modifier.FINAL) }
            )
        }
        super.visitVariable(node, p)
    }

    override fun visitIf(node: IfTree, p: Nothing?) {
        booleanConstant(node.condition, TreePath(currentPath, node.condition))?.let { constant ->
            offenders += "${parsedSource.path}:${lineOf(node.condition)} :: dead ${if (constant) "else branch" else "then branch"} from constant if-condition"
        }
        super.visitIf(node, p)
    }

    override fun visitConditionalExpression(node: ConditionalExpressionTree, p: Nothing?) {
        booleanConstant(node.condition, TreePath(currentPath, node.condition))?.let { constant ->
            offenders += "${parsedSource.path}:${lineOf(node.condition)} :: dead ${if (constant) "false expression" else "true expression"} from constant conditional expression"
        }
        super.visitConditionalExpression(node, p)
    }

    override fun visitWhileLoop(node: WhileLoopTree, p: Nothing?) {
        booleanConstant(node.condition, TreePath(currentPath, node.condition))?.let { constant ->
            offenders += "${parsedSource.path}:${lineOf(node.condition)} :: ${if (constant) "constant true" else "dead while-body"} while-condition"
        }
        super.visitWhileLoop(node, p)
    }

    override fun visitDoWhileLoop(node: DoWhileLoopTree, p: Nothing?) {
        booleanConstant(node.condition, TreePath(currentPath, node.condition))?.let { constant ->
            offenders += "${parsedSource.path}:${lineOf(node.condition)} :: ${if (constant) "constant true" else "dead repeated branch"} do-while condition"
        }
        super.visitDoWhileLoop(node, p)
    }

    override fun visitForLoop(node: ForLoopTree, p: Nothing?) {
        node.condition?.let { condition ->
            booleanConstant(condition, TreePath(currentPath, condition))?.let { constant ->
                offenders += "${parsedSource.path}:${lineOf(condition)} :: ${if (constant) "constant true" else "dead for-body"} for-condition"
            }
        }
        super.visitForLoop(node, p)
    }

    override fun visitAssignment(node: AssignmentTree, p: Nothing?) {
        val variableElement = trees.getElement(TreePath(currentPath, node.variable)) as? VariableElement
        if (variableElement != null && isTrackedLocal(variableElement)) {
            scan(node.expression, p)
            registerWrite(variableElement, lineOf(node.expression))
            return
        }
        super.visitAssignment(node, p)
    }

    override fun visitCompoundAssignment(node: CompoundAssignmentTree, p: Nothing?) {
        val variableElement = trees.getElement(TreePath(currentPath, node.variable)) as? VariableElement
        if (variableElement != null && isTrackedLocal(variableElement)) {
            markRead(variableElement)
            scan(node.expression, p)
            registerWrite(variableElement, lineOf(node.expression))
            return
        }
        super.visitCompoundAssignment(node, p)
    }

    override fun visitUnary(node: UnaryTree, p: Nothing?) {
        if (node.kind in setOf(
                Tree.Kind.PREFIX_INCREMENT,
                Tree.Kind.PREFIX_DECREMENT,
                Tree.Kind.POSTFIX_INCREMENT,
                Tree.Kind.POSTFIX_DECREMENT
            )
        ) {
            val variableElement = trees.getElement(TreePath(currentPath, node.expression)) as? VariableElement
            if (variableElement != null && isTrackedLocal(variableElement)) {
                markRead(variableElement)
                registerWrite(variableElement, lineOf(node.expression))
                return
            }
        }
        super.visitUnary(node, p)
    }

    override fun visitIdentifier(node: IdentifierTree, p: Nothing?) {
        val variableElement = trees.getElement(currentPath) as? VariableElement
        if (variableElement != null && isTrackedLocal(variableElement) && !isWriteOnlyIdentifier(node)) {
            markRead(variableElement)
        }
        super.visitIdentifier(node, p)
    }

    private fun currentScope(): MutableMap<VariableElement, DeadLocalVariableState> {
        if (scopes.isEmpty()) {
            scopes.addLast(linkedMapOf())
        }
        return scopes.last()
    }

    private fun finishScope() {
        if (scopes.isEmpty()) {
            return
        }
        val scope = scopes.removeLast()
        scope.values.forEach { variable ->
            if (!variable.everRead) {
                offenders += "${parsedSource.path}:${variable.declarationLine} :: dead local ${variable.name}"
                return@forEach
            }
            variable.pendingWrite?.let { pendingWrite ->
                offenders += "${parsedSource.path}:${pendingWrite.line} :: dead ${pendingWrite.description}"
            }
        }
    }

    private fun registerWrite(variableElement: VariableElement, line: Long) {
        val state = lookup(variableElement) ?: return
        state.pendingWrite?.let { pendingWrite ->
            offenders += "${parsedSource.path}:${pendingWrite.line} :: dead ${pendingWrite.description}"
        }
        state.pendingWrite = DeadLocalWrite(line, "assignment to local ${state.name}")
    }

    private fun markRead(variableElement: VariableElement) {
        val state = lookup(variableElement) ?: return
        state.everRead = true
        state.pendingWrite = null
    }

    private fun lookup(variableElement: VariableElement): DeadLocalVariableState? {
        val iterator = scopes.descendingIterator()
        while (iterator.hasNext()) {
            val state = iterator.next()[variableElement]
            if (state != null) {
                return state
            }
        }
        return null
    }

    private fun isTrackedLocal(variableElement: VariableElement): Boolean {
        return variableElement.kind == ElementKind.LOCAL_VARIABLE || variableElement.kind == ElementKind.RESOURCE_VARIABLE
    }

    private fun isWriteOnlyIdentifier(node: IdentifierTree): Boolean {
        val parent = currentPath.parentPath?.leaf ?: return false
        return parent is AssignmentTree && parent.variable == node
    }

    private fun booleanConstant(expression: ExpressionTree?, path: TreePath): Boolean? {
        return when (expression) {
            null -> null
            is ParenthesizedTree -> booleanConstant(expression.expression, TreePath(path, expression.expression))
            is LiteralTree -> expression.value as? Boolean
            is UnaryTree -> if (expression.kind == Tree.Kind.LOGICAL_COMPLEMENT) {
                booleanConstant(expression.expression, TreePath(path, expression.expression))?.not()
            } else {
                null
            }
            is IdentifierTree -> {
                val variableElement = trees.getElement(path) as? VariableElement ?: return null
                lookup(variableElement)?.constantBoolean
            }
            else -> null
        }
    }

    private fun lineOf(tree: Tree): Long {
        val position = sourcePositions.getStartPosition(parsedSource.compilationUnit, tree)
        if (position == javax.tools.Diagnostic.NOPOS.toLong()) {
            throw GradleException("Missing source position for ${parsedSource.path}")
        }
        return parsedSource.compilationUnit.lineMap.getLineNumber(position)
    }
}
