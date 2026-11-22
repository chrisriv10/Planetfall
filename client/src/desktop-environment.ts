/** A data-only capability flag from the sandboxed Electron preload. It only
 * disables unsupported account UI; it grants no privileges or identity. */
export function isDesktopGuest(environment:unknown=globalThis):boolean {
  if(!environment||typeof environment!=="object")return false;
  const flag=(environment as {planetfallDesktop?:{platform?:unknown;guestOnly?:unknown}}).planetfallDesktop;
  return flag?.platform==="win32"&&flag.guestOnly===true;
}
