import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getBusiness,
  getBrandProfile,
  getWebsite,
  getBlogPosts,
} from "@/lib/queries";
import { Card, Badge } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/icons";

export const metadata = { title: "비즈니스 개요" };

export default async function BusinessOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const business = await getBusiness(id);
  if (!business) notFound();

  const [brand, website, posts] = await Promise.all([
    getBrandProfile(id),
    getWebsite(id),
    getBlogPosts(id),
  ]);

  const base = `/business/${id}`;
  const steps = [
    {
      label: "브랜드 스토리",
      done: !!brand,
      href: `${base}/brand`,
      icon: Icon.sparkles,
      cta: brand ? "보기" : "만들기",
    },
    {
      label: "홈페이지",
      done: website?.status === "published",
      partial: !!website,
      href: `${base}/website`,
      icon: Icon.globe,
      cta: website ? (website.status === "published" ? "공개됨" : "편집") : "만들기",
    },
    {
      label: "블로그",
      done: posts.some((p) => p.status === "published"),
      partial: posts.length > 0,
      href: `${base}/blog`,
      icon: Icon.pen,
      cta: posts.length ? "관리" : "글쓰기",
    },
    {
      label: "마케팅 콘텐츠",
      done: false,
      href: `${base}/marketing`,
      icon: Icon.megaphone,
      cta: "만들기",
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="eyebrow mb-2">워크스페이스</p>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold uppercase tracking-tight sm:text-3xl">
              {business.name}
            </h1>
            {website?.status === "published" ? (
              <Badge tone="success">
                <span className="size-1.5 rounded-full bg-primary" />
                공개됨
              </Badge>
            ) : (
              <Badge tone="muted">비공개</Badge>
            )}
          </div>
          <p className="mt-1.5 text-muted">{business.category}</p>
        </div>
        {website?.status === "published" && (
          <ButtonLink
            href={`/site/${website.slug}`}
            variant="outline"
            size="sm"
          >
            <Icon.external width={16} height={16} />
            공개 홈페이지 열기
          </ButtonLink>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {steps.map((s) => {
          const StepIcon = s.icon;
          return (
            <Link key={s.label} href={s.href} className="group">
              <Card className="flex items-center justify-between transition-[border-color,box-shadow,transform] duration-200 group-hover:-translate-y-0.5 group-hover:border-border-strong group-hover:shadow-md">
                <div className="flex items-center gap-4">
                  <div className="grid size-11 place-items-center rounded-xl bg-primary-soft text-primary">
                    <StepIcon />
                  </div>
                  <div>
                    <p className="font-semibold tracking-tight">{s.label}</p>
                    <p className="text-sm text-muted">
                      {s.done ? "완료" : s.partial ? "진행 중" : "시작 전"}
                    </p>
                  </div>
                </div>
                <span className="text-sm font-medium text-primary">
                  {s.cta} →
                </span>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
