export type Role = "therapist" | "client";

const lastRoleKey = "lastRole";

export function getStoredRole(): Role | null {
  const value = localStorage.getItem(lastRoleKey);
  return value === "therapist" || value === "client" ? value : null;
}

export function storeRole(role: Role) {
  localStorage.setItem(lastRoleKey, role);
}

