import type { WebsiteTemplateId } from "@/types/domain";
import type { TemplateProps } from "./shared";
import { ClassicTemplate } from "./Classic";
import { SplitTemplate } from "./Split";
import { MinimalTemplate } from "./Minimal";

export { staticText, setPath } from "./shared";
export type { TemplateProps, TextRenderer } from "./shared";

const TEMPLATES: Record<WebsiteTemplateId, (p: TemplateProps) => React.ReactNode> = {
  classic: ClassicTemplate,
  split: SplitTemplate,
  minimal: MinimalTemplate,
};

export interface TemplateMeta {
  id: WebsiteTemplateId;
  name: string;
  description: string;
}

export const TEMPLATE_META: TemplateMeta[] = [
  { id: "classic", name: "클래식", description: "가운데 정렬, 카드형 섹션" },
  { id: "split", name: "스플릿", description: "좌우 비대칭, 에디토리얼" },
  { id: "minimal", name: "미니멀", description: "타이포 중심, 넉넉한 여백" },
];

export function TemplateRenderer(props: TemplateProps) {
  const id = (props.content.template ?? "classic") as WebsiteTemplateId;
  const Template = TEMPLATES[id] ?? ClassicTemplate;
  return <Template {...props} />;
}
