import { redirect } from "next/navigation";

export default function AdminChangePasswordRedirectPage() {
  redirect("/admin/security");
}
