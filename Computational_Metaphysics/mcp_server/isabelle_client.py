"""Persistent client for the Isabelle server (``isabelle server``).

One JVM, one TCP connection and one PIDE session are kept alive for the
lifetime of the client, so individual checks avoid cold starts.

Wire protocol (Isabelle system manual, chapter "The Isabelle server"):

* a message is either a single line terminated by ``\\n`` or a *long message*:
  a line holding only a decimal byte count ``n`` followed by exactly ``n`` bytes;
* the client first sends the server password;
* commands are ``name json_argument``; replies are ``OK json`` / ``ERROR json``;
* asynchronous commands (``session_start``, ``use_theories``, ``session_stop``)
  reply ``OK {"task": id}``, then stream ``NOTE`` messages and finish with
  ``FINISHED json`` or ``FAILED json`` tagged with that task id.
"""
from __future__ import annotations

import json
import os
import re
import shutil
import socket
import subprocess
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

_SERVER_INFO_RE = re.compile(
    r'server "(?P<name>[^"]+)" = (?P<host>[\d.]+):(?P<port>\d+) \(password "(?P<password>[^"]+)"\)'
)


class IsabelleError(RuntimeError):
    """ERROR or FAILED reply from the server."""

    def __init__(self, message: str, payload: Any = None):
        super().__init__(message)
        self.payload = payload


@dataclass(frozen=True)
class ServerInfo:
    name: str
    host: str
    port: int
    password: str

    @classmethod
    def parse(cls, line: str) -> "ServerInfo":
        m = _SERVER_INFO_RE.search(line)
        if not m:
            raise IsabelleError(f"cannot parse server info line: {line!r}")
        return cls(m["name"], m["host"], int(m["port"]), m["password"])


@dataclass
class TaskResult:
    status: str                     # FINISHED | FAILED
    result: dict
    notes: list[dict] = field(default_factory=list)


def find_isabelle() -> str | None:
    """Locate the ``isabelle`` executable ($ISABELLE_EXE, then PATH)."""
    exe = os.environ.get("ISABELLE_EXE")
    if exe and Path(exe).exists():
        return exe
    return shutil.which("isabelle")


class Connection:
    """Framing layer over a TCP socket. Not thread-safe; see IsabelleClient."""

    def __init__(self, sock: socket.socket):
        self.sock = sock
        self._buf = b""

    # -- low level ---------------------------------------------------------
    def _read_line(self) -> bytes:
        while b"\n" not in self._buf:
            chunk = self.sock.recv(65536)
            if not chunk:
                raise ConnectionError("Isabelle server closed the connection")
            self._buf += chunk
        line, self._buf = self._buf.split(b"\n", 1)
        return line

    def _read_exact(self, n: int) -> bytes:
        while len(self._buf) < n:
            chunk = self.sock.recv(max(65536, n - len(self._buf)))
            if not chunk:
                raise ConnectionError("Isabelle server closed the connection")
            self._buf += chunk
        data, self._buf = self._buf[:n], self._buf[n:]
        return data

    def read_message(self) -> str:
        line = self._read_line()
        if line.strip().isdigit():
            return self._read_exact(int(line.strip())).decode("utf-8")
        return line.decode("utf-8")

    def write_message(self, msg: str) -> None:
        data = msg.encode("utf-8")
        if b"\n" in data or len(data) > 4096:
            self.sock.sendall(str(len(data)).encode() + b"\n" + data)
        else:
            self.sock.sendall(data + b"\n")

    # -- reply decoding ----------------------------------------------------
    @staticmethod
    def split_reply(msg: str) -> tuple[str, Any]:
        head, _, rest = msg.partition(" ")
        rest = rest.strip()
        if not rest:
            return head, None
        try:
            return head, json.loads(rest)
        except json.JSONDecodeError:
            return head, rest


