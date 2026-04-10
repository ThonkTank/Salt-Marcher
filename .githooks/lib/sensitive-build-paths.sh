#!/usr/bin/env bash

sm_is_sensitive_build_path() {
    local path="${1#./}"

    case "$path" in
        build.gradle.kts|settings.gradle.kts|gradle.properties|gradlew|gradlew.bat|CODEOWNERS)
            return 0
            ;;
    esac

    if [[ "$path" == gradle/* || "$path" == buildSrc/* ]]; then
        return 0
    fi

    return 1
}
