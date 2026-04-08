package buildlogic.conventions.heuristic.owner

import com.sun.source.tree.BinaryTree
import com.sun.source.tree.BlockTree
import com.sun.source.tree.ConditionalExpressionTree
import com.sun.source.tree.ExpressionStatementTree
import com.sun.source.tree.ExpressionTree
import com.sun.source.tree.IdentifierTree
import com.sun.source.tree.IfTree
import com.sun.source.tree.LiteralTree
import com.sun.source.tree.MemberSelectTree
import com.sun.source.tree.MethodInvocationTree
import com.sun.source.tree.NewClassTree
import com.sun.source.tree.ParenthesizedTree
import com.sun.source.tree.ReturnTree
import com.sun.source.tree.StatementTree
import com.sun.source.tree.ThrowTree
import com.sun.source.tree.Tree
import com.sun.source.tree.TypeCastTree
import com.sun.source.tree.UnaryTree
import com.sun.source.tree.VariableTree
import javax.lang.model.element.Modifier
import org.gradle.api.Project
import org.gradle.api.Task
import org.gradle.api.tasks.TaskProvider

fun Project.registerCheckOwnerApiBoundaryOwnerFilesTask(
    support: OwnerConventionSupport
): TaskProvider<Task> = support.registerCheck(
    taskName = "checkOwnerApiBoundaryOwnerFiles",
    taskDescription = "Fail when touched owner entrypoint files drift away from the canonical *Object seam rules.",
    failureHeader = "Owner entrypoint drift detected.",
    failureSummary = "Touched owner files must remain single-file public *Object seams that expose only canonical owner request orchestration.",
    applicableRoles = setOf(support.ownerRole)
) { sourceFile, snapshot ->
    analyzeOwnerFile(sourceFile, snapshot, support).reasons
}

private data class OwnerMethodEnvironment(
    val requestParameterName: String,
    val requestParameterTypeName: String,
    val localProjectTypes: MutableMap<String, String> = linkedMapOf()
)

private data class OwnerCallClassification(
    val allowed: Boolean,
    val description: String
)

internal fun analyzeOwnerFile(
    sourceFile: OwnerConventionSourceFile,
    snapshot: OwnerConventionSnapshot,
    support: OwnerConventionSupport
): OwnerConventionAnalysis<OwnerConventionCanonicalOwnerCaller> {
    val context = sourceFile.context
    val shapeAnalysis = support.analyzeOwnerSurfaceShape(sourceFile, snapshot)
    val reasons = shapeAnalysis.reasons.toMutableList()
    val primaryType = support.parsedPrimaryType(sourceFile)
        ?: return OwnerConventionAnalysis(reasons = reasons.distinct(), model = shapeAnalysis.model?.let {
            OwnerConventionCanonicalOwnerCaller(it.typeName, it.ownerPackage, it.requestMethodNames)
        })
    val publicMethods = primaryType.methods.filter { Modifier.PUBLIC in it.modifiers }
    val fieldProjectTypes = primaryType.fields.mapNotNull { field ->
        val resolvedType = support.resolveProjectTypeName(field.tree.type, sourceFile.parsedSource, snapshot)
            ?: return@mapNotNull null
        field.name to resolvedType
    }.toMap()
    publicMethods
        .filter { ownerRequestShapeReasons(sourceFile, it, snapshot, support).isEmpty() }
        .forEach { method ->
            reasons += ownerRequestBodyReasons(
                sourceFile = sourceFile,
                snapshot = snapshot,
                support = support,
                primaryType = primaryType,
                method = method,
                fieldProjectTypes = fieldProjectTypes
            )
        }
    val canonicalOwnerCaller = shapeAnalysis.model?.let { ownerSurface ->
        OwnerConventionCanonicalOwnerCaller(
            typeName = ownerSurface.typeName,
            ownerPackage = ownerSurface.ownerPackage,
            requestMethodNames = ownerSurface.requestMethodNames
        )
    }
    return OwnerConventionAnalysis(
        reasons = reasons.distinct(),
        model = canonicalOwnerCaller
    )
}

