"use client";

import { useState } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Label, Select } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Spinner";
import { Icon } from "@/components/ui/icons";
import { GuideSteps } from "@/components/ui/GuideCard";
import { useLocale } from "@/components/i18n/LocaleProvider";

interface PostOption {
  id: string;
  title: string;
}

export function MarketingHub({
  businessId,
  posts,
  initial,
}: {
  businessId: string;
  posts: PostOption[];
  initial: { instagram?: string; facebook?: string; blogPostId?: string };
}) {
  const ko = useLocale() === "ko";
  const [postId, setPostId] = useState(
    initial.blogPostId ?? posts[0]?.id ?? "",
  );
  const [instagram, setInstagram] = useState(initial.instagram ?? "");
  const [facebook, setFacebook] = useState(initial.facebook ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    if (!postId) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/ai/marketing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, blogPostId: postId }),
      });
      const json = await res.json();
      if (!res.ok)
        throw new Error(
          json.error ?? (ko ? "생성에 실패했습니다." : "Generation failed."),
        );
      setInstagram(json.instagram ?? "");
      setFacebook(json.facebook ?? "");
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : ko
            ? "생성에 실패했습니다."
            : "Generation failed.",
      );
    } finally {
      setLoading(false);
    }
  };

  if (posts.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-surface p-12 text-center">
        <p className="text-muted">
          {ko
            ? "먼저 블로그 글을 작성해주세요. 블로그 글을 SNS 콘텐츠로 바꿔드립니다."
            : "Write a blog post first — we turn blog posts into social content."}
        </p>
        <ButtonLink
          href={`/business/${businessId}/blog/new`}
          variant="outline"
          className="mt-5"
        >
          <Icon.pen width={16} height={16} />
          {ko ? "블로그 글 쓰러 가기" : "Go write a blog post"}
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="space-y-4">
        <div>
          <Label htmlFor="post">{ko ? "블로그 글 선택" : "Choose a blog post"}</Label>
          <Select
            id="post"
            value={postId}
            onChange={(e) => setPostId(e.target.value)}
          >
            {posts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex flex-wrap gap-2 text-sm text-muted">
          {ko ? "변환 대상:" : "Formats:"}
          <span className="rounded-full bg-primary-soft px-3 py-0.5 text-primary">
            Instagram
          </span>
          <span className="rounded-full bg-primary-soft px-3 py-0.5 text-primary">
            Facebook
          </span>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button onClick={generate} disabled={loading}>
          {loading ? <Spinner /> : <Icon.sparkles width={18} height={18} />}
          {ko ? "SNS 콘텐츠 생성" : "Generate social posts"}
        </Button>
      </Card>

      {(instagram || facebook) && (
        <>
          <div className="grid gap-5 md:grid-cols-2">
            <PlatformCard label="Instagram" text={instagram} />
            <PlatformCard label="Facebook" text={facebook} />
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold tracking-tight">
              {ko ? "이제 이렇게 올리세요" : "Now post it like this"}
            </h3>
            <div className="grid gap-5 md:grid-cols-2">
              <Card className="space-y-4">
                <p className="flex items-center gap-2 font-semibold">
                  <Icon.instagramBrand width={18} height={18} />
                  Instagram
                </p>
                <GuideSteps
                  steps={[
                    {
                      title: ko
                        ? "위 캡션을 '복사' 버튼으로 복사하세요"
                        : "Copy the caption above with the Copy button",
                    },
                    {
                      title: ko
                        ? "인스타그램 앱에서 ➕ 새 게시물을 누르고 사진을 고르세요"
                        : "In the Instagram app, tap ➕ New post and pick photos",
                      desc: ko
                        ? "카드뉴스 이미지를 쓰면 보기 좋아요."
                        : "Card news images work great here.",
                    },
                    {
                      title: ko
                        ? "캡션 칸에 붙여넣고 공유를 누르세요"
                        : "Paste into the caption field and tap Share",
                    },
                  ]}
                />
                <a
                  href="#card-news"
                  className="inline-block text-sm font-medium text-primary hover:underline"
                >
                  {ko
                    ? "이미지가 필요하면 아래 '카드뉴스 이미지'에서 만들 수 있어요 ↓"
                    : "Need images? Make them in 'Card news images' below ↓"}
                </a>
              </Card>
              <Card className="space-y-4">
                <p className="flex items-center gap-2 font-semibold">
                  <Icon.facebookBrand width={18} height={18} />
                  Facebook
                </p>
                <GuideSteps
                  steps={[
                    {
                      title: ko
                        ? "위 캡션을 복사하세요"
                        : "Copy the caption above",
                    },
                    {
                      title: ko
                        ? "페이스북 앱/페이지에서 '게시물 만들기'를 여세요"
                        : "Open 'Create post' in the Facebook app or your page",
                    },
                    {
                      title: ko
                        ? "붙여넣고 게시를 누르세요"
                        : "Paste and hit Post",
                      desc: ko
                        ? "랜딩페이지 링크를 함께 붙이면 방문으로 이어져요."
                        : "Add your landing page link to drive visits.",
                    },
                  ]}
                />
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function PlatformCard({ label, text }: { label: string; text: string }) {
  const ko = useLocale() === "ko";
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  if (!text) return null;
  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold">{label}</h3>
        <Button variant="outline" size="sm" onClick={copy}>
          {copied ? (
            <Icon.check width={16} height={16} />
          ) : (
            <Icon.copy width={16} height={16} />
          )}
          {copied ? (ko ? "복사됨" : "Copied") : ko ? "복사" : "Copy"}
        </Button>
      </div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
        {text}
      </p>
    </Card>
  );
}
