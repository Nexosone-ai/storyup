import Link from "next/link";
import { getUser } from "@/lib/queries";
import { getLocale } from "@/lib/i18n";
import { isCurrentUserPartner, isSubPartner } from "@/lib/partner";
import { Card } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/icons";
import { PROVIDEO_ENABLED } from "@/lib/provideo/config";
import { B2B2C_ENABLED } from "@/lib/b2b2c/config";
import { RECAP_SHORTS_ENABLED } from "@/lib/recapShorts/config";

export const metadata = {
  title: "파트너 사용 매뉴얼",
  robots: { index: false, follow: false },
};

type IconKey = keyof typeof Icon;
interface Section {
  icon: IconKey;
  title: string;
  titleEn: string;
  items: string[];
  itemsEn: string[];
  /** 바로가기(선택). */
  link?: { href: string; label: string; labelEn: string };
}

export default async function PartnerGuidePage() {
  const ko = (await getLocale()) === "ko";
  const user = await getUser();
  if (!user) return null; // layout에서 이미 가드

  // 매뉴얼 섹션은 실제로 쓸 수 있는 기능에 맞춰 노출한다.
  const [partner, amSub] = await Promise.all([
    isCurrentUserPartner(),
    isSubPartner(user.id),
  ]);
  const canManageSubs = B2B2C_ENABLED && !amSub;

  const sections: Section[] = [
    {
      icon: "home",
      title: "파트너 영역이란",
      titleEn: "What the partner area is",
      items: [
        "본사가 배정한 고객 사업장을 대신 운영(대행)하는 공간입니다.",
        "접근은 '파트너' 권한 계정만 가능하며, 본사와 계약 후 활성화됩니다.",
        "모든 작업은 '보유 패킷(크레딧)'을 차감해 이뤄집니다(아래 패킷 안내 참고).",
      ],
      itemsEn: [
        "A workspace to run (on behalf of) the client businesses the head office assigns you.",
        "Only 'partner' accounts can access it; it is activated after a contract with the head office.",
        "Most actions consume your credit packet (see the packet section below).",
      ],
    },
    {
      icon: "briefcase",
      title: "고객 관리",
      titleEn: "Managing clients",
      items: [
        "파트너 홈 하단에 배정받은 고객과 사업장 목록이 표시됩니다.",
        "사업장별 [에이전트] 버튼 → 해당 사업장의 AI 에이전트로 바로 이동합니다.",
        "[워크스페이스] 버튼 → 사업장의 전체 콘텐츠(홈페이지·블로그·카드뉴스 등) 관리 화면입니다.",
        "배정이 없으면 본사(관리자)에게 고객 사업장 배정을 요청하세요.",
      ],
      itemsEn: [
        "Your assigned clients and their businesses appear at the bottom of the partner home.",
        "Per business, the [Agent] button jumps straight into that business's AI agent.",
        "The [Workspace] button opens the full content manager (site, blog, card news, etc.).",
        "If nothing is assigned, ask the head office (admin) to assign client businesses.",
      ],
    },
    {
      icon: "sparkles",
      title: "AI 에이전트로 콘텐츠 대행",
      titleEn: "Running content with the AI agent",
      items: [
        "고객 사업장의 [에이전트]에서 채팅으로 블로그·카드뉴스·SNS 글을 생성합니다.",
        "생성한 콘텐츠는 바로 발행하거나 예약 발행할 수 있습니다.",
        "오토파일럿을 켜면 고객별로 자동 제안·자동 실행까지 맡길 수 있습니다.",
        "연결된 채널(페이스북 등)로 바로 게시할 수 있습니다.",
      ],
      itemsEn: [
        "Create blog posts, card news, and SNS copy via chat in each business's [Agent].",
        "Publish immediately or schedule for later.",
        "Turn on Autopilot to let it propose and auto-run marketing per client.",
        "Post directly to connected channels (e.g., Facebook).",
      ],
    },
    {
      icon: "video",
      title: "영상 제작",
      titleEn: "Video production",
      items: [
        "[유사 영상 10개] — 원본 영상 1개와 컨셉을 넣으면 같은 느낌의 영상 10편을 한 번에 만듭니다(기본 480p; 길이·화질(720p ×2, 1080p ×5)에 따라 패킷 배수 차감).",
        ...(PROVIDEO_ENABLED
          ? ["[전문 영상 스튜디오] — 스토리→이미지/에셋→영상→음악까지 단계별로 제작합니다."]
          : []),
        "완성 영상은 내려받아 유튜브·틱톡·릴스 등에 올리면 됩니다.",
      ],
      itemsEn: [
        "[10 similar videos] — give one source video + a concept to generate 10 videos in one go (longer length uses a multiple of packets).",
        ...(PROVIDEO_ENABLED
          ? ["[Pro video studio] — build step by step: story → images/assets → video → music."]
          : []),
        "Download the finished videos and upload them to YouTube, TikTok, Reels, etc.",
      ],
      link: {
        href: "/partner/videos?tab=similar",
        label: "영상 만들기",
        labelEn: "Make videos",
      },
    },
  ];

  if (RECAP_SHORTS_ENABLED) {
    sections.push({
      icon: "megaphone",
      title: "블로그 요약 쇼츠",
      titleEn: "Blog recap shorts",
      items: [
        "고객 사업장의 발행 블로그 글 1개를 골라 30~40초 내레이션 요약 쇼츠를 만듭니다.",
        "순서: 대본 만들기(패킷 차감, AI가 장면 5~7개로 요약) → 내레이션 만들기(음성 합성) → (AI 이미지 선택 시) 이미지 만들기 → 영상 만들기(브라우저에서 자막·음악 합성, mp4 저장).",
        "이미지 소스는 '카드뉴스 배경'(추가 패킷 없음) 또는 'AI 생성'(장당 패킷) 중 선택합니다.",
        "대본·자막은 장면별로 직접 고칠 수 있고, 내레이션을 고치면 그 장면만 다시 합성됩니다.",
        "원문에 없는 수치·효과·가격은 대본에 넣지 않도록 설계돼 있지만, 올리기 전 한 번 확인하세요.",
      ],
      itemsEn: [
        "Pick one published blog post of a client business and make a 30–40s narrated recap short.",
        "Flow: Make script (credits; AI condenses into 5–7 scenes) → Make narration (TTS) → (if AI images) Make images → Make video (captions + music mixed in the browser, saved as mp4).",
        "Image source: 'card news backgrounds' (no extra credits) or 'AI generated' (credits per image).",
        "Edit narration/captions per scene; changing narration re-synthesizes only that scene.",
        "The script is designed not to invent numbers, claims, or prices, but review before publishing.",
      ],
      link: {
        href: "/partner/videos?tab=recap",
        label: "글로 영상 만들기",
        labelEn: "Make shorts from a post",
      },
    });
  }

  if (B2B2C_ENABLED) {
    sections.push({
      icon: "tag",
      title: "상품 · 판매 (중개)",
      titleEn: "Products & sales (reselling)",
      items: [
        "본사 기본 상품(Basic/Pro) 공급가 위에 내 판매가·마진을 붙여 상품을 등록합니다.",
        "고객에게 오퍼(견적)나 청구서를 발행하면, 고객은 토큰 링크로 결제합니다.",
        "결제는 본사가 수납하고, 수수료를 제외한 금액이 파트너에게 정산됩니다.",
        "공개 스토어(/partners/내슬러그)는 상담형입니다 — 가격·구매 버튼은 오퍼/청구서에서만 노출됩니다.",
      ],
      itemsEn: [
        "Register products by adding your own price/margin on top of the head office base (Basic/Pro) supply price.",
        "Issue an offer (quote) or invoice to a client; they pay via a token link.",
        "The head office collects payment and settles the amount minus the fee to you.",
        "Your public store (/partners/your-slug) is inquiry-style — price/buy buttons appear only in offers/invoices.",
      ],
      link: {
        href: "/partner/sales",
        label: "상품 · 판매 관리",
        labelEn: "Products & sales",
      },
    });
  }

  if (canManageSubs) {
    sections.push({
      icon: "users",
      title: "서브파트너 관리",
      titleEn: "Managing sub-partners",
      items: [
        "이메일로 서브파트너를 초대하면 즉시 활성화됩니다(승인 불필요).",
        "서브파트너는 내 상품을 원가로 받아 자기 마진을 붙여 판매합니다.",
        "서브파트너의 랜딩·블로그·카드뉴스·이벤트·트래픽 활동을 모니터링할 수 있습니다.",
        "결제 시 본사·파트너·서브파트너 3자 정산이 자동 기록됩니다(실제 송금은 수동).",
      ],
      itemsEn: [
        "Invite a sub-partner by email; they are activated immediately (no approval needed).",
        "Sub-partners take your products at cost and add their own margin to sell.",
        "You can monitor their landing pages, blogs, card news, events, and traffic.",
        "On payment, a 3-way settlement (head office/you/sub) is recorded automatically (payout is manual).",
      ],
      link: {
        href: "/partner/sub-partners",
        label: "서브파트너 관리",
        labelEn: "Sub-partners",
      },
    });
  }

  sections.push(
    {
      icon: "coin",
      title: "패킷(크레딧) 사용",
      titleEn: "Packet (credits) usage",
      items: [
        "패킷은 블로그·카드뉴스·영상 등 작업마다 차감되는 파트너 전용 크레딧입니다(고객의 이용권과 별개).",
        "작업별 차감량은 파트너 홈의 '이용 패킷 안내'에서 확인할 수 있습니다.",
        "1패킷 = 100원(부가세 별도, 110원 청구). 최소 100패킷부터 100패킷 단위로 구매합니다.",
        "카드결제: 결제 즉시 패킷이 지급됩니다.",
        "계좌이체: '청구서 발행' 후 안내 계좌로 입금하면 본사가 확인하고 수동으로 지급합니다(영업일 1일 이내). 입금자명을 청구서와 맞춰주세요.",
        "구매 내역과 입금 안내는 '패킷 구매' 페이지 하단에서 다시 볼 수 있습니다.",
      ],
      itemsEn: [
        "Packets are partner-only credits consumed per task (blog, card news, video, etc.), separate from the client's plan.",
        "See per-task costs under 'Packet usage' on the partner home.",
        "1 packet = KRW 100 (VAT excluded; KRW 110 billed). Minimum 100 packets, in steps of 100.",
        "Card: packets are granted immediately on payment.",
        "Bank transfer: issue an invoice, wire to the given account, and the head office confirms and grants manually (within 1 business day). Use the depositor name on the invoice.",
        "Order history and transfer instructions are at the bottom of the 'Buy packets' page.",
      ],
      link: { href: "/partner/packets", label: "패킷 구매", labelEn: "Buy packets" },
    },
    {
      icon: "chart",
      title: "정산 · 수익",
      titleEn: "Settlement & earnings",
      items: [
        "파트너 홈 상단에 '정산 예정 수익'과 '누적 지급'이 표시됩니다.",
        "구매확정·입금확인 후 약 2주 내에 정산됩니다.",
        "실제 지급(송금)은 본사 담당자가 확인 후 처리합니다.",
      ],
      itemsEn: [
        "The partner home header shows 'pending earnings' and 'total paid'.",
        "Settlement happens within ~2 weeks after purchase confirmation and payment verification.",
        "Actual payout is processed by the head office after verification.",
      ],
    },
    {
      icon: "pen",
      title: "파트너 프로필",
      titleEn: "Partner profile",
      items: [
        "파트너 홈의 프로필 편집에서 소개·이력·포트폴리오·연락처·전문분야를 작성하세요.",
        "작성한 프로필은 대행 문의 매칭과 공개 소개에 활용됩니다.",
      ],
      itemsEn: [
        "Fill in your bio, history, portfolio, contact, and skills in the profile editor on the partner home.",
        "Your profile is used for inquiry matching and public introduction.",
      ],
    },
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow mb-2">{ko ? "파트너 대행" : "Partner"}</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {ko ? "파트너 사용 매뉴얼" : "Partner guide"}
          </h1>
          <p className="mt-1.5 text-muted">
            {ko
              ? "파트너 영역의 기능과 사용 방법을 한눈에 정리했습니다."
              : "Everything in the partner area and how to use it, at a glance."}
          </p>
        </div>
        <ButtonLink href="/partner" variant="outline" size="sm">
          <Icon.arrowLeft className="size-4" />
          {ko ? "파트너 홈" : "Partner home"}
        </ButtonLink>
      </div>

      {!partner && (
        <Card className="p-4">
          <p className="text-sm text-muted">
            {ko
              ? "현재 파트너 권한이 없어 일부 기능은 사용할 수 없습니다. 본사에 문의하세요."
              : "You don't have partner access yet; some features are unavailable. Contact the head office."}
          </p>
        </Card>
      )}

      <div className="space-y-4">
        {sections.map((s, i) => (
          <Card key={i} className="p-4 sm:p-5">
            <div className="flex items-center gap-2">
              {(() => {
                const I = Icon[s.icon];
                return <I className="size-4 text-primary" />;
              })()}
              <h2 className="text-sm font-semibold sm:text-base">
                {i + 1}. {ko ? s.title : s.titleEn}
              </h2>
            </div>
            <ul className="mt-2.5 space-y-1.5 text-sm text-muted">
              {(ko ? s.items : s.itemsEn).map((it, j) => (
                <li key={j} className="flex gap-2">
                  <span className="mt-0.5 shrink-0 text-primary">·</span>
                  <span>{it}</span>
                </li>
              ))}
            </ul>
            {s.link && (
              <div className="mt-3">
                <ButtonLink href={s.link.href} size="sm" variant="outline">
                  {ko ? s.link.label : s.link.labelEn}
                </ButtonLink>
              </div>
            )}
          </Card>
        ))}
      </div>

      <Card className="p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <Icon.chat className="size-4 text-primary" />
          <h2 className="text-sm font-semibold">
            {ko ? "도움이 더 필요하면" : "Need more help"}
          </h2>
        </div>
        <p className="mt-2 text-sm text-muted">
          {ko
            ? "기능·패킷·정산 관련 문의는 본사(관리자)에게 연락하세요. 배정·충전·정산은 본사에서 처리합니다."
            : "For questions about features, packets, or settlement, contact the head office (admin), which handles assignments, top-ups, and payouts."}
        </p>
        <div className="mt-3">
          <Link
            href="/partner"
            className="text-sm font-medium text-primary hover:underline"
          >
            {ko ? "← 파트너 홈으로 돌아가기" : "← Back to partner home"}
          </Link>
        </div>
      </Card>
    </div>
  );
}
