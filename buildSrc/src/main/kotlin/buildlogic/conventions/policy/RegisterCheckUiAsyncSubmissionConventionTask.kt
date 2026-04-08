package buildlogic.conventions.policy

import org.gradle.api.GradleException
import org.gradle.api.Project
import org.gradle.api.Task
import org.gradle.api.tasks.TaskProvider

fun Project.registerCheckUiAsyncSubmissionConventionTask(): TaskProvider<Task> =
    tasks.register("checkUiAsyncSubmissionConvention") {
        group = "verification"
        description = "Fail when UI code bypasses UiAsyncTasks and calls UiAsyncExecutor.submit directly."
        val directExecutorPattern = Regex("""\bUiAsyncExecutor\.submit\(""")
        val projectRoot = layout.projectDirectory.asFile.toPath()

        doLast {
            val offenders = fileTree("src") {
                include("**/*.java")
                exclude("ui/async/**")
            }.files
                .map { projectRoot.relativize(it.toPath()).toString().replace('\\', '/') }
                .filter { path -> directExecutorPattern.containsMatchIn(file(path).readText()) }
                .sorted()

            if (offenders.isNotEmpty()) {
                val details = offenders.joinToString(separator = "\n") { " - $it" }
                throw GradleException(
                    "UI async submission convention drift detected.\n" +
                        "Use UiAsyncTasks.submit(...) as the public entrypoint; keep UiAsyncExecutor.submit(...) internal to ui.async.\n" +
                        "Offending files:\n$details"
                )
            }
        }
    }
