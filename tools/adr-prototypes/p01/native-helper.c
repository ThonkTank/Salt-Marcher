#define _GNU_SOURCE
#include <errno.h>
#include <fcntl.h>
#include <linux/openat2.h>
#include <linux/fs.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/stat.h>
#include <sys/syscall.h>
#include <unistd.h>

static int rootfd = -1;

static int safe_name(const char *name) {
  return name && *name && strlen(name) < 240 && !strstr(name, "..") && !strchr(name, '/');
}

static int open_beneath(const char *name, int flags, mode_t mode) {
  struct open_how how = { .flags = flags | O_NOFOLLOW | O_CLOEXEC, .mode = mode,
    .resolve = RESOLVE_BENEATH | RESOLVE_NO_SYMLINKS };
  return syscall(SYS_openat2, rootfd, name, &how, sizeof(how));
}

static int same_regular_fd(int fd) {
  struct stat st;
  return fstat(fd, &st) == 0 && S_ISREG(st.st_mode) && st.st_nlink == 1;
}

static void fail(const char *code) { printf("ERR %s %d\n", code, errno); fflush(stdout); }

static void do_write(const char *name, const char *value) {
  if (!safe_name(name) || !value) { errno = EINVAL; fail("input"); return; }
  char temp[300];
  snprintf(temp, sizeof(temp), ".h02-%ld-%s", (long)getpid(), name);
  int fd = open_beneath(temp, O_WRONLY | O_CREAT | O_EXCL, 0600);
  if (fd < 0) { fail("temp-open"); return; }
  if (!same_regular_fd(fd) || write(fd, value, strlen(value)) != (ssize_t)strlen(value) || fdatasync(fd) != 0) {
    int saved = errno; close(fd); unlinkat(rootfd, temp, 0); errno = saved; fail("temp-sync"); return;
  }
  close(fd);
  if (renameat2(rootfd, temp, rootfd, name, RENAME_NOREPLACE) != 0) {
    int saved = errno; unlinkat(rootfd, temp, 0); errno = saved; fail("publish"); return;
  }
  if (fsync(rootfd) != 0) { fail("directory-sync"); return; }
  printf("OK write %s\n", name); fflush(stdout);
}

static void do_read(const char *name) {
  if (!safe_name(name)) { errno = EINVAL; fail("input"); return; }
  int fd = open_beneath(name, O_RDONLY, 0);
  if (fd < 0 || !same_regular_fd(fd)) { if (fd >= 0) close(fd); fail("read-open"); return; }
  char buffer[4097]; ssize_t size = read(fd, buffer, sizeof(buffer) - 1); close(fd);
  if (size < 0) { fail("read"); return; }
  buffer[size] = 0; printf("OK read %s %s\n", name, buffer); fflush(stdout);
}

int main(int argc, char **argv) {
  if (argc != 2) return 64;
  rootfd = open(argv[1], O_RDONLY | O_DIRECTORY | O_CLOEXEC | O_NOFOLLOW);
  if (rootfd < 0) return 65;
  char line[8192];
  while (fgets(line, sizeof(line), stdin)) {
    line[strcspn(line, "\r\n")] = 0;
    char *op = strtok(line, " "), *name = strtok(NULL, " "), *value = strtok(NULL, "");
    if (!op) continue;
    if (!strcmp(op, "WRITE")) do_write(name, value);
    else if (!strcmp(op, "READ")) do_read(name);
    else if (!strcmp(op, "QUIT")) break;
    else { errno = EINVAL; fail("operation"); }
  }
  close(rootfd); return 0;
}
