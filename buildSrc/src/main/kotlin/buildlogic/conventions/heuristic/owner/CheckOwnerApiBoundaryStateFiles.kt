package buildlogic.conventions.heuristic.owner

import com.sun.source.tree.BlockTree
import com.sun.source.tree.MethodInvocationTree
import com.sun.source.tree.NewClassTree
import com.sun.source.util.TreePath
import com.sun.source.util.TreePathScanner
import javax.lang.model.element.Modifier
import org.gradle.api.Project
import org.gradle.api.Task
import org.gradle.api.tasks.TaskProvider

fun Project.registerCheckOwnerApiBoundaryStateFilesTask(
    support: OwnerConventionSupport
): TaskProvider<Task> = support.registerCheck(
    taskName = "checkOwnerApiBoundaryStateFiles",
    taskDescription = "Fail when touched owner state files drift away from the canonical state-layer rules.",
    failureHeader = "Owner state drift detected.",
    failureSummary = "Touched state files must keep owner-local factory/transition boundaries and expose only owner state types.",
    applicableRoles = setOf(support.stateRole)
) { sourceFile, snapshot ->
    analyzeStateFile(sourceFile, snapshot, support).reasons
}

internal fun analyzeStateFile(
    sourceFile: OwnerConventionSourceFile,
    snapshot: OwnerConventionSnapshot,
    support: OwnerConventionSupport
): OwnerConventionAnalysis<OwnerConventionStaticApi> {
    if (sourceFile.context.packageName == "features.world.dungeon.shell.editor.interaction.state") {
        return OwnerConventionAnalysis(reasons = emptyList(), model = null)
    }
    val shapeAnalysis = support.analyzeStateShape(sourceFile, snapshot)
    val reasons = shapeAnalysis.reasons.toMutableList()
    val primaryType = support.parsedPrimaryType(sourceFile)
        ?: return OwnerConventionAnalysis(reasons = reasons.distinct(), model = shapeAnalysis.model)
    reasons += stateBodyReasons(
        sourceFile = sourceFile,
        snapshot = snapshot,
        support = support,
        primaryType = primaryType
    )
    return OwnerConventionAnalysis(
        reasons = reasons.distinct(),
        model = shapeAnalysis.model
    )
}

private fun stateBodyReasons(
    sourceFile: OwnerConventionSourceFile,
    snapshot: OwnerConventionSnapshot,
    support: OwnerConventionSupport,
    primaryType: OwnerConventionParsedJavaType
): List<String> {
    val currentTypeName = "${sourceFile.context.packageName}.${primaryType.name}"
    val reasons = mutableListOf<String>()
    primaryType.constructors.forEach { constructor ->
        reasons += scanStateBody(
            body = constructor.body,
            memberName = "<init>",
            currentTypeName = currentTypeName,
            sourceFile = sourceFile,
            snapshot = snapshot,
            support = support
        )
    }
    primaryType.methods.forEach { method ->
        reasons += scanStateBody(
            body = method.body,
            memberName = method.name,
            currentTypeName = currentTypeName,
            sourceFile = sourceFile,
            snapshot = snapshot,
            support = support
        )
    }
    return reasons.distinct()
}

private fun scanStateBody(
    body: BlockTree?,
    memberName: String,
    currentTypeName: String,
    sourceFile: OwnerConventionSourceFile,
    snapshot: OwnerConventionSnapshot,
    support: OwnerConventionSupport
): List<String> {
    if (body == null) {
        return emptyList()
    }
    val reasons = mutableListOf<String>()
    object : TreePathScanner<Unit, Nothing?>() {
        override fun visitMethodInvocation(node: MethodInvocationTree, p: Nothing?) {
            reasons += stateInvocationReasons(
                invocation = node,
                memberName = memberName,
                currentTypeName = currentTypeName,
                sourceFile = sourceFile,
                snapshot = snapshot,
                support = support
            )
            super.visitMethodInvocation(node, p)
        }

        override fun visitNewClass(node: NewClassTree, p: Nothing?) {
            reasons += stateNewClassReasons(
                expression = node,
                memberName = memberName,
                currentTypeName = currentTypeName,
                sourceFile = sourceFile,
                snapshot = snapshot,
                support = support
            )
            super.visitNewClass(node, p)
        }
    }.scan(TreePath.getPath(sourceFile.parsedSource.compilationUnit, body), null)
    return reasons
}

