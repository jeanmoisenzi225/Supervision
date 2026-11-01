export function formatBytes(v: number): string {
  if (v >= 1024 ** 3) return `${(v / 1024 ** 3).toFixed(v >= 10 * 1024 ** 3 ? 0 : 1)} Go`;
  if (v >= 1024 ** 2) return `${Math.round(v / 1024 ** 2)} Mo`;
  if (v >= 1024) return `${Math.round(v / 1024)} Ko`;
  return `${Math.round(v)} o`;
}

export function formatCount(v: number): string {
  return v >= 1000 ? `${(v / 1000).toFixed(v >= 10_000 ? 0 : 1)} k` : `${Math.round(v)}`;
}

export const formatMs = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(1)} s` : `${Math.round(v)} ms`);
export const formatCpu = (v: number) => `${v.toFixed(v < 0.1 ? 3 : 2)} cœur`;

export function pct(used: number | null | undefined, limit: number | null | undefined): number | null {
  if (used == null || !limit) return null;
  return Math.round((used / limit) * 1000) / 10;
}
