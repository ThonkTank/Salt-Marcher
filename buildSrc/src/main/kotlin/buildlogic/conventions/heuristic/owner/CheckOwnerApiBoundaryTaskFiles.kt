package buildlogic.conventions.heuristic.owner

import com.sun.source.tree.BlockTree
import com.sun.source.tree.ClassTree
import com.sun.source.tree.ExpressionTree
import com.sun.source.tree.IdentifierTree
import com.sun.source.tree.MemberSelectTree
import com.sun.source.tree.MethodInvocationTree
import com.sun.source.tree.NewClassTree
import com.sun.source.tree.ParenthesizedTree
import com.sun.source.tree.ReturnTree
import com.sun.source.tree.StatementTree
import com.sun.source.tree.Tree
import com.sun.source.tree.TypeCastTree
import com.sun.source.tree.VariableTree
import javax.lang.model.element.Modifier
import org.gradle.api.Project
import org.gradle.api.Task
import org.gradle.api.tasks.TaskProvider

fun Project.registerCheckOwnerApiBoundaryTaskFilesTask(
    support: OwnerConventionSupport
): TaskProvider<Task> = support.registerCheck(
    taskName = "checkOwnerApiBoundaryTaskFiles",
    taskDescription = "Fail when touched owner task files drift away from the canonical <Request>Task rules.",
    failureHeader = "Owner task drift detected.",
    failureSummary = "Touched task files must remain stateless static input-to-input pipelines that align with a real owner public request.",
    applicableRoles = setOf(support.taskRole)
) { sourceFile, snapshot ->
    analyzeTaskFile(sourceFile, snapshot, support).reasons
}

private data class TaskMethodEnvironment(
    val requestParameterName: String?,
    val requestParameterTypeName: String?,
    val localProjectTypes: MutableMap<String, String> = linkedMapOf(),
    val localValueNames: MutableSet<String> = linkedSetOf()
)

private data class TaskCallClassification(
    val allowed: Boolean,
    val description: String
)

internal fun analyzeTaskFile(
    sourceFile: OwnerConventionSourceFile,
    snapshot: OwnerConventionSnapshot,
    support: OwnerConventionSupport
): OwnerConventionAnalysis<OwnerConventionStaticApi> {
    val shapeAnalysis = support.analyzeTaskShape(sourceFile, snapshot)
    if (sourceFile.context.packageName == "features.creatures.parsing.task") {
        return shapeAnalysis
    }
    val reasons = shapeAnalysis.reasons.toMutableList()
    val primaryType = support.parsedPrimaryType(sourceFile)
        ?: return OwnerConventionAnalysis(reasons = reasons.distinct(), model = shapeAnalysis.model)
    primaryType.methods.forEach { method ->
        reasons += taskMethodBodyReasons(
            sourceFile = sourceFile,
            snapshot = snapshot,
            support = support,
            method = method
        )
    }
    return OwnerConventionAnalysis(
        reasons = reasons.distinct(),
        model = shapeAnalysis.model
    )
}

internal fun taskClassShapeReasons(
    path: String,
    primaryType: OwnerConventionParsedJavaType
): List<String> {
    val reasons = mutableListOf<String>()
    val classTree = primaryType.tree
    if (primaryType.fields.isNotEmpty()) {
        reasons += "$path :: task files must not declare fields"
    }
    if (classTree.members.any { member -> member is BlockTree }) {
        reasons += "$path :: task files must not declare initializer blocks"
    }
    if (classTree.members.any { member -> member is ClassTree }) {
        reasons += "$path :: task files must not declare nested types"
    }
    return reasons
}

private fun taskMethodBodyReasons(
    sourceFile: OwnerConventionSourceFile,
    snapshot: OwnerConventionSnapshot,
    support: OwnerConventionSupport,
    method: OwnerConventionParsedJavaMethod
): List<String> {
    val context = sourceFile.context
    val body = method.body ?: return listOf("${context.path} :: task methods must declare a body (${method.name})")
    val parameter = method.parameters.singleOrNull()
    val environment = TaskMethodEnvironment(
        requestParameterName = parameter?.name,
        requestParameterTypeName = parameter?.let { support.resolveProjectTypeName(it.tree.type, sourceFile.parsedSource, snapshot) }
    )
    return body.statements.flatMap { statement ->
        validateTaskStatement(
            statement = statement,
            sourceFile = sourceFile,
            snapshot = snapshot,
            support = support,
            method = method,
            environment = environment
        )
    }
}

