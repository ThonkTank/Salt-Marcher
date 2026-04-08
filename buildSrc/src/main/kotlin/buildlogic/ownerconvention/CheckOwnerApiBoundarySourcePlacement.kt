package buildlogic.ownerconvention

import org.gradle.api.Project
import org.gradle.api.Task
import org.gradle.api.tasks.TaskProvider

fun Project.registerCheckOwnerApiBoundarySourcePlacementTask(
    support: OwnerConventionSupport
): TaskProvider<Task> = support.registerCheck(
    taskName = "checkOwnerApiBoundarySourcePlacement",
    taskDescription = "Fail when touched owner-boundary files drift away from the canonical package and bucket placement grammar.",
    failureHeader = "Owner source placement drift detected.",
    failureSummary = "Touched files must keep package declarations aligned with the filesystem grammar, and *Bucket directories must remain Java-free."
) { sourceFile, _ ->
    support.sourcePlacementReasons(sourceFile)
}
