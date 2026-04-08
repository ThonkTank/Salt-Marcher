package buildlogic.conventions.heuristic.owner

import com.sun.source.tree.BlockTree
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
    failureSummary = "Touched task files must remain static input-to-input pipelines that align with a real owner public request.",
    applicableRoles = setOf(support.taskRole)
) { sourceFile, snapshot ->
    analyzeTaskFile(sourceFile, snapshot, support).reasons
}

private data class TaskCallClassification(
    val allowed: Boolean,
    val description: String
)

internal fun analyzeTaskFile(
    sourceFile: OwnerConventionSourceFile,
    snapshot: OwnerConventionSnapshot,
    support: OwnerConventionSupport
): OwnerConventionAnalysis<OwnerConventionStaticApi> {
    val context = sourceFile.context
    val reasons = mutableListOf<String>()
    val className = context.className.removeSuffix(".java")
    val requestStem = support.requestStemForFile(context.className, "Task")
    if (requestStem == null) {
        reasons += "${context.path} :: task files must be named <Request>Task with a direct request stem"
    } else if (requestStem !in snapshot.requestStemsByOwner[context.ownerPackage].orEmpty()) {
        reasons += "${context.path} :: task files must match a real public request on ${context.ownerPackage}.${support.ownerObjectName(context.ownerPackage)}"
    }
    val primaryType = support.parsedPrimaryType(sourceFile)
    if (primaryType == null) {
        reasons += "${context.path} :: task files must declare a top-level type named $className"
        return OwnerConventionAnalysis(
            reasons = reasons,
            model = null
        )
    }
    if (sourceFile.parsedSource.topLevelTypes.size != 1) {
        reasons += "${context.path} :: task files must contain exactly one top-level type"
    }
    if (primaryType.kind != OwnerConventionParsedJavaTypeKind.CLASS || Modifier.FINAL !in primaryType.modifiers) {
        reasons += "${context.path} :: task files must declare a final class"
    }
    val constructors = primaryType.constructors
    if (constructors.none { Modifier.PRIVATE in it.modifiers } || constructors.any { Modifier.PUBLIC in it.modifiers }) {
        reasons += "${context.path} :: task files must hide construction behind a private constructor"
    }
    context.typeImports.importedPackages.forEach { importedPackage ->
        if (support.roleForDirectoryName(importedPackage.substringAfterLast('.')) != support.inputRole) {
            reasons += "${context.path} -> $importedPackage :: task files may import only input packages from project code"
        }
    }
    val publicStaticMethods = primaryType.methods.filter {
        Modifier.PUBLIC in it.modifiers && Modifier.STATIC in it.modifiers
    }
    val publicInstanceMethods = primaryType.methods.filter {
        Modifier.PUBLIC in it.modifiers && Modifier.STATIC !in it.modifiers
    }
    val instanceMethods = primaryType.methods.filter { Modifier.STATIC !in it.modifiers }
    if (publicStaticMethods.size != 1) {
        reasons += "${context.path} :: task files must expose exactly one public static method"
    }
    if (publicInstanceMethods.isNotEmpty()) {
        reasons += "${context.path} :: task files must not expose public instance methods"
    }
    if (instanceMethods.isNotEmpty()) {
        reasons += "${context.path} :: task files must stay static-only; all methods must be static"
    }
    publicStaticMethods.singleOrNull()?.let { method ->
        if (method.parameters.size != 1) {
            reasons += "${context.path} :: task files must model exactly one input parameter"
        }
        val parameterTypes = method.parameters.flatMap { parameter ->
            support.projectTypeNames(parameter.tree.type, sourceFile.parsedSource, snapshot)
        }.distinct()
        val returnTypes = support.projectTypeNames(method.tree.returnType, sourceFile.parsedSource, snapshot)
        if (parameterTypes.size != 1 || parameterTypes.any { typeName ->
                support.roleForDirectoryName(typeName.substringBeforeLast('.').substringAfterLast('.')) != support.inputRole
            }
        ) {
            reasons += "${context.path} :: task methods must accept exactly one project input type"
        }
        if (requestStem != null) {
            val expectedInputType = "${context.ownerPackage}.${support.inputRole}.${requestStem}Input"
            if (parameterTypes != listOf(expectedInputType)) {
                reasons += "${context.path} :: task methods must accept exactly ${requestStem}Input from the same owner"
            }
        }
        if (returnTypes.size != 1 || returnTypes.any { typeName ->
                support.roleForDirectoryName(typeName.substringBeforeLast('.').substringAfterLast('.')) != support.inputRole
            }
        ) {
            reasons += "${context.path} :: task methods must return exactly one project input type"
        }
    }
    primaryType.methods.forEach { method ->
        reasons += taskMethodBodyReasons(
            sourceFile = sourceFile,
            snapshot = snapshot,
            support = support,
            method = method
        )
    }
    val canonicalApi = if (reasons.isEmpty()) {
        OwnerConventionStaticApi(
            typeName = "${context.packageName}.${primaryType.name}",
            ownerPackage = context.ownerPackage,
            publicStaticMethodNames = setOf(publicStaticMethods.single().name)
        )
    } else {
        null
    }
    return OwnerConventionAnalysis(
        reasons = reasons.distinct(),
        model = canonicalApi
    )
}

private fun taskMethodBodyReasons(
    sourceFile: OwnerConventionSourceFile,
    snapshot: OwnerConventionSnapshot,
    support: OwnerConventionSupport,
    method: OwnerConventionParsedJavaMethod
): List<String> {
    val context = sourceFile.context
    val body = method.body ?: return listOf("${context.path} :: task methods must declare a body (${method.name})")
    return body.statements.flatMap { statement ->
        validateTaskStatement(
            statement = statement,
            sourceFile = sourceFile,
            snapshot = snapshot,
            support = support,
            method = method
        )
    }
}