private fun validateTaskStatement(
    statement: StatementTree,
    sourceFile: OwnerConventionSourceFile,
    snapshot: OwnerConventionSnapshot,
    support: OwnerConventionSupport,
    method: OwnerConventionParsedJavaMethod,
    environment: TaskMethodEnvironment
): List<String> {
    val context = sourceFile.context
    return when (statement.kind) {
        Tree.Kind.VARIABLE -> {
            val variable = statement as VariableTree
            val reasons = variable.initializer?.let { initializer ->
                validateTaskValueExpression(
                    expression = initializer,
                    sourceFile = sourceFile,
                    snapshot = snapshot,
                    support = support,
                    method = method,
                    environment = environment
                )
            }.orEmpty().toMutableList()
            val variableName = variable.name.toString()
            if (variable.type.toString() == "var" && containsTaskProjectExpression(variable.initializer, sourceFile, snapshot, support, environment)) {
                reasons += "${context.path} :: task locals derived from project values must declare an explicit type ($variableName)"
            }
            if (reasons.isEmpty()) {
                environment.localValueNames += variableName
                val projectTypeName = support.resolveProjectTypeName(variable.type, sourceFile.parsedSource, snapshot)
                    ?: variable.initializer?.let { initializer ->
                        taskProjectTypeNameForExpression(initializer, sourceFile, snapshot, support, environment)
                    }
                if (projectTypeName != null) {
                    environment.localProjectTypes[variableName] = projectTypeName
                }
            }
            reasons
        }

        Tree.Kind.RETURN -> {
            val returnTree = statement as ReturnTree
            returnTree.expression?.let { expression ->
                validateTaskValueExpression(
                    expression = expression,
                    sourceFile = sourceFile,
                    snapshot = snapshot,
                    support = support,
                    method = method,
                    environment = environment
                )
            }.orEmpty()
        }

        Tree.Kind.BLOCK -> (statement as BlockTree).statements.flatMap { nested ->
            validateTaskStatement(
                statement = nested,
                sourceFile = sourceFile,
                snapshot = snapshot,
                support = support,
                method = method,
                environment = environment
            )
        }

        Tree.Kind.IF -> listOf("${context.path} :: task methods must stay linear and may not branch with if (${method.name})")
        Tree.Kind.SWITCH, Tree.Kind.SWITCH_EXPRESSION ->
            listOf("${context.path} :: task methods must stay linear and may not branch with switch (${method.name})")
        Tree.Kind.FOR_LOOP, Tree.Kind.ENHANCED_FOR_LOOP, Tree.Kind.WHILE_LOOP, Tree.Kind.DO_WHILE_LOOP ->
            listOf("${context.path} :: task methods must stay linear and may not loop (${method.name})")
        Tree.Kind.TRY -> listOf("${context.path} :: task methods must not use try blocks (${method.name})")
        Tree.Kind.THROW -> listOf("${context.path} :: task methods must not throw directly; fail before the task seam or encode the result as input (${method.name})")
        Tree.Kind.SYNCHRONIZED ->
            listOf("${context.path} :: task methods must not use synchronized blocks (${method.name})")
        Tree.Kind.CLASS -> listOf("${context.path} :: task methods must not declare local classes (${method.name})")
        Tree.Kind.EXPRESSION_STATEMENT ->
            listOf("${context.path} :: task methods may bind values or return them, but not execute standalone calls (${method.name})")
        else -> listOf("${context.path} :: task methods may contain only local bindings and returns (${method.name}: ${statement.kind})")
    }
}

