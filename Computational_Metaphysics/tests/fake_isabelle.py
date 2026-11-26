"""In-process fake of the Isabelle server wire protocol (for offline tests)."""
from __future__ import annotations

import json
import socket
import threading
from typing import Callable

from mcp_server.isabelle_client import ServerInfo

Responder = Callable[[str, dict], tuple[str, object, list]]


class FakeIsabelleServer:
    """Speaks the framing/auth/task protocol. ``responder(cmd, arg)`` returns
    (final_head, final_payload, notes); for synchronous commands notes is None."""

    def __init__(self, responder: Responder, password: str = "secret", long_replies: bool = False):
        self.responder = responder
        self.password = password
        self.long_replies = long_replies
        self.received: list[str] = []
        self.sock = socket.socket()
        self.sock.bind(("127.0.0.1", 0))
        self.sock.listen(1)
        self.info = ServerInfo("fake", "127.0.0.1", self.sock.getsockname()[1], password)
        self._task = 0
        threading.Thread(target=self._serve, daemon=True).start()

    def _send(self, conn, msg: str) -> None:
        data = msg.encode()
        if self.long_replies or b"\n" in data:
            conn.sendall(str(len(data)).encode() + b"\n" + data)
        else:
            conn.sendall(data + b"\n")

    def _serve(self) -> None:
        conn, _ = self.sock.accept()
        f = conn.makefile("rb")

        def read() -> str | None:
            line = f.readline()
            if not line:
                return None
            line = line.rstrip(b"\n")
            if line.isdigit():
                return f.read(int(line)).decode()
            return line.decode()

        if read() != self.password:
            self._send(conn, 'ERROR "Bad password"')
            conn.close()
            return
        self._send(conn, 'OK {"isabelle_id":"fake","isabelle_name":"Isabelle2025"}')
        while (msg := read()) is not None:
            self.received.append(msg)
            name, _, rest = msg.partition(" ")
            arg = json.loads(rest) if rest else {}
            head, payload, notes = self.responder(name, arg)
            if notes is None:
                self._send(conn, f"{head} {json.dumps(payload)}")
                continue
            self._task += 1
            tid = f"t{self._task}"
            self._send(conn, f'OK {json.dumps({"task": tid})}')
            for n in notes:
                self._send(conn, f"NOTE {json.dumps({**n, 'task': tid})}")
            self._send(conn, f"{head} {json.dumps({**payload, 'task': tid})}")
        conn.close()
