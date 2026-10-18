import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { Workspace } from "@/components/workspace";
import { inviteCallback } from "@/lib/callback";
const allowed = [
  "dashboard",
  "transactions",
  "wallets",
  "budgets",
  "goals",
  "bills",
  "reports",
  "household",
  "household/invitations",
  "notifications",
  "settings",
  "settings/profile",
  "settings/security",
  "onboarding",
];
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ path: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const path = (await params).path.join("/");
  const search = await searchParams;
  const callback =
    path === "household/invitations" && typeof search.token === "string"
      ? inviteCallback("/household/invitations?token=" + search.token)
      : "";
  if (!allowed.includes(path)) redirect("/dashboard");
  let user;
  try {
    user = await currentUser();
  } catch {
    redirect(
      "/login" +
        (callback ? "?callbackUrl=" + encodeURIComponent(callback) : ""),
    );
  }
  return (
    <Workspace
      path={path}
      user={{ id: user.id, name: user.name, email: user.email }}
    />
  );
}