internal fun ownerRequestShapeReasons(
    sourceFile: OwnerConventionSourceFile,
    method: OwnerConventionParsedJavaMethod,
    snapshot: OwnerConventionSnapshot,
    support: OwnerConventionSupport
): List<String> {
    val context = sourceFile.context
    val reasons = mutableListOf<String>()
    val requestStem = support.requestStemForMethod(method.name)
    if (Modifier.STATIC in method.modifiers) {
        reasons += "${context.path} :: owner requests must not be static (${method.name})"
    }
    if (requestStem == null) {
        reasons += "${context.path} :: owner public methods must be canonical request methods with lowerCamelCase names (${method.name})"
        return reasons
    }
    if (method.parameters.size != 1) {
        reasons += "${context.path} :: owner requests must accept exactly one ${requestStem}Input parameter (${method.name})"
    }
    val expectedInputType = "${context.ownerPackage}.${support.inputRole}.${requestStem}Input"
    val parameterType = method.parameters.singleOrNull()?.let { parameter ->
        support.declaredInputTypeName(parameter.tree.type, sourceFile.parsedSource, snapshot)
    }
    if (parameterType != expectedInputType) {
        reasons += "${context.path} :: owner requests must accept exactly ${expectedInputType.substringAfterLast('.')} (${method.name})"
    }
    if (!support.isCanonicalOwnerRequestReturnType(method.tree.returnType, sourceFile.parsedSource, snapshot)) {
        reasons += "${context.path} :: owner public methods may expose only input types from project code (${method.name})"
    }
    return reasons
}

internal fun validateOwnerDependencyTypes(
    context: OwnerConventionSourceContext,
    snapshot: OwnerConventionSnapshot,
    support: OwnerConventionSupport,
    sourceTypeName: String,
    projectTypeNames: Set<String>,
    reasonPrefix: String
): List<String> {
    return projectTypeNames.mapNotNull { typeName ->
        val typePackage = typeName.substringBeforeLast('.')
        val typeRole = support.roleForDirectoryName(typePackage.substringAfterLast('.'))
        val targetOwnerPackage = support.ownerPackageFor(typePackage, typeRole)
        when {
            targetOwnerPackage == context.ownerPackage ->
                if (typeRole !in setOf(support.inputRole, support.taskRole, support.stateRole, support.repositoryRole)) {
                    "$reasonPrefix may reference only own input/task/state/repository project types ($typeName)"
                } else {
                    null
                }

            !support.isOwnerReachable(context.ownerPackage, targetOwnerPackage) ->
                "$reasonPrefix may cross only one owner edge ($typeName from $sourceTypeName)"

            typeRole == support.ownerRole && typeName == support.ownerSurfaceTypeName(targetOwnerPackage, snapshot) ->
                null

            typeRole == support.inputRole ->
                null

            else ->
                "$reasonPrefix may reference only foreign owner entrypoints and foreign input types ($typeName)"
        }
    }
}

private fun ownerRequestBodyReasons(
    sourceFile: OwnerConventionSourceFile,
    snapshot: OwnerConventionSnapshot,
    support: OwnerConventionSupport,
    primaryType: OwnerConventionParsedJavaType,
    method: OwnerConventionParsedJavaMethod,
    fieldProjectTypes: Map<String, String>
): List<String> {
    val context = sourceFile.context
    val requestStem = support.requestStemForMethod(method.name) ?: return emptyList()
    val body = method.body ?: return listOf("${context.path} :: owner request bodies must be present (${method.name})")
    val parameter = method.parameters.singleOrNull()
        ?: return listOf("${context.path} :: owner requests must model exactly one request parameter (${method.name})")
    val requestParameterTypeName = support.resolveProjectTypeName(parameter.tree.type, sourceFile.parsedSource, snapshot)
        ?: return listOf("${context.path} :: owner requests must use a resolvable project input type (${method.name})")
    val environment = OwnerMethodEnvironment(
        requestParameterName = parameter.name,
        requestParameterTypeName = requestParameterTypeName
    )
    val reasons = mutableListOf<String>()
    body.statements.forEach { statement ->
        reasons += validateOwnerStatement(
            statement = statement,
            sourceFile = sourceFile,
            snapshot = snapshot,
            support = support,
            primaryType = primaryType,
            fieldProjectTypes = fieldProjectTypes,
            environment = environment,
            requestStem = requestStem
        )
    }
    return reasons
}