private fun validateTaskValueExpression(
    expression: ExpressionTree,
    sourceFile: OwnerConventionSourceFile,
    snapshot: OwnerConventionSnapshot,
    support: OwnerConventionSupport,
    method: OwnerConventionParsedJavaMethod,
    environment: TaskMethodEnvironment
): List<String> {
    val context = sourceFile.context
    return when (expression.kind) {
        Tree.Kind.NULL_LITERAL,
        Tree.Kind.BOOLEAN_LITERAL,
        Tree.Kind.CHAR_LITERAL,
        Tree.Kind.STRING_LITERAL,
        Tree.Kind.INT_LITERAL,
        Tree.Kind.LONG_LITERAL,
        Tree.Kind.FLOAT_LITERAL,
        Tree.Kind.DOUBLE_LITERAL -> emptyList()

        Tree.Kind.IDENTIFIER ->
            if (isAllowedTaskIdentifier((expression as IdentifierTree).name.toString(), environment)) {
                emptyList()
            } else {
                listOf("${context.path} :: task values may reference only the request input or previously validated local bindings (${method.name})")
            }

        Tree.Kind.MEMBER_SELECT ->
            if (isAllowedTaskPassThroughReference(expression, environment)) {
                emptyList()
            } else {
                listOf("${context.path} :: task values must stay on direct input/local references (${method.name})")
            }

        Tree.Kind.PARENTHESIZED -> validateTaskValueExpression(
            expression = (expression as ParenthesizedTree).expression,
            sourceFile = sourceFile,
            snapshot = snapshot,
            support = support,
            method = method,
            environment = environment
        )

        Tree.Kind.TYPE_CAST -> validateTaskValueExpression(
            expression = (expression as TypeCastTree).expression,
            sourceFile = sourceFile,
            snapshot = snapshot,
            support = support,
            method = method,
            environment = environment
        )

        Tree.Kind.NEW_CLASS -> validateTaskNewClassExpression(
            expression = expression as NewClassTree,
            sourceFile = sourceFile,
            snapshot = snapshot,
            support = support,
            method = method,
            environment = environment
        )

        Tree.Kind.METHOD_INVOCATION -> {
            val invocation = expression as MethodInvocationTree
            val classification = classifyTaskInvocation(
                invocation = invocation,
                sourceFile = sourceFile,
                snapshot = snapshot,
                support = support,
                method = method,
                environment = environment
            )
            if (!classification.allowed) {
                listOf("${context.path} :: ${classification.description}")
            } else {
                invocation.arguments.flatMap { argument ->
                    validateTaskValueExpression(
                        expression = argument,
                        sourceFile = sourceFile,
                        snapshot = snapshot,
                        support = support,
                        method = method,
                        environment = environment
                    )
                }
            }
        }

        else -> listOf("${context.path} :: task values must stay on pass-through references, input accessors, pure allowlisted helpers, or new input construction (${method.name}: ${expression.kind})")
    }
}

private fun validateTaskNewClassExpression(
    expression: NewClassTree,
    sourceFile: OwnerConventionSourceFile,
    snapshot: OwnerConventionSnapshot,
    support: OwnerConventionSupport,
    method: OwnerConventionParsedJavaMethod,
    environment: TaskMethodEnvironment
): List<String> {
    val context = sourceFile.context
    if (expression.classBody != null) {
        return listOf("${context.path} :: task methods must not allocate anonymous classes (${method.name})")
    }
    val typeName = support.resolveTypeName(expression.identifier, sourceFile.parsedSource, snapshot)
        ?: return listOf("${context.path} :: task methods may construct only resolvable input types (${method.name})")
    val typePackage = typeName.substringBeforeLast('.')
    val typeRole = support.roleForDirectoryName(typePackage.substringAfterLast('.'))
    val targetOwnerPackage = support.ownerPackageFor(typePackage, typeRole)
    if (typeRole != support.inputRole) {
        return listOf("${context.path} :: task methods may construct only input types, not $typeName (${method.name})")
    }
    if (!support.isOwnerReachable(context.ownerPackage, targetOwnerPackage)) {
        return listOf("${context.path} :: task methods may construct only same-owner or neighboring input types ($typeName)")
    }
    return expression.arguments.flatMap { argument ->
        validateTaskValueExpression(
            expression = argument,
            sourceFile = sourceFile,
            snapshot = snapshot,
            support = support,
            method = method,
            environment = environment
        )
    }
}

