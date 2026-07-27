#define _POSIX_C_SOURCE 200809L
/* SPDX-License-Identifier: MIT */

#include <errno.h>
#include <fcntl.h>
#include <limits.h>
#include <poll.h>
#include <signal.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/file.h>
#include <sys/prctl.h>
#include <sys/stat.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <time.h>
#include <unistd.h>

enum {
    DEFER_EXIT = 75,
    TIMEOUT_EXIT = 124,
    USAGE_EXIT = 64,
    MAX_LOCK_TIMEOUT_SECONDS = 900
};

struct locks {
    int directory;
    int intent;
    int host;
};

struct controller_message {
    char kind;
    int value;
};

static int audit_fd = -1;
static pid_t command_pid = 0;
static pid_t watchdog_pid = 0;

static void fail(const char *message)
{
    fprintf(stderr, "host-lease-native: %s: %s\n", message, strerror(errno));
    exit(USAGE_EXIT);
}

static void reject(const char *message)
{
    fprintf(stderr, "host-lease-native: %s\n", message);
    exit(USAGE_EXIT);
}

static double monotonic_seconds(void)
{
    struct timespec value;
    if (clock_gettime(CLOCK_MONOTONIC, &value) != 0) {
        fail("cannot read monotonic clock");
    }
    return (double)value.tv_sec + (double)value.tv_nsec / 1000000000.0;
}

static void audit_event(const char *event)
{
    char line[256];
    int length;
    ssize_t written;

    if (audit_fd < 0) {
        return;
    }
    length = snprintf(line, sizeof(line), "%.9f|%s|%ld|%ld|%ld\n",
                      monotonic_seconds(), event, (long)getpid(),
                      (long)command_pid, (long)watchdog_pid);
    if (length <= 0 || (size_t)length >= sizeof(line)) {
        reject("audit line overflow");
    }
    do {
        written = write(audit_fd, line, (size_t)length);
    } while (written < 0 && errno == EINTR);
    if (written != length) {
        fail("cannot append audit event");
    }
}

static bool path_is_clean_absolute(const char *path)
{
    size_t length = strlen(path);
    if (length == 0 || length >= PATH_MAX || path[0] != '/') {
        return false;
    }
    if (length > 1 && path[length - 1] == '/') {
        return false;
    }
    if (strstr(path, "//") != NULL || strstr(path, "/./") != NULL ||
        strstr(path, "/../") != NULL) {
        return false;
    }
    if (length >= 2 && strcmp(path + length - 2, "/.") == 0) {
        return false;
    }
    if (length >= 3 && strcmp(path + length - 3, "/..") == 0) {
        return false;
    }
    return true;
}

static void validate_directory(int fd)
{
    struct stat status;
    if (fstat(fd, &status) != 0) {
        fail("cannot inspect lock directory descriptor");
    }
    if (!S_ISDIR(status.st_mode) || status.st_uid != geteuid() ||
        (status.st_mode & 07777) != 0700 || status.st_nlink < 2) {
        reject("lock directory must be an owned real 0700 directory");
    }
}

static int open_lock_file(int directory, const char *name)
{
    struct stat opened;
    struct stat named;
    int fd = openat(directory, name,
                    O_RDWR | O_CREAT | O_NOFOLLOW | O_CLOEXEC, 0600);
    if (fd < 0) {
        fail("cannot open stable lock file");
    }
    if (fstat(fd, &opened) != 0 ||
        fstatat(directory, name, &named, AT_SYMLINK_NOFOLLOW) != 0) {
        close(fd);
        fail("cannot inspect stable lock file");
    }
    if (!S_ISREG(opened.st_mode) || opened.st_uid != geteuid() ||
        (opened.st_mode & 07777) != 0600 || opened.st_nlink != 1 ||
        !S_ISREG(named.st_mode) || opened.st_dev != named.st_dev ||
        opened.st_ino != named.st_ino) {
        close(fd);
        reject("lock must be an owned, singly linked, real 0600 regular file");
    }
    return fd;
}

static struct locks open_locks(void)
{
    char default_path[PATH_MAX];
    const char *base = getenv("ALETHEIA_HOST_LEASE_DIR");
    struct locks result = {-1, -1, -1};
    struct stat path_status;

