import type { SiteSection } from "@/types/domain";
import type { TextRenderer, ImageRenderer, SiteLang } from "./shared";
import { BlogPreviewCards, type SiteSectionPost } from "./BlogPreview";
import { LucianFaq } from "./LucianFaq";
import { LucianStats } from "./LucianStats";

/* 가입 유도 버튼 — Lucian UX/UI #211(테두리 빛이 도는 가입 유도 버튼)의 회전
 * 글로우 테두리를 브랜드 색으로 포팅. 순수 CSS(@property) — JS 불필요.
 * https://lucianlabs.dev/uxui-prompt/#211 */
const GLOW_CSS = `
@property --lxa{syntax:'<angle>';inherits:false;initial-value:0deg}
.lxcta{position:relative;display:inline-flex;align-items:center;gap:8px;height:52px;padding:0 28px;border-radius:999px;background:var(--primary);color:var(--primary-foreground);font-weight:800;font-size:15px;isolation:isolate;box-shadow:0 12px 30px -16px var(--primary);transition:transform .3s cubic-bezier(.3,1.6,.5,1)}
.lxcta::before{content:"";position:absolute;inset:-4px;z-index:-1;border-radius:inherit;background:conic-gradient(from var(--lxa),var(--primary),color-mix(in srgb,var(--primary) 35%,#fff),var(--primary),color-mix(in srgb,var(--primary) 35%,#fff),var(--primary));filter:blur(13px);opacity:.5;animation:lxspin 5s linear infinite}
.lxcta:hover{transform:translateY(-2px)}
.lxcta:hover::before{opacity:.85;animation-duration:1.6s}
.lxcta-ar{transition:transform .3s cubic-bezier(.3,1.6,.5,1)}
.lxcta:hover .lxcta-ar{transform:translateX(4px)}
@keyframes lxspin{to{--lxa:360deg}}
@media (prefers-reduced-motion:reduce){.lxcta::before{animation:none}}
`;

/** 글로우 테두리 CTA 버튼(#contact로 이동). 라벨은 T로 인라인 편집 가능. */
function GlowCta({
  base,
  label,
  T,
}: {
  base: string;
  label: string;
  T: TextRenderer;
}) {
  return (
    <>
      <style>{GLOW_CSS}</style>
      <a href="#contact" className="lxcta">
        {T({ path: `${base}.ctaLabel`, value: label, as: "span" })}
        <svg
          className="lxcta-ar"
          width="16"
          height="16"
          viewBox="0 0 14 14"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M3 7h8M7.5 3.5 11 7l-3.5 3.5" />
        </svg>
      </a>
    </>
  );
}

/**
 * (프리미엄) 풍부한 홈페이지 섹션 렌더러 — content.sections 배열을 유형별 블록으로
 * 그린다. 공개 사이트에선 정적 텍스트, 에디터에선 T 렌더러가 인라인 편집을 제공한다.
 * (섹션 텍스트는 "sections.{i}..." 경로로 편집 저장된다. 섹션 구조 자체는 재생성으로 변경.)
 */
export function SiteSections({
  sections,
  T,
  Img,
  pathPrefix = "",
  editable = false,
  onDelete,
  posts,
  blogHref,
  lang = "ko",
  categories,
}: {
  sections?: SiteSection[];
  T: TextRenderer;
  /** 이미지 슬롯 렌더러 — 공개는 staticImage, 에디터는 업로드·AI 생성 슬롯. */
  Img?: ImageRenderer;
  /** 편집 경로 접두사 — 홈은 "", 하위 페이지는 "pages.{i}." (setPath 중첩 경로). */
  pathPrefix?: string;
  editable?: boolean;
  /** 에디터에서 해당 섹션(단락)을 삭제. */
  onDelete?: (index: number) => void;
  /** 글 목록(postList) 섹션용 — 이 사이트의 공개 글(카테고리 포함). */
  posts?: SiteSectionPost[];
  /** 블로그 글 링크 베이스 (예: /site/{slug}/blog). */
  blogHref?: string;
  lang?: SiteLang;
  /** (에디터) 사용 중인 블로그 카테고리 — postList 카테고리 입력 힌트. */
  categories?: string[];
}) {
  if (!sections?.length) return null;
  return (
    <>
      {sections.map((s, i) => {
        const base = `${pathPrefix}sections.${i}`;
        return (
          <div key={i} className="relative">
            {editable && onDelete && (
              <button
                type="button"
                onClick={() => onDelete(i)}
                title="섹션 삭제"
                className="absolute right-4 top-4 z-10 rounded-lg border border-border bg-white/90 px-2.5 py-1 text-xs font-medium text-danger shadow-sm hover:bg-white"
              >
                ✕ 삭제
              </button>
            )}
            {Img &&
              s.type !== "postList" &&
              s.type !== "hero" &&
              (editable || s.image) && (
              <div className="mx-auto max-w-5xl px-5 pt-12">
                <div className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl border border-border bg-surface-muted/40">
                  {Img({
                    path: `${base}.image`,
                    value: s.image,
                    aspect: "16:9",
                  })}
                </div>
              </div>
            )}
            <SectionBlock
              section={s}
              base={base}
              T={T}
              editable={editable}
              posts={posts}
              blogHref={blogHref}
              lang={lang}
              categories={categories}
            />
          </div>
        );
      })}
    </>
  );
}