private fun validateOwnerStatement(
    statement: StatementTree,
    sourceFile: OwnerConventionSourceFile,
    snapshot: OwnerConventionSnapshot,
    support: OwnerConventionSupport,
    primaryType: OwnerConventionParsedJavaType,
    fieldProjectTypes: Map<String, String>,
    environment: OwnerMethodEnvironment,
    requestStem: String
): List<String> {
    val context = sourceFile.context
    return when (statement.kind) {
        Tree.Kind.VARIABLE -> {
            val variable = statement as VariableTree
            val reasons = mutableListOf<String>()
            variable.initializer?.let { initializer ->
                reasons += validateOwnerValueExpression(
                    expression = initializer,
                    sourceFile = sourceFile,
                    snapshot = snapshot,
                    support = support,
                    primaryType = primaryType,
                    fieldProjectTypes = fieldProjectTypes,
                    environment = environment,
                    requestStem = requestStem
                )
            }
            val declaredTypeName = support.resolveProjectTypeName(variable.type, sourceFile.parsedSource, snapshot)
            if (variable.type.toString() == "var" && containsProjectExpression(initializer = variable.initializer, sourceFile = sourceFile, snapshot = snapshot, support = support, environment = environment)) {
                reasons += "${context.path} :: owner locals derived from project calls or inputs must declare an explicit type (${variable.name})"
            }
            if (declaredTypeName != null) {
                environment.localProjectTypes[variable.name.toString()] = declaredTypeName
            }
            reasons
        }

        Tree.Kind.EXPRESSION_STATEMENT -> {
            val expressionStatement = statement as ExpressionStatementTree
            validateOwnerCallExpressionStatement(
                expression = expressionStatement.expression,
                sourceFile = sourceFile,
                snapshot = snapshot,
                support = support,
                primaryType = primaryType,
                fieldProjectTypes = fieldProjectTypes,
                environment = environment,
                requestStem = requestStem
            )
        }

        Tree.Kind.RETURN -> {
            val returnTree = statement as ReturnTree
            if (returnTree.expression == null) {
                emptyList()
            } else {
                validateOwnerValueExpression(
                    expression = returnTree.expression,
                    sourceFile = sourceFile,
                    snapshot = snapshot,
                    support = support,
                    primaryType = primaryType,
                    fieldProjectTypes = fieldProjectTypes,
                    environment = environment,
                    requestStem = requestStem
                )
            }
        }

        Tree.Kind.IF -> validateOwnerIfStatement(
            statement = statement as IfTree,
            sourceFile = sourceFile,
            snapshot = snapshot,
            support = support,
            primaryType = primaryType,
            fieldProjectTypes = fieldProjectTypes,
            environment = environment,
            requestStem = requestStem
        )

        Tree.Kind.THROW -> validateOwnerThrowStatement(
            statement = statement as ThrowTree,
            sourceFile = sourceFile,
            snapshot = snapshot,
            support = support,
            primaryType = primaryType,
            fieldProjectTypes = fieldProjectTypes,
            environment = environment,
            requestStem = requestStem
        )

        Tree.Kind.BLOCK -> (statement as BlockTree).statements.flatMap { nested ->
            validateOwnerStatement(
                statement = nested,
                sourceFile = sourceFile,
                snapshot = snapshot,
                support = support,
                primaryType = primaryType,
                fieldProjectTypes = fieldProjectTypes,
                environment = environment,
                requestStem = requestStem
            )
        }

        else -> listOf("${context.path} :: owner request bodies may contain only guard clauses, local bindings, orchestration calls, returns, and throws (${statement.kind})")
    }
}

private fun validateOwnerIfStatement(
    statement: IfTree,
    sourceFile: OwnerConventionSourceFile,
    snapshot: OwnerConventionSnapshot,
    support: OwnerConventionSupport,
    primaryType: OwnerConventionParsedJavaType,
    fieldProjectTypes: Map<String, String>,
    environment: OwnerMethodEnvironment,
    requestStem: String
): List<String> {
    val context = sourceFile.context
    val reasons = mutableListOf<String>()
    if (!isAllowedOwnerGuardCondition(statement.condition, sourceFile, snapshot, support, environment)) {
        reasons += "${context.path} :: owner guard conditions must stay on direct pass-through values"
    }
    reasons += validateGuardBranch(
        statement.thenStatement,
        sourceFile,
        snapshot,
        support,
        primaryType,
        fieldProjectTypes,
        environment,
        requestStem
    )
    statement.elseStatement?.let { elseStatement ->
        reasons += validateGuardBranch(
            elseStatement,
            sourceFile,
            snapshot,
            support,
            primaryType,
            fieldProjectTypes,
            environment,
            requestStem
        )
    }
    return reasons
}

