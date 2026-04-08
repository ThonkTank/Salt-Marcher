package buildlogic.conventions.heuristic.owner

import javax.lang.model.element.Modifier
import org.gradle.api.Project
import org.gradle.api.Task
import org.gradle.api.tasks.TaskProvider

fun Project.registerCheckOwnerApiBoundaryInputFilesTask(
    support: OwnerConventionSupport
): TaskProvider<Task> = support.registerCheck(
    taskName = "checkOwnerApiBoundaryInputFiles",
    taskDescription = "Fail when touched owner input files drift away from the canonical <Request>Input rules.",
    failureHeader = "Owner input drift detected.",
    failureSummary = "Touched input files must remain owner-local request carriers that match a real owner public request.",
    applicableRoles = setOf(support.inputRole)
) { sourceFile, snapshot ->
    inputFileReasons(sourceFile, snapshot, support)
}

private fun inputFileReasons(
    sourceFile: OwnerConventionSourceFile,
    snapshot: OwnerConventionSnapshot,
    support: OwnerConventionSupport
): List<String> {
    val context = sourceFile.context
    val reasons = mutableListOf<String>()
    val className = context.className.removeSuffix(".java")
    val requestStem = support.requestStemForFile(context.className, "Input")
    if (requestStem == null) {
        reasons += "${context.path} :: input files must be named <Request>Input with a direct request stem"
    } else if (requestStem !in snapshot.requestStemsByOwner[context.ownerPackage].orEmpty()) {
        reasons += "${context.path} :: input files must match a real public request on ${context.ownerPackage}.${support.ownerObjectName(context.ownerPackage)}"
    }
    val primaryType = support.parsedPrimaryType(sourceFile)
    if (primaryType == null) {
        reasons += "${context.path} :: input files must declare a top-level type named $className"
        return reasons
    }
    val validKind = primaryType.kind == OwnerConventionParsedJavaTypeKind.RECORD ||
        primaryType.kind == OwnerConventionParsedJavaTypeKind.ENUM ||
        (primaryType.kind == OwnerConventionParsedJavaTypeKind.INTERFACE && Modifier.SEALED in primaryType.modifiers)
    if (!validKind) {
        reasons += "${context.path} :: input files must declare a record, enum, or sealed interface"
    }
    if (sourceFile.parsedSource.topLevelTypes.size != 1) {
        reasons += "${context.path} :: input files must contain exactly one top-level type"
    }
    context.typeImports.importedPackages.forEach { importedPackage ->
        if (support.roleForDirectoryName(importedPackage.substringAfterLast('.')) != support.inputRole) {
            reasons += "${context.path} -> $importedPackage :: input files may import only other input packages from project code"
        }
    }
    return reasons
}
