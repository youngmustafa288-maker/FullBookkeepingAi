/** Database reads must not silently become blank client workspaces. */
export function requireSuccessfulRead<T>(result: {data:T[] | null;error:unknown} | null | undefined,label:string):T[]
/** Distinguishes a genuinely absent workspace row from an invalid saved record. */
export function requireWorkspaceState<T>(row: {state: T} | null | undefined, createEmptyState:()=>T):T
