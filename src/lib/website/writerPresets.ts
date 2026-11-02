import type {
  SiteSection,
  WebsiteTemplateId,
  WebsitePaletteId,
  WebsiteFontId,
  WriterKind,
} from "@/types/domain";

/**
 * 작가·예술가 사이트 스타터 프리셋 — '작가' 카테고리에서 음악/미술/소설/기타를 고르면
 * minimal 레이아웃 + 하위 유형에 맞는 섹션 골격(음악 앨범·미술 갤러리·글)을 깐다.
 * 글감(story/placeholder)을 미리 채워 작가가 바로 이야기를 적을 수 있게 안내한다.
 */
export interface WriterPreset {
  kind: WriterKind;
  template: WebsiteTemplateId;
  palette: WebsitePaletteId;
  font: WebsiteFontId;
  build: (ko: boolean) => SiteSection[];
}

const t = (ko: boolean, k: string, e: string) => (ko ? k : e);

export const WRITER_PRESETS: Record<WriterKind, WriterPreset> = {
  music: {
    kind: "music",
    template: "minimal",
    palette: "charcoal",
    font: "gowun",
    build: (ko) => [
      {
        type: "hero",
        title: t(ko, "음악을 만드는 사람", "I make music"),
        subtitle: t(
          ko,
          "제가 만든 곡과 그 안에 담긴 이야기를 들려드릴게요.",
          "My songs and the stories behind them.",
        ),
        ctaLabel: t(ko, "연락하기", "Get in touch"),
      },
      {
        type: "musicAlbum",
        title: t(ko, "내 음악", "My music"),
        story: t(
          ko,
          "이 앨범을 소개하는 글을 적어보세요. 어떤 마음으로 만들었는지, 어떤 순간에 들으면 좋은지 들려주세요.",
          "Introduce this album — why you made it and when to listen.",
        ),
        items: [
          {
            title: t(ko, "곡 제목", "Track title"),
            lyrics: "",
            story: t(
              ko,
              "이 곡을 만든 계기와 가사에 담긴 사연을 들려주세요.",
              "Share the story behind this song.",
            ),
          },
        ],
      },
      {
        type: "cta",
        title: t(ko, "함께 작업하고 싶으신가요?", "Want to work together?"),
        body: t(ko, "공연·협업·문의 편하게 연락주세요.", "Reach out anytime."),
        ctaLabel: t(ko, "연락하기", "Contact"),
      },
    ],
  },
  art: {
    kind: "art",
    template: "minimal",
    palette: "plum",
    font: "serif",
    build: (ko) => [
      {
        type: "hero",
        title: t(ko, "그림을 그리는 사람", "I make art"),
        subtitle: t(
          ko,
          "제 작품과 그 안에 담긴 이야기를 전해드릴게요.",
          "My works and the stories within them.",
        ),
        ctaLabel: t(ko, "연락하기", "Get in touch"),
      },
      {
        type: "artGallery",
        title: t(ko, "작품", "Works"),
        story: t(
          ko,
          "작업 세계를 한 문단으로 소개해보세요.",
          "Introduce your work in a paragraph.",
        ),
        items: [
          {
            title: t(ko, "작품 제목", "Artwork title"),
            story: t(
              ko,
              "이 그림에 담긴 이야기, 그리게 된 계기를 적어주세요.",
              "Share the story behind this piece.",
            ),
          },
        ],
      },
      {
        type: "cta",
        title: t(ko, "작품이 궁금하신가요?", "Interested in my work?"),
        body: t(ko, "전시·구매·협업 문의 환영합니다.", "Exhibitions and commissions welcome."),
        ctaLabel: t(ko, "연락하기", "Contact"),
      },
    ],
  },
  novel: {
    kind: "novel",
    template: "minimal",
    palette: "forest",
    font: "serif",
    build: (ko) => [
      {
        type: "hero",
        title: t(ko, "글을 쓰는 사람", "I write"),
        subtitle: t(ko, "제 글과 이야기를 모았습니다.", "A home for my writing."),
        ctaLabel: t(ko, "연락하기", "Get in touch"),
      },
      {
        type: "richText",
        title: t(ko, "작가의 글", "My writing"),
        body: t(
          ko,
          "여기에 소설·에세이·시 등 작품을 적어보세요. 글 하나를 통째로 붙여넣어도 좋고, 소개와 발췌를 함께 담아도 좋습니다.",
          "Paste your novel, essay, or poem here — the whole piece or an intro with excerpts.",
        ),
      },
      {
        type: "cta",
        title: t(ko, "이야기가 더 궁금하신가요?", "Want to read more?"),
        body: t(ko, "연재·출간·협업 문의 환영합니다.", "Serialization and publishing inquiries welcome."),
        ctaLabel: t(ko, "연락하기", "Contact"),
      },
    ],
  },
  etc: {
    kind: "etc",
    template: "minimal",
    palette: "ocean",
    font: "serif",
    build: (ko) => [
      {
        type: "hero",
        title: t(ko, "창작하는 사람", "A creator"),
        subtitle: t(ko, "제 작업과 이야기를 소개합니다.", "My work and stories."),
        ctaLabel: t(ko, "연락하기", "Get in touch"),
      },
      {
        type: "richText",
        title: t(ko, "소개", "About"),
        body: t(
          ko,
          "어떤 작업을 하는지, 어떤 이야기를 담고 싶은지 자유롭게 적어보세요.",
          "Describe your work and the stories you want to tell.",
        ),
      },
      {
        type: "artGallery",
        title: t(ko, "작업", "Works"),
        items: [
          {
            title: t(ko, "작업 제목", "Title"),
            story: t(ko, "이 작업에 대한 이야기를 적어주세요.", "Share the story behind this."),
          },
        ],
      },
      {
        type: "cta",
        title: t(ko, "함께하고 싶으신가요?", "Want to collaborate?"),
        body: t(ko, "문의 편하게 연락주세요.", "Reach out anytime."),
        ctaLabel: t(ko, "연락하기", "Contact"),
      },
    ],
  },
};
