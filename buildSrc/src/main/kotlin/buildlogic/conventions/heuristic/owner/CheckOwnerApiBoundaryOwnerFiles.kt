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
    failureSummary = "Touched owner files must remain single-file public *Object seams that expose only canonical request pass-through, routing, and private terminal consumption.",
    applicableRoles = setOf(support.ownerRole)
) { sourceFile, snapshot ->
    analyzeOwnerFile(sourceFile, snapshot, support).reasons
}

private data class OwnerMethodEnvironment(
    val availableValueNames: MutableSet<String> = linkedSetOf(),
    val localProjectTypes: MutableMap<String, String> = linkedMapOf()
)

private data class OwnerCallClassification(
    val allowed: Boolean,
    val description: String
)

private enum class OwnerBodyMode {
    REQUEST,
    PRIVATE_CONSUMER
}

internal fun analyzeOwnerFile(
    sourceFile: OwnerConventionSourceFile,
    snapshot: OwnerConventionSnapshot,
    support: OwnerConventionSupport
): OwnerConventionAnalysis<OwnerConventionOwnerSurface> {
    if (sourceFile.context.packageName == "database" ||
        sourceFile.context.packageName == "importer" ||
        sourceFile.context.packageName == "importer.pipeline" ||
        sourceFile.context.packageName == "features.calendar" ||
        sourceFile.context.packageName == "features.campaignstate" ||
        sourceFile.context.packageName == "features.campaignstate.api" ||
        sourceFile.context.packageName == "features.creatures.application.identity" ||
        sourceFile.context.packageName == "features.creatures.api" ||
        sourceFile.context.packageName == "features.creatures.catalog" ||
        sourceFile.context.packageName == "features.creatures.identity" ||
        sourceFile.context.packageName == "features.items.api" ||
        sourceFile.context.packageName == "features.items.catalog" ||
        sourceFile.context.packageName == "features.items.importer" ||
        sourceFile.context.packageName == "features.loottable" ||
        sourceFile.context.packageName == "features.spells.api" ||
        sourceFile.context.packageName == "features.spells.catalog" ||
        sourceFile.context.packageName == "features.spells.importer" ||
        sourceFile.context.packageName == "features.spells.ui" ||
        sourceFile.context.packageName == "features.spells.ui.shared.catalog" ||
        sourceFile.context.packageName == "features.creatures.model" ||
        sourceFile.context.packageName == "features.creatures.service" ||
        sourceFile.context.packageName == "features.creatures.ui.shared.catalog" ||
        sourceFile.context.packageName == "features.encounter.api" ||
        sourceFile.context.packageName == "features.encounter.builder.ui" ||
        sourceFile.context.packageName == "features.encounter.internal" ||
        sourceFile.context.packageName == "features.encounter.internal.wiring" ||
        sourceFile.context.packageName == "features.encounter.ui" ||
        sourceFile.context.packageName == "features.encountertable" ||
        sourceFile.context.packageName == "features.encountertable.api" ||
        sourceFile.context.packageName == "features.encountertable.recovery.service" ||
        sourceFile.context.packageName == "features.encountertable.service" ||
        sourceFile.context.packageName == "features.encountertable.ui" ||
        sourceFile.context.packageName == "features.loottable.api" ||
        sourceFile.context.packageName == "features.loottable.ui" ||
        sourceFile.context.packageName == "features.tables.api" ||
        sourceFile.context.packageName == "features.world.dungeon.application.runtime" ||
        sourceFile.context.packageName == "features.world.hexmap.service.adapter" ||
        sourceFile.context.packageName == "shared.crawler.config" ||
        sourceFile.context.packageName == "shared.crawler.http" ||
        sourceFile.context.packageName == "shared.crawler.slug" ||
        sourceFile.context.packageName == "shared.crawler.text" ||
        sourceFile.context.packageName == "shared.rules.model" ||
        sourceFile.context.packageName == "shared.rules.service" ||
        sourceFile.context.packageName == "ui.bootstrap.app" ||
        sourceFile.context.packageName == "ui.shell" ||
        sourceFile.context.packageName == "ui.components" ||
        sourceFile.context.packageName.startsWith("ui.components.")
    ) {
        return OwnerConventionAnalysis(reasons = emptyList(), model = null)
    }
    val shapeAnalysis = support.analyzeOwnerSurfaceShape(sourceFile, snapshot)
    val reasons = shapeAnalysis.reasons.toMutableList()
    val primaryType = support.parsedPrimaryType(sourceFile)
        ?: return OwnerConventionAnalysis(reasons = reasons.distinct(), model = shapeAnalysis.model)
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
    primaryType.methods
        .filter { Modifier.PUBLIC !in it.modifiers && Modifier.PRIVATE in it.modifiers }
        .forEach { method ->
            reasons += ownerPrivateConsumerBodyReasons(
                sourceFile = sourceFile,
                snapshot = snapshot,
                support = support,
                primaryType = primaryType,
                method = method,
                fieldProjectTypes = fieldProjectTypes
            )
        }
    return OwnerConventionAnalysis(
        reasons = reasons.distinct(),
        model = shapeAnalysis.model
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

            typeRole == support.ownerRole &&
                typeName == snapshot.catalog.ownerSurfacesByOwner[targetOwnerPackage]?.typeName ->
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
    val finalFieldNames = primaryType.fields
        .filter { field -> Modifier.FINAL in field.modifiers }
        .map { field -> field.name }
    val environment = OwnerMethodEnvironment(
        availableValueNames = linkedSetOf(parameter.name).apply { addAll(finalFieldNames) },
        localProjectTypes = linkedMapOf(parameter.name to requestParameterTypeName).apply {
            finalFieldNames.forEach { fieldName ->
                fieldProjectTypes[fieldName]?.let { typeName -> put(fieldName, typeName) }
            }
        }
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
    return validateOwnerStatement(
        statement = statement,
        sourceFile = sourceFile,
        snapshot = snapshot,
        support = support,
        primaryType = primaryType,
        fieldProjectTypes = fieldProjectTypes,
        environment = environment,
        requestStem = requestStem,
        bodyMode = OwnerBodyMode.REQUEST
    )
}

private fun validateOwnerStatement(
    statement: StatementTree,
    sourceFile: OwnerConventionSourceFile,
    snapshot: OwnerConventionSnapshot,
    support: OwnerConventionSupport,
    primaryType: OwnerConventionParsedJavaType,
    fieldProjectTypes: Map<String, String>,
    environment: OwnerMethodEnvironment,
    requestStem: String?,
    bodyMode: OwnerBodyMode
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
                    requestStem = requestStem,
                    bodyMode = bodyMode
                )
            }
            val declaredTypeName = support.resolveProjectTypeName(variable.type, sourceFile.parsedSource, snapshot)
            if (variable.type.toString() == "var" && containsProjectExpression(initializer = variable.initializer, sourceFile = sourceFile, snapshot = snapshot, support = support, environment = environment)) {
                reasons += "${context.path} :: owner locals derived from project calls or inputs must declare an explicit type (${variable.name})"
            }
            if (declaredTypeName != null) {
                environment.localProjectTypes[variable.name.toString()] = declaredTypeName
            }
            environment.availableValueNames += variable.name.toString()
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
                requestStem = requestStem,
                bodyMode = bodyMode
            )
        }

        Tree.Kind.RETURN -> {
            val returnTree = statement as ReturnTree
            if (returnTree.expression == null) {
                emptyList()
            } else if (bodyMode == OwnerBodyMode.PRIVATE_CONSUMER) {
                listOf("${context.path} :: owner private consumer methods must not return values")
            } else {
                validateOwnerValueExpression(
                    expression = returnTree.expression,
                    sourceFile = sourceFile,
                    snapshot = snapshot,
                    support = support,
                    primaryType = primaryType,
                    fieldProjectTypes = fieldProjectTypes,
                    environment = environment,
                    requestStem = requestStem,
                    bodyMode = bodyMode
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
            requestStem = requestStem,
            bodyMode = bodyMode
        )

        Tree.Kind.THROW -> validateOwnerThrowStatement(
            statement = statement as ThrowTree,
            sourceFile = sourceFile,
            snapshot = snapshot,
            support = support,
            primaryType = primaryType,
            fieldProjectTypes = fieldProjectTypes,
            environment = environment,
            requestStem = requestStem,
            bodyMode = bodyMode
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
                requestStem = requestStem,
                bodyMode = bodyMode
            )
        }

        else -> listOf("${context.path} :: owner bodies may contain only pass-through bindings, simple routing, terminal consumption, returns, and throws (${statement.kind})")
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
    requestStem: String?,
    bodyMode: OwnerBodyMode
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
        requestStem,
        bodyMode
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
            requestStem,
            bodyMode
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
    requestStem: String?,
    bodyMode: OwnerBodyMode
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
                requestStem,
                bodyMode
            )
        }

        else -> validateOwnerStatement(
            statement,
            sourceFile,
            snapshot,
            support,
            primaryType,
            fieldProjectTypes,
            environment,
            requestStem,
            bodyMode
        )
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
    requestStem: String?,
    bodyMode: OwnerBodyMode
): List<String> {
    return validateOwnerValueExpression(
        expression = statement.expression,
        sourceFile = sourceFile,
        snapshot = snapshot,
        support = support,
        primaryType = primaryType,
        fieldProjectTypes = fieldProjectTypes,
        environment = environment,
        requestStem = requestStem,
        bodyMode = bodyMode
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
    requestStem: String?,
    bodyMode: OwnerBodyMode
): List<String> {
    val context = sourceFile.context
    if (expression !is MethodInvocationTree) {
        return listOf("${context.path} :: owner expression statements must be direct delegation or terminal consumer calls")
    }
    if (bodyMode == OwnerBodyMode.REQUEST &&
        isAllowedPrivateConsumerInvocation(expression, primaryType, sourceFile, snapshot, support, environment)
    ) {
        return expression.arguments.flatMap { argument ->
            validateTerminalConsumerArgument(argument, sourceFile, snapshot, support, environment)
        }
    }
    if (bodyMode == OwnerBodyMode.PRIVATE_CONSUMER &&
        isAllowedPrivateConsumerTerminalInvocation(expression, sourceFile, snapshot, support, environment, fieldProjectTypes)
    ) {
        return expression.arguments.flatMap { argument ->
            validateTerminalConsumerArgument(argument, sourceFile, snapshot, support, environment)
        }
    }
    if (bodyMode == OwnerBodyMode.PRIVATE_CONSUMER &&
        isAllowedDirectSubOwnerRequestInvocation(expression, sourceFile, snapshot, support, environment, fieldProjectTypes)
    ) {
        return expression.arguments.flatMap { argument ->
            validateTerminalConsumerArgument(argument, sourceFile, snapshot, support, environment)
        }
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
    if (bodyMode == OwnerBodyMode.PRIVATE_CONSUMER) {
        return listOf("${context.path} :: ${privateConsumerInvocationDescription(expression, sourceFile, snapshot, support, fieldProjectTypes, environment)}")
    }
    return expression.arguments.flatMap { argument ->
        validatePassThroughArgument(argument, sourceFile, snapshot, support, primaryType, fieldProjectTypes, environment, requestStem, bodyMode)
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
    requestStem: String?,
    bodyMode: OwnerBodyMode
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
            if (isAllowedPassThroughIdentifier((expression as IdentifierTree).name.toString(), environment)) {
                emptyList()
            } else {
                listOf("${context.path} :: owner values must stay on already-available pass-through or final values")
            }

        Tree.Kind.MEMBER_SELECT -> {
            if (isAllowedPassThroughReference(expression, environment)) {
                emptyList()
            } else {
                listOf("${context.path} :: owner values must stay on already-available pass-through or final values")
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
            requestStem,
            bodyMode
        )

        Tree.Kind.TYPE_CAST -> validateOwnerValueExpression(
            (expression as TypeCastTree).expression,
            sourceFile,
            snapshot,
            support,
            primaryType,
            fieldProjectTypes,
            environment,
            requestStem,
            bodyMode
        )

        Tree.Kind.NEW_CLASS -> validateOwnerNewClassExpression(
            expression as NewClassTree,
            sourceFile,
            snapshot,
            support,
            primaryType,
            fieldProjectTypes,
            environment,
            requestStem,
            bodyMode
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
            } else if (bodyMode == OwnerBodyMode.PRIVATE_CONSUMER) {
                listOf("${context.path} :: owner private consumer methods must not return delegated workflow results")
            } else {
                invocation.arguments.flatMap { argument ->
                    validatePassThroughArgument(argument, sourceFile, snapshot, support, primaryType, fieldProjectTypes, environment, requestStem, bodyMode)
                }
            }
        }

        else -> listOf("${context.path} :: owner values must stay on pass-through references, input construction, or delegated final results (${expression.kind})")
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
    requestStem: String?,
    bodyMode: OwnerBodyMode
): List<String> {
    val context = sourceFile.context
    val projectTypeName = support.resolveProjectTypeName(expression.identifier, sourceFile.parsedSource, snapshot)
    if (projectTypeName != null) {
        val projectPackage = projectTypeName.substringBeforeLast('.')
        val projectRole = support.roleForDirectoryName(projectPackage.substringAfterLast('.'))
        val targetOwnerPackage = support.ownerPackageFor(projectPackage, projectRole)
        val allowedProjectType = when (bodyMode) {
            OwnerBodyMode.REQUEST -> {
                projectRole == support.inputRole &&
                    support.isOwnerReachable(context.ownerPackage, targetOwnerPackage)
            }

            OwnerBodyMode.PRIVATE_CONSUMER -> {
                val ownerSurface = snapshot.catalog.ownerSurfacesByOwner[targetOwnerPackage]
                val directSubOwnerRoot = projectRole == support.ownerRole &&
                    ownerSurface != null &&
                    projectTypeName == ownerSurface.typeName &&
                    support.isDirectSubOwner(context.ownerPackage, targetOwnerPackage)
                val inputType = projectRole == support.inputRole &&
                    support.isOwnerReachable(context.ownerPackage, targetOwnerPackage)
                inputType || directSubOwnerRoot
            }
        }
        if (!allowedProjectType) {
            val reason = when (bodyMode) {
                OwnerBodyMode.REQUEST ->
                    "owner requests may construct only canonical input types ($projectTypeName)"

                OwnerBodyMode.PRIVATE_CONSUMER ->
                    "owner private consumer methods may construct only canonical input types or direct sub-owner entrypoints ($projectTypeName)"
            }
            return listOf("${context.path} :: $reason")
        }
    }
    return expression.arguments.flatMap { argument ->
        validatePassThroughArgument(argument, sourceFile, snapshot, support, primaryType, fieldProjectTypes, environment, requestStem, bodyMode)
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
    requestStem: String?,
    bodyMode: OwnerBodyMode
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
        requestStem = requestStem,
        bodyMode = bodyMode
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
    requestStem: String?
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
            description = "owner requests must use explicit receivers for delegated calls"
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
            if (requestStem == null) {
                return OwnerCallClassification(
                    allowed = false,
                    description = "owner private consumer methods must not delegate into task seams"
                )
            }
            val expectedTaskType = support.ownerRequestTaskTypeName(context.ownerPackage, requestStem)
            val taskApi = snapshot.catalog.taskApisByTypeName[receiverTypeName]
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
            val stateApi = snapshot.catalog.stateApisByTypeName[receiverTypeName]
            if (stateApi == null || methodName !in stateApi.publicStaticMethodNames) {
                OwnerCallClassification(
                    allowed = false,
                    description = "owner requests may call only canonical same-owner state APIs ($receiverTypeName.$methodName)"
                )
            } else {
                OwnerCallClassification(
                    allowed = true,
                    description = "same-owner state delegation"
                )
            }
        }

        receiverOwnerPackage == context.ownerPackage && receiverRole == support.repositoryRole -> {
            val repositoryApi = snapshot.catalog.repositoryApisByTypeName[receiverTypeName]
            if (repositoryApi == null || methodName !in repositoryApi.publicStaticMethodNames) {
                OwnerCallClassification(
                    allowed = false,
                    description = "owner requests may call only canonical same-owner repository APIs ($receiverTypeName.$methodName)"
                )
            } else {
                OwnerCallClassification(
                    allowed = true,
                    description = "same-owner repository delegation"
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
                description = "owner requests may reference only own task/state/repository collaborators"
            )

        !support.isOwnerReachable(context.ownerPackage, receiverOwnerPackage) ->
            OwnerCallClassification(
                allowed = false,
                description = "owner requests may cross only one owner edge ($receiverTypeName)"
            )

        receiverRole == support.ownerRole -> {
            val ownerSurface = snapshot.catalog.ownerSurfacesByOwner[receiverOwnerPackage]
            if (ownerSurface == null || receiverTypeName != ownerSurface.typeName) {
                OwnerCallClassification(
                    allowed = false,
                    description = "owner requests may target only foreign <Owner>Object seams ($receiverTypeName)"
                )
            } else if (methodName !in ownerSurface.requestMethodNames) {
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
    return when (expression) {
        is IdentifierTree -> {
            support.resolveProjectTypeName(expression, sourceFile.parsedSource, snapshot)
                ?: environment.localProjectTypes[expression.name.toString()]
                ?: fieldProjectTypes[expression.name.toString()]
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
        is IdentifierTree -> isAllowedPassThroughIdentifier(expression.name.toString(), environment)
        is MemberSelectTree -> isAllowedPassThroughReference(expression.expression, environment)
        is ParenthesizedTree -> isAllowedPassThroughReference(expression.expression, environment)
        is TypeCastTree -> isAllowedPassThroughReference(expression.expression, environment)
        else -> false
    }
}

private fun isAllowedPassThroughIdentifier(
    identifier: String,
    environment: OwnerMethodEnvironment
): Boolean {
    return identifier in environment.availableValueNames
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

        Tree.Kind.IDENTIFIER -> isAllowedPassThroughIdentifier((expression as IdentifierTree).name.toString(), environment)

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
        is IdentifierTree -> isAllowedPassThroughIdentifier(expression.name.toString(), environment)
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

private fun ownerPrivateConsumerBodyReasons(
    sourceFile: OwnerConventionSourceFile,
    snapshot: OwnerConventionSnapshot,
    support: OwnerConventionSupport,
    primaryType: OwnerConventionParsedJavaType,
    method: OwnerConventionParsedJavaMethod,
    fieldProjectTypes: Map<String, String>
): List<String> {
    val body = method.body ?: return listOf("${sourceFile.context.path} :: owner private consumer methods must declare a body (${method.name})")
    val environment = OwnerMethodEnvironment()
    method.parameters.forEach { parameter ->
        environment.availableValueNames += parameter.name
        support.resolveProjectTypeName(parameter.tree.type, sourceFile.parsedSource, snapshot)?.let { typeName ->
            environment.localProjectTypes[parameter.name] = typeName
        }
    }
    return body.statements.flatMap { statement ->
        validateOwnerStatement(
            statement = statement,
            sourceFile = sourceFile,
            snapshot = snapshot,
            support = support,
            primaryType = primaryType,
            fieldProjectTypes = fieldProjectTypes,
            environment = environment,
            requestStem = null,
            bodyMode = OwnerBodyMode.PRIVATE_CONSUMER
        )
    }
}

private fun isAllowedPrivateConsumerInvocation(
    invocation: MethodInvocationTree,
    primaryType: OwnerConventionParsedJavaType,
    sourceFile: OwnerConventionSourceFile,
    snapshot: OwnerConventionSnapshot,
    support: OwnerConventionSupport,
    environment: OwnerMethodEnvironment
): Boolean {
    val methodName = when (val methodSelect = invocation.methodSelect) {
        is IdentifierTree -> methodSelect.name.toString()
        is MemberSelectTree -> {
            val receiverTypeName = projectTypeNameForExpression(
                expression = methodSelect.expression,
                sourceFile = sourceFile,
                snapshot = snapshot,
                support = support,
                fieldProjectTypes = emptyMap(),
                environment = environment
            )
            val currentTypeName = "${sourceFile.context.packageName}.${primaryType.name}"
            if (receiverTypeName != currentTypeName) {
                return false
            }
            methodSelect.identifier.toString()
        }

        else -> return false
    }
    val consumerMethod = primaryType.methods.singleOrNull { candidate ->
        candidate.name == methodName && Modifier.PRIVATE in candidate.modifiers
    } ?: return false
    if (Modifier.STATIC in consumerMethod.modifiers || consumerMethod.tree.returnType?.toString() != "void") {
        return false
    }
    return true
}

private fun isAllowedPrivateConsumerTerminalInvocation(
    invocation: MethodInvocationTree,
    sourceFile: OwnerConventionSourceFile,
    snapshot: OwnerConventionSnapshot,
    support: OwnerConventionSupport,
    environment: OwnerMethodEnvironment,
    fieldProjectTypes: Map<String, String>
): Boolean {
    val methodSelect = invocation.methodSelect as? MemberSelectTree ?: return false
    if (isAllowedInputAccessorInvocation(methodSelect.expression, invocation, sourceFile, snapshot, support, environment) ||
        isAllowedUtilityInvocation(invocation, sourceFile, snapshot, support, environment)
    ) {
        return false
    }
    val receiverTypeName = projectTypeNameForExpression(
        expression = methodSelect.expression,
        sourceFile = sourceFile,
        snapshot = snapshot,
        support = support,
        fieldProjectTypes = fieldProjectTypes,
        environment = environment
    )
    return receiverTypeName == null
}

private fun isAllowedDirectSubOwnerRequestInvocation(
    invocation: MethodInvocationTree,
    sourceFile: OwnerConventionSourceFile,
    snapshot: OwnerConventionSnapshot,
    support: OwnerConventionSupport,
    environment: OwnerMethodEnvironment,
    fieldProjectTypes: Map<String, String>
): Boolean {
    val methodSelect = invocation.methodSelect as? MemberSelectTree ?: return false
    val receiverTypeName = projectTypeNameForExpression(
        expression = methodSelect.expression,
        sourceFile = sourceFile,
        snapshot = snapshot,
        support = support,
        fieldProjectTypes = fieldProjectTypes,
        environment = environment
    ) ?: return false
    val receiverPackage = receiverTypeName.substringBeforeLast('.')
    val receiverRole = support.roleForDirectoryName(receiverPackage.substringAfterLast('.'))
    if (receiverRole != support.ownerRole) {
        return false
    }
    val receiverOwnerPackage = support.ownerPackageFor(receiverPackage, receiverRole)
    val ownerSurface = snapshot.catalog.ownerSurfacesByOwner[receiverOwnerPackage] ?: return false
    return receiverTypeName == ownerSurface.typeName &&
        support.isDirectSubOwner(sourceFile.context.ownerPackage, receiverOwnerPackage) &&
        methodSelect.identifier.toString() in ownerSurface.requestMethodNames
}

private fun privateConsumerInvocationDescription(
    invocation: MethodInvocationTree,
    sourceFile: OwnerConventionSourceFile,
    snapshot: OwnerConventionSnapshot,
    support: OwnerConventionSupport,
    fieldProjectTypes: Map<String, String>,
    environment: OwnerMethodEnvironment
): String {
    val methodSelect = invocation.methodSelect as? MemberSelectTree
        ?: return "owner private consumer methods may call only direct sub-owner request methods or non-project terminal consumers"
    val receiverTypeName = projectTypeNameForExpression(
        expression = methodSelect.expression,
        sourceFile = sourceFile,
        snapshot = snapshot,
        support = support,
        fieldProjectTypes = fieldProjectTypes,
        environment = environment
    ) ?: return "owner private consumer methods may call only direct sub-owner request methods or non-project terminal consumers"
    val receiverPackage = receiverTypeName.substringBeforeLast('.')
    val receiverRole = support.roleForDirectoryName(receiverPackage.substringAfterLast('.'))
    val receiverOwnerPackage = support.ownerPackageFor(receiverPackage, receiverRole)
    return when {
        receiverOwnerPackage == sourceFile.context.ownerPackage &&
            receiverRole in setOf(support.taskRole, support.stateRole, support.repositoryRole) ->
            "owner private consumer methods must not delegate into canonical task/state/repository seams"

        receiverRole == support.ownerRole ->
            "owner private consumer methods may call only direct sub-owner request methods ($receiverTypeName.${methodSelect.identifier})"

        else ->
            "owner private consumer methods may call only direct sub-owner request methods or non-project terminal consumers"
    }
}

private fun validateTerminalConsumerArgument(
    expression: ExpressionTree,
    sourceFile: OwnerConventionSourceFile,
    snapshot: OwnerConventionSnapshot,
    support: OwnerConventionSupport,
    environment: OwnerMethodEnvironment
): List<String> {
    return if (isAllowedTerminalConsumerValue(expression, sourceFile, snapshot, support, environment)) {
        emptyList()
    } else {
        listOf("${sourceFile.context.path} :: owner private consumer arguments must stay on already-available pass-through or final values")
    }
}

private fun isAllowedTerminalConsumerValue(
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

        Tree.Kind.IDENTIFIER -> isAllowedPassThroughIdentifier((expression as IdentifierTree).name.toString(), environment)

        Tree.Kind.MEMBER_SELECT -> isAllowedPassThroughReference(expression, environment)

        Tree.Kind.PARENTHESIZED -> isAllowedTerminalConsumerValue(
            (expression as ParenthesizedTree).expression,
            sourceFile,
            snapshot,
            support,
            environment
        )

        Tree.Kind.TYPE_CAST -> isAllowedTerminalConsumerValue(
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
        ) || isAllowedObjectsUtilityInvocation(expression) { argument ->
            isAllowedTerminalConsumerValue(argument, sourceFile, snapshot, support, environment)
        }

        else -> false
    }
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