class IsabelleClient:
    """High-level, thread-safe client. Use as a context manager.

    Either connect to an existing server (``info``) or let the client spawn
    ``isabelle server`` itself (``spawn=True``).
    """

    def __init__(self, info: ServerInfo | None = None, *, spawn: bool = False,
                 server_name: str = "computational_metaphysics",
                 isabelle_exe: str | None = None, connect_timeout: float = 120.0):
        self._lock = threading.Lock()
        self._proc: subprocess.Popen | None = None
        self.session_id: str | None = None
        self.session_tmp_dir: str | None = None
        self.server_version: Any = None
        if info is None:
            if not spawn:
                raise ValueError("pass ServerInfo or spawn=True")
            info = self._spawn(isabelle_exe or find_isabelle(), server_name, connect_timeout)
        self.info = info
        sock = socket.create_connection((info.host, info.port), timeout=connect_timeout)
        sock.settimeout(None)
        self.conn = Connection(sock)
        self.conn.write_message(info.password)
        head, payload = self.conn.split_reply(self.conn.read_message())
        if head != "OK":
            raise IsabelleError(f"authentication failed: {head} {payload}", payload)
        self.server_version = payload

    # -- process management ------------------------------------------------
    def _spawn(self, exe: str | None, name: str, timeout: float) -> ServerInfo:
        if not exe:
            raise IsabelleError("isabelle executable not found (set ISABELLE_EXE or PATH)")
        self._proc = subprocess.Popen([exe, "server", "-n", name], stdout=subprocess.PIPE,
                                      stderr=subprocess.STDOUT, text=True)
        deadline = time.monotonic() + timeout
        assert self._proc.stdout is not None
        while time.monotonic() < deadline:
            line = self._proc.stdout.readline()
            if not line:
                break
            if _SERVER_INFO_RE.search(line):
                return ServerInfo.parse(line)
        raise IsabelleError("isabelle server did not report its address in time")

    # -- commands ------------------------------------------------------------
    def command(self, name: str, arg: Any = None) -> Any:
        """Synchronous command: returns the OK payload or raises."""
        with self._lock:
            self.conn.write_message(name if arg is None else f"{name} {json.dumps(arg)}")
            head, payload = self.conn.split_reply(self.conn.read_message())
        if head != "OK":
            raise IsabelleError(f"{name}: {head} {payload}", payload)
        return payload

    def task(self, name: str, arg: Any) -> TaskResult:
        """Asynchronous command: waits for FINISHED/FAILED of its task id."""
        with self._lock:
            self.conn.write_message(f"{name} {json.dumps(arg)}")
            head, payload = self.conn.split_reply(self.conn.read_message())
            if head != "OK" or not isinstance(payload, dict) or "task" not in payload:
                raise IsabelleError(f"{name}: {head} {payload}", payload)
            task_id = payload["task"]
            notes: list[dict] = []
            while True:
                head, payload = self.conn.split_reply(self.conn.read_message())
                if isinstance(payload, dict) and payload.get("task") not in (None, task_id):
                    continue  # belongs to another task (should not happen under the lock)
                if head == "NOTE":
                    notes.append(payload)
                elif head in ("FINISHED", "FAILED"):
                    res = TaskResult(head, payload if isinstance(payload, dict) else {}, notes)
                    if head == "FAILED":
                        raise IsabelleError(f"{name} failed: {payload}", res)
                    return res
                elif head == "ERROR":
                    raise IsabelleError(f"{name}: ERROR {payload}", payload)

    # -- session API ---------------------------------------------------------
    def session_start(self, session: str = "HOL", dirs: list[str] | None = None,
                      options: list[str] | None = None) -> str:
        arg: dict[str, Any] = {"session": session}
        if dirs:
            arg["dirs"] = [str(d) for d in dirs]
        if options:
            arg["options"] = options
        res = self.task("session_start", arg)
        self.session_id = res.result["session_id"]
        self.session_tmp_dir = res.result.get("tmp_dir")
        return self.session_id

    def use_theories(self, theories: list[str], master_dir: str | Path,
                     *, unicode_symbols: bool = True, watchdog_timeout: float | None = None,
                     check_delay: float | None = None) -> dict:
        if not self.session_id:
            raise IsabelleError("no session; call session_start first")
        arg: dict[str, Any] = {"session_id": self.session_id, "theories": theories,
                               "master_dir": str(master_dir), "unicode_symbols": unicode_symbols}
        if check_delay is not None:
            arg["check_delay"] = check_delay
        if watchdog_timeout is not None:
            arg["watchdog_timeout"] = watchdog_timeout
        return self.task("use_theories", arg).result

    def purge_theories(self, theories: list[str], master_dir: str | Path) -> Any:
        return self.command("purge_theories", {"session_id": self.session_id,
                                               "theories": theories, "master_dir": str(master_dir)})

    def session_stop(self) -> None:
        if self.session_id:
            try:
                self.task("session_stop", {"session_id": self.session_id})
            finally:
                self.session_id = None

    def close(self) -> None:
        try:
            self.session_stop()
        except (IsabelleError, ConnectionError, OSError):
            pass
        try:
            self.conn.sock.close()
        except OSError:
            pass
        if self._proc is not None:
            self._proc.terminate()
            try:
                self._proc.wait(timeout=10)
            except subprocess.TimeoutExpired:
                self._proc.kill()
            self._proc = None

    def __enter__(self) -> "IsabelleClient":
        return self

    def __exit__(self, *exc) -> None:
        self.close()
