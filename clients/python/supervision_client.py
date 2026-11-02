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
import hashlib
import hmac
import json
import logging
import os
import re
import threading
import time
import traceback
import urllib.request

try:  # FastAPI est facultatif : seulement pour supervision_fastapi_router.
    from fastapi import Request as FastAPIRequest
except ImportError:  # pragma: no cover
    FastAPIRequest = None  # type: ignore[assignment,misc]

_LEVELS = {
    logging.DEBUG: "debug",
    logging.INFO: "info",
    logging.WARNING: "warn",
    logging.ERROR: "error",
    logging.CRITICAL: "fatal",
}


# Bibliothèques très bavardes (une ligne par requête HTTP, par passage du
# planificateur...) : seuls leurs avertissements et erreurs sont envoyés. Les
# lignes de httpx contiennent aussi les adresses appelées, jetons compris.
QUIET_LOGGERS = ("uvicorn.access", "httpx", "httpcore", "urllib3", "apscheduler", "hpack", "asyncio", "multipart")

# Suite de 9 à 15 chiffres isolée (un point final de phrase est accepté,
# pas un séparateur de milliers ou de décimales).
_PHONE = re.compile(r"(?<![\w.])\+?\d{9,15}(?!\w|[.,]\d)")


def mask_phone_numbers(text: str) -> str:
    """+2250707123456 -> +22507•••••56 : le numéro reste reconnaissable sans être exploitable."""
    def _mask(m: re.Match) -> str:
        raw = m.group(0)
        plus = "+" if raw.startswith("+") else ""
        digits = raw.lstrip("+")
        return plus + digits[:5] + "•" * (len(digits) - 7) + digits[-2:]
    return _PHONE.sub(_mask, text)