private fun validateGuardBranch(
    statement: StatementTree,
    sourceFile: OwnerConventionSourceFile,
    snapshot: OwnerConventionSnapshot,
    support: OwnerConventionSupport,
    primaryType: OwnerConventionParsedJavaType,
    fieldProjectTypes: Map<String, String>,
    environment: OwnerMethodEnvironment,
    requestStem: String
): List<String> {
    return when (statement.kind) {
        Tree.Kind.BLOCK -> (statement as BlockTree).statements.flatMap { nested ->
            validateGuardBranch(
                nested,
                sourceFile,
                snapshot,
                support,
                primaryType,
                fieldProjectTypes,
                environment,
                requestStem
            )
        }

        Tree.Kind.RETURN,
        Tree.Kind.THROW -> validateOwnerStatement(
            statement,
            sourceFile,
            snapshot,
            support,
            primaryType,
            fieldProjectTypes,
            environment,
            requestStem
        )

        else -> listOf("${sourceFile.context.path} :: owner conditionals may only guard with return or throw branches")
    }
}

private fun validateOwnerThrowStatement(
    statement: ThrowTree,
    sourceFile: OwnerConventionSourceFile,
    snapshot: OwnerConventionSnapshot,
    support: OwnerConventionSupport,
    primaryType: OwnerConventionParsedJavaType,
    fieldProjectTypes: Map<String, String>,
    environment: OwnerMethodEnvironment,
    requestStem: String
): List<String> {
    return validateOwnerValueExpression(
        expression = statement.expression,
        sourceFile = sourceFile,
        snapshot = snapshot,
        support = support,
        primaryType = primaryType,
        fieldProjectTypes = fieldProjectTypes,
        environment = environment,
        requestStem = requestStem
    )
}

private fun validateOwnerCallExpressionStatement(
    expression: ExpressionTree,
    sourceFile: OwnerConventionSourceFile,
    snapshot: OwnerConventionSnapshot,
    support: OwnerConventionSupport,
    primaryType: OwnerConventionParsedJavaType,
    fieldProjectTypes: Map<String, String>,
    environment: OwnerMethodEnvironment,
    requestStem: String
): List<String> {
    val context = sourceFile.context
    if (expression !is MethodInvocationTree) {
        return listOf("${context.path} :: owner expression statements must be direct orchestration calls")
    }
    val classification = classifyOwnerInvocation(
        invocation = expression,
        sourceFile = sourceFile,
        snapshot = snapshot,
        support = support,
        primaryType = primaryType,
        fieldProjectTypes = fieldProjectTypes,
        environment = environment,
        requestStem = requestStem
    )
    if (!classification.allowed) {
        return listOf("${context.path} :: ${classification.description}")
    }
    return expression.arguments.flatMap { argument ->
        validatePassThroughArgument(argument, sourceFile, snapshot, support, primaryType, fieldProjectTypes, environment, requestStem)
    }
}

private fun validateOwnerValueExpression(
    expression: ExpressionTree,
    sourceFile: OwnerConventionSourceFile,
    snapshot: OwnerConventionSnapshot,
    support: OwnerConventionSupport,
    primaryType: OwnerConventionParsedJavaType,
    fieldProjectTypes: Map<String, String>,
    environment: OwnerMethodEnvironment,
    requestStem: String
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

        Tree.Kind.MEMBER_SELECT -> {
            if (isAllowedPassThroughReference(expression, environment)) {
                emptyList()
            } else {
                listOf("${context.path} :: owner values must stay on direct pass-through references")
            }
        }

        Tree.Kind.PARENTHESIZED -> validateOwnerValueExpression(
            (expression as ParenthesizedTree).expression,
            sourceFile,
            snapshot,
            support,
            primaryType,
            fieldProjectTypes,
            environment,
            requestStem
        )

        Tree.Kind.TYPE_CAST -> validateOwnerValueExpression(
            (expression as TypeCastTree).expression,
            sourceFile,
            snapshot,
            support,
            primaryType,
            fieldProjectTypes,
            environment,
            requestStem
        )

        Tree.Kind.NEW_CLASS -> validateOwnerNewClassExpression(
            expression as NewClassTree,
            sourceFile,
            snapshot,
            support,
            primaryType,
            fieldProjectTypes,
            environment,
            requestStem
        )

        Tree.Kind.METHOD_INVOCATION -> {
            val invocation = expression as MethodInvocationTree
            val classification = classifyOwnerInvocation(
                invocation = invocation,
                sourceFile = sourceFile,
                snapshot = snapshot,
                support = support,
                primaryType = primaryType,
                fieldProjectTypes = fieldProjectTypes,
                environment = environment,
                requestStem = requestStem
            )
            if (!classification.allowed) {
                listOf("${context.path} :: ${classification.description}")
            } else {
                invocation.arguments.flatMap { argument ->
                    validatePassThroughArgument(argument, sourceFile, snapshot, support, primaryType, fieldProjectTypes, environment, requestStem)
                }
            }
        }

        else -> listOf("${context.path} :: owner values must stay on pass-through references, input construction, or allowed orchestration results (${expression.kind})")
    }
}

