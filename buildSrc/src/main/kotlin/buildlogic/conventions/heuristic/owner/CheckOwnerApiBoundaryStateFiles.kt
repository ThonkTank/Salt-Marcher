package buildlogic.conventions.heuristic.owner

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
    stateFileReasons(sourceFile, snapshot, support)
}

private fun stateFileReasons(
    sourceFile: OwnerConventionSourceFile,
    snapshot: OwnerConventionSnapshot,
    support: OwnerConventionSupport
): List<String> {
    val context = sourceFile.context
    val reasons = mutableListOf<String>()
    val className = context.className.removeSuffix(".java")
    val primaryType = support.parsedPrimaryType(sourceFile)
    if (primaryType == null) {
        reasons += "${context.path} :: state files must declare a top-level type named $className"
        return reasons
    }
    if (sourceFile.parsedSource.topLevelTypes.size != 1) {
        reasons += "${context.path} :: state files must contain exactly one top-level type"
    }
    val validKind = primaryType.kind == OwnerConventionParsedJavaTypeKind.RECORD ||
        primaryType.kind == OwnerConventionParsedJavaTypeKind.ENUM ||
        (primaryType.kind == OwnerConventionParsedJavaTypeKind.CLASS && Modifier.FINAL in primaryType.modifiers)
    if (!validKind) {
        reasons += "${context.path} :: state files must declare a final class, record, or enum"
    }
    if (
        primaryType.kind == OwnerConventionParsedJavaTypeKind.CLASS &&
        primaryType.constructors.any { Modifier.PUBLIC in it.modifiers }
    ) {
        reasons += "${context.path} :: state classes must use factory or transition methods instead of public constructors"
    }
    context.typeImports.importedPackages.forEach { importedPackage ->
        val importedRole = support.roleForDirectoryName(importedPackage.substringAfterLast('.'))
        val allowed = support.sameOwner(context.ownerPackage, importedPackage) &&
            importedRole in setOf(support.inputRole, support.stateRole)
        if (!allowed) {
            reasons += "${context.path} -> $importedPackage :: state files may import only own input and own state packages"
        }
    }
    val publicMethods = primaryType.methods.filter { Modifier.PUBLIC in it.modifiers }
    if (publicMethods.any { Modifier.STATIC !in it.modifiers }) {
        reasons += "${context.path} :: state files must not expose public instance methods"
    }
    publicMethods
        .filter { Modifier.STATIC in it.modifiers }
        .forEach { method ->
            val parameterPackages = method.parameters.flatMap { parameter ->
                support.projectTypePackages(parameter.tree.type, sourceFile.parsedSource, snapshot)
            }.distinct()
            val returnPackages = support.projectTypePackages(method.tree.returnType, sourceFile.parsedSource, snapshot)
            if (parameterPackages.any { projectPackage ->
                    !support.sameOwner(context.ownerPackage, projectPackage) ||
                        support.roleForDirectoryName(projectPackage.substringAfterLast('.')) !in setOf(support.inputRole, support.stateRole)
                }
            ) {
                reasons += "${context.path} :: state factories may accept only own input and own state types"
            }
            if (returnPackages.any { projectPackage ->
                    !support.sameOwner(context.ownerPackage, projectPackage) ||
                        support.roleForDirectoryName(projectPackage.substringAfterLast('.')) != support.stateRole
                }
            ) {
                reasons += "${context.path} :: state factories may return only own state types"
            }
        }
    return reasons
}