    umask(0077);
    if (base == NULL || base[0] == '\0') {
        int length = snprintf(default_path, sizeof(default_path),
                              "/tmp/saltmarcher-aletheia-host-lease-%lu",
                              (unsigned long)geteuid());
        if (length <= 0 || (size_t)length >= sizeof(default_path)) {
            reject("default lock path overflow");
        }
        base = default_path;
    }
    if (!path_is_clean_absolute(base)) {
        reject("lock directory must be a clean absolute path without traversal");
    }
    if (lstat(base, &path_status) != 0) {
        if (errno != ENOENT || mkdir(base, 0700) != 0) {
            fail("cannot create lock directory");
        }
    } else if (S_ISLNK(path_status.st_mode)) {
        reject("lock directory must not be a symlink");
    }
    result.directory = open(base, O_RDONLY | O_DIRECTORY | O_NOFOLLOW | O_CLOEXEC);
    if (result.directory < 0) {
        fail("cannot securely open lock directory");
    }
    validate_directory(result.directory);
    result.intent = open_lock_file(result.directory, "intent");
    result.host = open_lock_file(result.directory, "host");
    return result;
}

static double parse_positive(const char *text, const char *label, double maximum)
{
    char *end = NULL;
    double value;
    errno = 0;
    value = strtod(text, &end);
    if (errno != 0 || end == text || *end != '\0' || !(value > 0.0) ||
        value > maximum) {
        fprintf(stderr, "host-lease-native: %s must be positive and <= %.0f\n",
                label, maximum);
        exit(USAGE_EXIT);
    }
    return value;
}

static int try_lock(int fd)
{
    for (;;) {
        if (flock(fd, LOCK_EX | LOCK_NB) == 0) {
            return 0;
        }
        if (errno == EINTR) {
            continue;
        }
        if (errno == EWOULDBLOCK || errno == EAGAIN) {
            return DEFER_EXIT;
        }
        return USAGE_EXIT;
    }
}

static int timed_lock(int fd, double timeout)
{
    const double deadline = monotonic_seconds() + timeout;
    const struct timespec pause = {0, 1000000};
    int result;
    do {
        result = try_lock(fd);
        if (result != DEFER_EXIT) {
            return result;
        }
        if (monotonic_seconds() >= deadline) {
            return DEFER_EXIT;
        }
        while (nanosleep(&pause, NULL) != 0 && errno == EINTR) {
        }
    } while (true);
}

static bool group_alive(pid_t group)
{
    if (kill(-group, 0) == 0) {
        return true;
    }
    return errno == EPERM;
}

static bool wait_group_gone(pid_t group, double timeout)
{
    const double deadline = monotonic_seconds() + timeout;
    const struct timespec pause = {0, 5000000};

    while (group_alive(group) && monotonic_seconds() < deadline) {
        while (waitpid(-1, NULL, WNOHANG) > 0) {
        }
        while (nanosleep(&pause, NULL) != 0 && errno == EINTR) {
        }
    }
    while (waitpid(-1, NULL, WNOHANG) > 0) {
    }
    return !group_alive(group);
}

static bool terminate_group(pid_t group)
{
    (void)kill(-group, SIGTERM);
    if (wait_group_gone(group, 1.0)) {
        return true;
    }
    (void)kill(-group, SIGKILL);
    return wait_group_gone(group, 4.0);
}

static void send_message(int fd, char kind, int value)
{
    struct controller_message message = {kind, value};
    ssize_t count;
    do {
        count = write(fd, &message, sizeof(message));
    } while (count < 0 && errno == EINTR);
    if (count != (ssize_t)sizeof(message)) {
        _exit(USAGE_EXIT);
    }
}

static int read_message(int fd, struct controller_message *message)
{
    ssize_t count;
    do {
        count = read(fd, message, sizeof(*message));
    } while (count < 0 && errno == EINTR);
    if (count == 0) {
        return 0;
    }
    return count == (ssize_t)sizeof(*message) ? 1 : -1;
}

static int child_result(int status);

