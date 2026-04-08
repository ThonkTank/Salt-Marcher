package buildlogic.conventions.heuristic.owner

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
    support.stateFileReasons(sourceFile.context, sourceFile.sourceText, snapshot.knownTypeNames)
}
