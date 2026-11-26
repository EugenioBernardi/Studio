"""`isabelle-mcp`: MCP server exposing Isabelle/HOL + HOML_Base to an LLM agent.

Tools (Phase 1 contract)
------------------------
verify_theory(thy_code)                       -> {"status": "OK"} or errors
check_consistency(axioms_thy)                 -> nitpick [satisfy, user_axioms, card=1-4]
prove_with_sledgehammer(thy_code, lemma_name) -> replayed proof, or none/timeout
find_countermodel(thy_code, lemma_name)       -> strict Kripke JSON (nitpick_parser)

All Isabelle traffic goes through one persistent ``IsabelleClient`` session on
the pre-built ``HOML_Base`` heap (``scripts/build_heap.sh``). Outputs are
parsed only by the deterministic parsers in this package.

Run:  python -m mcp_server.server          (stdio transport)
"""
from __future__ import annotations

import os
import re
import threading
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from . import theory_tools as tt
from .isabelle_client import IsabelleClient, IsabelleError, find_isabelle
from .nitpick_parser import parse_nitpick, to_kripke, to_strict_json
from .sledgehammer_parser import parse_sledgehammer

ROOT = Path(__file__).resolve().parents[1]


@dataclass
class Config:
    theories_dir: Path = ROOT / "theories"
    work_dir: Path = ROOT / "outputs" / "isabelle_work" / "mcp"
    session: str = tt.BASE_SESSION
    isabelle_exe: str | None = None
    nitpick_timeout: int = 30
    nitpick_card: str = "1-4"
    sledgehammer_timeout: int = 30
    max_replays: int = 3
    replay_watchdog: float = 60.0          # seconds before a hanging replay is abandoned
    default_watchdog: float = 120.0        # any check (e.g. a looping `by auto`) is abandoned after this
    consistency_sledgehammer_timeout: int = 20
    # Synchronous, ATP-free contradiction check tried before Sledgehammer.
    fast_contradiction_methods: tuple[str, ...] = ("blast", "meson", "auto")
    fast_path_watchdog: float = 10.0
    extra_session_dirs: list[Path] = field(default_factory=list)
    # Isabelle's default headless_consolidate_delay (2.0 s) is a fixed floor on
    # every use_theories call; 0.25 s keeps small checks well under 2 s.
    session_options: list[str] = field(default_factory=lambda: [
        "headless_consolidate_delay=0.25", "headless_check_delay=0.1"])

    @classmethod
    def from_env(cls) -> "Config":
        c = cls()
        if v := os.environ.get("CM_WORK_DIR"):
            c.work_dir = Path(v)
        c.isabelle_exe = os.environ.get("ISABELLE_EXE") or find_isabelle()
        for key, attr in (("CM_NITPICK_TIMEOUT", "nitpick_timeout"),
                          ("CM_SLEDGEHAMMER_TIMEOUT", "sledgehammer_timeout")):
            if v := os.environ.get(key):
                setattr(c, attr, int(v))
        return c


def _complete(node: dict) -> bool:
    st = node.get("status") or {}
    return (st.get("consolidated") is True and st.get("canceled") is not True
            and st.get("running", 1) == 0 and st.get("unprocessed", 1) == 0
            and st.get("failed", 1) == 0)


def _clean(msg: str) -> str:
    return msg.replace("⌂", "").strip()


