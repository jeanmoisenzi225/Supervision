import { useState } from "react";
import { api, type AppOverview } from "../lib/api";
import { usePolling } from "../lib/usePolling";

interface TenantSummary {
  id: string;
  name: string;
  subtitle?: string;
  badges?: string[];
  fields?: { label: string; value: string | number }[];
}

interface TenantDetail {
  name: string;
  subtitle?: string;
  sections: { title: string; items: { label: string; value: string | number }[] }[];
}

interface TenantsResponse {
  configured: boolean;
  notReady?: boolean;
  error?: string;
  label: string | null;
  items: TenantSummary[];
}

/** Onglet Clients : les clients de l'appli (garages, comptes, abonnés…), puis la fiche de chacun. */
export function TenantsPanel({ app }: { app: AppOverview }) {
  const { data, error } = usePolling(() => api<TenantsResponse>(`/apps/${app.key}/tenants`), 5 * 60_000, [app.key]);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<TenantDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  async function open(id: string) {
    setSelected(id);
    setDetail(null);
    setDetailError(null);
    try {
      setDetail(await api<TenantDetail>(`/apps/${app.key}/tenants/${encodeURIComponent(id)}`));
    } catch (err) {
      setDetailError((err as Error).message);
    }
  }

  if (error) return <p className="error">{error}</p>;
  if (!data) return <p className="muted">Chargement…</p>;
  if (!data.configured) return <p className="muted small">Non branché : le jeton d'envoi des journaux de cette appli n'est pas défini sur la supervision.</p>;
  if (data.notReady) return <p className="muted small">Pas encore branché : la version de l'appli qui présente ses clients n'est pas encore en ligne.</p>;
  if (data.error) return <p className="error small">{data.error}</p>;
  if (!data.label) return <p className="muted small">Cette appli ne présente pas de liste de clients.</p>;

  if (selected) {
    return (
      <div className="stack">
        <button className="link" onClick={() => setSelected(null)}>
          ← {data.label}
        </button>
        {detailError && <p className="error">{detailError}</p>}
        {!detail && !detailError && <p className="muted">Chargement…</p>}
        {detail && (
          <>
            <div>
              <h2>{detail.name}</h2>
              {detail.subtitle && <p className="muted small">{detail.subtitle}</p>}
            </div>
            {detail.sections.map((s) => (
              <section key={s.title} className="card">
                <h3>{s.title}</h3>
                <table className="table tenant-table">
                  <tbody>
                    {s.items.map((i) => (
                      <tr key={i.label}>
                        <td className="muted">{i.label}</td>
                        <td className="val">{i.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ))}
          </>
        )}
      </div>
    );
  }

  const needle = q.trim().toLowerCase();
  const items = needle ? data.items.filter((t) => `${t.name} ${t.subtitle ?? ""} ${(t.badges ?? []).join(" ")}`.toLowerCase().includes(needle)) : data.items;

  return (
    <div className="stack">
      <div className="row wrap">
        <strong className="grow">
          {data.label} ({data.items.length})
        </strong>
        {data.items.length > 6 && <input placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} />}
      </div>
      {items.length === 0 && <p className="muted small">Aucun.</p>}
      {items.map((t) => (
        <button key={t.id} className="card tenant" onClick={() => void open(t.id)}>
          <div className="row wrap">
            <strong className="grow">{t.name}</strong>
            {(t.badges ?? []).map((b) => (
              <span key={b} className="pill">
                {b}
              </span>
            ))}
          </div>
          {t.subtitle && <span className="muted small">{t.subtitle}</span>}
          {t.fields && t.fields.length > 0 && (
            <div className="tenant-fields">
              {t.fields.map((f) => (
                <span key={f.label}>
                  <strong>{f.value}</strong> <span className="muted">{f.label}</span>
                </span>
              ))}
            </div>
          )}
        </button>
      ))}
    </div>
  );
}
