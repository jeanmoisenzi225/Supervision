-- Retour au taux de marché (décision du 2026-11-12) : le réglage « conversion des coûts » du profil de facturation
-- repasse à « market » (la parité commerciale reste disponible dans Paramètres). Sans effet si le profil n'existe pas.
UPDATE "Setting"
SET "value" = jsonb_set("value"::jsonb, '{fxMode}', '"market"')::text
WHERE "key" = 'billing.profile' AND "value"::jsonb ? 'fxMode';
