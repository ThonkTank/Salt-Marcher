package buildlogic.application

import org.gradle.api.Project
import org.gradle.api.tasks.JavaExec
import org.gradle.api.tasks.TaskProvider

fun Project.registerApplyCreatureOverridesTask(support: ApplicationTaskSupport): TaskProvider<JavaExec> =
    support.registerJavaExecTask(
        "applyCreatureOverrides",
        "Apply versioned creature CR/XP overrides from data/creature_overrides.csv.",
        "importer.CreatureOverridesTool"
    )
