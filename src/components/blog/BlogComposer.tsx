"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Textarea, Label, Select } from "@/components/ui/Field";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/icons";
import { GeneratingScreen } from "@/components/ai/GeneratingScreen";
import { useLocale } from "@/components/i18n/LocaleProvider";
import {
  BLOG_TONES,
  BLOG_LENGTHS,
  BLOG_TONE_LABEL,
  BLOG_LENGTH_LABEL,
  type BlogTone,
  type BlogLength,
} from "@/types/domain";

const STEPS_KO = [
  "주제를 분석하는 중...",
  "구성을 잡는 중...",
  "글을 쓰는 중...",
  "SEO를 다듬는 중...",
  "커버 이미지를 만드는 중...",
];

const STEPS_EN = [
  "Analyzing the topic...",
  "Outlining the post...",
  "Writing the post...",
  "Polishing SEO...",
  "Creating the cover image...",
];

export function BlogComposer({ businessId }: { businessId: string }) {
  const router = useRouter();
  const ko = useLocale() === "ko";
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState<BlogTone>("Friendly");
  const [length, setLength] = useState<BlogLength>("Medium");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    if (!topic.trim()) {
      setError(
        ko
          ? "어떤 내용을 쓰고 싶은지 알려주세요."
          : "Tell us what you would like to write about.",
      );
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
      if (!res.ok)
        throw new Error(
          json.error ?? (ko ? "생성에 실패했습니다." : "Generation failed."),
        );
      router.push(`/business/${businessId}/blog/${json.postId}`);
    } catch (e) {
      setGenerating(false);
      setError(
        e instanceof Error
          ? e.message
          : ko
            ? "생성에 실패했습니다."
            : "Generation failed.",
      );
    }
  };

  if (generating && !error) {
    return (
      <GeneratingScreen
        title={ko ? "블로그 글을 쓰고 있어요..." : "Writing your blog post..."}
        steps={ko ? STEPS_KO : STEPS_EN}
      />
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {ko
            ? "어떤 이야기를 나누고 싶으세요?"
            : "What story would you like to share?"}
        </h1>
        <p className="mt-1 text-muted">
          {ko
            ? "주제를 알려주면 AI가 블로그 글로 만들어드립니다."
            : "Give us a topic and AI will turn it into a blog post."}
        </p>
      </div>

      <Card className="space-y-5">
        <div>
          <Label htmlFor="topic">{ko ? "주제" : "Topic"}</Label>
          <Textarea
            id="topic"
            autoFocus
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder={
              ko
                ? "예: 오늘 새로 출시한 딸기 케이크에 대해 홍보하고 싶어요."
                : "e.g. I want to promote the strawberry cake we launched today."
            }
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="tone">{ko ? "톤" : "Tone"}</Label>
            <Select
              id="tone"
              value={tone}
              onChange={(e) => setTone(e.target.value as BlogTone)}
            >
              {BLOG_TONES.map((t) => (
                <option key={t} value={t}>
                  {ko ? BLOG_TONE_LABEL[t] : t}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="length">{ko ? "분량" : "Length"}</Label>
            <Select
              id="length"
              value={length}
              onChange={(e) => setLength(e.target.value as BlogLength)}
            >
              {BLOG_LENGTHS.map((l) => (
                <option key={l} value={l}>
                  {ko ? BLOG_LENGTH_LABEL[l] : l}
                </option>
              ))}
            </Select>
          </div>
        </div>
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button onClick={generate} className="w-full">
          <Icon.sparkles width={18} height={18} />
          {ko ? "글 생성하기" : "Generate post"}
        </Button>
      </Card>
    </div>
  );
}