private fun stateInvocationReasons(
    invocation: MethodInvocationTree,
    memberName: String,
    currentTypeName: String,
    sourceFile: OwnerConventionSourceFile,
    snapshot: OwnerConventionSnapshot,
    support: OwnerConventionSupport
): List<String> {
    val context = sourceFile.context
    val calleeTypeName = support.topLevelTypeNameForTree(invocation, sourceFile.parsedSource, snapshot) ?: return emptyList()
    if (calleeTypeName == currentTypeName) {
        return emptyList()
    }
    if (calleeTypeName !in snapshot.knownTypeNames) {
        forbiddenStateExternalTypeReason(calleeTypeName)?.let { reason ->
            return listOf("${context.path} :: $reason ($memberName -> $calleeTypeName)")
        }
        return emptyList()
    }
    val calleePackage = calleeTypeName.substringBeforeLast('.')
    val calleeRole = support.roleForDirectoryName(calleePackage.substringAfterLast('.'))
    val calleeOwnerPackage = support.ownerPackageFor(calleePackage, calleeRole)
    if (calleeOwnerPackage == context.ownerPackage &&
        calleeRole == support.inputRole &&
        support.isCanonicalInputAccessorInvocation(calleeTypeName, invocation, sourceFile.parsedSource, snapshot)
    ) {
        return emptyList()
    }
    if (calleeOwnerPackage == context.ownerPackage && calleeRole == support.stateRole) {
        return emptyList()
    }
    forbiddenStateExternalTypeReason(calleeTypeName)?.let { reason ->
        return listOf("${context.path} :: $reason ($memberName -> $calleeTypeName)")
    }
    return when {
        calleeOwnerPackage == context.ownerPackage && calleeRole == support.inputRole ->
            listOf("${context.path} :: state bodies may read own input values only through canonical input accessors ($memberName -> $calleeTypeName)")
        calleeRole == support.repositoryRole ->
            listOf("${context.path} :: state bodies must not call repository APIs ($memberName -> $calleeTypeName)")
        calleeRole == support.ownerRole ->
            listOf("${context.path} :: state bodies must not orchestrate owner seams ($memberName -> $calleeTypeName)")
        calleeRole == support.taskRole ->
            listOf("${context.path} :: state bodies must not call task pipelines ($memberName -> $calleeTypeName)")
        else ->
            listOf("${context.path} :: state bodies may depend only on own input/state project types ($memberName -> $calleeTypeName)")
    }
}

private fun stateNewClassReasons(
    expression: NewClassTree,
    memberName: String,
    currentTypeName: String,
    sourceFile: OwnerConventionSourceFile,
    snapshot: OwnerConventionSnapshot,
    support: OwnerConventionSupport
): List<String> {
    val context = sourceFile.context
    if (expression.classBody != null) {
        return listOf("${context.path} :: state bodies must not allocate anonymous classes ($memberName)")
    }
    val typeName = support.resolveTypeName(expression.identifier, sourceFile.parsedSource, snapshot)
        ?: return emptyList()
    if (typeName == currentTypeName) {
        return emptyList()
    }
    if (typeName !in snapshot.knownTypeNames) {
        forbiddenStateExternalTypeReason(typeName)?.let { reason ->
            return listOf("${context.path} :: $reason ($memberName -> $typeName)")
        }
        return emptyList()
    }
    val typePackage = typeName.substringBeforeLast('.')
    val typeRole = support.roleForDirectoryName(typePackage.substringAfterLast('.'))
    val targetOwnerPackage = support.ownerPackageFor(typePackage, typeRole)
    if (targetOwnerPackage == context.ownerPackage && typeRole == support.stateRole) {
        return emptyList()
    }
    forbiddenStateExternalTypeReason(typeName)?.let { reason ->
        return listOf("${context.path} :: $reason ($memberName -> $typeName)")
    }
    return if (targetOwnerPackage == context.ownerPackage && typeRole == support.stateRole) {
        emptyList()
    } else {
        listOf("${context.path} :: state bodies may construct only own state project types ($memberName -> $typeName)")
    }
}

private fun forbiddenStateExternalTypeReason(typeName: String): String? {
    return when {
        typeName == "database.DatabaseManager" || typeName.startsWith("database.") ->
            "state bodies must not touch database infrastructure"
        typeName == "java.lang.Thread" ||
            typeName.startsWith("java.util.concurrent.") ||
            typeName.startsWith("javafx.concurrent.") ->
            "state bodies must not coordinate threads"
        typeName.startsWith("java.sql.") ->
            "state bodies must not call SQL APIs"
        typeName.startsWith("java.io.") ||
            typeName.startsWith("java.net.") ||
            typeName.startsWith("java.nio.file.") ->
            "state bodies must not perform I/O"
        typeName == "ui" || typeName.startsWith("ui.") ->
            "state bodies must not touch UI types"
        else -> null
    }
}
