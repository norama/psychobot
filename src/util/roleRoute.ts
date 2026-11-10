import { getStoredWorkspace } from "./workspaceData";

export type Role = "therapist" | "client";

const lastRoleKey = "lastRole";

export function getStoredRole(): Role | null {
  const value = localStorage.getItem(lastRoleKey);
  return value === "therapist" || value === "client" ? value : null;
}

export function storeRole(role: Role) {
  localStorage.setItem(lastRoleKey, role);
}

export const isInvitationRoute = /^\/invite\/?$/.test(window.location.pathname);

// Only /therapist and /client are valid. Anything else (including /) falls
// back to the last-used role, so the URL always matches the screen.
function resolveRole(): Role {
  if (isInvitationRoute) {
    return getStoredRole() ?? "client";
  }

  const match = /^\/(therapist|client)\/?$/.exec(window.location.pathname);
  if (match) {
    const role = match[1] as Role;
    storeRole(role);
    return role;
  }
  // A plain visit to / goes straight back to the last opened workspace.
  const lastWorkspace =
    window.location.pathname === "/" && !window.location.search
      ? getStoredWorkspace()
      : null;
  if (lastWorkspace) {
    storeRole(lastWorkspace.role);
    window.history.replaceState(
      null,
      "",
      `/${lastWorkspace.role}?workspace=${lastWorkspace.id}`,
    );
    return lastWorkspace.role;
  }
  const role = getStoredRole() ?? "client";
  window.history.replaceState(null, "", `/${role}${window.location.search}`);
  return role;
}

export const currentRole = resolveRole();
