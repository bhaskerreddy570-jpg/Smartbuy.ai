import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { FilesClient } from "@/components/portal/files-client";
import { loadContactsPortalData } from "@/lib/contacts/portal-data";
import { getDashboardData } from "@/lib/dashboard";
import { isFileCategory } from "@/lib/storage/categories";

type FilesPageProps = {
  searchParams: Promise<{ q?: string; category?: string }>;
};

export default async function FilesPage({ searchParams }: FilesPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const params = await searchParams;
  const category =
    params.category && isFileCategory(params.category)
      ? params.category
      : undefined;
  const data = await getDashboardData(session.user.id, { category });

  if (!data) {
    redirect("/login");
  }

  const contactsData =
    category === "CONTACTS"
      ? await loadContactsPortalData(session.user.id)
      : undefined;

  return (
    <FilesClient
      initialData={data}
      initialQuery={params.q ?? ""}
      contactsData={contactsData}
    />
  );
}
