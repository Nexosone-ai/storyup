"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Textarea, Label, Select } from "@/components/ui/Field";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/icons";
import { GeneratingScreen } from "@/components/ai/GeneratingScreen";
import {
  BLOG_TONES,
  BLOG_LENGTHS,
  type BlogTone,
  type BlogLength,
} from "@/types/domain";

const STEPS = [
  "주제를 분석하는 중...",
  "구성을 잡는 중...",
  "글을 쓰는 중...",
  "SEO를 다듬는 중...",
];

export function BlogComposer({ businessId }: { businessId: string }) {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState<BlogTone>("Friendly");
  const [length, setLength] = useState<BlogLength>("Medium");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    if (!topic.trim()) {
      setError("어떤 내용을 쓰고 싶은지 알려주세요.");
      return;
    }
    setError(null);
    setGenerating(true);
    try {
      const res = await fetch("/api/ai/blog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, topic, tone, length }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "생성에 실패했습니다.");
      router.push(`/business/${businessId}/blog/${json.postId}`);
    } catch (e) {
      setGenerating(false);
      setError(e instanceof Error ? e.message : "생성에 실패했습니다.");
    }
  };

  if (generating && !error) {
    return (
      <GeneratingScreen title="블로그 글을 쓰고 있어요..." steps={STEPS} />
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          어떤 이야기를 나누고 싶으세요?
        </h1>
        <p className="mt-1 text-muted">
          주제를 알려주면 AI가 블로그 글로 만들어드립니다.
        </p>
      </div>

      <Card className="space-y-5">
        <div>
          <Label htmlFor="topic">주제</Label>
          <Textarea
            id="topic"
            autoFocus
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="예: 오늘 새로 출시한 딸기 케이크에 대해 홍보하고 싶어요."
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="tone">톤</Label>
            <Select
              id="tone"
              value={tone}
              onChange={(e) => setTone(e.target.value as BlogTone)}
            >
              {BLOG_TONES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="length">분량</Label>
            <Select
              id="length"
              value={length}
              onChange={(e) => setLength(e.target.value as BlogLength)}
            >
              {BLOG_LENGTHS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </Select>
          </div>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button onClick={generate} className="w-full">
          <Icon.sparkles width={18} height={18} />
          글 생성하기
        </Button>
      </Card>
    </div>
  );
}
