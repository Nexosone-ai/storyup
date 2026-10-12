import type { SiteSection } from "@/types/domain";
import type { TextRenderer, ImageRenderer, SiteLang } from "./shared";
import { BlogPreviewCards, type SiteSectionPost } from "./BlogPreview";

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
            {Img && s.type !== "postList" && (editable || s.image) && (
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

    case "pricing":
      return (
        <section className={WRAP}>
          <div className={INNER}>
            <SectionHeader title={s.title} subtitle={s.subtitle} base={base} T={T} />
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {s.items.map((it, j) => (
                <div
                  key={j}
                  className={`flex flex-col rounded-2xl border p-6 ${
                    it.highlighted
                      ? "border-primary bg-primary-soft/40"
                      : "border-border bg-surface"
                  }`}
                >
                  {T({
                    path: `${base}.items.${j}.name`,
                    value: it.name,
                    as: "h3",
                    className: "font-semibold",
                  })}
                  {T({
                    path: `${base}.items.${j}.price`,
                    value: it.price,
                    as: "p",
                    className: "mt-1 text-2xl font-bold tracking-tight",
                  })}
                  {it.description
                    ? T({
                        path: `${base}.items.${j}.description`,
                        value: it.description,
                        as: "p",
                        className: "mt-1.5 text-sm text-muted",
                      })
                    : null}
                  {it.features && it.features.length > 0 && (
                    <ul className="mt-4 space-y-1.5 text-sm text-foreground/85">
                      {it.features.map((f, k) => (
                        <li key={k} className="flex gap-2">
                          <span className="mt-0.5 shrink-0 text-primary">✓</span>
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

    case "faq":
      return (
        <section className={WRAP}>
          <div className="mx-auto max-w-3xl px-5 py-16">
            <SectionHeader title={s.title} subtitle={s.subtitle} base={base} T={T} />
            <dl className="space-y-3">
              {s.items.map((it, j) => (
                <div key={j} className="rounded-2xl border border-border bg-surface p-5">
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
                    className: "mt-1.5 whitespace-pre-wrap leading-relaxed text-muted",
                  })}
                </div>
              ))}
            </dl>
          </div>
        </section>
      );

    case "testimonials":
      return (
        <section className={WRAP}>
          <div className={INNER}>
            <SectionHeader title={s.title} subtitle={s.subtitle} base={base} T={T} />
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {s.items.map((it, j) => (
                <figure
                  key={j}
                  className="flex flex-col rounded-2xl border border-border bg-surface p-6"
                >
                  {T({
                    path: `${base}.items.${j}.quote`,
                    value: it.quote,
                    as: "blockquote",
                    className: "flex-1 leading-relaxed text-foreground/90",
                  })}
                  <figcaption className="mt-4 text-sm">
                    {T({
                      path: `${base}.items.${j}.author`,
                      value: it.author,
                      as: "span",
                      className: "font-semibold",
                    })}
                    {it.role
                      ? T({
                          path: `${base}.items.${j}.role`,
                          value: it.role,
                          as: "span",
                          className: "ml-1 text-muted",
                        })
                      : null}
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      );

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
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {s.items.map((it, j) => (
                <div key={j} className="text-center">
                  {T({
                    path: `${base}.items.${j}.value`,
                    value: it.value,
                    as: "p",
                    className: "text-3xl font-bold tracking-tight text-primary",
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
          </div>
        </section>
      );

    case "cta":
      return (
        <section className={WRAP}>
          <div className="mx-auto max-w-3xl px-5 py-16 text-center">
            {T({ path: `${base}.title`, value: s.title, as: "h2", className: H })}
            {s.body
              ? T({
                  path: `${base}.body`,
                  value: s.body,
                  as: "p",
                  className: "mx-auto mt-3 max-w-xl text-muted",
                })
              : null}
            <a
              href="#contact"
              className="mt-7 inline-flex rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground shadow-xs"
            >
              {T({
                path: `${base}.ctaLabel`,
                value: s.ctaLabel || "문의하기",
                as: "span",
              })}
            </a>
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