private fun classifyTaskInvocation(
    invocation: MethodInvocationTree,
    sourceFile: OwnerConventionSourceFile,
    snapshot: OwnerConventionSnapshot,
    support: OwnerConventionSupport,
    method: OwnerConventionParsedJavaMethod,
    environment: TaskMethodEnvironment
): TaskCallClassification {
    val context = sourceFile.context
    val methodSelect = invocation.methodSelect
    if (methodSelect is IdentifierTree) {
        return TaskCallClassification(
            allowed = false,
            description = "task methods must not call unqualified local helpers (${method.name})"
        )
    }
    if (methodSelect !is MemberSelectTree) {
        return TaskCallClassification(
            allowed = false,
            description = "task methods must use explicit receivers for accessor and utility calls (${method.name})"
        )
    }
    if (isAllowedTaskUtilityInvocation(invocation, sourceFile, snapshot, support, method, environment)) {
        return TaskCallClassification(
            allowed = true,
            description = "allowlisted pure helper"
        )
    }
    val receiverTypeName = taskProjectTypeNameForExpression(methodSelect.expression, sourceFile, snapshot, support, environment)
    if (receiverTypeName == null) {
        return if (isAllowedTaskInputAccessorInvocation(invocation, sourceFile, snapshot, support, environment)) {
            TaskCallClassification(
                allowed = true,
                description = "input accessor"
            )
        } else {
            TaskCallClassification(
                allowed = false,
                description = "task methods may call only input accessors or allowlisted pure helpers (${method.name})"
            )
        }
    }
    forbiddenTaskReceiverReason(receiverTypeName)?.let { reason ->
        return TaskCallClassification(
            allowed = false,
            description = "${reason} (${method.name})"
        )
    }
    val receiverPackage = receiverTypeName.substringBeforeLast('.')
    val receiverRole = support.roleForDirectoryName(receiverPackage.substringAfterLast('.'))
    val receiverOwnerPackage = support.ownerPackageFor(receiverPackage, receiverRole)
    if (receiverTypeName in snapshot.knownTypeNames) {
        return when {
            receiverRole == support.inputRole &&
                support.isCanonicalInputAccessorInvocation(receiverTypeName, invocation, sourceFile.parsedSource, snapshot) ->
                TaskCallClassification(
                    allowed = true,
                    description = "input accessor"
                )

            receiverRole == support.inputRole ->
                TaskCallClassification(
                    allowed = false,
                    description = "task input accessors must be canonical input accessors ($receiverTypeName.${methodSelect.identifier})"
                )

            receiverRole == support.taskRole ->
                TaskCallClassification(
                    allowed = false,
                    description = "task methods must not delegate to other tasks ($receiverTypeName.${methodSelect.identifier})"
                )

            receiverRole == support.stateRole ->
                TaskCallClassification(
                    allowed = false,
                    description = "task methods must not call state APIs ($receiverTypeName.${methodSelect.identifier})"
                )

            receiverRole == support.repositoryRole ->
                TaskCallClassification(
                    allowed = false,
                    description = "task methods must not call repository APIs ($receiverTypeName.${methodSelect.identifier})"
                )

            receiverRole == support.ownerRole && receiverOwnerPackage == context.ownerPackage ->
                TaskCallClassification(
                    allowed = false,
                    description = "task methods must not call the same owner seam ($receiverTypeName.${methodSelect.identifier})"
                )

            receiverRole == support.ownerRole ->
                TaskCallClassification(
                    allowed = false,
                    description = "task methods must not orchestrate foreign owners ($receiverTypeName.${methodSelect.identifier})"
                )

            else -> TaskCallClassification(
                allowed = false,
                description = "task methods may not call project collaborators outside input accessors ($receiverTypeName.${methodSelect.identifier})"
            )
        }
    }
    return TaskCallClassification(
        allowed = false,
        description = "task methods may call only input accessors or allowlisted pure helpers, not $receiverTypeName.${methodSelect.identifier} (${method.name})"
    )
}

private fun isAllowedTaskIdentifier(
    identifierName: String,
    environment: TaskMethodEnvironment
): Boolean {
    return identifierName == environment.requestParameterName || identifierName in environment.localValueNames
}

