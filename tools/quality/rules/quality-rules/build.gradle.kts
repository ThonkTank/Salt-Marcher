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

apply(from = "../../view-contribution-enforcement/pmd-host.gradle.kts")

dependencies {
    implementation("net.sourceforge.pmd:pmd-java:7.23.0")
}