static void reap_command(pid_t pid, int *status)
{
    while (waitpid(pid, status, 0) < 0) {
        if (errno != EINTR && errno != ECHILD) {
            _exit(USAGE_EXIT);
        }
        if (errno == ECHILD) {
            break;
        }
    }
    while (waitpid(-1, NULL, WNOHANG) > 0) {
    }
}

static int watchdog_main(int liveness_read, int result_write,
                         struct locks *locks, double timeout, char **command)
{
    struct pollfd descriptor = {liveness_read, POLLIN | POLLHUP, 0};
    const double deadline = monotonic_seconds() + timeout;
    int command_status = 0;
    int gate[2];
    const struct timespec pause = {0, 5000000};

    if (prctl(PR_SET_CHILD_SUBREAPER, 1, 0, 0, 0) != 0) {
        return USAGE_EXIT;
    }
    if (pipe(gate) != 0) {
        return USAGE_EXIT;
    }
    command_pid = fork();
    if (command_pid < 0) {
        return USAGE_EXIT;
    }
    if (command_pid == 0) {
        char start;
        ssize_t count;
        close(gate[1]);
        close(liveness_read);
        close(result_write);
        if (locks->directory >= 0) {
            close(locks->directory);
        }
        if (locks->intent >= 0) {
            close(locks->intent);
        }
        if (locks->host >= 0) {
            close(locks->host);
        }
        if (audit_fd >= 0) {
            close(audit_fd);
        }
        do {
            count = read(gate[0], &start, 1);
        } while (count < 0 && errno == EINTR);
        close(gate[0]);
        if (count != 1 || start != 'G' || setpgid(0, 0) != 0) {
            _exit(USAGE_EXIT);
        }
        execvp(command[0], command);
        _exit(127);
    }
    close(gate[0]);
    send_message(result_write, 'P', (int)command_pid);
    {
        char acknowledged;
        ssize_t count;
        do {
            count = read(liveness_read, &acknowledged, 1);
        } while (count < 0 && errno == EINTR);
        if (count != 1 || acknowledged != 'A') {
            (void)kill(command_pid, SIGKILL);
            close(gate[1]);
            reap_command(command_pid, &command_status);
            return count == 0 ? 0 : USAGE_EXIT;
        }
    }
    if (write(gate[1], "G", 1) != 1) {
        (void)kill(command_pid, SIGKILL);
        close(gate[1]);
        reap_command(command_pid, &command_status);
        return USAGE_EXIT;
    }
    close(gate[1]);
    if (setpgid(command_pid, command_pid) != 0 && errno != EACCES && errno != ESRCH) {
        (void)kill(command_pid, SIGKILL);
        reap_command(command_pid, &command_status);
        return USAGE_EXIT;
    }

    for (;;) {
        pid_t waited = waitpid(command_pid, &command_status, WNOHANG);
        double remaining;
        int wait_ms;
        int polled;
        char byte;
        ssize_t count;

        if (waited == command_pid) {
            if (group_alive(command_pid) && !terminate_group(command_pid)) {
                send_message(result_write, 'R', USAGE_EXIT);
                return USAGE_EXIT;
            }
            send_message(result_write, 'R', child_result(command_status));
            return 0;
        }
        if (waited < 0 && errno != EINTR) {
            send_message(result_write, 'R', USAGE_EXIT);
            return USAGE_EXIT;
        }
        remaining = deadline - monotonic_seconds();
        if (remaining <= 0.0) {
            int result = terminate_group(command_pid) ? TIMEOUT_EXIT : USAGE_EXIT;
            reap_command(command_pid, &command_status);
            send_message(result_write, 'R', result);
            return result;
        }
        wait_ms = (int)(remaining * 1000.0);
        if (wait_ms > 5) {
            wait_ms = 5;
        } else if (wait_ms < 1) {
            wait_ms = 1;
        }
        polled = poll(&descriptor, 1, wait_ms);
        if (polled < 0) {
            if (errno == EINTR) {
                continue;
            }
            (void)terminate_group(command_pid);
            reap_command(command_pid, &command_status);
            return USAGE_EXIT;
        }
        if (polled == 0) {
            while (nanosleep(&pause, NULL) != 0 && errno == EINTR) {
            }
            continue;
        }
        do {
            count = read(liveness_read, &byte, 1);
        } while (count < 0 && errno == EINTR);
        if (count == 0) {
            int result = terminate_group(command_pid) ? 0 : USAGE_EXIT;
            reap_command(command_pid, &command_status);
            return result;
        }
        (void)terminate_group(command_pid);
        reap_command(command_pid, &command_status);
        return USAGE_EXIT;
    }
}

