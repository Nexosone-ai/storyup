"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Label, Select } from "@/components/ui/Field";
import { Icon } from "@/components/ui/icons";
import { StepHeader, type StudioStep } from "./StepHeader";
import { CardNewsStudio } from "@/components/cards/CardNewsStudio";
import type { ShortsQuota, ShortsYoutube } from "@/components/cards/ShortsPanel";
import { MarketingHub } from "@/components/marketing/MarketingHub";
import { VideoEditor } from "@/components/video/VideoEditor";
import { VideoStudio } from "@/components/video/VideoStudio";
import type { CardNewsResult } from "@/types/domain";

export interface StudioPost {
  id: string;
  title: string;
  slug?: string;
  published?: boolean;
  socialCaption?: string | null;
}

export interface StudioVideoData {
  pricing: { price: number; balance: number };
  engineReady: boolean;
  videos: { id: string; title: string | null; url: string; createdAt: string }[];
  pendingJobs: { id: string; prompt: string; createdAt: string }[];
}

type Clip = { blob: Blob; ext: string; url?: string };

const STEP_COUNT = 6;
const clampStep = (n: number) => (Number.isInteger(n) && n >= 1 && n <= STEP_COUNT ? n : 0);

/**
 * 콘텐츠 스튜디오 — 글 선택 → 카드뉴스 → 쇼츠 만들기 → 쇼츠 편집 → 공유 → AI 동영상을
 * 한 페이지에서 단계적으로 처리한다.
 * - CardNewsStudio(카드·쇼츠·공유)는 단계와 무관하게 '항상' 마운트해 상태(카드·이미지·쇼츠 Blob)를
 *   보존하고, `view` 로 보이는 섹션만 바꾼다.
 * - 단계는 URL ?step= 과 동기화(history.replaceState — 서버 왕복 없음).
 */
