"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Label, Select } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Spinner";
import { Icon } from "@/components/ui/icons";

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
      if (!res.ok) throw new Error(json.error ?? "생성에 실패했습니다.");
      setInstagram(json.instagram ?? "");
      setFacebook(json.facebook ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "생성에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  if (posts.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-surface p-12 text-center">
        <p className="text-muted">
          먼저 블로그 글을 작성해주세요. 블로그 글을 SNS 콘텐츠로 바꿔드립니다.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="space-y-4">
        <div>
          <Label htmlFor="post">블로그 글 선택</Label>
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
          변환 대상:
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
          SNS 콘텐츠 생성
        </Button>
      </Card>

      {(instagram || facebook) && (
        <div className="grid gap-5 md:grid-cols-2">
          <PlatformCard label="Instagram" text={instagram} />
          <PlatformCard label="Facebook" text={facebook} />
        </div>
      )}
    </div>
  );
}

function PlatformCard({ label, text }: { label: string; text: string }) {
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
          {copied ? "복사됨" : "복사"}
        </Button>
      </div>
      <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
        {text}
      </p>
    </Card>
  );
}