static int child_result(int status)
{
    if (WIFEXITED(status)) {
        return WEXITSTATUS(status);
    }
    if (WIFSIGNALED(status)) {
        return 128 + WTERMSIG(status);
    }
    return USAGE_EXIT;
}

static void set_close_on_exec(int fd)
{
    int flags = fcntl(fd, F_GETFD);
    if (flags < 0 || fcntl(fd, F_SETFD, flags | FD_CLOEXEC) != 0) {
        fail("cannot make liveness descriptor close-on-exec");
    }
}

static int run_bounded(struct locks *locks, double timeout, char **command)
{
    int liveness[2];
    int results[2];
    int watchdog_status = 0;
    int command_result = USAGE_EXIT;
    bool received_pid = false;
    bool received_result = false;
    struct controller_message message;
    struct pollfd descriptor;

    if (prctl(PR_SET_CHILD_SUBREAPER, 1, 0, 0, 0) != 0) {
        fail("cannot become command subreaper");
    }
    if (pipe(liveness) != 0 || pipe(results) != 0) {
        fail("cannot create private controller pipes");
    }
    set_close_on_exec(liveness[0]);
    set_close_on_exec(liveness[1]);
    set_close_on_exec(results[0]);
    set_close_on_exec(results[1]);

    watchdog_pid = fork();
    if (watchdog_pid < 0) {
        fail("cannot fork watchdog");
    }
    if (watchdog_pid == 0) {
        int result;
        (void)setpgid(0, 0);
        close(liveness[1]);
        close(results[0]);
        close(locks->directory);
        locks->directory = -1;
        if (audit_fd >= 0) {
            close(audit_fd);
            audit_fd = -1;
        }
        /*
         * Keep the applicable lock descriptors inherited from the supervisor.
         * They refer to the same locked open-file descriptions.  A retains
         * intent+host; admitted non-A has already closed intent and retains
         * host.  The command inherited neither.
         */
        result = watchdog_main(liveness[0], results[1], locks, timeout, command);
        close(liveness[0]);
        close(results[1]);
        if (locks->intent >= 0) {
            close(locks->intent);
        }
        if (locks->host >= 0) {
            close(locks->host);
        }
        _exit(result);
    }
    if (setpgid(watchdog_pid, watchdog_pid) != 0 && errno != EACCES && errno != ESRCH) {
        (void)kill(watchdog_pid, SIGKILL);
        (void)waitpid(watchdog_pid, NULL, 0);
        fail("cannot isolate watchdog process group");
    }
    close(liveness[0]);
    close(results[1]);
    descriptor.fd = results[0];
    descriptor.events = POLLIN | POLLHUP;
    while (!received_result) {
        int polled = poll(&descriptor, 1, 10);
        pid_t waited;
        if (polled < 0 && errno != EINTR) {
            fail("cannot monitor watchdog result");
        }
        if (polled > 0) {
            int read_result = read_message(results[0], &message);
            if (read_result == 1 && message.kind == 'P' && !received_pid) {
                command_pid = (pid_t)message.value;
                received_pid = true;
                audit_event("command_started");
                if (write(liveness[1], "A", 1) != 1) {
                    (void)kill(-watchdog_pid, SIGKILL);
                    (void)kill(command_pid, SIGKILL);
                    return USAGE_EXIT;
                }
                continue;
            }
            if (read_result == 1 && message.kind == 'R' && received_pid) {
                command_result = message.value;
                received_result = true;
                break;
            }
            if (read_result < 0) {
                break;
            }
        }
        waited = waitpid(watchdog_pid, &watchdog_status, WNOHANG);
        if (waited == watchdog_pid) {
            (void)kill(-watchdog_pid, SIGKILL);
            if (received_pid) {
                (void)terminate_group(command_pid);
            }
            while (waitpid(-1, NULL, WNOHANG) > 0) {
            }
            close(liveness[1]);
            close(results[0]);
            audit_event("watchdog_lost");
            return USAGE_EXIT;
        }
        if (waited < 0 && errno != EINTR) {
            fail("cannot inspect watchdog");
        }
    }
    close(liveness[1]);
    close(results[0]);
    while (waitpid(watchdog_pid, &watchdog_status, 0) < 0) {
        if (errno != EINTR) {
            fail("cannot reap watchdog");
        }
    }
    audit_event("command_finished");
    if (!received_result || !WIFEXITED(watchdog_status)) {
        return USAGE_EXIT;
    }
    return command_result;
}

