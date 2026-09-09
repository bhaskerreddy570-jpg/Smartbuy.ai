import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { FilesClient } from "@/components/portal/files-client";
import { getDashboardData } from "@/lib/dashboard";
import { isFileCategory } from "@/lib/storage/categories";
import { CUSTOMER_FILE_CATEGORIES } from "@/lib/storage/types";

type FilesPageProps = {
  searchParams: Promise<{ q?: string; category?: string }>;
};

export default async function FilesPage({ searchParams }: FilesPageProps) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const params = await searchParams;
  const categoryParam =
    params.category && isFileCategory(params.category)
      ? params.category
      : undefined;
  const category =
    categoryParam && (CUSTOMER_FILE_CATEGORIES as readonly string[]).includes(categoryParam)
      ? categoryParam
      : categoryParam === "CONTACTS"
        ? undefined
        : categoryParam;

  const data = await getDashboardData(session.user.id, { category });

  if (!data) {
    redirect("/login");
  }

  return <FilesClient initialData={data} initialQuery={params.q ?? ""} />;
}
