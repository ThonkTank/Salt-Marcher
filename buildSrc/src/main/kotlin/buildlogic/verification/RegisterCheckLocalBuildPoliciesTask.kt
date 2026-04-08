package buildlogic.verification

import org.gradle.api.Project
import org.gradle.api.Task
import org.gradle.api.tasks.TaskProvider

fun Project.registerCheckLocalBuildPoliciesTask(
    checkUiAsyncSubmissionConvention: TaskProvider<out Task>
): TaskProvider<Task> = tasks.register("checkLocalBuildPolicies") {
    group = "verification"
    description = "Run project-local policy checks that are intentional API-usage rules rather than global architecture."
    dependsOn(checkUiAsyncSubmissionConvention)
}
