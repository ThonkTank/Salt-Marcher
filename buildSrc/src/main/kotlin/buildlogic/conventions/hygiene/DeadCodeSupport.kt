package buildlogic.conventions.hygiene

import java.io.File
import org.gradle.api.GradleException
import org.gradle.api.Project
import org.gradle.api.tasks.SourceSetContainer

internal fun Project.mainJavaCompileClasspath(): Collection<File> {
    val sourceSets = extensions.findByType(SourceSetContainer::class.java) ?: return emptyList()
    return sourceSets.getByName("main").compileClasspath.files.sortedBy(File::getAbsolutePath)
}

internal fun Project.mainJavaSourceFiles(): List<File> {
    return fileTree("src") {
        include("**/*.java")
        exclude("**/package-info.java")
    }.files.sortedBy(File::getPath)
}

internal fun Project.touchedJavaPaths(): Set<String> {
    val projectDir = layout.projectDirectory.asFile
    val changed = linkedSetOf<String>()
    val currentBranch = gitStdout(projectDir, "branch", "--show-current")
    val committedDiffs = if (currentBranch == "main") {
        emptyList()
    } else {
        val mergeBase = gitStdout(projectDir, "merge-base", "HEAD", "origin/main")
        listOf(gitLines(projectDir, "diff", "--name-only", "--diff-filter=ACMR", "$mergeBase..HEAD", "--", "src"))
    }
    (committedDiffs + listOf(
        gitLines(projectDir, "diff", "--name-only", "--cached", "--diff-filter=ACMR", "--", "src"),
        gitLines(projectDir, "diff", "--name-only", "--diff-filter=ACMR", "--", "src"),
        gitLines(projectDir, "ls-files", "--others", "--exclude-standard", "--", "src")
    )).forEach { lines ->
        lines.asSequence()
            .filter { path -> path.endsWith(".java") }
            .forEach(changed::add)
    }
    return changed
}

private fun gitStdout(projectDir: File, vararg args: String): String {
    val process = ProcessBuilder(listOf("git", *args))
        .directory(projectDir)
        .redirectErrorStream(true)
        .start()
    val output = process.inputStream.bufferedReader().use { reader -> reader.readText() }
    val exitCode = process.waitFor()
    if (exitCode != 0) {
        throw GradleException("Git command failed (${args.joinToString(" ")}).\n$output")
    }
    return output.trim()
}

private fun gitLines(projectDir: File, vararg args: String): List<String> {
    return gitStdout(projectDir, *args)
        .lines()
        .map(String::trim)
        .filter(String::isNotBlank)
}
