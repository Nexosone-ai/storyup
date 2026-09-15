import { Icon } from "@/components/ui/icons";

/**
 * 결제 페이지 상품 상세 — 플랜별 소개 쇼케이스.
 * 이미지 한 장이 아니라 코드로 렌더링해 어떤 폭에서도 텍스트가 박스를 넘치지 않는다.
 * (플랜 상품(grants_plan)에 노출)
 */

type IconName = keyof typeof Icon;
type Feature = { icon: IconName; title: string; desc: string };

const CARDS: [string, string][] = [
  ["demo-menu-1", "신메뉴"],
  ["demo-menu-2", "이벤트"],
  ["demo-menu-3", "감사 쿠폰"],
];

const BASIC_FEATURES: Feature[] = [
  {
    icon: "globe",
    title: "나만의 전용 주소",
    desc: "홈페이지를 따로 만들지 않아도 storyup.me/site/브랜드명 형태의 전용 주소를 제공합니다. 자체 도메인 연결도 지원해 고객에게 알리기 쉬워요.",
  },
  {
    icon: "chart",
    title: "방문자 분석",
    desc: "내 랜딩페이지·블로그에 얼마나 많은 고객이 방문하는지 확인하고, 성과를 보며 더 효과적으로 마케팅할 수 있습니다.",
  },
  {
    icon: "users",
    title: "문의 고객 DB 관리",
    desc: "랜딩페이지로 들어온 고객 문의를 자동으로 수집·관리합니다. 흩어지는 문의를 놓치지 않고 잠재고객 DB로 축적하세요.",
  },
];

const PRO_FEATURES: Feature[] = [
  {
    icon: "globe",
    title: "최대 5개의 AI 랜딩페이지",
    desc: "상품·서비스·이벤트·캠페인별로 최대 5개의 랜딩페이지를 만들 수 있습니다. 목적과 고객에 따라 각각의 페이지로 더 효과적으로 브랜드를 소개하세요.",
  },
  {
    icon: "pen",
    title: "월 90건의 AI 블로그 콘텐츠",
    desc: "검색 고객에게 꾸준히 발견되도록 월 최대 90건의 블로그를 제작할 수 있습니다. 꾸준한 발행으로 브랜드 전문성과 콘텐츠 자산을 쌓아가세요.",
  },
  {
    icon: "megaphone",
    title: "월 100건의 SNS 카드뉴스",
    desc: "블로그에만 머물지 않고 SNS까지 확장하세요. 월 최대 100건의 카드뉴스로 다양한 채널에서 고객과 만날 수 있습니다.",
  },
  {
    icon: "image",
    title: "월 70개의 AI 이미지 생성",
    desc: "블로그·랜딩페이지·SNS에 필요한 이미지를 AI로 직접 생성합니다. 콘텐츠 주제와 브랜드에 어울리는 이미지를 손쉽게 만들어 활용하세요.",
  },
  {
    icon: "link",
    title: "내 브랜드의 자체 도메인 연결",
    desc: "STORYUP 기본 주소를 넘어 www.mybrand.com 같은 내 도메인을 연결할 수 있습니다. 더 전문적이고 신뢰감 있는 브랜드 경험을 제공하세요.",
  },
  {
    icon: "shield",
    title: "STORYUP 워터마크 제거",
    desc: "워터마크를 제거해 온전히 내 브랜드를 중심으로 구성된 페이지를 운영할 수 있습니다.",
  },
  {
    icon: "chart",
    title: "방문자 분석 & 잠재고객 관리",
    desc: "랜딩페이지·블로그 방문자 현황과 콘텐츠 반응을 분석하고, 접수된 문의 고객을 DB로 관리해 상담·영업에 활용하세요.",
  },
  {
    icon: "bell",
    title: "고객 문의 알림",
    desc: "새로운 고객 문의가 들어오면 알림으로 빠르게 확인할 수 있습니다. 방문 → 관심 → 문의 → 상담으로 이어지는 고객 확보 과정을 관리하세요.",
  },
  {
    icon: "file",
    title: "만든 콘텐츠가 자산이 됩니다",
    desc: "제작된 랜딩페이지·블로그는 계정에 보관되어 계속 활용할 수 있습니다. 쓸수록 콘텐츠가 사라지지 않고 내 브랜드의 온라인 자산이 쌓여갑니다.",
  },
];

function FeatureCard({ f }: { f: Feature }) {
  const Glyph = Icon[f.icon];
  return (
    <div className="flex gap-3 rounded-xl border border-border bg-surface p-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-primary-soft text-primary">
        <Glyph width={20} height={20} />
      </span>
      <div className="min-w-0">
        <p className="font-bold text-foreground">{f.title}</p>
        <p className="break-keep-kr mt-1 text-sm leading-relaxed text-muted">
          {f.desc}
        </p>
      </div>
    </div>
  );
}

