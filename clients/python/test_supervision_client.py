"""Tests du module Python : python3 -m unittest clients/python/test_supervision_client.py"""

import json
import logging
import os
import sys
import unittest
from unittest import mock

sys.path.insert(0, os.path.dirname(__file__))
import supervision_client as sc  # noqa: E402


class MaskingTest(unittest.TestCase):
    def test_masque_les_numeros(self):
        self.assertEqual(sc.mask_phone_numbers("Abonnement pour +2250707123456 retiré"), "Abonnement pour +22507••••••56 retiré")
        self.assertEqual(sc.mask_phone_numbers("de 2250707123456 (text)"), "de 22507••••••56 (text)")

    def test_garde_les_petits_nombres_et_montants(self):
        for text in ("Quiz du jour a envoyer a 42 abonne(s).", "Capitalisation 12.345.678.901 FCFA", "BOC 2026-10-31"):
            self.assertEqual(sc.mask_phone_numbers(text), text)

    def test_source_courte(self):
        self.assertEqual(sc.short_source("brvm_agent.jobs"), "jobs")
        self.assertEqual(sc.short_source("webhook_server"), "serveur")
        self.assertEqual(sc.short_source("uvicorn.error"), "serveur")


class HandlerTest(unittest.TestCase):
    def setUp(self):
        self.sent = []
        patcher = mock.patch.object(sc, "_post", side_effect=lambda url, token, path, body: self.sent.append((path, body)))
        patcher.start()
        self.addCleanup(patcher.stop)
        self.handler = sc.SupervisionHandler("https://sup.test", "t", flush_interval=3600)
        self.logger = logging.getLogger("brvm_agent.jobs")
        self.logger.setLevel(logging.DEBUG)
        self.logger.addHandler(self.handler)
        self.addCleanup(self.logger.removeHandler, self.handler)

    def entries(self):
        self.handler.flush()
        return [e for path, body in self.sent for e in body["entries"]]

    def test_envoie_masque_et_source(self):
        self.logger.info("Nouvel abonnement push enregistré pour %s.", "+2250707123456")
        (entry,) = self.entries()
        self.assertEqual(entry["level"], "info")
        self.assertEqual(entry["source"], "jobs")
        self.assertNotIn("0707123456", entry["message"])

    def test_bibliotheques_bavardes_ignorees_sauf_erreurs(self):
        httpx_logger = logging.getLogger("httpx")
        httpx_logger.addHandler(self.handler)
        self.addCleanup(httpx_logger.removeHandler, self.handler)
        httpx_logger.setLevel(logging.INFO)
        httpx_logger.info("HTTP Request: GET https://graph.facebook.com/?access_token=secret")
        httpx_logger.error("Connexion refusée")
        self.assertEqual([e["message"] for e in self.entries()], ["Connexion refusée"])

    def test_trace_des_exceptions(self):
        try:
            1 / 0
        except ZeroDivisionError:
            self.logger.exception("Echec du recap")
        (entry,) = self.entries()
        self.assertEqual(entry["level"], "error")
        self.assertIn("ZeroDivisionError", entry["message"])

    def test_garde_les_journaux_si_injoignable(self):
        with mock.patch.object(sc, "_post", side_effect=OSError("réseau")):
            self.logger.warning("à garder")
            self.handler.flush()
        self.assertEqual([e["message"] for e in self.entries()], ["à garder"])

    def test_silencieux_sans_configuration(self):
        handler = sc.SupervisionHandler("", "")
        self.assertFalse(handler.enabled)


if __name__ == "__main__":
    unittest.main()


class AdminSignatureTest(unittest.TestCase):
    # Vecteur produit par la supervision (Node) : les deux côtés doivent calculer la même chose.
    KEY = "550f2f4f2a798a3f61e57515a5c87c39082bb5239d720f9a8db4826bf4d6388c"
    SIG = "e43b5a7fe3cd0f5de0fc90f7ded8591aa7bec053a93fa269ddc2916b02b8bfd3"
    BODY = '{"params":{"email":"é@b.ci","n":3},"by":"admin"}'

    def test_meme_cle_et_meme_signature_que_la_supervision(self):
        self.assertEqual(sc.derive_admin_key("jeton-envoi"), self.KEY)
        self.assertEqual(sc.sign_admin_request(self.KEY, 1800000000000, "post", "/actions/x", self.BODY), self.SIG)

    def test_corps_recalcule_comme_json_stringify(self):
        self.assertEqual(sc.canonical_body(self.BODY.encode()), self.BODY)

    def test_refus(self):
        ok = sc.verify_admin_request(self.KEY, "1800000000000", self.SIG, "POST", "/actions/x", self.BODY, now_ms=1800000001000)
        self.assertTrue(ok)
        self.assertFalse(sc.verify_admin_request(self.KEY, "1800000000000", self.SIG, "POST", "/actions/y", self.BODY, now_ms=1800000001000))
        self.assertFalse(sc.verify_admin_request(self.KEY, "1800000000000", self.SIG, "POST", "/actions/x", self.BODY, now_ms=1800000000000 + 6 * 60_000))
        self.assertFalse(sc.verify_admin_request("", "1800000000000", self.SIG, "POST", "/actions/x", self.BODY))
