import { useState } from "react";
import { api, type AppOverview } from "../lib/api";
import { PAUSE_DURATIONS, pauseLabel } from "../lib/format";

/** Couper / reprendre la supervision d'une ou plusieurs applis. */
export function PauseControls({ apps, onChange, compact = false }: { apps: AppOverview[]; onChange: () => void; compact?: boolean }) {
  const [selected, setSelected] = useState<string[]>(compact ? apps.map((a) => a.key) : []);
  const [duration, setDuration] = useState<string>("60");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const targets = compact ? apps.map((a) => a.key) : selected;
  const pausedTargets = apps.filter((a) => targets.includes(a.key) && a.pause);
  const activeTargets = apps.filter((a) => targets.includes(a.key) && !a.pause);

  async function send(path: "/pause" | "/resume", keys: string[]) {
    setBusy(true);
    setError(null);
    try {
      await api(path, {
        method: "POST",
        body: path === "/pause" ? { apps: keys, minutes: duration === "none" ? null : Number(duration), reason: reason.trim() || null } : { apps: keys },
      });
      setReason("");
      onChange();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack-small">
      {!compact && (
        <ul className="pause-list">
          {apps.map((a) => (
            <li key={a.key}>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={selected.includes(a.key)}
                  onChange={(e) => setSelected(e.target.checked ? [...selected, a.key] : selected.filter((k) => k !== a.key))}
                />
                <span>
                  <strong>{a.name}</strong>
                  <span className="muted small"> · {a.pause ? `coupée ${pauseLabel(a.pause.until)}` : "surveillée"}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
      {activeTargets.length > 0 && (
        <div className="row wrap">
          <select value={duration} onChange={(e) => setDuration(e.target.value)}>
            {PAUSE_DURATIONS.map((d) => (
              <option key={d.label} value={d.minutes === null ? "none" : String(d.minutes)}>
                {d.label}
              </option>
            ))}
          </select>
          <input placeholder="Motif (facultatif)" value={reason} maxLength={200} onChange={(e) => setReason(e.target.value)} />
          <button disabled={busy} onClick={() => send("/pause", activeTargets.map((a) => a.key))}>
            Couper la supervision{compact ? "" : ` (${activeTargets.length})`}
          </button>
        </div>
      )}
      {pausedTargets.length > 0 && (
        <button className="primary" disabled={busy} onClick={() => send("/resume", pausedTargets.map((a) => a.key))}>
          Reprendre la supervision{compact ? "" : ` (${pausedTargets.length})`}
        </button>
      )}
      {!compact && targets.length === 0 && <p className="muted small">Coche une ou plusieurs applis.</p>}
      {error && <p className="error small">{error}</p>}
    </div>
  );
}
