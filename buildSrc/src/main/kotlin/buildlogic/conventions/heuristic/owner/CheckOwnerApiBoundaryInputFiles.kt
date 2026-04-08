package buildlogic.conventions.heuristic.owner

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
    support.inputFileReasons(sourceFile.context, sourceFile.sourceText, snapshot.requestStemsByOwner)
}
