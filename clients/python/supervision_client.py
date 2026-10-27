"""Module d'envoi vers la Supervision, à copier dans une appli Python
(Yiri Invest). Aucune dépendance : bibliothèque standard uniquement.

    import logging, os
    from supervision_client import SupervisionHandler, supervision_alert

    handler = SupervisionHandler(os.getenv("SUPERVISION_URL"), os.getenv("SUPERVISION_INGEST_TOKEN"), source="webhook")
    logging.getLogger().addHandler(handler)   # tous les logging.* partent aussi vers la supervision

    supervision_alert("recap-brvm", "Récap BRVM non envoyé", "Détail…")   # alerte métier
    supervision_alert("recap-brvm", resolve=True)                         # incident clos

Pour les actions super administrateur avec FastAPI, voir
`supervision_fastapi_router` en bas de fichier.

Sans adresse ou sans jeton, tout devient silencieux.
"""

from __future__ import annotations

import atexit
import datetime as _dt
import hmac
import json
import logging
import os
import threading
import traceback
import urllib.request

_LEVELS = {
    logging.DEBUG: "debug",
    logging.INFO: "info",
    logging.WARNING: "warn",
    logging.ERROR: "error",
    logging.CRITICAL: "fatal",
}


def _post(url: str, token: str, path: str, body: dict) -> None:
    req = urllib.request.Request(
        f"{url.rstrip('/')}/api/ingest/{path}",
        data=json.dumps(body, default=str).encode("utf-8"),
        headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"},
        method="POST",
    )
    urllib.request.urlopen(req, timeout=10).read()


class SupervisionHandler(logging.Handler):
    """Handler logging qui envoie les journaux par lots toutes les 5 s."""

    def __init__(self, url: str | None, token: str | None, source: str | None = None,
                 level: int = logging.INFO, flush_interval: float = 5.0):
        super().__init__(level)
        self.url = (url or "").strip()
        self.token = (token or "").strip()
        self.source = source
        self.enabled = bool(self.url and self.token)
        self._queue: list[dict] = []
        self._lock = threading.Lock()
        self._wake = threading.Event()
        self._interval = flush_interval
        if self.enabled:
            threading.Thread(target=self._loop, name="supervision-flush", daemon=True).start()
            atexit.register(self.flush)

    def emit(self, record: logging.LogRecord) -> None:
        if not self.enabled or record.name.startswith("urllib3"):
            return
        try:
            message = record.getMessage()
            if record.exc_info:
                message += "\n" + "".join(traceback.format_exception(*record.exc_info))
            entry = {
                "at": _dt.datetime.fromtimestamp(record.created, _dt.timezone.utc).isoformat(),
                "level": _LEVELS.get(record.levelno, "info"),
                "message": message[:4000],
                "source": self.source or record.name,
                "context": {"logger": record.name, "fonction": record.funcName, "ligne": record.lineno},
            }
            with self._lock:
                self._queue.append(entry)
                if len(self._queue) > 5000:
                    self._queue = self._queue[-5000:]
            if record.levelno >= logging.ERROR:
                self._wake.set()
        except Exception:  # un souci d'envoi ne doit jamais casser l'appli
            self.handleError(record)

    def flush(self) -> None:
        if not self.enabled:
            return
        with self._lock:
            batch, self._queue = self._queue[:500], self._queue[500:]
        if not batch:
            return
        try:
            _post(self.url, self.token, "logs", {"entries": batch})
        except Exception:
            with self._lock:  # supervision injoignable : on réessaiera
                self._queue = batch + self._queue

    def _loop(self) -> None:
        while True:
            self._wake.wait(self._interval)
            self._wake.clear()
            self.flush()


def supervision_alert(key: str, title: str | None = None, detail: str | None = None,
                      severity: str = "warning", resolve: bool = False) -> None:
    """Ouvre (ou referme avec resolve=True) une alerte métier dans la supervision."""
    url, token = os.getenv("SUPERVISION_URL", ""), os.getenv("SUPERVISION_INGEST_TOKEN", "")
    if not (url and token):
        return
    body = {"key": key, "severity": severity, "resolve": resolve}
    if title:
        body["title"] = title
    if detail:
        body["detail"] = detail[:2000]
    try:
        _post(url, token, "alerts", body)
    except Exception:
        logging.getLogger(__name__).debug("supervision injoignable", exc_info=True)


def supervision_fastapi_router(actions: list[dict], summary=None):
    """Routes /supervision/... pour FastAPI (protocole décrit dans docs/integration.md).

    actions : [{"id": "purger-cache", "label": "Vider le cache", "danger": False,
                "description": "...", "params": [...], "run": fonction(params, by) -> dict|None}]
    summary : fonction sans argument -> [{"label": "Abonnés", "value": 42}]
    """
    from fastapi import APIRouter, Header, HTTPException, Request

    router = APIRouter(prefix="/supervision")
    token = os.getenv("SUPERVISION_ADMIN_TOKEN", "")

    def check(authorization: str | None) -> None:
        given = (authorization or "").removeprefix("Bearer ")
        if not token or not hmac.compare_digest(given, token):
            raise HTTPException(status_code=401, detail="Non autorisé")

    @router.get("/actions")
    def list_actions(authorization: str | None = Header(default=None)):
        check(authorization)
        return {"actions": [{k: v for k, v in a.items() if k != "run"} for a in actions]}

    @router.get("/summary")
    def get_summary(authorization: str | None = Header(default=None)):
        check(authorization)
        return {"metrics": summary() if summary else []}

    @router.post("/actions/{action_id}")
    async def run_action(action_id: str, request: Request, authorization: str | None = Header(default=None)):
        check(authorization)
        action = next((a for a in actions if a["id"] == action_id), None)
        if not action:
            raise HTTPException(status_code=404, detail="Action inconnue")
        body = await request.json()
        result = action["run"](body.get("params") or {}, body.get("by") or "supervision") or {}
        return {"ok": True, "message": result.get("message", "Action effectuée"), "data": result.get("data")}

    return router
