import "server-only";

export { getAuthService } from "@/lib/auth/factory";
export type { AuthService } from "@/lib/auth/service";
export {
  getCurrentUser,
  getRequestPath,
  requireAdmin,
  requireUser,
} from "@/lib/auth/session";
export type { SessionUser, ViewMode } from "@/lib/auth/types";
export {
  getViewMode,
  isAdminView,
  resolveViewMode,
} from "@/lib/auth/view-mode";