const WRAP = "border-t border-border";
const INNER = "mx-auto max-w-5xl px-5 py-16";
const H = "text-2xl font-semibold tracking-tight";

function SectionHeader({
  title,
  subtitle,
  base,
  T,
  center = true,
}: {
  title?: string;
  subtitle?: string;
  base: string;
  T: TextRenderer;
  center?: boolean;
}) {
  if (!title && !subtitle) return null;
  return (
    <div className={`mb-8 ${center ? "text-center" : ""}`}>
      {title !== undefined &&
        T({ path: `${base}.title`, value: title, as: "h2", className: H })}
      {subtitle
        ? T({
            path: `${base}.subtitle`,
            value: subtitle,
            as: "p",
            className: "mt-2 text-muted",
          })
        : null}
    </div>
  );
}

function SectionBlock({
  section: s,
  base,
  T,
  editable = false,
  posts,
  blogHref,
  lang = "ko",
  categories,
}: {
  section: SiteSection;
  base: string;
  T: TextRenderer;
  editable?: boolean;
  posts?: SiteSectionPost[];
  blogHref?: string;
  lang?: SiteLang;
  categories?: string[];
}) {
  switch (s.type) {
    // 섹션형 히어로 — 액센트 글로우 배경 + 큰 제목 + 소개 + 글로우 CTA 버튼.
    case "hero":
      return (
        <section className="relative overflow-hidden border-t border-border bg-[radial-gradient(120%_70%_at_50%_0%,var(--primary-soft),transparent_62%)]">
          <div className="mx-auto max-w-3xl px-5 py-24 text-center">
            {T({
              path: `${base}.title`,
              value: s.title,
              as: "h2",
              className:
                "text-3xl font-black leading-[1.14] tracking-tight sm:text-5xl",
            })}
            {s.subtitle
              ? T({
                  path: `${base}.subtitle`,
                  value: s.subtitle,
                  as: "p",
                  className: "mx-auto mt-4 max-w-xl text-muted sm:text-lg",
                })
              : null}
            {(s.ctaLabel || editable) && (
              <div className="mt-9 flex justify-center">
                <GlowCta base={base} label={s.ctaLabel || "문의하기"} T={T} />
              </div>
            )}
          </div>
        </section>
      );

    case "features":
      return (
        <section className={WRAP}>
          <div className={INNER}>
            <SectionHeader title={s.title} subtitle={s.subtitle} base={base} T={T} />
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {s.items.map((it, j) => (
                <div
                  key={j}
                  className="rounded-2xl border border-border bg-surface p-6"
                >
                  {T({
                    path: `${base}.items.${j}.title`,
                    value: it.title,
                    as: "h3",
                    className: "mb-2 font-semibold",
                  })}
                  {T({
                    path: `${base}.items.${j}.description`,
                    value: it.description,
                    as: "p",
                    className: "text-sm leading-relaxed text-muted",
                  })}
                </div>
              ))}
            </div>
          </div>
        </section>
      );

    case "steps":
      return (
        <section className={WRAP}>
          <div className={INNER}>
            <SectionHeader title={s.title} subtitle={s.subtitle} base={base} T={T} />
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {s.items.map((it, j) => (
                <div key={j} className="relative rounded-2xl border border-border bg-surface p-6">
                  <div className="mb-3 grid size-9 place-items-center rounded-lg bg-primary-soft font-bold text-primary">
                    {j + 1}
                  </div>
                  {T({
                    path: `${base}.items.${j}.title`,
                    value: it.title,
                    as: "h3",
                    className: "mb-1.5 font-semibold",
                  })}
                  {T({
                    path: `${base}.items.${j}.description`,
                    value: it.description,
                    as: "p",
                    className: "text-sm leading-relaxed text-muted",
                  })}
                </div>
              ))}
            </div>
          </div>
        </section>
      );

    // 가격표 — Lucian UX/UI #056(월·연 요금 전환 카드)의 시각 처리(강조 링·추천 배지·
    // 체크 아이콘)를 그리드 카드에 적용. https://lucianlabs.dev/uxui-prompt/#056
    case "pricing":
      return (
        <section className={WRAP}>
          <div className={INNER}>
            <SectionHeader title={s.title} subtitle={s.subtitle} base={base} T={T} />
            <div className="grid items-start gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {s.items.map((it, j) => (
                <div
                  key={j}
                  className={`relative flex flex-col rounded-[22px] border bg-surface p-6 transition-transform ${
                    it.highlighted
                      ? "border-primary/60 shadow-[0_18px_40px_-24px_var(--ring)] lg:-translate-y-2 lg:scale-[1.03]"
                      : "border-border"
                  }`}
                >
                  {it.highlighted && (
                    <span className="absolute right-5 top-5 inline-flex items-center rounded-md bg-primary-soft px-2 py-0.5 text-[11px] font-extrabold text-primary">
                      {lang === "ko" ? "추천" : "Popular"}
                    </span>
                  )}
                  {T({
                    path: `${base}.items.${j}.name`,
                    value: it.name,
                    as: "h3",
                    className: "text-lg font-extrabold tracking-tight",
                  })}
                  <div className="mt-1 flex items-end gap-1">
                    {T({
                      path: `${base}.items.${j}.price`,
                      value: it.price,
                      as: "span",
                      className: "text-3xl font-black tracking-tight",
                    })}
                  </div>
                  {it.description
                    ? T({
                        path: `${base}.items.${j}.description`,
                        value: it.description,
                        as: "p",
                        className: "mt-1.5 text-sm text-muted",
                      })
                    : null}
                  {it.features && it.features.length > 0 && (
                    <ul className="mt-5 space-y-2.5 border-t border-border pt-5 text-sm text-foreground/85">
                      {it.features.map((f, k) => (
                        <li key={k} className="flex items-center gap-2.5">
                          <svg
                            viewBox="0 0 18 18"
                            aria-hidden="true"
                            className="size-[18px] shrink-0 fill-none stroke-primary"
                            strokeWidth="2.4"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M4 9.4l3.2 3.2L14 5.6" />
                          </svg>
                          {T({
                            path: `${base}.items.${j}.features.${k}`,
                            value: f,
                            as: "span",
                          })}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      );

    // FAQ — 발행 사이트는 Lucian UX/UI #044 아코디언(한 번에 하나 열림·+/− 모프),
    // 에디터는 인라인 편집을 위해 모두 펼친 목록으로 렌더. https://lucianlabs.dev/uxui-prompt/#044
    case "faq":
      return (
        <section className={WRAP}>
          <div className="mx-auto max-w-3xl px-5 py-16">
            <SectionHeader title={s.title} subtitle={s.subtitle} base={base} T={T} />
            {editable ? (
              <dl className="space-y-3">
                {s.items.map((it, j) => (
                  <div
                    key={j}
                    className="rounded-2xl border border-border bg-surface p-5"
                  >
                    {T({
                      path: `${base}.items.${j}.q`,
                      value: it.q,
                      as: "dt",
                      className: "font-semibold",
                    })}
                    {T({
                      path: `${base}.items.${j}.a`,
                      value: it.a,
                      as: "dd",
                      className:
                        "mt-1.5 whitespace-pre-wrap leading-relaxed text-muted",
                    })}
                  </div>
                ))}
              </dl>
            ) : (
              <LucianFaq
                items={s.items.map((it) => ({ q: it.q, a: it.a }))}
              />
            )}
          </div>
        </section>
      );

    // 후기 — Lucian UX/UI #207(두 줄로 흐르는 후기 벽)의 카드 처리(별점·이니셜 아바타·
    // 떠오르는 카드)를 편집 가능한 그리드에 적용. https://lucianlabs.dev/uxui-prompt/#207
    case "testimonials":
      return (
        <section className={WRAP}>
          <div className={INNER}>
            <SectionHeader title={s.title} subtitle={s.subtitle} base={base} T={T} />
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {s.items.map((it, j) => (
                <figure
                  key={j}
                  className="flex flex-col rounded-[22px] border border-border bg-surface p-6 transition-transform duration-300 hover:-translate-y-1 hover:shadow-[0_14px_26px_-14px_rgba(0,0,0,.22)]"
                >
                  <div
                    aria-hidden="true"
                    className="mb-3 text-sm tracking-tight text-amber-400"
                  >
                    ★★★★★
                  </div>
                  {T({
                    path: `${base}.items.${j}.quote`,
                    value: it.quote,
                    as: "blockquote",
                    className: "flex-1 leading-relaxed text-foreground/90",
                  })}
                  <figcaption className="mt-5 flex items-center gap-3">
                    <span className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-sm font-extrabold text-primary-foreground">
                      {(it.author || "·").trim().charAt(0) || "·"}
                    </span>
                    <span className="min-w-0 text-sm">
                      {T({
                        path: `${base}.items.${j}.author`,
                        value: it.author,
                        as: "span",
                        className: "block font-semibold",
                      })}
                      {it.role
                        ? T({
                            path: `${base}.items.${j}.role`,
                            value: it.role,
                            as: "span",
                            className: "block text-xs text-muted",
                          })
                        : null}
                    </span>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      );

    // 통계 — 발행 사이트는 화면에 들어오면 숫자가 굴러 오름(count-up), 에디터는 편집 목록.
    case "stats":
      return (
        <section className={WRAP}>
          <div className={INNER}>
            {s.title
              ? T({
                  path: `${base}.title`,
                  value: s.title,
                  as: "h2",
                  className: `mb-8 text-center ${H}`,
                })
              : null}
            {editable ? (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {s.items.map((it, j) => (
                  <div key={j} className="text-center">
                    {T({
                      path: `${base}.items.${j}.value`,
                      value: it.value,
                      as: "p",
                      className:
                        "text-3xl font-black tracking-tight text-primary",
                    })}
                    {T({
                      path: `${base}.items.${j}.label`,
                      value: it.label,
                      as: "p",
                      className: "mt-1 text-sm text-muted",
                    })}
                  </div>
                ))}
              </div>
            ) : (
              <LucianStats items={s.items} />
            )}
          </div>
        </section>
      );

    // CTA — Lucian #211의 글로우 테두리 버튼 + 액센트 글로우 배경.
    case "cta":
      return (
        <section className="relative overflow-hidden border-t border-border bg-[radial-gradient(80%_70%_at_50%_100%,var(--primary-soft),transparent_70%)]">
          <div className="mx-auto max-w-3xl px-5 py-20 text-center">
            {T({ path: `${base}.title`, value: s.title, as: "h2", className: H })}
            {s.body
              ? T({
                  path: `${base}.body`,
                  value: s.body,
                  as: "p",
                  className: "mx-auto mt-3 max-w-xl text-muted",
                })
              : null}
            <div className="mt-8 flex justify-center">
              <GlowCta base={base} label={s.ctaLabel || "문의하기"} T={T} />
            </div>
          </div>
        </section>
      );

    case "richText":
      return (
        <section className={WRAP}>
          <div className="mx-auto max-w-3xl px-5 py-16">
            {T({ path: `${base}.title`, value: s.title, as: "h2", className: `mb-5 text-center ${H}` })}
            {T({
              path: `${base}.body`,
              value: s.body,
              as: "p",
              className: "whitespace-pre-wrap leading-relaxed text-foreground/85",
            })}
          </div>
        </section>
      );

    case "postList": {
      const cat = (s.category ?? "").trim();
      const all = posts ?? [];
      const matched = (
        cat ? all.filter((p) => (p.category ?? "") === cat) : all
      ).slice(0, 6);
      return (
        <section className={WRAP}>
          <div className={INNER}>
            {s.title
              ? T({
                  path: `${base}.title`,
                  value: s.title,
                  as: "h2",
                  className: `mb-6 ${H}`,
                })
              : null}
            {editable && (
              <div className="mb-6 rounded-xl border border-dashed border-border bg-surface-muted/40 p-4">
                <label className="mb-1 block text-xs font-medium text-muted">
                  표시할 카테고리
                </label>
                {T({
                  path: `${base}.category`,
                  value: s.category ?? "",
                  as: "span",
                  placeholder: "카테고리명 (예: 여행)",
                  className:
                    "inline-block min-w-36 rounded-md border border-border bg-white px-2 py-1 text-sm",
                })}
                <p className="mt-2 text-xs leading-relaxed text-muted">
                  공개 페이지에서 이 카테고리의 블로그 글이 자동 목록으로 표시됩니다(최신 6개).
                  비우면 전체 글.
                  {categories && categories.length > 0 && (
                    <>
                      {" "}
                      · 사용 중인 카테고리:{" "}
                      <span className="text-foreground">
                        {categories.join(", ")}
                      </span>
                    </>
                  )}
                  {` · 현재 ${matched.length}개 매칭`}
                </p>
              </div>
            )}
            {matched.length > 0 ? (
              <BlogPreviewCards
                posts={matched}
                blogHref={blogHref ?? "#"}
                lang={lang}
              />
            ) : editable ? (
              <p className="rounded-xl border border-dashed border-border bg-surface p-6 text-center text-sm text-muted">
                {cat
                  ? `'${cat}' 카테고리의 공개 글이 없습니다. 블로그에서 글의 카테고리를 '${cat}'(으)로 저장하면 여기에 표시됩니다.`
                  : "표시할 공개 글이 없습니다. 블로그 글을 발행해보세요."}
              </p>
            ) : null}
          </div>
        </section>
      );
    }

    default:
      return null;
  }
}
