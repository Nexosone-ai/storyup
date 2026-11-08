"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import {
  RecapShortsStudio,
  type RecapJobView,
} from "@/components/partner/RecapShortsStudio";
import {
  SimilarVideoStudio,
  type BatchView,
} from "@/components/partner/SimilarVideoStudio";
import {
  ProVideoStudio,
  type ProjectRow,
  type BizOption,
  type ProviderStatus,
} from "@/components/provideo/ProVideoStudio";

export type VideoHubTab = "recap" | "similar" | "pro";

export interface RecapHubData {
  businesses: BizOption[];
  jobs: RecapJobView[];
  basePrice: number | null;
  imagePrice: number | null;
  providers: { script: boolean; tts: boolean };
  youtube: { configured: boolean; connected: boolean; channelTitle: string | null };
}
export interface SimilarHubData {
  configured: boolean;
  batches: BatchView[];
  cost: number | null;
}
export interface ProHubData {
  projects: ProjectRow[];
  businesses: BizOption[];
  providers: ProviderStatus;
}

/**
 * 파트너 영상 허브 — 한 페이지에서 탭으로 전환:
 * 글로 영상 만들기(요약 쇼츠) / AI로 관련 영상 10개(유사영상) / 전문 영상(플래그).
 * 탭 전환은 history.replaceState 로 URL(?tab=)만 바꿔 서버 왕복 없이 유지한다.
 */
export function PartnerVideoHub(props: {
  initialTab: VideoHubTab;
  credits: number;
  recap: RecapHubData | null;
  similar: SimilarHubData;
  pro: ProHubData | null;
}) {
  const [tab, setTab] = useState<VideoHubTab>(props.initialTab);
  const tabs: { id: VideoHubTab; label: string; desc: string }[] = [
    ...(props.recap
      ? [
          {
            id: "recap" as const,
            label: "글로 영상 만들기",
            desc: "고객 블로그 글 1개 → 30~40초 내레이션 요약 쇼츠",
          },
        ]
      : []),
    {
      id: "similar" as const,
      label: "AI로 관련 영상 10개",
      desc: "원본 영상 1개 + 컨셉 → 같은 분위기의 새 영상 10편",
    },
    ...(props.pro
      ? [
          {
            id: "pro" as const,
            label: "전문 영상",
            desc: "스토리→이미지→영상→음악 단계별 제작",
          },
        ]
      : []),
  ];
  const current = tabs.find((t) => t.id === tab) ?? tabs[0];

  const switchTab = (id: VideoHubTab) => {
    setTab(id);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", id);
      window.history.replaceState(null, "", url.toString());
    } catch {
      /* noop */
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow mb-2">파트너 대행</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">영상 만들기</h1>
          <p className="mt-1.5 text-muted">
            블로그 글로 요약 쇼츠를 만들거나, 원본 영상 하나로 관련 영상 10개를 한 번에 만듭니다.
            모두 패킷(크레딧)으로 차감돼요.
          </p>
        </div>
        <div className="flex gap-3">
          <Card className="px-4 py-3 text-right">
            <p className="text-xs text-muted">보유 패킷</p>
            <p className="text-2xl font-semibold tabular-nums">
              {props.credits.toLocaleString()}
            </p>
          </Card>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => switchTab(t.id)}
            className={`whitespace-nowrap px-4 py-2.5 text-sm font-semibold transition-colors ${
              current.id === t.id
                ? "border-b-2 border-primary text-primary"
                : "text-muted hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <p className="-mt-3 text-sm text-muted">{current.desc}</p>

      {current.id === "recap" && props.recap && (
        <RecapShortsStudio
          embedded
          businesses={props.recap.businesses}
          jobs={props.recap.jobs}
          credits={props.credits}
          basePrice={props.recap.basePrice}
          imagePrice={props.recap.imagePrice}
          providers={props.recap.providers}
          youtube={props.recap.youtube}
        />
      )}
      {current.id === "similar" && (
        <SimilarVideoStudio
          embedded
          configured={props.similar.configured}
          batches={props.similar.batches}
          credits={props.credits}
          cost={props.similar.cost}
        />
      )}
      {current.id === "pro" && props.pro && (
        <ProVideoStudio
          embedded
          projects={props.pro.projects}
          businesses={props.pro.businesses}
          providers={props.pro.providers}
        />
      )}
    </div>
  );
}