private fun validateOwnerNewClassExpression(
    expression: NewClassTree,
    sourceFile: OwnerConventionSourceFile,
    snapshot: OwnerConventionSnapshot,
    support: OwnerConventionSupport,
    primaryType: OwnerConventionParsedJavaType,
    fieldProjectTypes: Map<String, String>,
    environment: OwnerMethodEnvironment,
    requestStem: String
): List<String> {
    val context = sourceFile.context
    val projectTypeName = support.resolveProjectTypeName(expression.identifier, sourceFile.parsedSource, snapshot)
    if (projectTypeName != null) {
        val projectPackage = projectTypeName.substringBeforeLast('.')
        val projectRole = support.roleForDirectoryName(projectPackage.substringAfterLast('.'))
        val targetOwnerPackage = support.ownerPackageFor(projectPackage, projectRole)
        val allowedProjectType = projectRole == support.inputRole &&
            support.isOwnerReachable(context.ownerPackage, targetOwnerPackage)
        if (!allowedProjectType) {
            return listOf("${context.path} :: owner requests may construct only own or neighboring foreign input types (${projectTypeName})")
        }
    }
    return expression.arguments.flatMap { argument ->
        validatePassThroughArgument(argument, sourceFile, snapshot, support, primaryType, fieldProjectTypes, environment, requestStem)
    }
}

private fun validatePassThroughArgument(
    expression: ExpressionTree,
    sourceFile: OwnerConventionSourceFile,
    snapshot: OwnerConventionSnapshot,
    support: OwnerConventionSupport,
    primaryType: OwnerConventionParsedJavaType,
    fieldProjectTypes: Map<String, String>,
    environment: OwnerMethodEnvironment,
    requestStem: String
): List<String> {
    if (isAllowedPassThroughValue(expression, sourceFile, snapshot, support, environment)) {
        return emptyList()
    }
    return validateOwnerValueExpression(
        expression = expression,
        sourceFile = sourceFile,
        snapshot = snapshot,
        support = support,
        primaryType = primaryType,
        fieldProjectTypes = fieldProjectTypes,
        environment = environment,
        requestStem = requestStem
    )
}

