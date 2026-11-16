import { CustomerPortalView } from "@/components/CustomerPortalView";
import {
  getInitialPublicPortalPayload,
  loadCustomerPortalById,
} from "@/lib/portal-service";
import {
  CustomerSession,
  getCustomerSession,
  verifyToken,
} from "@/lib/security";

export const dynamic = "force-dynamic";

export default async function CustomerPortalPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; _ct?: string }>;
}) {
  const resolved = await searchParams;
  const validTabs = [
    "catalog",
    "profile",
    "bonuses",
    "vip",
    "discounts",
    "purchases",
  ] as const;
  type ValidTab = (typeof validTabs)[number];

  const tab: ValidTab = validTabs.includes(resolved.tab as ValidTab)
    ? (resolved.tab as ValidTab)
    : "catalog";
  const queryToken =
    typeof resolved._ct === "string" && resolved._ct ? resolved._ct : null;

  let initialData: Awaited<
    ReturnType<typeof getInitialPublicPortalPayload>
  > | null = null;
  let initialPortalData: Awaited<
    ReturnType<typeof loadCustomerPortalById>
  > | null = null;

  try {
    initialData = await getInitialPublicPortalPayload();
    const session =
      (queryToken ? verifyToken<CustomerSession>(queryToken) : null) ||
      (await getCustomerSession());
    if (session?.customerId) {
      initialPortalData = await loadCustomerPortalById(session.customerId);
    }
  } catch {
    initialData = null;
  }

  return (
    <CustomerPortalView
      initialTab={tab}
      initialBranding={initialData?.branding ?? null}
      initialProducts={initialData?.featuredProducts}
      initialPortalData={initialPortalData}
      initialCustomerToken={queryToken}
    />
  );
}
