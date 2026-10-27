import Link from "next/link";
import type { ReactNode } from "react";
import { getLocale } from "@/lib/i18n";

/**
 * 스토리업 이용가이드(초보자용 메뉴얼). 가입→랜딩→편집→블로그→분석/전환→
 * 카드뉴스/쇼츠→AI영상→대행 순서로, 눌러야 할 버튼을 강조한 '목업' 화면과 함께 안내한다.
 * 실제 스크린샷은 각 Screen 안에 이미지로 교체할 수 있게 구성했다(현재는 UI 목업).
 * 내용은 한국어 기준(제품 1차 사용자층). 서버 컴포넌트 — 상호작용 없음.
 */

/** 가짜 앱 화면 프레임 — 상단 크롬 + 내용. 실제 스크린샷으로 교체 가능한 슬롯. */
function Screen({ caption, children }: { caption?: string; children: ReactNode }) {
  return (
    <figure className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
      <div className="flex items-center gap-1.5 border-b border-border bg-surface-muted/60 px-3 py-2">
        <span className="size-2.5 rounded-full bg-foreground/15" />
        <span className="size-2.5 rounded-full bg-foreground/15" />
        <span className="size-2.5 rounded-full bg-foreground/15" />
        {caption && (
          <span className="ml-2 truncate text-xs text-muted">{caption}</span>
        )}
      </div>
      <div className="p-4 sm:p-5">{children}</div>
    </figure>
  );
}

/** 강조된 '눌러야 할' 버튼 — 펄스 링 + 손가락 라벨. */
function ClickBtn({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <span className="relative mr-2 inline-flex align-middle">
      <span
        className="absolute inset-0 animate-ping rounded-xl bg-primary/25"
        aria-hidden
      />
      <span className="relative inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow">
        {children}
      </span>
      {hint && (
        <span className="absolute -right-3 -top-3 whitespace-nowrap rounded-full bg-foreground px-2 py-0.5 text-[10px] font-bold text-white shadow">
          {hint} 👆
        </span>
      )}
    </span>
  );
}

/** 메뉴/탭 등 '여기 있어요' 위치를 가리키는 칩. */
function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-lg border border-primary/30 bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary">
      {children}
    </span>
  );
}

/** 단계 섹션 래퍼 — 번호 뱃지 + 제목 + 리드 + 본문. */
function Step({
  n,
  title,
  lead,
  children,
}: {
  n: number;
  title: string;
  lead: string;
  children: ReactNode;
}) {
  return (
    <section id={`step-${n}`} className="scroll-mt-24">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-extrabold text-primary-foreground">
          {n}
        </span>
        <div>
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">{title}</h2>
          <p className="mt-0.5 text-sm text-muted">{lead}</p>
        </div>
      </div>
      <div className="mt-4 space-y-4 border-l-2 border-primary/15 pl-4 sm:pl-6">
        {children}
      </div>
    </section>
  );
}

/** '이렇게 하세요' 번호 목록. */
function Dos({ items }: { items: ReactNode[] }) {
  return (
    <ol className="space-y-2.5">
      {items.map((it, i) => (
        <li key={i} className="flex items-start gap-2.5 text-sm">
          <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[11px] font-bold text-primary">
            {i + 1}
          </span>
          <span className="leading-relaxed">{it}</span>
        </li>
      ))}
    </ol>
  );
}

/** 강조 팁/장점 박스. */
function Tip({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-primary/20 bg-primary-soft/50 p-3.5">
      <p className="text-sm font-bold text-primary">💡 {title}</p>
      <div className="mt-1 text-sm leading-relaxed text-foreground/85">
        {children}
      </div>
    </div>
  );
}

