package buildlogic.application

import org.gradle.api.Project
import org.gradle.api.tasks.JavaExec
import org.gradle.api.tasks.TaskProvider

fun Project.registerRebuildCreatureAnalysisTask(support: ApplicationTaskSupport): TaskProvider<JavaExec> =
    support.registerJavaExecTask(
        "rebuildCreatureAnalysis",
        "Rebuild persisted creature analysis for current analysis inputs and refresh the active party cache.",
        "importer.RebuildCreatureAnalysisTool"
    )
