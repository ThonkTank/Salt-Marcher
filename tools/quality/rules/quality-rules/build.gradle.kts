import org.gradle.api.tasks.SourceSetContainer
import org.gradle.jvm.tasks.Jar
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

val sourceSets = the<SourceSetContainer>()
sourceSets["main"].java.setSrcDirs(listOf(layout.projectDirectory.dir("src/main/java").asFile.absolutePath))

dependencies {
    implementation("net.sourceforge.pmd:pmd-java:7.23.0")
}

tasks.named<Jar>("jar") {
    isPreserveFileTimestamps = false
    isReproducibleFileOrder = true
}
