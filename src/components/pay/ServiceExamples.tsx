import { Icon } from "@/components/ui/icons";

/**
 * 결제 페이지 상품 상세 — "이런 결과물을 만들고, 비즈니스 플랫폼으로 운영하세요" 쇼케이스.
 * 이미지 한 장이 아니라 코드로 렌더링해 어떤 폭에서도 텍스트가 박스를 넘치지 않는다.
 * (플랜 상품(grants_plan)에 노출)
 */

const CARDS: [string, string][] = [
  ["demo-menu-1", "신메뉴"],
  ["demo-menu-2", "이벤트"],
  ["demo-menu-3", "감사 쿠폰"],
];

type IconName = keyof typeof Icon;
const FEATURES: { icon: IconName; title: string; desc: string }[] = [
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

export function ServiceExamples({ planName = "" }: { planName?: string }) {
  return (
    <div className="space-y-8">
      {/* 인트로 */}
      <section>
        <h2 className="break-keep-kr text-xl font-extrabold leading-snug tracking-tight text-foreground">
          나만의 비즈니스 공간을 만들고, 고객을 만나세요
        </h2>
        <p className="break-keep-kr mt-3 text-sm leading-relaxed text-muted">
          STORYUP{planName ? ` ${planName}` : ""}은 단순히 AI로 콘텐츠를 만들어주는
          서비스가 아닙니다. 나만의 랜딩페이지와 블로그를 만들고, 방문자를 확인하고,
          문의 고객까지 관리하는 <b className="text-foreground">비즈니스 플랫폼</b>입니다.
        </p>
      </section>

      {/* 이런 콘텐츠를 만들어 드립니다 */}
      <section className="space-y-5">
        <p className="text-sm font-bold text-foreground">이런 콘텐츠를 만들어 드려요</p>

        {/* AI 랜딩페이지 — 브라우저 목업 */}
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

        {/* AI 블로그 — 카드 */}
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

        {/* SNS 카드뉴스 — 3장 */}
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

      {/* 콘텐츠를 넘어, 비즈니스 플랫폼 */}
      <section className="space-y-3">
        <p className="text-sm font-bold text-foreground">콘텐츠를 넘어, 비즈니스 플랫폼</p>
        {FEATURES.map((f) => {
          const Glyph = Icon[f.icon];
          return (
            <div
              key={f.title}
              className="flex gap-3 rounded-xl border border-border bg-surface p-4"
            >
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
        })}
      </section>

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
