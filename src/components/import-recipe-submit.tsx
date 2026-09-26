"use client";

import { useFormStatus } from "react-dom";

export function ImportRecipeSubmit() {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending}><span aria-live="polite">{pending ? "Importing recipe…" : "Import recipe"}</span></button>;
}