/** AI 랜딩페이지·블로그·카드뉴스 결과물 예시 (공통) */
function ContentExamples() {
  return (
    <section className="space-y-5">
      <p className="text-sm font-bold text-foreground">이런 콘텐츠를 만들어 드려요</p>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-muted">AI 랜딩페이지</h3>
        <div className="overflow-hidden rounded-xl bg-[#0f1420] shadow-sm">
          <div className="flex items-center gap-1.5 px-3 py-2.5">
            <span className="size-2 rounded-full bg-[#ff5f57]" />
            <span className="size-2 rounded-full bg-[#febc2e]" />
            <span className="size-2 rounded-full bg-[#28c840]" />
          </div>
          <div className="relative aspect-[16/11]">
            {/* eslint-disable-next-line @next/next/no-img-element -- 정적 데모 에셋 */}
            <img
              src="/images/demo/demo-hero.jpg"
              alt="랜딩페이지 예시"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-black/45" />
            <div className="absolute inset-0 flex flex-col items-center justify-center px-5 text-center">
              <p className="break-keep-kr text-lg font-extrabold leading-tight text-white sm:text-xl">
                당신의 브랜드, 이렇게 완성됩니다
              </p>
              <p className="break-keep-kr mt-1.5 text-xs text-white/85 sm:text-sm">
                사업 이야기를 들려주면 AI가 홈페이지로
              </p>
              <span className="mt-3 rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-white">
                자세히 보기
              </span>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-muted">AI 블로그</h3>
        <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element -- 정적 데모 에셋 */}
          <img
            src="/images/demo/demo-blog-1.jpg"
            alt="블로그 예시"
            className="aspect-[16/7] w-full object-cover"
          />
          <div className="p-4">
            <p className="break-keep-kr font-bold text-foreground">
              우리 가게가 특별한 3가지 이유
            </p>
            <div className="mt-3 space-y-2">
              <div className="h-2.5 w-full rounded bg-surface-muted" />
              <div className="h-2.5 w-11/12 rounded bg-surface-muted" />
              <div className="h-2.5 w-3/4 rounded bg-surface-muted" />
            </div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-muted">SNS 카드뉴스</h3>
        <div className="grid grid-cols-3 gap-2">
          {CARDS.map(([file, label]) => (
            <div
              key={file}
              className="relative aspect-square overflow-hidden rounded-lg"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- 정적 데모 에셋 */}
              <img
                src={`/images/demo/${file}.jpg`}
                alt={label}
                className="absolute inset-0 h-full w-full object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 bg-black/45 py-1.5 text-center text-[11px] font-bold text-white sm:text-xs">
                {label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function ServiceExamples({ plan }: { plan: "basic" | "pro" }) {
  const isPro = plan === "pro";
  return (
    <div className="space-y-8">
      {/* 인트로 */}
      <section>
        <h2 className="break-keep-kr text-xl font-extrabold leading-snug tracking-tight text-foreground">
          {isPro
            ? "콘텐츠를 넘어, 고객이 찾아오는 비즈니스 채널을 만드세요"
            : "나만의 비즈니스 공간을 만들고, 고객을 만나세요"}
        </h2>
        <p className="break-keep-kr mt-3 text-sm leading-relaxed text-muted">
          {isPro ? (
            <>
              STORYUP Pro는 AI로 콘텐츠를 만드는 것을 넘어,{" "}
              <b className="text-foreground">
                브랜드의 온라인 마케팅 채널을 직접 구축하고 운영
              </b>
              하기 위한 전문가용 플랜입니다.
            </>
          ) : (
            <>
              STORYUP Basic은 단순히 AI로 콘텐츠를 만들어주는 서비스가 아닙니다.
              나만의 랜딩페이지와 블로그를 만들고, 방문자를 확인하고, 문의 고객까지
              관리하는 <b className="text-foreground">비즈니스 플랫폼</b>입니다.
            </>
          )}
        </p>
      </section>

      <ContentExamples />

      {/* 플랜 기능 */}
      <section className="space-y-3">
        <p className="text-sm font-bold text-foreground">
          {isPro ? "Pro가 드리는 것" : "콘텐츠를 넘어, 비즈니스 플랫폼"}
        </p>
        {(isPro ? PRO_FEATURES : BASIC_FEATURES).map((f) => (
          <FeatureCard key={f.title} f={f} />
        ))}
      </section>

      {/* Pro 요약 하이라이트 */}
      {isPro && (
        <div className="rounded-xl border border-primary/30 bg-primary-soft/60 p-5">
          <p className="text-sm font-extrabold uppercase tracking-[0.15em] text-primary">
            STORYUP PRO
          </p>
          <p className="break-keep-kr mt-2 text-sm leading-relaxed text-foreground">
            AI 브랜드 스토리 + 랜딩페이지 5개 + 블로그 90건/월 + SNS 카드뉴스 100건/월
            + AI 이미지 70개/월
          </p>
          <p className="break-keep-kr mt-2 text-sm leading-relaxed text-muted">
            여기에{" "}
            <b className="text-foreground">
              자체 도메인 연결 · 워터마크 제거 · 방문자 분석 · 문의고객 DB · 고객문의
              알림
            </b>
            까지.
          </p>
          <p className="tnum mt-3 text-2xl font-bold text-foreground">월 49,000원</p>
          <p className="break-keep-kr mt-1 text-sm leading-relaxed text-muted">
            콘텐츠를 만들고, 검색되고, 고객을 확보하는 것까지. STORYUP Pro 하나로
            시작하세요.
          </p>
        </div>
      )}

      {/* 결제 후 자동 적용 안내 */}
      <div className="rounded-xl bg-primary-soft p-4">
        <p className="font-bold text-foreground">결제 후 가입 계정에 자동 적용</p>
        <p className="break-keep-kr mt-1.5 text-sm leading-relaxed text-muted">
          결제하신 이메일 계정에 플랜이 1개월 적용되어 위 기능을 바로 이용할 수 있습니다.
        </p>
        <p className="break-keep-kr mt-1 text-xs leading-relaxed text-muted">
          자동 갱신 없음 · 안전한 카드 결제(PortOne · KG이니시스)
        </p>
      </div>
    </div>
  );
}
