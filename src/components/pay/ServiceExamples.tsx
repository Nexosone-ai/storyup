/**
 * 결제 페이지 상품 상세 — "이런 결과물을 만들어 드립니다" 예시 쇼케이스.
 * 이미지 한 장이 아니라 코드로 렌더링해 어떤 폭에서도 텍스트가 박스를 넘치지 않는다.
 * (플랜 상품(grants_plan)에 노출)
 */

const CARDS: [string, string][] = [
  ["demo-menu-1", "신메뉴"],
  ["demo-menu-2", "이벤트"],
  ["demo-menu-3", "감사 쿠폰"],
];

export function ServiceExamples() {
  return (
    <div className="space-y-6">
      {/* AI 랜딩페이지 — 브라우저 목업 */}
      <section>
        <h3 className="mb-2 text-sm font-bold text-foreground">AI 랜딩페이지</h3>
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
      </section>

      {/* AI 블로그 — 카드 */}
      <section>
        <h3 className="mb-2 text-sm font-bold text-foreground">AI 블로그</h3>
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
      </section>

      {/* SNS 카드뉴스 — 3장 */}
      <section>
        <h3 className="mb-2 text-sm font-bold text-foreground">SNS 카드뉴스</h3>
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
      </section>

      {/* 결제 후 자동 적용 안내 */}
      <div className="rounded-xl bg-primary-soft p-4">
        <p className="font-bold text-foreground">결제 후 가입 계정에 자동 적용</p>
        <p className="break-keep-kr mt-1.5 text-sm leading-relaxed text-muted">
          브랜드 스토리·랜딩페이지·블로그·카드뉴스를 AI가 만들어 드립니다.
        </p>
        <p className="break-keep-kr mt-1 text-xs leading-relaxed text-muted">
          자동 갱신 없음 · 안전한 카드 결제(PortOne · KG이니시스)
        </p>
      </div>
    </div>
  );
}