/** 유튜브 영상 카드 — 16:9 반응형 임베드 + 라벨. */
function VideoCard({
  id,
  label,
  badge,
}: {
  id: string;
  label: string;
  badge: string;
}) {
  return (
    <figure className="overflow-hidden rounded-2xl border border-border bg-surface shadow-sm">
      <div className="relative aspect-video w-full bg-black">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${id}?rel=0`}
          title={label}
          className="absolute inset-0 size-full"
          loading="lazy"
          referrerPolicy="strict-origin-when-cross-origin"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
      <figcaption className="flex items-center gap-2 px-4 py-3">
        <span className="inline-flex items-center rounded-full bg-primary px-2.5 py-0.5 text-xs font-bold text-primary-foreground">
          {badge}
        </span>
        <span className="text-sm font-semibold">{label}</span>
      </figcaption>
    </figure>
  );
}

/** 블로그 글쓰기 4가지 방법 카드. */
function MethodCard({
  emoji,
  name,
  desc,
  perks,
}: {
  emoji: string;
  name: string;
  desc: string;
  perks: string[];
}) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-base font-bold">
        <span className="mr-1.5 text-lg">{emoji}</span>
        {name}
      </p>
      <p className="mt-1 text-xs text-muted">{desc}</p>
      <ul className="mt-2.5 space-y-1">
        {perks.map((p, i) => (
          <li key={i} className="flex gap-1.5 text-xs leading-relaxed">
            <span className="text-primary">✓</span>
            <span>{p}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export async function UserGuide() {
  const ko = (await getLocale()) === "ko";

  const toc = [
    "회원가입",
    "홈페이지 만들기",
    "홈페이지 편집",
    "블로그 글쓰기",
    "글 분석·고객 전환",
    "카드뉴스·쇼츠",
    "AI 영상",
    "대행 서비스",
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-10 pb-16">
      {/* 헤더 */}
      <header className="space-y-3">
        <p className="eyebrow">{ko ? "이용가이드" : "User guide"}</p>
        <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
          스토리업 처음이세요? 8단계로 끝내요
        </h1>
        <p className="text-muted">
          클릭 몇 번이면 홈페이지가 생기고, 글·카드뉴스·영상까지 만들 수 있어요.
          아래 순서대로만 따라오시면 됩니다. 어려운 건 <b>대행 서비스</b>가 대신
          해드려요.
        </p>
        {!ko && (
          <p className="rounded-lg border border-border bg-surface-muted/50 px-3 py-2 text-sm text-muted">
            This guide is currently available in Korean.
          </p>
        )}

        {/* 영상 메뉴얼 — 제일 위에 노출 */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold">🎬 영상으로 먼저 보기</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <VideoCard
              id="W-a9obkycqE"
              badge="Free"
              label="Free 유저 메뉴얼"
            />
            <VideoCard
              id="G-fXz2djWek"
              badge="Basic"
              label="Basic 유저 메뉴얼"
            />
          </div>
          <div className="rounded-xl border border-primary/20 bg-primary-soft/50 px-3.5 py-3 text-sm">
            <p className="font-bold text-primary">📺 더 선명하게 보는 법</p>
            <p className="mt-1 leading-relaxed text-foreground/85">
              영상이 흐릿하게 보이면, 재생 화면에서{" "}
              <b>⚙️ 설정(톱니바퀴) → 화질 → 1080p</b> 로 바꿔주세요. 유튜브는
              처음에 낮은 화질로 재생될 수 있어, <b>1080p로 맞추면</b> 글자와
              버튼이 또렷하게 보여요.
            </p>
          </div>
        </div>

        {/* 목차 */}
        <nav className="flex flex-wrap gap-2 pt-1">
          {toc.map((label, i) => (
            <a
              key={i}
              href={`#step-${i + 1}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground/80 transition-colors hover:border-primary/40 hover:text-primary"
            >
              <span className="flex size-4 items-center justify-center rounded-full bg-primary-soft text-[10px] font-bold text-primary">
                {i + 1}
              </span>
              {label}
            </a>
          ))}
        </nav>
      </header>

      {/* 1. 회원가입 */}
      <Step
        n={1}
        title="회원가입 — 1분이면 끝나요"
        lead="이메일 또는 소셜 계정으로 간단하게 시작합니다."
      >
        <p className="text-sm leading-relaxed">
          복잡한 서류나 설정 없이 바로 가입할 수 있어요. 이메일 주소만 있으면
          되고, 페이스북 같은 소셜 계정으로는 더 빠르게 시작할 수 있습니다.
        </p>
        <Screen caption="storyup.me/signup">
          <div className="mx-auto max-w-xs space-y-3">
            <div className="h-9 rounded-lg border border-border bg-background px-3 text-xs leading-9 text-muted">
              이메일 주소
            </div>
            <div className="h-9 rounded-lg border border-border bg-background px-3 text-xs leading-9 text-muted">
              비밀번호
            </div>
            <div className="pt-1 text-center">
              <ClickBtn hint="여기">가입하기</ClickBtn>
            </div>
            <p className="pt-1 text-center text-[11px] text-muted">
              또는 페이스북으로 계속하기
            </p>
          </div>
        </Screen>
        <Dos
          items={[
            <>
              상단의 <ClickBtn>가입하기</ClickBtn> 를 눌러요.
            </>,
            "이메일·비밀번호를 넣거나, 소셜 계정을 선택해요.",
            "가입 즉시 대시보드로 들어와 바로 시작할 수 있어요.",
          ]}
        />
        <Tip title="가입만 해도 UP 포인트를 드려요">
          가입 축하 포인트가 쌓이고, 활동할 때마다 <b>UP 포인트</b>가 적립돼요.
          이 포인트는 나중에 AI 영상 만들기 등에 쓸 수 있어요.
        </Tip>
      </Step>

      {/* 2. 랜딩(홈페이지) 생성 */}
      <Step
        n={2}
        title="홈페이지 만들기 — 클릭만으로 완성"
        lead="구글 지도 링크 하나면 가게 정보가 통째로 들어옵니다."
      >
        <p className="text-sm leading-relaxed">
          워크스페이스의 <Pill>랜딩페이지</Pill> 메뉴에서 버튼만 누르면 AI가
          홈페이지를 자동으로 만들어줘요. 특히 <b>구글 지도에서 내 가게 링크를
          붙여넣으면</b> 주소·전화번호·웹사이트·SNS·사진까지 한 번에 채워져서,
          직접 입력할 게 거의 없어요.
        </p>
        <Screen caption="내 비즈니스 › 랜딩페이지">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted">
                구글 지도 링크 붙여넣기
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-9 flex-1 rounded-lg border border-border bg-background px-3 text-xs leading-9 text-muted">
                https://maps.app.goo.gl/…
              </div>
              <ClickBtn hint="가져오기">불러오기</ClickBtn>
            </div>
            <div className="rounded-lg border border-primary/20 bg-primary-soft/40 px-3 py-2 text-xs text-primary">
              ✓ 주소 · 전화번호 · 웹사이트 · SNS · 사진 5장을 채웠어요
            </div>
          </div>
        </Screen>
        <Dos
          items={[
            <>
              왼쪽 메뉴에서 <Pill>랜딩페이지</Pill> 로 들어가요.
            </>,
            <>
              구글 지도 앱에서 내 가게의 <b>공유 → 링크 복사</b> 를 눌러요.
            </>,
            <>
              복사한 링크를 붙여넣고 <ClickBtn>불러오기</ClickBtn> 를 누르면
              정보가 자동으로 채워져요.
            </>,
            "AI가 전체 홈페이지를 완성해줘요. 끝!",
          ]}
        />
        <Tip title="직접 안 적어도 돼요">
          가게 사진, 주소, 연락처를 하나하나 올릴 필요 없이 <b>구글 지도 링크
          하나로</b> 전체 페이지에 자동 반영돼요. 가장 쉽고 빠른 방법이에요.
        </Tip>
      </Step>

      {/* 3. 랜딩 편집 */}
      <Step
        n={3}
        title="홈페이지 편집 — 마음에 안 들면 바로 수정"
        lead="글자·사진·순서를 클릭으로 바꿀 수 있어요."
      >
        <p className="text-sm leading-relaxed">
          만들어진 홈페이지는 언제든 고칠 수 있어요. 바꾸고 싶은 글자를 누르면
          바로 수정되고, 사진 교체나 섹션(박스) 순서 바꾸기도 할 수 있어요. 다
          고쳤으면 <b>저장</b> 후 <b>발행</b>만 누르면 됩니다.
        </p>
        <Screen caption="랜딩페이지 편집">
          <div className="space-y-3">
            <div className="rounded-lg border border-dashed border-primary/40 bg-primary-soft/30 p-3">
              <p className="text-sm font-bold">우리 가게 이름 ✎</p>
              <p className="mt-1 text-xs text-muted">
                글자를 누르면 바로 고칠 수 있어요
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <span className="inline-flex items-center rounded-lg border border-border px-3 py-1.5 text-xs text-muted">
                저장
              </span>
              <ClickBtn hint="끝나면">발행하기</ClickBtn>
            </div>
          </div>
        </Screen>
        <Dos
          items={[
            "바꾸고 싶은 글자를 클릭해서 바로 고쳐요.",
            "사진은 클릭해서 교체하거나 AI로 새로 만들 수 있어요.",
            "박스(섹션)는 끌어서 순서를 바꿀 수 있어요.",
            <>
              다 됐으면 <ClickBtn>발행하기</ClickBtn> 로 세상에 공개해요.
            </>,
          ]}
        />
      </Step>

      {/* 4. 블로그 글쓰기 */}
      <Step
        n={4}
        title="블로그 글쓰기 — 4가지 방법 중 편한 걸로"
        lead="가장 중요한 단계! 꾸준한 글이 손님을 불러와요."
      >
        <p className="text-sm leading-relaxed">
          <Pill>블로그</Pill> 메뉴에서 글을 쓸 수 있어요. 글쓰기가 어렵다면
          걱정 마세요. <b>4가지 방법</b> 중 편한 걸 고르면 됩니다.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <MethodCard
            emoji="🤖"
            name="AI로 글쓰기"
            desc="주제만 주면 AI가 글을 완성"
            perks={[
              "가장 빠름 — 키워드·주제만 입력",
              "SEO(검색 노출)에 맞춘 구성으로 작성",
              "글쓰기가 막막한 분께 추천",
            ]}
          />
          <MethodCard
            emoji="💬"
            name="대화로 글쓰기"
            desc="AI와 질문·답변을 주고받으며 완성"
            perks={[
              "내 생각을 대화로 풀어내면 글이 됨",
              "AI가 근거까지 물어봐 알찬 글",
              "인터뷰하듯 자연스럽게 작성",
            ]}
          />
          <MethodCard
            emoji="🎙️"
            name="녹음으로 글쓰기"
            desc="말로 하면 글로 바꿔줘요"
            perks={[
              "타이핑 없이 말만 하면 끝",
              "이동 중·바쁠 때 편함",
              "말투가 살아있는 진솔한 글",
            ]}
          />
          <MethodCard
            emoji="✍️"
            name="직접 쓰기"
            desc="내가 처음부터 자유롭게"
            perks={[
              "원하는 대로 100% 내 표현",
              "에디터로 사진·서식 자유 편집",
              "이미 쓸 내용이 정해졌을 때 좋음",
            ]}
          />
        </div>
        <Tip title="무엇을 고르든 발행은 똑같아요">
          어떤 방법으로 쓰든 완성된 글은 <b>내 블로그·홈페이지에 바로 연결</b>
          돼요. 처음엔 <b>AI로 글쓰기</b>나 <b>녹음으로 글쓰기</b>가 가장 쉬워요.
        </Tip>
      </Step>

      {/* 5. 글 분석 + 고객 전환 */}
      <Step
        n={5}
        title="글 분석 & 손님 정보 받기"
        lead="쓴 글을 진단하고, 글 아래에서 예약·상담·쿠폰까지."
      >
        <p className="text-sm leading-relaxed">
          써 놓은 글은 그냥 두지 않아요. 검색·AI 노출에 맞는지 <b>진단</b>해주고,
          개선 문구까지 제안해요. 더 중요한 건, 글을 읽은 손님이 <b>글 바로
          아래에서</b> 쿠폰을 받거나 예약·상담을 신청할 수 있다는 점이에요.
          그렇게 손님의 연락처(고객 정보)가 쌓여요.
        </p>
        <Screen caption="블로그 글 하단">
          <div className="space-y-3">
            <div className="rounded-lg border border-border bg-surface-muted/40 p-3 text-xs text-muted">
              … 글 내용 …
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg border border-primary/30 bg-primary-soft/50 py-2 text-center text-xs font-semibold text-primary">
                🎁 쿠폰 받기
              </div>
              <div className="rounded-lg border border-primary/30 bg-primary-soft/50 py-2 text-center text-xs font-semibold text-primary">
                📅 예약하기
              </div>
              <div className="rounded-lg border border-primary/30 bg-primary-soft/50 py-2 text-center text-xs font-semibold text-primary">
                💬 상담신청
              </div>
            </div>
          </div>
        </Screen>
        <Dos
          items={[
            "글을 쓰면 SEO·AEO 진단과 개선 제안을 확인해요.",
            "글 아래에 쿠폰·예약·상담 버튼을 켜요.",
            "손님이 버튼을 누르면 연락처가 남고, 문의/쿠폰관리에서 확인해요.",
          ]}
        />
        <Tip title="글이 '영업사원'이 돼요">
          단순히 읽히는 글이 아니라, 읽은 손님을 <b>예약·상담·단골</b>로
          이어줘요. 쌓인 고객 정보는 <Pill>문의/쿠폰관리</Pill> 메뉴에서 볼 수
          있어요.
        </Tip>
      </Step>

      {/* 6. 카드뉴스 + 쇼츠 */}
      <Step
        n={6}
        title="카드뉴스 & 유튜브 쇼츠 만들기"
        lead="블로그 글감으로 카드뉴스를, 카드뉴스로 쇼츠까지."
      >
        <p className="text-sm leading-relaxed">
          <Pill>SNS</Pill> 메뉴에서 카드뉴스를 만들 수 있어요. 새로 쓸 필요 없이
          <b> 이미 쓴 블로그 글에서 내용을 가져와</b> 카드뉴스로 만들어줘요.
          완성된 카드뉴스는 <b>인스타그램·페이스북에 그대로 올릴 수</b> 있고,
          한 걸음 더 나아가 <b>유튜브 쇼츠(세로 영상)</b>로도 만들 수 있어요.
        </p>
        <Screen caption="SNS › 카드뉴스 / 쇼츠">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs">
              <Pill>블로그 글에서 가져오기</Pill>
              <span className="text-muted">→ 카드 자동 생성</span>
            </div>
            <div className="flex gap-2">
              <div className="aspect-square flex-1 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5" />
              <div className="aspect-square flex-1 rounded-lg bg-gradient-to-br from-primary/15 to-primary/5" />
              <div className="aspect-square flex-1 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5" />
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <span className="inline-flex items-center rounded-lg border border-border px-3 py-1.5 text-xs text-muted">
                인스타·페북 공유
              </span>
              <ClickBtn hint="영상으로">쇼츠 만들기</ClickBtn>
            </div>
          </div>
        </Screen>
        <Dos
          items={[
            <>
              <Pill>SNS</Pill> 메뉴에서 <b>블로그 글에서 가져오기</b>를 눌러요.
            </>,
            "AI가 카드뉴스 여러 장을 자동으로 만들어줘요.",
            "완성본을 인스타그램·페이스북에 바로 공유해요.",
            <>
              같은 카드뉴스로 <ClickBtn>쇼츠 만들기</ClickBtn> 를 누르면 세로
              영상(mp4)이 돼요. 유튜브에 올릴 수 있어요.
            </>,
          ]}
        />
        <Tip title="한 번 쓴 글을 '재활용'해요">
          블로그 글 → 카드뉴스 → 쇼츠까지, <b>한 번 만든 내용을 여러 채널에</b>
          그대로 활용할 수 있어 시간이 크게 절약돼요.
        </Tip>
      </Step>

      {/* 7. AI 영상 */}
      <Step
        n={7}
        title="AI 영상 만들기 — UP 포인트로"
        lead="장면을 설명하면 소리까지 담긴 영상이 나와요."
      >
        <p className="text-sm leading-relaxed">
          <Pill>AI 영상</Pill> 메뉴에서, 원하는 장면을 글로 설명하면 AI가 소리가
          담긴 영상을 만들어줘요. 캐릭터를 먼저 그려 영상에 등장시킬 수도 있어요.
          다만 영상은 만드는 데 비용이 커서, <b>UP 포인트를 넉넉히 모아야</b> 만들
          수 있어요.
        </p>
        <Screen caption="AI 영상 만들기">
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg border border-border bg-surface-muted/40 px-3 py-2 text-xs">
              <span className="text-muted">영상 1편당</span>
              <span className="font-bold text-primary">UP 포인트 필요</span>
            </div>
            <div className="h-16 rounded-lg border border-border bg-background px-3 py-2 text-xs text-muted">
              예: 아늑한 카페에서 커피를 내리는 15초 홍보 영상
            </div>
            <div className="text-right">
              <ClickBtn hint="포인트로">영상 만들기</ClickBtn>
            </div>
          </div>
        </Screen>
        <Tip title="UP 포인트를 모으는 법">
          가입·글쓰기·카드뉴스·공유 등 <b>활동할 때마다 UP이 쌓여요.</b>
          <Pill>UP 적립</Pill> 메뉴에서 모으는 방법을 확인하고, 충분히 모이면
          영상에 쓰세요.
        </Tip>
      </Step>

      {/* 8. 대행 서비스 */}
      <Step
        n={8}
        title="복잡하면? 대행 서비스에 맡기세요"
        lead="직접 하기 어려우면 전문가가 대신 해드려요."
      >
        <p className="text-sm leading-relaxed">
          위 과정이 많아 보여도 괜찮아요. 홈페이지 제작부터 블로그·카드뉴스까지
          <b> 전문가가 대신 운영해주는 대행 서비스</b>가 있어요. 바쁘거나
          손이 안 가는 분은 맡겨두고 결과만 받아보세요.
        </p>
        <Screen caption="대행 서비스 신청">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm">
              <p className="font-bold">콘텐츠 대행 서비스</p>
              <p className="mt-0.5 text-xs text-muted">
                블로그·카드뉴스·홈페이지 운영을 대신 해드려요
              </p>
            </div>
            <ClickBtn hint="문의">신청하기</ClickBtn>
          </div>
        </Screen>
        <div className="flex flex-wrap gap-2 pt-1">
          <Link
            href="/pay/1-e31184"
            className="inline-flex items-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground"
          >
            대행 서비스 보러가기
          </Link>
          <Link
            href="/dashboard/businesses"
            className="inline-flex items-center rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-foreground/80 hover:border-primary/40"
          >
            지금 바로 시작하기
          </Link>
        </div>
      </Step>

      {/* 마무리 */}
      <footer className="rounded-2xl border border-primary/20 bg-primary-soft/40 p-5 text-center">
        <p className="text-base font-bold">준비됐어요! 1단계부터 시작해볼까요?</p>
        <p className="mt-1 text-sm text-muted">
          막히는 부분이 있으면 언제든 이 가이드로 돌아오세요.
        </p>
        <Link
          href="/dashboard/businesses"
          className="mt-4 inline-flex items-center rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground"
        >
          내 비즈니스로 가기
        </Link>
      </footer>
    </div>
  );
}
