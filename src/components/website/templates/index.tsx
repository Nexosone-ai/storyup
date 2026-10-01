import type { WebsiteTemplateId } from "@/types/domain";
import type { TemplateProps } from "./shared";
import { ClassicTemplate } from "./Classic";
import { SplitTemplate } from "./Split";
import { MinimalTemplate } from "./Minimal";
import { BoldTemplate } from "./Bold";
import { ElegantTemplate } from "./Elegant";
import { VibrantTemplate } from "./Vibrant";
import { MagazineTemplate } from "./Magazine";
import { WarmTemplate } from "./Warm";
import { ModernTemplate } from "./Modern";

export { staticText, staticImage, staticGallery, setPath } from "./shared";
export type {
  TemplateProps,
  TextRenderer,
  ImageRenderer,
  GalleryRenderer,
} from "./shared";

const TEMPLATES: Record<WebsiteTemplateId, (p: TemplateProps) => React.ReactNode> = {
  classic: ClassicTemplate,
  split: SplitTemplate,
  minimal: MinimalTemplate,
  bold: BoldTemplate,
  elegant: ElegantTemplate,
  vibrant: VibrantTemplate,
  magazine: MagazineTemplate,
  warm: WarmTemplate,
  modern: ModernTemplate,
};

export interface TemplateMeta {
  id: WebsiteTemplateId;
  name: string;
  description: string;
  nameEn: string;
  descriptionEn: string;
}

export const TEMPLATE_META: TemplateMeta[] = [
  {
    id: "classic",
    name: "클래식",
    description: "가운데 정렬, 카드형 섹션",
    nameEn: "Classic",
    descriptionEn: "Centered layout, card sections",
  },
  {
    id: "split",
    name: "스플릿",
    description: "좌우 비대칭, 에디토리얼",
    nameEn: "Split",
    descriptionEn: "Asymmetric, editorial layout",
  },
  {
    id: "minimal",
    name: "미니멀",
    description: "타이포 중심, 넉넉한 여백",
    nameEn: "Minimal",
    descriptionEn: "Typography-first, generous whitespace",
  },
  {
    id: "bold",
    name: "볼드",
    description: "다크 히어로, 큰 타이포, 강한 대비",
    nameEn: "Bold",
    descriptionEn: "Dark hero, big type, high contrast",
  },
  {
    id: "elegant",
    name: "엘레강트",
    description: "세리프, 넉넉한 여백, 절제된 고급",
    nameEn: "Elegant",
    descriptionEn: "Serif, airy, refined",
  },
  {
    id: "vibrant",
    name: "바이브런트",
    description: "그라디언트, 둥근 컬러 카드, 경쾌",
    nameEn: "Vibrant",
    descriptionEn: "Gradient, rounded colorful cards",
  },
  {
    id: "magazine",
    name: "매거진",
    description: "오버레이 히어로, 좌우 교차 편집",
    nameEn: "Magazine",
    descriptionEn: "Overlay hero, editorial rows",
  },
  {
    id: "warm",
    name: "웜",
    description: "크림 배경, 부드러운 둥근 카드",
    nameEn: "Warm",
    descriptionEn: "Cream tones, soft rounded cards",
  },
  {
    id: "modern",
    name: "모던",
    description: "샤프한 그리드, 모노 라벨, 테크",
    nameEn: "Modern",
    descriptionEn: "Sharp grid, mono labels, techy",
  },
];

export function TemplateRenderer(props: TemplateProps) {
  const id = (props.content.template ?? "classic") as WebsiteTemplateId;
  const Template = TEMPLATES[id] ?? ClassicTemplate;
  return <Template {...props} />;
}