private fun classifyOwnerInvocation(
    invocation: MethodInvocationTree,
    sourceFile: OwnerConventionSourceFile,
    snapshot: OwnerConventionSnapshot,
    support: OwnerConventionSupport,
    primaryType: OwnerConventionParsedJavaType,
    fieldProjectTypes: Map<String, String>,
    environment: OwnerMethodEnvironment,
    requestStem: String
): OwnerCallClassification {
    val context = sourceFile.context
    val methodSelect = invocation.methodSelect
    if (methodSelect is IdentifierTree) {
        return OwnerCallClassification(
            allowed = false,
            description = "owner requests must not call unqualified helper methods (${methodSelect.name})"
        )
    }
    if (methodSelect !is MemberSelectTree) {
        return OwnerCallClassification(
            allowed = false,
            description = "owner requests must use explicit receivers for orchestration calls"
        )
    }
    val methodName = methodSelect.identifier.toString()
    val receiverTypeName = projectTypeNameForExpression(
        expression = methodSelect.expression,
        sourceFile = sourceFile,
        snapshot = snapshot,
        support = support,
        fieldProjectTypes = fieldProjectTypes,
        environment = environment
    )
    if (receiverTypeName == null) {
        return if (isAllowedInputAccessorInvocation(methodSelect.expression, invocation, sourceFile, snapshot, support, environment)) {
            OwnerCallClassification(
                allowed = true,
                description = "input accessor call"
            )
        } else if (isAllowedUtilityInvocation(invocation, sourceFile, snapshot, support, environment)) {
            OwnerCallClassification(
                allowed = true,
                description = "allowed utility call"
            )
        } else {
            OwnerCallClassification(
                allowed = false,
                description = "owner requests may call only explicit input accessors or allowed utility helpers"
            )
        }
    }
    val receiverPackage = receiverTypeName.substringBeforeLast('.')
    val receiverRole = support.roleForDirectoryName(receiverPackage.substringAfterLast('.'))
    val receiverOwnerPackage = support.ownerPackageFor(receiverPackage, receiverRole)
    return when {
        receiverOwnerPackage == context.ownerPackage && receiverRole == support.taskRole -> {
            val expectedTaskType = support.ownerRequestTaskTypeName(context.ownerPackage, requestStem)
            val taskApi = support.taskApi(receiverTypeName, snapshot)
            if (receiverTypeName != expectedTaskType) {
                OwnerCallClassification(
                    allowed = false,
                    description = "owner request $requestStem may delegate only to $expectedTaskType"
                )
            } else if (taskApi == null || methodName !in taskApi.publicStaticMethodNames) {
                OwnerCallClassification(
                    allowed = false,
                    description = "owner requests may call only canonical task APIs on $expectedTaskType"
                )
            } else {
                OwnerCallClassification(
                    allowed = true,
                    description = "matching owner task dispatch"
                )
            }
        }

        receiverOwnerPackage == context.ownerPackage && receiverRole == support.stateRole -> {
            val stateApi = support.stateApi(receiverTypeName, snapshot)
            if (stateApi == null || methodName !in stateApi.publicStaticMethodNames) {
                OwnerCallClassification(
                    allowed = false,
                    description = "owner requests may call only canonical same-owner state APIs ($receiverTypeName.$methodName)"
                )
            } else {
                OwnerCallClassification(
                    allowed = true,
                    description = "same-owner state orchestration"
                )
            }
        }

        receiverOwnerPackage == context.ownerPackage && receiverRole == support.repositoryRole -> {
            val repositoryApi = support.repositoryApi(receiverTypeName, snapshot)
            if (repositoryApi == null || methodName !in repositoryApi.publicStaticMethodNames) {
                OwnerCallClassification(
                    allowed = false,
                    description = "owner requests may call only canonical same-owner repository APIs ($receiverTypeName.$methodName)"
                )
            } else {
                OwnerCallClassification(
                    allowed = true,
                    description = "same-owner repository orchestration"
                )
            }
        }

        receiverOwnerPackage == context.ownerPackage && receiverRole == support.inputRole ->
            OwnerCallClassification(
                allowed = isCanonicalInputAccessorInvocation(receiverTypeName, invocation, sourceFile, snapshot, support),
                description = "owner input values may expose only canonical input accessors"
            )

        receiverOwnerPackage == context.ownerPackage ->
            OwnerCallClassification(
                allowed = false,
                description = "owner requests may orchestrate only own task/state/repository collaborators"
            )

        !support.isOwnerReachable(context.ownerPackage, receiverOwnerPackage) ->
            OwnerCallClassification(
                allowed = false,
                description = "owner requests may cross only one owner edge ($receiverTypeName)"
            )

        receiverRole == support.ownerRole -> {
            val allowedRequestMethods = support.ownerSurfaceRequestMethodNames(receiverOwnerPackage, snapshot)
            val ownerSurfaceTypeName = support.ownerSurfaceTypeName(receiverOwnerPackage, snapshot)
            if (receiverTypeName != ownerSurfaceTypeName) {
                OwnerCallClassification(
                    allowed = false,
                    description = "owner requests may target only foreign <Owner>Object seams ($receiverTypeName)"
                )
            } else if (methodName !in allowedRequestMethods) {
                OwnerCallClassification(
                    allowed = false,
                    description = "owner requests may call only foreign owner request methods ($receiverTypeName.$methodName)"
                )
            } else {
                OwnerCallClassification(
                    allowed = true,
                    description = "foreign owner request"
                )
            }
        }

        receiverRole == support.inputRole ->
            OwnerCallClassification(
                allowed = isCanonicalInputAccessorInvocation(receiverTypeName, invocation, sourceFile, snapshot, support),
                description = "foreign input values may expose only canonical input accessors"
            )

        else -> OwnerCallClassification(
            allowed = false,
            description = "owner requests may reference only foreign owner entrypoints or foreign input values ($receiverTypeName)"
        )
    }
}