def short_source(logger_name: str) -> str:
    """brvm_agent.jobs -> jobs ; __main__ / webhook_server -> serveur."""
    name = logger_name.rsplit(".", 1)[-1]
    return "serveur" if name in ("__main__", "webhook_server", "error") else name


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
                 level: int = logging.INFO, flush_interval: float = 5.0,
                 redact=mask_phone_numbers, quiet_loggers=QUIET_LOGGERS):
        """redact : fonction appliquée à chaque message avant envoi (par défaut,
        masquage des numéros de téléphone). source : fixe la source ; sinon
        elle vient du nom du logger (brvm_agent.jobs -> jobs)."""
        super().__init__(level)
        self.redact = redact
        self.quiet_loggers = tuple(quiet_loggers)
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
        if not self.enabled:
            return
        if record.levelno < logging.WARNING and record.name.startswith(self.quiet_loggers):
            return
        try:
            message = record.getMessage()
            if record.exc_info:
                message += "\n" + "".join(traceback.format_exception(*record.exc_info))
            if self.redact:
                message = self.redact(message)
            entry = {
                "at": _dt.datetime.fromtimestamp(record.created, _dt.timezone.utc).isoformat(),
                "level": _LEVELS.get(record.levelno, "info"),
                "message": message[:4000],
                "source": self.source or short_source(record.name),
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


def derive_admin_key(ingest_token: str) -> str:
    """Clé d'administration dérivée du jeton d'envoi (même calcul que la supervision)."""
    if not ingest_token:
        return ""
    return hmac.new(ingest_token.encode(), b"supervision-admin", hashlib.sha256).hexdigest()


def sign_admin_request(key: str, timestamp: int, method: str, rel_path: str, body: str) -> str:
    message = f"{timestamp}.{method.upper()}.{rel_path}.{body}".encode()
    return hmac.new(key.encode(), message, hashlib.sha256).hexdigest()


def verify_admin_request(key: str, timestamp: str | None, signature: str | None, method: str,
                         rel_path: str, body: str, now_ms: int | None = None) -> bool:
    """Signature exacte et horodatage à moins de 5 minutes (pas de rejeu)."""
    if not key or not timestamp or not signature:
        return False
    try:
        ts = int(timestamp)
    except ValueError:
        return False
    now_ms = now_ms if now_ms is not None else int(time.time() * 1000)
    if abs(now_ms - ts) > 5 * 60_000:
        return False
    return hmac.compare_digest(sign_admin_request(key, ts, method, rel_path, body), signature)


def canonical_body(raw: bytes) -> str:
    """Le corps tel que la supervision l'a signé (JSON compact, comme JSON.stringify)."""
    if not raw:
        return "{}"
    return json.dumps(json.loads(raw), separators=(",", ":"), ensure_ascii=False)


def supervision_fastapi_router(actions: list[dict], summary=None, prefix: str = "/api/supervision", tenants: dict | None = None):
    """Routes /supervision/... pour FastAPI (protocole décrit dans docs/integration.md).

    actions : [{"id": "renvoyer-recap", "label": "Renvoyer le récap", "danger": False,
                "description": "...", "params": [...], "run": fonction(params, by) -> dict|None}]
              (une fonction `run` peut être async).
    summary : fonction sans argument -> [{"label": "Abonnés", "value": 42}]
    tenants : {"label": "Abonnés", "list": fonction() -> [ {id, name, subtitle?, badges?, fields?} ],
               "detail": fonction(id) -> {name, subtitle?, sections: [{title, items: [{label, value}]}]} | None}
              (caractéristiques et activité seulement, jamais de données confidentielles)
    Clé : SUPERVISION_ADMIN_TOKEN, sinon dérivée de SUPERVISION_INGEST_TOKEN.
    """
    import inspect

    from fastapi import APIRouter, HTTPException

    router = APIRouter(prefix=prefix)
    key = os.getenv("SUPERVISION_ADMIN_TOKEN", "").strip() or derive_admin_key(os.getenv("SUPERVISION_INGEST_TOKEN", "").strip())

    async def check(request: FastAPIRequest) -> bytes:
        raw = await request.body()
        rel_path = request.url.path[len(prefix):] if request.url.path.startswith(prefix) else request.url.path
        body = "" if request.method.upper() == "GET" else canonical_body(raw)
        if not verify_admin_request(key, request.headers.get("x-supervision-timestamp"),
                                    request.headers.get("x-supervision-signature"), request.method, rel_path, body):
            raise HTTPException(status_code=401, detail="Non autorisé")
        return raw

    async def call(fn, *args):
        result = fn(*args)
        return await result if inspect.isawaitable(result) else result

    @router.get("/actions")
    async def list_actions(request: FastAPIRequest):
        await check(request)
        return {"actions": [{k: v for k, v in a.items() if k != "run"} for a in actions]}

    @router.get("/summary")
    async def get_summary(request: FastAPIRequest):
        await check(request)
        return {"metrics": (await call(summary)) if summary else []}

    @router.get("/tenants")
    async def list_tenants(request: FastAPIRequest):
        await check(request)
        if not tenants:
            return {"label": None, "items": []}
        return {"label": tenants["label"], "items": await call(tenants["list"])}

    @router.get("/tenants/{tenant_id}")
    async def tenant_detail(tenant_id: str, request: FastAPIRequest):
        await check(request)
        detail = (await call(tenants["detail"], tenant_id)) if tenants else None
        if not detail:
            raise HTTPException(status_code=404, detail="Introuvable")
        return detail

    @router.post("/actions/{action_id}")
    async def run_action(action_id: str, request: FastAPIRequest):
        raw = await check(request)
        action = next((a for a in actions if a["id"] == action_id), None)
        if not action:
            raise HTTPException(status_code=404, detail="Action inconnue")
        body = json.loads(raw) if raw else {}
        try:
            result = (await call(action["run"], body.get("params") or {}, body.get("by") or "supervision")) or {}
        except Exception as exc:  # refus métier : message lisible
            raise HTTPException(status_code=422, detail=str(exc)) from exc
        return {"ok": True, "message": result.get("message", "Action effectuée"), "data": result.get("data")}

    return router
