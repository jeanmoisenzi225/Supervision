import type { ReactNode } from "react";
import { createPortal } from "react-dom";

/** Place son contenu comme un niveau de plus de l'en-tête (rangée `.lvl` de `#hstack`), s'il existe. */
export function StackLevel({ children }: { children: ReactNode }) {
  const slot = document.getElementById("hstack");
  return slot ? createPortal(<div className="lvl tabs-lvl">{children}</div>, slot) : <>{children}</>;
}
