import type { WebsiteTemplateId } from "@/types/domain";
import type { TemplateProps } from "./shared";
import { ClassicTemplate } from "./Classic";
import { SplitTemplate } from "./Split";
import { MinimalTemplate } from "./Minimal";

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
];

export function TemplateRenderer(props: TemplateProps) {
  const id = (props.content.template ?? "classic") as WebsiteTemplateId;
  const Template = TEMPLATES[id] ?? ClassicTemplate;
  return <Template {...props} />;
}
