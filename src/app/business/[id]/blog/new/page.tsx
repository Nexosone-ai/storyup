import { notFound } from "next/navigation";
import { getBusiness } from "@/lib/queries";
import { BlogComposer } from "@/components/blog/BlogComposer";

export const metadata = { title: "새 블로그 글" };

export default async function NewBlogPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const business = await getBusiness(id);
  if (!business) notFound();
  return <BlogComposer businessId={id} />;
}