export function ContentStudio(props: {
  businessId: string;
  ko: boolean;
  posts: StudioPost[];
  brandName: string;
  handle: string;
  siteSlug: string | null;
  initialCards?: {
    cardNews?: CardNewsResult;
    blogPostId?: string;
    id?: string;
    thanks?: number;
    views?: number;
  };
  initialText: { instagram?: string; facebook?: string; blogPostId?: string };
  shortsQuota: ShortsQuota | null;
  shortsYoutube: ShortsYoutube | null;
  /** 카드뉴스·쇼츠는 유료 전용 — 무료 플랜이면 업그레이드 안내. */
  isFreePlan: boolean;
  /** AI 동영상 데이터(null = 플랜 미제공 → 업그레이드 안내). */
  video: StudioVideoData | null;
  channelAdsEnabled: boolean;
  /** 서버가 계산한 초기 단계·글(SSR/클라이언트 일치). */
  initialStep: number;
  initialPostId: string;
}) {
  const { ko, businessId } = props;
  const sp = useSearchParams();
  const [step, setStepState] = useState<number>(() => {
    const fromUrl = clampStep(Number(sp.get("step")));
    return fromUrl || props.initialStep;
  });
  const [postId, setPostId] = useState<string>(() => {
    const fromUrl = sp.get("post");
    return fromUrl && props.posts.some((p) => p.id === fromUrl) ? fromUrl : props.initialPostId;
  });
  const [cardState, setCardState] = useState<{
    hasData: boolean;
    dataPostId: string | null;
    cardNewsId: string | null;
  }>({
    hasData: !!props.initialCards?.cardNews,
    dataPostId: props.initialCards?.blogPostId ?? null,
    cardNewsId: props.initialCards?.id ?? null,
  });
  const [shortsClip, setShortsClip] = useState<Clip | null>(null);
  const [editedClip, setEditedClip] = useState<Clip | null>(null);

  const setStep = (n: number) => {
    setStepState(n);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("step", String(n));
      window.history.replaceState(null, "", url.toString());
    } catch {
      /* noop */
    }
  };

  // 쇼츠 Blob → 편집기 입력용 object URL(바뀌면 이전 것 해제).
  const shortsUrl = useMemo(
    () => (shortsClip ? URL.createObjectURL(shortsClip.blob) : null),
    [shortsClip],
  );
  useEffect(() => {
    return () => {
      if (shortsUrl) URL.revokeObjectURL(shortsUrl);
    };
  }, [shortsUrl]);

  const published = props.posts.filter((p) => p.published);
  const postOk = !!postId;
  const cardsOk = cardState.hasData && cardState.dataPostId === postId;
  const shortsOk = !!shortsClip || (props.shortsQuota?.used ?? 0) > 0;
  const editedOk = !!editedClip;
  const videoOk = (props.video?.videos.length ?? 0) > 0;

  const steps: StudioStep[] = [
    { n: 1, label: ko ? "글 선택" : "Pick a post", done: postOk, hint: ko ? "발행된 블로그 글 고르기" : "Choose a published post" },
    { n: 2, label: ko ? "카드뉴스" : "Card news", done: cardsOk, locked: !postOk, hint: ko ? "글로 카드뉴스 만들기" : "Make cards from the post" },
    { n: 3, label: ko ? "쇼츠 만들기" : "Make short", done: shortsOk, locked: !cardsOk, hint: ko ? "카드뉴스로 9:16 쇼츠" : "9:16 short from cards" },
    { n: 4, label: ko ? "쇼츠 편집" : "Edit short", done: editedOk, locked: !shortsClip, optional: true, hint: ko ? "자르기·자막·음악" : "Trim · captions · music" },
    { n: 5, label: ko ? "공유" : "Share", done: false, optional: true, hint: ko ? "PNG·링크·유튜브·캡션" : "PNG · link · YouTube · caption" },
    { n: 6, label: ko ? "AI 동영상" : "AI video", done: videoOk, optional: true, hint: ko ? "장면 설명으로 AI 영상" : "AI video from a prompt" },
  ];

  // CardNewsStudio 가 보여줄 섹션 — 그 외 단계에서도 언마운트하지 않고 'none'.
  const cardView =
    step === 2 ? "cards" : step === 3 ? "shorts" : step === 5 ? "share" : "none";
  const selectedPost = props.posts.find((p) => p.id === postId);

  const upgrade = (title: string, desc: string) => (
    <Card className="p-6 text-center">
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted">{desc}</p>
      <ButtonLink href="/dashboard/plans" className="mt-3" size="sm">
        {ko ? "플랜 보기" : "View plans"}
      </ButtonLink>
    </Card>
  );

  return (
    <div className="space-y-6">
      <StepHeader
        steps={steps}
        current={step}
        onSelect={setStep}
        nextLabel={ko ? "다음 단계" : "Next step"}
      />

      {/* ── 1. 글 선택 ── */}
      {step === 1 && (
        <Card className="space-y-4" data-tour="studio-post">
          <div>
            <h2 className="font-semibold">{ko ? "어떤 글로 만들까요?" : "Which post?"}</h2>
            <p className="mt-1 text-sm text-muted">
              {ko
                ? "발행된 블로그 글을 고르면 그 글로 카드뉴스 → 쇼츠 → 공유까지 이어서 만듭니다."
                : "Pick a published post; we'll turn it into cards, a short, and shareables."}
            </p>
          </div>
          {published.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-center">
              <p className="text-sm text-muted">
                {ko
                  ? "발행된 글이 아직 없어요. 먼저 블로그 글을 쓰고 발행해주세요."
                  : "No published posts yet. Write and publish one first."}
              </p>
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                <ButtonLink href={`/business/${businessId}/blog/new`} size="sm">
                  <Icon.pen className="size-4" />
                  {ko ? "새 글 쓰기" : "Write a post"}
                </ButtonLink>
                <ButtonLink href={`/business/${businessId}/blog`} size="sm" variant="outline">
                  {ko ? "블로그 목록" : "Blog list"}
                </ButtonLink>
              </div>
            </div>
          ) : (
            <>
              <div>
                <Label htmlFor="studio-post">{ko ? "발행된 글" : "Published post"}</Label>
                <Select
                  id="studio-post"
                  value={postId}
                  onChange={(e) => setPostId(e.target.value)}
                >
                  <option value="">{ko ? "선택" : "Select"}</option>
                  {published.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={() => setStep(2)} disabled={!postOk}>
                  {ko ? "이 글로 시작 →" : "Start with this post →"}
                </Button>
                <ButtonLink href={`/business/${businessId}/blog/new`} size="sm" variant="outline">
                  <Icon.pen className="size-4" />
                  {ko ? "새 글 쓰기" : "Write a new post"}
                </ButtonLink>
              </div>
            </>
          )}
        </Card>
      )}

      {/* ── 2·3·5 공통: CardNewsStudio 는 항상 마운트(상태 보존), view 로 섹션만 전환 ── */}
      {props.isFreePlan ? (
        (step === 2 || step === 3 || step === 5) &&
        upgrade(
          ko ? "카드뉴스·쇼츠는 유료 플랜(Basic 이상) 기능입니다." : "Card news & shorts need a paid plan (Basic+).",
          ko ? "플랜을 업그레이드하면 글을 카드뉴스와 쇼츠로 바로 만들 수 있어요." : "Upgrade to turn posts into cards and shorts.",
        )
      ) : (
        <>
          {step === 2 && !cardsOk && cardState.hasData && (
            <p className="text-sm text-muted">
              {ko
                ? "지금 보이는 카드뉴스는 다른 글의 것이에요. 아래에서 '카드뉴스 생성'을 누르면 선택한 글로 새로 만듭니다."
                : "The cards shown belong to another post. Press Generate to make cards for the selected post."}
            </p>
          )}
          {step === 3 && (
            <p className="text-sm text-muted">
              {ko
                ? "카드뉴스를 배경으로 9:16 쇼츠를 만듭니다. 음악·페이드·카드 순서/시간을 조절한 뒤 '쇼츠 만들기'를 누르세요. 만든 영상은 자동 저장되고 다음 단계에서 편집할 수 있어요."
                : "Make a 9:16 short from the cards. Adjust music, fades and card timing, then press Make Short. The result is saved and editable in the next step."}
            </p>
          )}
          <CardNewsStudio
            businessId={businessId}
            posts={props.posts}
            brandName={props.brandName}
            handle={props.handle}
            siteSlug={props.siteSlug}
            initial={props.initialCards}
            shorts={props.shortsQuota}
            youtube={props.shortsYoutube}
            postId={postId}
            onPostChange={setPostId}
            onStateChange={setCardState}
            view={cardView}
            shortsView={step === 5 ? "share" : "make"}
            onShortsRendered={(blob, ext) => {
              setShortsClip({ blob, ext });
              setEditedClip(null);
            }}
            shortsBlobOverride={editedClip}
          />
        </>
      )}

      {/* ── 4. 쇼츠 편집 ── */}
      {step === 4 &&
        (shortsClip && shortsUrl ? (
          <div className="space-y-3">
            <p className="text-sm text-muted">
              {ko
                ? "방금 만든 쇼츠를 자르고 자막·배경음악·비율을 바꿉니다. '다운로드' 또는 '저장'하면 편집본이 공유 단계에 쓰여요."
                : "Trim the short and add captions, music or a new aspect. Download or Save to use the edited version in Share."}
            </p>
            <VideoEditor
              inline
              businessId={businessId}
              fileUrl={shortsUrl}
              title={selectedPost?.title ?? null}
              ko={ko}
              onClose={() => setStep(5)}
              onResult={(r) => setEditedClip(r)}
            />
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setStep(5)}>
                {ko ? "편집 없이 공유 단계로 →" : "Skip to Share →"}
              </Button>
            </div>
          </div>
        ) : (
          <Card className="p-6 text-center">
            <p className="text-sm text-muted">
              {ko
                ? "편집할 쇼츠가 없어요. 먼저 '쇼츠 만들기' 단계에서 영상을 만들어주세요."
                : "Nothing to edit yet — make a short first."}
            </p>
            <Button className="mt-3" size="sm" onClick={() => setStep(3)}>
              {ko ? "쇼츠 만들기로" : "Go to Make short"}
            </Button>
          </Card>
        ))}

      {/* ── 5. 공유: SNS 캡션 + 채널 공유 의뢰 (카드·쇼츠 공유는 위 CardNewsStudio share 뷰) ── */}
      {step === 5 && (
        <div className="space-y-6">
          <section className="space-y-3">
            <h2 className="text-lg font-semibold tracking-tight">
              {ko ? "SNS 캡션" : "Social captions"}
            </h2>
            <MarketingHub
              businessId={businessId}
              posts={props.posts.map((p) => ({ id: p.id, title: p.title }))}
              initial={props.initialText}
              postId={postId || undefined}
            />
          </section>
          {props.channelAdsEnabled && (
            <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
              <div>
                <p className="font-semibold">
                  {ko ? "다른 채널에 공유 의뢰하기" : "Ask other channels to share"}
                </p>
                <p className="mt-0.5 text-sm text-muted">
                  {ko
                    ? "팔로워를 가진 채널 보유자에게 이 글·카드뉴스 공유를 유료로 의뢰할 수 있어요."
                    : "Pay channel owners to share this post or card news with their followers."}
                </p>
              </div>
              <ButtonLink href="/dashboard/ads" size="sm" variant="outline">
                {ko ? "채널 공유 마켓 열기" : "Open channel market"}
              </ButtonLink>
            </Card>
          )}
        </div>
      )}

      {/* ── 6. AI 동영상 ── */}
      {step === 6 &&
        (props.video ? (
          <div className="space-y-3">
            <p className="text-sm text-muted">
              {ko
                ? "원하는 장면을 설명하면 AI가 소리까지 담긴 영상을 만들어요. 완성 영상은 랜딩·블로그·SNS에 바로 쓸 수 있어요."
                : "Describe a scene and AI makes a video with sound, ready for your site, blog or social."}
            </p>
            <VideoStudio
              businessId={businessId}
              pricing={props.video.pricing}
              engineReady={props.video.engineReady}
              videos={props.video.videos}
              pendingJobs={props.video.pendingJobs}
              ko={ko}
            />
          </div>
        ) : (
          upgrade(
            ko ? "AI 영상은 유료 플랜(Basic/Pro)에서 사용할 수 있어요." : "AI video needs a paid plan (Basic/Pro).",
            ko ? "AI 영상은 생성 1편당 UP 포인트가 차감됩니다." : "AI video costs UP points per generation.",
          )
        ))}
    </div>
  );
}
