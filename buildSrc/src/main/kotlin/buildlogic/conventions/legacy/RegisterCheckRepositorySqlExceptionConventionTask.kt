package buildlogic.conventions.legacy

import org.gradle.api.GradleException
import org.gradle.api.Project
import org.gradle.api.Task
import org.gradle.api.tasks.TaskProvider

fun Project.registerCheckRepositorySqlExceptionConventionTask(): TaskProvider<Task> =
    tasks.register("checkRepositorySqlExceptionConvention") {
        group = "verification"
        description = "Legacy guard for SQLException-swallowing patterns in legacy feature repository packages."
        val sqlCatchPattern = Regex("""catch\s*\(\s*SQLException\b""")
        val sqlSwallowPattern = Regex(
            """catch\s*\(\s*SQLException\b[\s\S]*?(?:System\.(?:out|err)\.println\(|return\s+(?:Optional\.empty\(\)|0L|false|null)\s*;)[\s\S]*?\}"""
        )
        val projectRoot = layout.projectDirectory.asFile.toPath()

        doLast {
            val offenders = fileTree("src/features") {
                include("**/repository/*Repository.java")
            }.files
                .map { projectRoot.relativize(it.toPath()).toString().replace('\\', '/') }
                .filter { path ->
                    val content = file(path).readText()
                    sqlCatchPattern.containsMatchIn(content) && sqlSwallowPattern.containsMatchIn(content)
                }
                .sorted()

            if (offenders.isNotEmpty()) {
                val details = offenders.joinToString(separator = "\n") { " - $it" }
                throw GradleException(
                    "Repository SQL contract drift detected.\n" +
                        "Repositories should propagate SQLException and let service/application layers decide fallback behavior.\n" +
                        "Offending files:\n$details"
                )
            }
        }
    }