private fun containsProjectExpression(
    initializer: ExpressionTree?,
    sourceFile: OwnerConventionSourceFile,
    snapshot: OwnerConventionSnapshot,
    support: OwnerConventionSupport,
    environment: OwnerMethodEnvironment
): Boolean {
    if (initializer == null) {
        return false
    }
    if (initializer is NewClassTree) {
        return support.resolveProjectTypeName(initializer.identifier, sourceFile.parsedSource, snapshot) != null
    }
    if (initializer is MethodInvocationTree) {
        return projectTypeNameForExpression(
            initializer.methodSelect,
            sourceFile,
            snapshot,
            support,
            emptyMap(),
            environment
        ) != null
    }
    return false
}

private fun projectTypeNameForExpression(
    expression: ExpressionTree,
    sourceFile: OwnerConventionSourceFile,
    snapshot: OwnerConventionSnapshot,
    support: OwnerConventionSupport,
    fieldProjectTypes: Map<String, String>,
    environment: OwnerMethodEnvironment
): String? {
    val context = sourceFile.context
    return when (expression) {
        is IdentifierTree -> {
            support.resolveProjectTypeName(expression, sourceFile.parsedSource, snapshot)
                ?: when (expression.name.toString()) {
                    environment.requestParameterName -> environment.requestParameterTypeName
                    else -> environment.localProjectTypes[expression.name.toString()]
                        ?: fieldProjectTypes[expression.name.toString()]
                }
        }

        is MemberSelectTree -> support.resolveProjectTypeName(expression, sourceFile.parsedSource, snapshot)

        is ParenthesizedTree -> projectTypeNameForExpression(
            expression.expression,
            sourceFile,
            snapshot,
            support,
            fieldProjectTypes,
            environment
        )

        else -> null
    }
}

private fun isAllowedPassThroughReference(
    expression: ExpressionTree,
    environment: OwnerMethodEnvironment
): Boolean {
    return when (expression) {
        is IdentifierTree -> true
        is MemberSelectTree -> isAllowedPassThroughReference(expression.expression, environment)
        is ParenthesizedTree -> isAllowedPassThroughReference(expression.expression, environment)
        is TypeCastTree -> isAllowedPassThroughReference(expression.expression, environment)
        else -> false
    }
}

private fun isAllowedPassThroughValue(
    expression: ExpressionTree,
    sourceFile: OwnerConventionSourceFile,
    snapshot: OwnerConventionSnapshot,
    support: OwnerConventionSupport,
    environment: OwnerMethodEnvironment
): Boolean {
    return when (expression.kind) {
        Tree.Kind.NULL_LITERAL,
        Tree.Kind.BOOLEAN_LITERAL,
        Tree.Kind.CHAR_LITERAL,
        Tree.Kind.STRING_LITERAL,
        Tree.Kind.INT_LITERAL,
        Tree.Kind.LONG_LITERAL,
        Tree.Kind.FLOAT_LITERAL,
        Tree.Kind.DOUBLE_LITERAL -> true

        Tree.Kind.IDENTIFIER -> true

        Tree.Kind.MEMBER_SELECT -> isAllowedPassThroughReference(expression, environment)

        Tree.Kind.PARENTHESIZED -> isAllowedPassThroughValue(
            (expression as ParenthesizedTree).expression,
            sourceFile,
            snapshot,
            support,
            environment
        )

        Tree.Kind.TYPE_CAST -> isAllowedPassThroughValue(
            (expression as TypeCastTree).expression,
            sourceFile,
            snapshot,
            support,
            environment
        )

        Tree.Kind.METHOD_INVOCATION -> isAllowedInputAccessorInvocation(
            receiverExpression = null,
            invocation = expression as MethodInvocationTree,
            sourceFile = sourceFile,
            snapshot = snapshot,
            support = support,
            environment = environment
        ) || isAllowedUtilityInvocation(
            invocation = expression,
            sourceFile = sourceFile,
            snapshot = snapshot,
            support = support,
            environment = environment
        )

        Tree.Kind.NEW_CLASS -> {
            val newClass = expression as NewClassTree
            val typeName = support.resolveProjectTypeName(newClass.identifier, sourceFile.parsedSource, snapshot)
            if (typeName == null) {
                false
            } else {
                val typePackage = typeName.substringBeforeLast('.')
                val typeRole = support.roleForDirectoryName(typePackage.substringAfterLast('.'))
                val targetOwnerPackage = support.ownerPackageFor(typePackage, typeRole)
                typeRole == support.inputRole &&
                    support.isOwnerReachable(sourceFile.context.ownerPackage, targetOwnerPackage) &&
                    newClass.arguments.all { argument ->
                        isAllowedPassThroughValue(argument, sourceFile, snapshot, support, environment)
                    }
            }
        }

        else -> false
    }
}

