#!/usr/bin/env python3
"""libei sender on the disposable compositor's private bus, never the host bus.
KWin: https://github.com/KDE/kwin/blob/master/src/plugins/eis/eisbackend.cpp
API: https://libinput.pages.freedesktop.org/libei/api/group__libei-sender.html
"""
import ctypes as C
import json
import os
import select
import sys
import time
import gi
from gi.repository import Gio, GLib
assert os.environ.get('TW_VIRTUAL_SESSION') == '1', 'EIS injection is restricted to the owned virtual session'
assert os.environ['XDG_RUNTIME_DIR'].startswith('/tmp/saltmarcher-tw02-')
lib = C.CDLL('libei.so.1')
P = C.c_void_p

def api(name, result, *args):
    f = getattr(lib, name)
    f.restype = result
    f.argtypes = args
    return f

new = api('ei_new_sender', P, P)
configure = api('ei_configure_name', None, P, C.c_char_p)
setup = api('ei_setup_backend_fd', C.c_int, P, C.c_int)
get_fd = api('ei_get_fd', C.c_int, P)
dispatch = api('ei_dispatch', C.c_int, P)
get_event = api('ei_get_event', P, P)
event_type = api('ei_event_get_type', C.c_int, P)
type_name = api('ei_event_type_to_string', C.c_char_p, C.c_int)
get_seat = api('ei_event_get_seat', P, P)
bind = api('ei_seat_bind_capabilities', None, P)  # varargs, terminated by zero
get_device = api('ei_event_get_device', P, P)
has_cap = api('ei_device_has_capability', C.c_bool, P, C.c_int)
ref = api('ei_device_ref', P, P)
unref_device = api('ei_device_unref', P, P)
unref_event = api('ei_event_unref', P, P)
start = api('ei_device_start_emulating', None, P, C.c_uint32)
stop = api('ei_device_stop_emulating', None, P)
key = api('ei_device_keyboard_key', None, P, C.c_uint32, C.c_bool)
frame = api('ei_device_frame', None, P, C.c_uint64)
unref = api('ei_unref', P, P)
bus = Gio.bus_get_sync(Gio.BusType.SESSION, None)
reply, fds = bus.call_with_unix_fd_list_sync('org.kde.KWin', '/org/kde/KWin/EIS/RemoteDesktop', 'org.kde.KWin.EIS.RemoteDesktop', 'connectToEIS', GLib.Variant('(i)', (1,)), GLib.VariantType.new('(hi)'), Gio.DBusCallFlags.NONE, 5000, None, None)
index, cookie = reply.unpack()
ctx = new(None)
configure(ctx, b'SaltMarcher TW02 isolated keyboard')
assert setup(ctx, fds.get(index)) == 0
fd = get_fd(ctx)
device = None
ready = False
held = set()
trace = []

def pump():
    global device, ready
    dispatch(ctx)
    while True:
        e = get_event(ctx)
        if not e:
            break
        name = type_name(event_type(e)).decode()
        trace.append(name)
        if 'SEAT_ADDED' in name.upper():
            bind(get_seat(e), C.c_int(1 << 2), C.c_int(0))
        if 'DEVICE_ADDED' in name.upper():
            d = get_device(e)
            if has_cap(d, 1 << 2):
                device = ref(d)
        if 'DEVICE_RESUMED' in name.upper() and get_device(e) == device:
            start(device, 1)
            ready = True
        unref_event(e)

try:
    deadline = time.monotonic() + 5
    while not ready and time.monotonic() < deadline:
        select.select([fd], [], [], .05)
        pump()
    assert ready, 'No EIS keyboard device resumed: ' + str(trace)
    print(json.dumps({'ready': True, 'method': 'KWin EIS -> Wayland wl_keyboard -> Chromium trusted events', 'cookie': cookie, 'events': trace}), flush=True)
    while True:
        readable, _, _ = select.select([fd, sys.stdin], [], [], 5)
        if fd in readable:
            pump()
        if sys.stdin in readable:
            line = sys.stdin.readline()
            if not line:
                break
            action = json.loads(line)
            if action.get('close'):
                break
            code, down = int(action['code']), bool(action['down'])
            key(device, code, down)
            (held.add if down else held.discard)(code)
            frame(device, time.monotonic_ns() // 1000)
            dispatch(ctx)
            print(json.dumps({'id': action['id'], 'sent': action}), flush=True)
finally:
    if device:
        for code in held:
            key(device, code, False)
        frame(device, time.monotonic_ns() // 1000)
        stop(device)
        dispatch(ctx)
        unref_device(device)
    unref(ctx)
    bus.call_sync('org.kde.KWin', '/org/kde/KWin/EIS/RemoteDesktop', 'org.kde.KWin.EIS.RemoteDesktop', 'disconnect', GLib.Variant('(i)', (cookie,)), None, Gio.DBusCallFlags.NONE, 5000, None)
