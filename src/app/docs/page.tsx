import { redirect } from "next/navigation";

// /docs -> dokumentasi Partner API versi terbaru.
export default function DocsIndexPage() {
  redirect("/docs/api-v1");
}