private fun isAllowedOwnerGuardCondition(
    expression: ExpressionTree,
    sourceFile: OwnerConventionSourceFile,
    snapshot: OwnerConventionSnapshot,
    support: OwnerConventionSupport,
    environment: OwnerMethodEnvironment
): Boolean {
    return when (expression) {
        is LiteralTree -> true
        is IdentifierTree -> true
        is MemberSelectTree -> isAllowedPassThroughReference(expression, environment)
        is ParenthesizedTree -> isAllowedOwnerGuardCondition(expression.expression, sourceFile, snapshot, support, environment)
        is TypeCastTree -> isAllowedOwnerGuardCondition(expression.expression, sourceFile, snapshot, support, environment)
        is MethodInvocationTree -> isAllowedInputAccessorInvocation(
            receiverExpression = null,
            invocation = expression,
            sourceFile = sourceFile,
            snapshot = snapshot,
            support = support,
            environment = environment
        ) || isAllowedUtilityGuardInvocation(expression, sourceFile, snapshot, support, environment)

        is UnaryTree -> isAllowedOwnerGuardCondition(expression.expression, sourceFile, snapshot, support, environment)

        is BinaryTree -> isAllowedOwnerGuardCondition(expression.leftOperand, sourceFile, snapshot, support, environment) &&
            isAllowedOwnerGuardCondition(expression.rightOperand, sourceFile, snapshot, support, environment)

        is ConditionalExpressionTree -> false

        else -> false
    }
}

private fun isAllowedInputAccessorInvocation(
    receiverExpression: ExpressionTree?,
    invocation: MethodInvocationTree,
    sourceFile: OwnerConventionSourceFile,
    snapshot: OwnerConventionSnapshot,
    support: OwnerConventionSupport,
    environment: OwnerMethodEnvironment
): Boolean {
    if (invocation.arguments.isNotEmpty()) {
        return false
    }
    val methodSelect = invocation.methodSelect as? MemberSelectTree ?: return false
    val receiver = receiverExpression ?: methodSelect.expression
    if (receiver !is IdentifierTree && receiver !is MemberSelectTree && receiver !is ParenthesizedTree && receiver !is TypeCastTree) {
        return false
    }
    val receiverTypeName = projectTypeNameForExpression(
        expression = receiver,
        sourceFile = sourceFile,
        snapshot = snapshot,
        support = support,
        fieldProjectTypes = emptyMap(),
        environment = environment
    ) ?: return false
    return isCanonicalInputAccessorInvocation(receiverTypeName, invocation, sourceFile, snapshot, support)
}

private fun isCanonicalInputAccessorInvocation(
    receiverTypeName: String,
    invocation: MethodInvocationTree,
    sourceFile: OwnerConventionSourceFile,
    snapshot: OwnerConventionSnapshot,
    support: OwnerConventionSupport
): Boolean {
    return support.isCanonicalInputAccessorInvocation(
        receiverTypeName = receiverTypeName,
        invocation = invocation,
        parsedSource = sourceFile.parsedSource,
        snapshot = snapshot
    )
}

private fun isAllowedUtilityInvocation(
    invocation: MethodInvocationTree,
    sourceFile: OwnerConventionSourceFile,
    snapshot: OwnerConventionSnapshot,
    support: OwnerConventionSupport,
    environment: OwnerMethodEnvironment
): Boolean {
    return isAllowedObjectsUtilityInvocation(invocation) { argument ->
        isAllowedPassThroughValue(argument, sourceFile, snapshot, support, environment)
    }
}

private fun isAllowedUtilityGuardInvocation(
    invocation: MethodInvocationTree,
    sourceFile: OwnerConventionSourceFile,
    snapshot: OwnerConventionSnapshot,
    support: OwnerConventionSupport,
    environment: OwnerMethodEnvironment
): Boolean {
    return isAllowedObjectsUtilityInvocation(invocation) { argument ->
        isAllowedPassThroughValue(argument, sourceFile, snapshot, support, environment)
    }
}