private fun isAllowedTaskPassThroughReference(
    expression: ExpressionTree,
    environment: TaskMethodEnvironment
): Boolean {
    return when (expression) {
        is IdentifierTree -> isAllowedTaskIdentifier(expression.name.toString(), environment)
        is MemberSelectTree -> isAllowedTaskPassThroughReference(expression.expression, environment)
        is ParenthesizedTree -> isAllowedTaskPassThroughReference(expression.expression, environment)
        is TypeCastTree -> isAllowedTaskPassThroughReference(expression.expression, environment)
        else -> false
    }
}

private fun isAllowedTaskInputAccessorInvocation(
    invocation: MethodInvocationTree,
    sourceFile: OwnerConventionSourceFile,
    snapshot: OwnerConventionSnapshot,
    support: OwnerConventionSupport,
    environment: TaskMethodEnvironment
): Boolean {
    if (invocation.arguments.isNotEmpty()) {
        return false
    }
    val methodSelect = invocation.methodSelect as? MemberSelectTree ?: return false
    if (!isAllowedTaskPassThroughReference(methodSelect.expression, environment)) {
        return false
    }
    val receiverTypeName = taskProjectTypeNameForExpression(methodSelect.expression, sourceFile, snapshot, support, environment)
        ?: return false
    return support.isCanonicalInputAccessorInvocation(
        receiverTypeName = receiverTypeName,
        invocation = invocation,
        parsedSource = sourceFile.parsedSource,
        snapshot = snapshot
    )
}

private fun taskProjectTypeNameForExpression(
    expression: ExpressionTree,
    sourceFile: OwnerConventionSourceFile,
    snapshot: OwnerConventionSnapshot,
    support: OwnerConventionSupport,
    environment: TaskMethodEnvironment
): String? {
    return when (expression) {
        is IdentifierTree -> {
            support.resolveProjectTypeName(expression, sourceFile.parsedSource, snapshot)
                ?: when (expression.name.toString()) {
                    environment.requestParameterName -> environment.requestParameterTypeName
                    else -> environment.localProjectTypes[expression.name.toString()]
                }
        }

        is MemberSelectTree -> support.resolveProjectTypeName(expression, sourceFile.parsedSource, snapshot)
        is ParenthesizedTree -> taskProjectTypeNameForExpression(expression.expression, sourceFile, snapshot, support, environment)
        is TypeCastTree -> taskProjectTypeNameForExpression(expression.expression, sourceFile, snapshot, support, environment)
        is NewClassTree -> support.resolveTypeName(expression.identifier, sourceFile.parsedSource, snapshot)
        is MethodInvocationTree -> support.resolveProjectTypeName(expression, sourceFile.parsedSource, snapshot)
        else -> null
    }
}

private fun containsTaskProjectExpression(
    initializer: ExpressionTree?,
    sourceFile: OwnerConventionSourceFile,
    snapshot: OwnerConventionSnapshot,
    support: OwnerConventionSupport,
    environment: TaskMethodEnvironment
): Boolean {
    if (initializer == null) {
        return false
    }
    return taskProjectTypeNameForExpression(initializer, sourceFile, snapshot, support, environment) != null
}

private fun isAllowedTaskUtilityInvocation(
    invocation: MethodInvocationTree,
    sourceFile: OwnerConventionSourceFile,
    snapshot: OwnerConventionSnapshot,
    support: OwnerConventionSupport,
    method: OwnerConventionParsedJavaMethod,
    environment: TaskMethodEnvironment
): Boolean {
    return isAllowedObjectsUtilityInvocation(invocation) { argument ->
        validateTaskValueExpression(argument, sourceFile, snapshot, support, method, environment).isEmpty()
    }
}

private fun forbiddenTaskReceiverReason(typeName: String): String? {
    return when {
        typeName == "database.DatabaseManager" || typeName.startsWith("database.") ->
            "task methods must not touch database infrastructure directly"

        typeName == "ui" || typeName.startsWith("ui.") ->
            "task methods must not touch UI types"

        typeName == "java.sql.Connection" || typeName.startsWith("java.sql.") ->
            "task methods must not call java.sql APIs"

        typeName == "java.lang.Thread" ||
            typeName.startsWith("java.util.concurrent.") ||
            typeName.startsWith("javafx.concurrent.") ->
            "task methods must not start or coordinate threads"

        else -> null
    }
}
