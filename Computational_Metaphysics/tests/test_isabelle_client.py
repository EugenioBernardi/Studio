import pytest

from mcp_server.isabelle_client import IsabelleClient, IsabelleError, ServerInfo
from tests.fake_isabelle import FakeIsabelleServer


def responder(name, arg):
    if name == "echo":
        return "OK", arg, None
    if name == "session_start":
        return "FINISHED", {"session_id": "S1", "tmp_dir": "/tmp/x"}, [{"kind": "writeln", "message": "Starting"}]
    if name == "use_theories":
        if arg["theories"] == ["Broken"]:
            return "FAILED", {"kind": "error", "message": "boom"}, []
        return "FINISHED", {"ok": True, "errors": [], "nodes": [
            {"node_name": "X", "messages": [{"kind": "writeln", "message": "multi\nline", "pos": {"line": 3}}]}]}, []
    if name == "purge_theories":
        return "OK", {"purged": arg["theories"], "retained": []}, None
    if name == "session_stop":
        return "FINISHED", {"ok": True}, []
    return "ERROR", f"unknown command {name}", None


@pytest.mark.parametrize("long_replies", [False, True])
def test_auth_sync_and_task_flow(long_replies):
    srv = FakeIsabelleServer(responder, long_replies=long_replies)
    with IsabelleClient(srv.info) as c:
        assert c.server_version["isabelle_name"] == "Isabelle2025"
        assert c.command("echo", {"a": [1, 2]}) == {"a": [1, 2]}
        assert c.session_start("HOML_Base", dirs=["theories"], options=["x=1"]) == "S1"
        res = c.use_theories(["Foo"], "/work", check_delay=0.1)
        assert res["nodes"][0]["messages"][0]["message"] == "multi\nline"
        assert c.purge_theories(["Foo"], "/work")["purged"] == ["Foo"]
        with pytest.raises(IsabelleError, match="failed"):
            c.use_theories(["Broken"], "/work")
        with pytest.raises(IsabelleError, match="unknown command"):
            c.command("nonsense")
    sent = [m.split(" ", 1)[0] for m in srv.received]
    assert sent == ["echo", "session_start", "use_theories", "purge_theories",
                    "use_theories", "nonsense", "session_stop"]


def test_long_client_message_is_length_prefixed():
    srv = FakeIsabelleServer(responder)
    with IsabelleClient(srv.info) as c:
        payload = {"text": "x" * 10000}
        assert c.command("echo", payload) == payload


def test_bad_password():
    srv = FakeIsabelleServer(responder, password="right")
    info = ServerInfo(srv.info.name, srv.info.host, srv.info.port, "wrong")
    with pytest.raises(IsabelleError, match="authentication"):
        IsabelleClient(info)


def test_server_info_line():
    info = ServerInfo.parse('server "isabelle" = 127.0.0.1:4711 (password "a-b-c")')
    assert (info.port, info.password) == (4711, "a-b-c")
    with pytest.raises(IsabelleError):
        ServerInfo.parse("garbage")


def test_use_theories_requires_session():
    srv = FakeIsabelleServer(responder)
    with IsabelleClient(srv.info) as c:
        with pytest.raises(IsabelleError, match="no session"):
            c.use_theories(["Foo"], "/work")