private fun validateTaskStatement(
    statement: StatementTree,
    sourceFile: OwnerConventionSourceFile,
    snapshot: OwnerConventionSnapshot,
    support: OwnerConventionSupport,
    method: OwnerConventionParsedJavaMethod
): List<String> {
    val context = sourceFile.context
    return when (statement.kind) {
        Tree.Kind.VARIABLE -> {
            val variable = statement as VariableTree
            variable.initializer?.let { initializer ->
                validateTaskValueExpression(
                    expression = initializer,
                    sourceFile = sourceFile,
                    snapshot = snapshot,
                    support = support,
                    method = method
                )
            }.orEmpty()
        }

        Tree.Kind.RETURN -> {
            val returnTree = statement as ReturnTree
            returnTree.expression?.let { expression ->
                validateTaskValueExpression(
                    expression = expression,
                    sourceFile = sourceFile,
                    snapshot = snapshot,
                    support = support,
                    method = method
                )
            }.orEmpty()
        }

        Tree.Kind.BLOCK -> (statement as BlockTree).statements.flatMap { nested ->
            validateTaskStatement(
                statement = nested,
                sourceFile = sourceFile,
                snapshot = snapshot,
                support = support,
                method = method
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
    method: OwnerConventionParsedJavaMethod
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

        Tree.Kind.IDENTIFIER -> emptyList()

        Tree.Kind.MEMBER_SELECT ->
            if (isAllowedTaskPassThroughReference(expression)) {
                emptyList()
            } else {
                listOf("${context.path} :: task values must stay on direct input/local references (${method.name})")
            }

        Tree.Kind.PARENTHESIZED -> validateTaskValueExpression(
            expression = (expression as ParenthesizedTree).expression,
            sourceFile = sourceFile,
            snapshot = snapshot,
            support = support,
            method = method
        )

        Tree.Kind.TYPE_CAST -> validateTaskValueExpression(
            expression = (expression as TypeCastTree).expression,
            sourceFile = sourceFile,
            snapshot = snapshot,
            support = support,
            method = method
        )

        Tree.Kind.NEW_CLASS -> validateTaskNewClassExpression(
            expression = expression as NewClassTree,
            sourceFile = sourceFile,
            snapshot = snapshot,
            support = support,
            method = method
        )

        Tree.Kind.METHOD_INVOCATION -> {
            val invocation = expression as MethodInvocationTree
            val classification = classifyTaskInvocation(
                invocation = invocation,
                sourceFile = sourceFile,
                snapshot = snapshot,
                support = support,
                method = method
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
                        method = method
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
    method: OwnerConventionParsedJavaMethod
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
    if (targetOwnerPackage != context.ownerPackage && !support.sameOwnerEdgeOrNeighbor(context.ownerPackage, targetOwnerPackage)) {
        return listOf("${context.path} :: task methods may construct only same-owner or neighboring input types ($typeName)")
    }
    return expression.arguments.flatMap { argument ->
        validateTaskValueExpression(
            expression = argument,
            sourceFile = sourceFile,
            snapshot = snapshot,
            support = support,
            method = method
        )
    }
}

private fun classifyTaskInvocation(
    invocation: MethodInvocationTree,
    sourceFile: OwnerConventionSourceFile,
    snapshot: OwnerConventionSnapshot,
    support: OwnerConventionSupport,
    method: OwnerConventionParsedJavaMethod
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
    if (isAllowedTaskUtilityInvocation(invocation)) {
        return TaskCallClassification(
            allowed = true,
            description = "allowlisted pure helper"
        )
    }
    val receiverTypeName = support.resolveTypeName(methodSelect.expression, sourceFile.parsedSource, snapshot)
    if (receiverTypeName == null) {
        return if (isAllowedTaskInputAccessorInvocation(invocation, sourceFile, snapshot, support)) {
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

private fun isAllowedTaskPassThroughReference(expression: ExpressionTree): Boolean {
    return when (expression) {
        is IdentifierTree -> true
        is MemberSelectTree -> isAllowedTaskPassThroughReference(expression.expression)
        is ParenthesizedTree -> isAllowedTaskPassThroughReference(expression.expression)
        is TypeCastTree -> isAllowedTaskPassThroughReference(expression.expression)
        else -> false
    }
}

private fun isAllowedTaskInputAccessorInvocation(
    invocation: MethodInvocationTree,
    sourceFile: OwnerConventionSourceFile,
    snapshot: OwnerConventionSnapshot,
    support: OwnerConventionSupport
): Boolean {
    if (invocation.arguments.isNotEmpty()) {
        return false
    }
    val methodSelect = invocation.methodSelect as? MemberSelectTree ?: return false
    if (!isAllowedTaskPassThroughReference(methodSelect.expression)) {
        return false
    }
    val receiverTypeName = support.resolveProjectTypeName(methodSelect.expression, sourceFile.parsedSource, snapshot)
        ?: return false
    return support.isCanonicalInputAccessorInvocation(
        receiverTypeName = receiverTypeName,
        invocation = invocation,
        parsedSource = sourceFile.parsedSource,
        snapshot = snapshot
    )
}

private fun isAllowedTaskUtilityInvocation(invocation: MethodInvocationTree): Boolean {
    val methodSelect = invocation.methodSelect as? MemberSelectTree ?: return false
    val receiverText = methodSelect.expression.toString()
    return when (receiverText) {
        "Objects", "java.util.Objects" -> methodSelect.identifier.toString() in setOf("requireNonNull", "equals", "isNull", "nonNull")
        else -> false
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