class IsabelleTools:
    """Tool implementations, independent of the MCP transport (unit-testable)."""

    def __init__(self, config: Config | None = None, client: IsabelleClient | None = None):
        self.config = config or Config.from_env()
        self._client = client
        self._lock = threading.Lock()
        self._seq = 0
        self.config.work_dir.mkdir(parents=True, exist_ok=True)

    # -- session ---------------------------------------------------------------
    @property
    def client(self) -> IsabelleClient:
        if self._client is None:
            self._client = IsabelleClient(spawn=True, isabelle_exe=self.config.isabelle_exe)
        if self._client.session_id is None:
            dirs = [self.config.theories_dir, *self.config.extra_session_dirs]
            self._client.session_start(self.config.session, dirs=[str(d) for d in dirs],
                                       options=self.config.session_options)
        return self._client

    def close(self) -> None:
        if self._client is not None:
            self._client.close()
            self._client = None

    # -- core check --------------------------------------------------------------
    def _check(self, text: str, *, tag: str, watchdog: float | None = None) -> dict:
        """Write a uniquely named copy of ``text`` and check it with use_theories.

        Node names are never reused: re-checking a purged node under the same
        name makes PIDE see the file content twice (observed with Isabelle2025).
        """
        with self._lock:
            self._seq += 1
            seq = self._seq
        escapes = tt.proof_escape_problems(text)
        if escapes:
            raise tt.PolicyError("; ".join(escapes))
        name, prepared = tt.prepare(text, tag=f"{tag}:{os.getpid()}:{seq}")
        path = self.config.work_dir / f"{name}.thy"
        path.write_text(prepared, encoding="utf-8")
        t0 = time.monotonic()
        with self._lock:
            client = self.client
            try:
                res = client.use_theories([name], self.config.work_dir,
                                          watchdog_timeout=watchdog or self.config.default_watchdog)
            finally:
                try:
                    client.purge_theories([name], self.config.work_dir)
                except IsabelleError:
                    pass
        elapsed = time.monotonic() - t0
        msgs: list[dict] = []
        for node in res.get("nodes", []):
            for m in node.get("messages", []):
                msgs.append({"kind": m.get("kind"), "line": (m.get("pos") or {}).get("line"),
                             "message": _clean(m.get("message", ""))})
        errors = [m for m in msgs if m["kind"] == "error"]
        for e in res.get("errors", []):
            item = {"kind": "error", "line": (e.get("pos") or {}).get("line"),
                    "message": _clean(e.get("message", ""))}
            if item not in errors:
                errors.append(item)
        # Soundness: `ok` with no errors is NOT success. When the watchdog abandons a
        # check, the server answers ok=true while a proof is still running
        # (observed: running=1, consolidated=false, plus an early "theorem False").
        # Only a fully consolidated node with nothing running/failed counts.
        incomplete = [n.get("status", {}) for n in res.get("nodes", []) if not _complete(n)]
        if not res.get("nodes"):
            incomplete = [{"nodes": 0}]
        for st in incomplete:
            errors.append({"kind": "incomplete", "line": None,
                           "message": "check did not finish (watchdog/timeout); node status: "
                                      + ", ".join(f"{k}={st.get(k)}" for k in
                                                  ("consolidated", "running", "unprocessed", "failed"))})
        return {"ok": bool(res.get("ok")) and not errors, "errors": errors, "messages": msgs,
                "theory": name, "file": str(path), "elapsed_s": round(elapsed, 3)}

    @staticmethod
    def _output_at(check: dict, first: int, last: int | None = None) -> str:
        """Concatenated non-error output of the command(s) on lines first..last."""
        last = first if last is None else last
        return "\n".join(m["message"] for m in check["messages"]
                         if m["line"] is not None and first <= m["line"] <= last
                         and m["kind"] != "error")

    @staticmethod
    def _policy_error(e: tt.PolicyError) -> dict:
        return {"status": "REJECTED", "errors": [{"kind": "policy", "line": None, "message": str(e)}]}

    # -- tools -------------------------------------------------------------------
    def verify_theory(self, thy_code: str) -> dict:
        """OK only if the theory type-checks AND every lemma is actually proved.

        status: OK | ERROR (Isabelle errors) | REJECTED (policy / proof escape,
        e.g. sorry) | UNPROVED (type-checks, but lemmas are left with oops)
        """
        try:
            chk = self._check(thy_code, tag="verify")
        except tt.PolicyError as e:
            return self._policy_error(e)
        out: dict[str, Any] = {"theory": chk["theory"], "elapsed_s": chk["elapsed_s"]}
        if not chk["ok"]:
            out.update(status="ERROR", errors=chk["errors"])
        elif unproved := tt.oops_lemmas(thy_code):
            out.update(status="UNPROVED", typecheck="OK", unproved=unproved)
        else:
            out["status"] = "OK"
        warnings = [m for m in chk["messages"] if m["kind"] == "warning"]
        if warnings:
            out["warnings"] = warnings
        return out

    def _sledgehammer_replay(self, build, timeout: int) -> dict:
        """Run Sledgehammer at a goal and replay its suggestions.

        ``build(proof_text) -> (theory_text, line)`` places a proof at the goal.
        A suggestion counts only if the full theory re-checks with it as the
        proof (same path as verify_theory), so preplay-only successes and
        replays that error or hang (watchdog) are never reported as proofs.
        """
        cmd = f"sledgehammer [timeout = {timeout}]\n  oops"
        text, line = build(cmd)
        chk = self._check(text, tag="sledgehammer")
        if not chk["ok"]:
            return {"status": "ERROR", "errors": chk["errors"], "elapsed_s": chk["elapsed_s"]}
        raw = self._output_at(chk, line, line + cmd.count("\n"))
        sh = parse_sledgehammer(raw)
        elapsed = chk["elapsed_s"]
        ranked = sorted(sh.suggestions, key=lambda s: (s.time_ms if s.time_ms is not None
                                                       else float("inf"), s.proof))
        tried = []
        for sug in ranked[: self.config.max_replays]:
            if re.search(r"\b(sorry|oops)\b", sug.proof):
                continue
            replay_text, _ = build(sug.proof)
            try:
                rep = self._check(replay_text, tag="replay", watchdog=self.config.replay_watchdog)
            except (tt.PolicyError, IsabelleError) as e:
                tried.append({"proof": sug.proof, "prover": sug.prover, "ok": False, "error": str(e)})
                continue
            elapsed += rep["elapsed_s"]
            tried.append({"proof": sug.proof, "prover": sug.prover, "ok": rep["ok"]})
            if rep["ok"]:
                return {"status": "PROVED", "proof": sug.proof, "prover": sug.prover,
                        "replayed": True, "tried": tried, "raw_output": raw,
                        "elapsed_s": round(elapsed, 3)}
        status = {"proof_found": "REPLAY_FAILED", "timeout": "TIMEOUT",
                  "none": "NO_PROOF"}.get(sh.status, "UNKNOWN")
        return {"status": status, "proof": None, "replayed": False, "tried": tried,
                "raw_output": raw, "elapsed_s": round(elapsed, 3)}

    def check_consistency(self, axioms_thy: str) -> dict:
        """Gate for axiom sets. Verdicts (``status``):

        CONSISTENT             genuine Nitpick model with card <= 4   (consistent=True)
        INCONSISTENT           no model, and False proved + replayed  (consistent=False)
        NO_FINITE_MODEL_FOUND  no model <= 4, no contradiction found  (consistent=None):
                               the axioms may only have infinite (or larger) models,
                               e.g. an infinite causal chain; this is NOT a proof of
                               inconsistency
        POTENTIAL_MODEL_ONLY   only a potentially spurious model      (consistent=None)
        UNKNOWN                Nitpick gave up / timed out            (consistent=None)
        ERROR / REJECTED       does not type-check / violates policy  (consistent=None)
        """
        cmd = (f"lemma True\n  nitpick [satisfy, user_axioms, show_all, card = {self.config.nitpick_card},"
               f" batch_size = 1, timeout = {self.config.nitpick_timeout}]\n  oops")
        try:
            text, line = tt.with_command_before_end(axioms_thy, cmd)
            chk = self._check(text, tag="consistency")
        except tt.PolicyError as e:
            return {**self._policy_error(e), "consistent": None}
        if not chk["ok"]:
            return {"status": "ERROR", "consistent": None, "errors": chk["errors"],
                    "elapsed_s": chk["elapsed_s"]}
        raw = self._output_at(chk, line, line + cmd.count("\n"))
        res = parse_nitpick(raw)
        out: dict[str, Any] = {"model": to_strict_json(res), "nitpick_outcome": res.outcome,
                               "cards": res.cards, "card_bound": self.config.nitpick_card,
                               "raw_output": raw, "elapsed_s": chk["elapsed_s"]}
        if res.outcome == "model" and res.genuine:
            return {"status": "CONSISTENT", "consistent": True, **out}
        if res.outcome == "model":
            return {"status": "POTENTIAL_MODEL_ONLY", "consistent": None, **out}
        if res.outcome != "none":
            return {"status": "UNKNOWN", "consistent": None, **out}
        # No finite model: look for an explicit contradiction before concluding anything.
        # 1) fast path: built-in proof methods over the named axioms (no external ATPs)
        fast = self._fast_contradiction(axioms_thy)
        out["fast_path"] = fast
        out["elapsed_s"] = round(out["elapsed_s"] + fast["elapsed_s"], 3)
        if fast["status"] == "PROVED":
            out["contradiction_search"] = {"status": "PROVED", "proof": fast["proof"],
                                           "prover": "isabelle:" + fast["method"], "tried": fast["tried"]}
            return {"status": "INCONSISTENT", "consistent": False, **out}
        # 2) Sledgehammer, with every suggestion replayed
        contra = self._sledgehammer_replay(
            lambda proof: tt.with_command_before_end(axioms_thy, "lemma False\n  " + proof),
            self.config.consistency_sledgehammer_timeout)
        out["contradiction_search"] = {k: contra.get(k) for k in ("status", "proof", "prover", "tried")}
        out["elapsed_s"] = round(out["elapsed_s"] + contra.get("elapsed_s", 0), 3)
        if contra["status"] == "PROVED":
            return {"status": "INCONSISTENT", "consistent": False, **out}
        return {"status": "NO_FINITE_MODEL_FOUND", "consistent": None,
                "note": (f"No model with card {self.config.nitpick_card} and no derivation of False. "
                         "This rules out small finite models only; the axioms may require an "
                         "infinite domain."), **out}

    def _fast_contradiction(self, axioms_thy: str) -> dict:
        names = [n for n, _ in tt.axioms(axioms_thy)]
        using = f"using {' '.join(names)} " if names else ""
        tried, elapsed = [], 0.0
        for method in self.config.fast_contradiction_methods:
            proof = f"{using}by {method}"
            text, _ = tt.with_command_before_end(axioms_thy, "lemma False\n  " + proof)
            try:
                rep = self._check(text, tag="fastpath", watchdog=self.config.fast_path_watchdog)
            except IsabelleError as e:
                tried.append({"method": method, "ok": False, "error": str(e)})
                continue
            elapsed += rep["elapsed_s"]
            tried.append({"method": method, "ok": rep["ok"], "elapsed_s": rep["elapsed_s"]})
            if rep["ok"]:
                return {"status": "PROVED", "method": method, "proof": proof,
                        "tried": tried, "elapsed_s": round(elapsed, 3)}
        return {"status": "NOT_FOUND", "tried": tried, "elapsed_s": round(elapsed, 3)}

    def find_countermodel(self, thy_code: str, lemma_name: str) -> dict:
        cmd = (f"nitpick [user_axioms, show_all, card = {self.config.nitpick_card}, batch_size = 1,"
               f" timeout = {self.config.nitpick_timeout}]\n  oops")
        try:
            text, line = tt.with_proof(thy_code, lemma_name, cmd)
            chk = self._check(text, tag="countermodel")
        except tt.PolicyError as e:
            return self._policy_error(e)
        if not chk["ok"]:
            return {"status": "ERROR", "errors": chk["errors"], "elapsed_s": chk["elapsed_s"]}
        raw = self._output_at(chk, line, line + cmd.count("\n"))
        res = parse_nitpick(raw)
        return {"status": "OK", "kripke": to_strict_json(res),
                "detail": {"outcome": res.outcome, "cards": res.cards,
                           "actual_world": to_kripke(res)["actual_world"]},
                "raw_output": raw, "elapsed_s": chk["elapsed_s"]}

    def prove_with_sledgehammer(self, thy_code: str, lemma_name: str) -> dict:
        try:
            tt.find_lemma(thy_code, lemma_name)
            return self._sledgehammer_replay(
                lambda proof: tt.with_proof(thy_code, lemma_name, proof),
                self.config.sledgehammer_timeout)
        except tt.PolicyError as e:
            return self._policy_error(e)