static void open_audit(void)
{
    const char *path = getenv("ALETHEIA_HOST_LEASE_AUDIT_LOG");
    if (path == NULL || path[0] == '\0') {
        return;
    }
    audit_fd = open(path, O_WRONLY | O_APPEND | O_CREAT | O_CLOEXEC | O_NOFOLLOW, 0600);
    if (audit_fd < 0) {
        fail("cannot open audit log");
    }
}

int main(int argc, char **argv)
{
    bool role_a;
    double timeout = 900.0;
    double lock_timeout = 900.0;
    int command_index = -1;
    int index;
    int result;
    struct locks locks;

    if (signal(SIGPIPE, SIG_IGN) == SIG_ERR) {
        fail("cannot ignore SIGPIPE");
    }
    if (argc < 4 || (strcmp(argv[1], "a") != 0 && strcmp(argv[1], "non-a") != 0)) {
        reject("usage: host-lease-native {a|non-a} [--timeout s] [--lock-timeout s] -- command [args]");
    }
    role_a = strcmp(argv[1], "a") == 0;
    for (index = 2; index < argc; ++index) {
        if (strcmp(argv[index], "--") == 0) {
            command_index = index + 1;
            break;
        }
        if (strcmp(argv[index], "--timeout") == 0 && index + 1 < argc) {
            timeout = parse_positive(argv[++index], "command timeout",
                                     role_a ? (double)INT_MAX : 900.0);
            continue;
        }
        if (strcmp(argv[index], "--lock-timeout") == 0 && index + 1 < argc) {
            lock_timeout = parse_positive(argv[++index], "lock timeout",
                                          MAX_LOCK_TIMEOUT_SECONDS);
            continue;
        }
        reject("unknown or incomplete option");
    }
    if (command_index < 0 || command_index >= argc) {
        reject("a command is required after --");
    }

    open_audit();
    locks = open_locks();
    if (role_a) {
        audit_event("a_wait_intent");
        result = timed_lock(locks.intent, lock_timeout);
        if (result != 0) {
            return result;
        }
        audit_event("a_intent");
        result = timed_lock(locks.host, lock_timeout);
        if (result != 0) {
            return result;
        }
        audit_event("a_host");
        result = run_bounded(&locks, timeout, &argv[command_index]);
        close(locks.host);
        close(locks.intent);
        audit_event("a_release");
    } else {
        result = try_lock(locks.intent);
        if (result != 0) {
            return result;
        }
        if (flock(locks.intent, LOCK_UN) != 0) {
            fail("cannot release intent probe");
        }
        audit_event("non_a_wait_host");
        result = timed_lock(locks.host, lock_timeout);
        if (result != 0) {
            return result;
        }
        result = try_lock(locks.intent);
        if (result != 0) {
            audit_event("non_a_yield");
            close(locks.host);
            return result;
        }
        if (flock(locks.intent, LOCK_UN) != 0) {
            fail("cannot release intent recheck");
        }
        close(locks.intent);
        locks.intent = -1;
        audit_event("non_a_admitted");
        result = run_bounded(&locks, timeout, &argv[command_index]);
        close(locks.host);
        audit_event("non_a_release");
    }
    close(locks.directory);
    if (audit_fd >= 0) {
        close(audit_fd);
    }
    return result;
}
