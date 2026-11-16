import { AdminWorkspace } from "@/components/AdminWorkspace";
import { getAdminOverviewPayload } from "@/lib/overview-service";
import {
  getStaffSession,
  hasPermission,
  ROLE_PERMISSIONS,
  StaffSession,
  verifyToken,
} from "@/lib/security";
import { ensureSystemBootstrapped, getAppConfig } from "@/lib/settings-service";

export const dynamic = "force-dynamic";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    _st?: string;
    err?: string;
    mode?: string;
  }>;
}) {
  const resolved = await searchParams;
  const tab = typeof resolved.tab === "string" ? resolved.tab : undefined;
  const queryToken =
    typeof resolved._st === "string" && resolved._st ? resolved._st : null;
  const errCode = typeof resolved.err === "string" ? resolved.err : undefined;
  const loginMode = resolved.mode === "employee" ? "employee" : "pin";

  let initialBranding = {
    storeName: "AYUB PARFUM",
    clubName: "AYUB CLUB PRO",
  };
  let initialSession: {
    staffType: "MASTER_ADMIN" | "EMPLOYEE";
    employeeId: number | null;
    role: "ADMIN" | "MANAGER" | "CASHIER";
    fullName: string;
    login: string;
  } | null = null;
  let initialPermissions: string[] = [];
  let initialOverview: Awaited<
    ReturnType<typeof getAdminOverviewPayload>
  > | null = null;

  try {
    await ensureSystemBootstrapped();
    const config = await getAppConfig();
    initialBranding = {
      storeName: config.storeName,
      clubName: config.clubName,
    };

    const session =
      (queryToken ? verifyToken<StaffSession>(queryToken) : null) ||
      (await getStaffSession());

    if (session) {
      initialSession = {
        staffType: session.staffType,
        employeeId: session.employeeId,
        role: session.role,
        fullName: session.fullName,
        login: session.login,
      };
      initialPermissions = ROLE_PERMISSIONS[session.role] || [];
      if (hasPermission(session.role, "view_dashboard")) {
        initialOverview = await getAdminOverviewPayload();
      }
    }
  } catch {
    // Fallback cleanly to client login
  }

  return (
    <AdminWorkspace
      initialTab={tab}
      initialBranding={initialBranding}
      initialSession={initialSession}
      initialPermissions={initialPermissions}
      initialOverview={initialOverview}
      initialStaffToken={queryToken}
      initialErrorCode={errCode}
      initialLoginMode={loginMode}
    />
  );
}