# --------------------------------------------------------------------------
# MCP wiring
# --------------------------------------------------------------------------

def build_server(tools: IsabelleTools | None = None):
    from mcp.server.mcpserver import MCPServer

    tools = tools or IsabelleTools()
    mcp = MCPServer(
        name="isabelle-mcp",
        instructions=("Isabelle/HOL with a LogiKEy HOML embedding. Theories must import "
                      "HOML_Base. Lemmas are addressed by name ('lemma name: ...')."),
    )

    @mcp.tool()
    def verify_theory(thy_code: str) -> dict:
        """Parse and type-check a complete theory. Returns {"status": "OK"} or the errors."""
        return tools.verify_theory(thy_code)

    @mcp.tool()
    def check_consistency(axioms_thy: str) -> dict:
        """Search for a model of all axioms (nitpick satisfy, card 1-4). consistent=false means rejected."""
        return tools.check_consistency(axioms_thy)

    @mcp.tool()
    def prove_with_sledgehammer(thy_code: str, lemma_name: str) -> dict:
        """Run Sledgehammer on the named lemma and replay the proof it suggests."""
        return tools.prove_with_sledgehammer(thy_code, lemma_name)

    @mcp.tool()
    def find_countermodel(thy_code: str, lemma_name: str) -> dict:
        """Run Nitpick on the named lemma; returns a Kripke countermodel as JSON."""
        return tools.find_countermodel(thy_code, lemma_name)

    return mcp


def main() -> None:
    build_server().run("stdio")


if __name__ == "__main__":
    main()
