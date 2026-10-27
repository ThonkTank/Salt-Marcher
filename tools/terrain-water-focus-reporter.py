#!/usr/bin/env python3
"""One-shot private DBus response from the temporary terrain KWin script."""
import json
import pathlib
import sys

import dbus
import dbus.service
from dbus.mainloop.glib import DBusGMainLoop
from gi.repository import GLib

DBusGMainLoop(set_as_default=True)
loop = GLib.MainLoop()
bus = dbus.SessionBus()
name = dbus.service.BusName(sys.argv[1], bus)
destination = pathlib.Path(sys.argv[2])


class Reporter(dbus.service.Object):
    @dbus.service.method("org.saltmarcher.TerrainProbe", in_signature="s", out_signature="")
    def Report(self, payload):
        destination.write_text(json.dumps(json.loads(str(payload)), indent=2) + "\n")
        # Let the method reply flush before the one-shot reporter exits.
        GLib.timeout_add(500, loop.quit)


reporter = Reporter(bus, "/Probe")
print("ready", flush=True)
GLib.timeout_add_seconds(10, loop.quit)
loop.run()
