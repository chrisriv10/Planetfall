const escapeText = (value: string): string => value.replace(/[&<>"']/g, char => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
}[char]!));

/** Inline presentation only; unknown bindings remain safely escaped text. */
export function mouseButtonIcon(label: string): string {
  if (label !== "LMB" && label !== "RMB") return escapeText(label);
  const left = label === "LMB";
  const title = left ? "Left mouse button" : "Right mouse button";
  const path = left ? "M12 3C7 3 4 6 4 11v3h8Z" : "M12 3c5 0 8 3 8 8v3h-8Z";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="23" viewBox="0 0 24 30" role="img" aria-label="${title}" style="vertical-align:middle"><path d="${path}" fill="currentColor"/><rect x="4" y="3" width="16" height="24" rx="8" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 3v11M4 14h16" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>`;
}
