pluginManagement {
    includeBuild("../SM/buildSrc") {
        name = "sm-buildlogic"
    }
}

plugins {
    id("org.gradle.toolchains.foojay-resolver-convention") version "1.0.0"
}

rootProject.name = "salt-marcher"
