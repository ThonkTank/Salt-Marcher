import java.io.File
import org.gradle.api.tasks.SourceSetContainer
import org.gradle.jvm.tasks.Jar
import org.gradle.kotlin.dsl.named
import org.gradle.kotlin.dsl.the

plugins {
    `java-library`
}

group = "saltmarcher.quality"
version = "1.0-SNAPSHOT"

repositories {
    mavenCentral()
}

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}

val repoRootDir = System.getProperty("saltmarcher.repoRootDir")
    ?.let(::File)
    ?: projectDir.parentFile.parentFile.parentFile.parentFile

val sourceSets = the<SourceSetContainer>()
sourceSets.named("main") {
    java.setSrcDirs(
        listOf(layout.projectDirectory.dir("src/main/java").asFile.absolutePath) +
            repoRootDir.resolve("tools/quality")
                .walkTopDown()
                .filter { file ->
                    file.isDirectory &&
                        file.relativeTo(repoRootDir).path.replace(File.separatorChar, '/').endsWith("/pmd/src/main/java")
                }
                .map(File::getAbsolutePath)
                .toList()
    )
}

dependencies {
    implementation("net.sourceforge.pmd:pmd-java:7.23.0")
}

tasks.named<Jar>("jar") {
    isPreserveFileTimestamps = false
    isReproducibleFileOrder = true
}
