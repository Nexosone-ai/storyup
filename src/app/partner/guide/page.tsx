import Link from "next/link";
import { getUser } from "@/lib/queries";
import { getLocale } from "@/lib/i18n";
import { isCurrentUserPartner, isSubPartner } from "@/lib/partner";
import { canProvisionAccounts } from "@/lib/partner/provisioning";
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
  /** 단계별 상세(선택) — 상품 구성·가격·결제처럼 순서가 중요한 절차. */
  steps?: { title: string; titleEn: string; body: string; bodyEn: string }[];
  /** 바로가기(선택). */
  link?: { href: string; label: string; labelEn: string };
}

/**
 * 파트너 사용 매뉴얼 — 2026-11-11 패킷 폐지·본사 상품·작업권 전환 반영.
 * 핵심은 "본사 상품에 내 마진을 붙여 상품 구성 → 오퍼/청구서 → 고객 결제 → 작업권·플랜 자동 지급 → 정산".
 */
export default async function PartnerGuidePage() {
  const ko = (await getLocale()) === "ko";
  const user = await getUser();
  if (!user) return null; // layout에서 이미 가드

  const [partner, amSub, canProvision] = await Promise.all([
    isCurrentUserPartner(),
    isSubPartner(user.id),
    canProvisionAccounts(user.id),
  ]);
  const canManageSubs = B2B2C_ENABLED && !amSub;

  const sections: Section[] = [
    {
      icon: "home",
      title: "파트너 영역이란",
      titleEn: "What the partner area is",
      items: [
        "본사가 배정한(또는 내가 등록한) 고객 사업장을 대신 운영(대행)하고, 본사 상품에 내 마진을 붙여 고객에게 판매하는 공간입니다.",
        "접근은 '파트너' 권한 계정만 가능하며, 본사와 계약 후 활성화됩니다.",
        "요약 쇼츠·유사영상·Lite 계정 생성 같은 파트너 도구는 '작업권'을 사용합니다. 작업권은 따로 사지 않고, 고객이 내 상품을 결제하면 상품에 포함된 만큼 자동으로 생깁니다(아래 작업권 안내).",
      ],
      itemsEn: [
        "A workspace to run client businesses on their behalf and to sell head-office products with your own margin.",
        "Only 'partner' accounts can access it; it is activated after a contract with the head office.",
        "Partner tools (recap shorts, similar videos, Lite accounts) use 'service credits', which are granted automatically when a client pays for your product — nothing to buy separately.",
      ],
    },
    {
      icon: "briefcase",
      title: "고객 관리",
      titleEn: "Managing clients",
      items: [
        "파트너 홈의 '고객 등록'에 고객(가맹점)의 스토리업 계정 이메일을 입력하면 바로 내 고객으로 연결됩니다.",
        "아직 가입 전 이메일은 '가입 대기'로 보관되며, 그 이메일로 가입하는 순간 자동 연결됩니다.",
        "한 고객은 한 파트너만 담당합니다. 이미 다른 파트너가 담당 중이면 등록되지 않으니 본사에 문의하세요.",
        "연결된 고객과 사업장은 파트너 홈 하단에 표시됩니다. [에이전트] → AI 에이전트, [워크스페이스] → 전체 콘텐츠 관리.",
        "고객 카드의 [연결 해제]로 대행을 종료할 수 있고, 고객도 '담당 파트너' 메뉴에서 접근을 해제할 수 있습니다.",
        "파트너 홈의 '내 영업 링크'는 두 가지입니다 — 고객 가입 링크(/join?ref=코드)로 가입하면 내 고객으로, 영업파트너 모집 링크(&as=partner)로 가입하면 파트너(영업)으로 자동 등록됩니다.",
      ],
      itemsEn: [
        "Enter the client's STORYUP account email under 'Register a client' on the partner home to link them immediately.",
        "Emails not yet registered are kept as 'waiting for sign-up' and linked automatically when they sign up.",
        "Each client has one partner. If another partner already manages them, contact the head office.",
        "Linked clients and their businesses appear at the bottom of the partner home: [Agent] for the AI agent, [Workspace] for full content management.",
        "[Unlink] on a client card ends the engagement; the client can also revoke access under 'My partner'.",
        "Your partner home has two sales links: the client link (/join?ref=code) links sign-ups as your clients; the recruit link (&as=partner) registers them as sales partners.",
      ],
    },
  ];

  if (B2B2C_ENABLED) {
    sections.push({
      icon: "tag",
      title: "상품 구성 · 가격 책정 · 결제 처리",
      titleEn: "Products, pricing & payment",
      items: [
        "흐름: 본사 상품 확인 → 내 상품 만들기(판매가 = 마진 포함) → 판매 시작 → 오퍼(견적) → 청구서 발행 → 고객이 링크에서 결제 → 플랜·작업권 자동 지급 → 정산. 수납은 STORYUP이 하고 차액이 정산됩니다.",
        amSub
          ? "파트너(영업)은 상위파트너가 판매 중인 상품만 연결할 수 있고, 상위 판매가 위에 내 판매가를 정합니다. 본사 가격 정책은 상위파트너가 관리합니다."
          : "고객에게 보이는 가격은 내 판매가뿐입니다. 본사 공급가·수수료는 정산 때 공제되며 화면에 표시되지 않습니다.",
      ],
      itemsEn: [
        "Flow: check head-office products → create your product (price includes your margin) → start selling → offer (quote) → invoice → client pays via link → plan & credits granted automatically → settlement. STORYUP collects the payment and settles the difference.",
        amSub
          ? "Sales partners link only the parent partner's active products and set their own price on top; the parent manages head-office pricing."
          : "Clients only ever see your sell price. The head-office supply price and fee are deducted at settlement and never shown.",
      ],
      steps: [
        {
          title: "1) 본사 상품 확인",
          titleEn: "1) Check head-office products",
          body: amSub
            ? "상품·판매 관리 › 상품 탭의 '상위파트너 상품' 카드에서 상위파트너가 판매 중인 상품과 포함 내역을 확인합니다."
            : "상품·판매 관리 › 상품 탭의 '본사 제공 상품' 카드에서 Basic·Pro 등 본사 상품의 포함 내역과 '결제 시 제공'(고객 플랜 기간, 요약 쇼츠·유사영상·Lite 계정 작업권 수량)을 확인합니다. 본사가 내용을 바꾸면 이후 저장하는 내 상품부터 반영됩니다.",
          bodyEn: amSub
            ? "On Products & sales › Products, review the parent partner's active products and what they include."
            : "On Products & sales › Products, review the head-office products (Basic, Pro, …), what they include and what is granted on payment (client plan period, service credits).",
        },
        {
          title: "2) 내 상품 만들기",
          titleEn: "2) Create your product",
          body: `[+ 새 상품]에서 상품명·설명·포함 서비스(고객 노출)를 적고, ${amSub ? "상위파트너 상품" : "연결할 본사 상품"}을 고른 뒤 판매가(원)·부가세(포함/별도)·청구 방식(1회/정기)·제공 범위·취소·환불 조건을 입력해 저장합니다. 저장 직후는 '초안'이며 [판매 시작]을 눌러야 오퍼·청구서에 쓸 수 있습니다.`,
          bodyEn: `Use [+ New product]: name, description, included services (shown to clients), the ${amSub ? "parent product" : "head-office product"} to link, sell price, VAT mode, billing type, scope and refund terms. New products start as drafts — press [Start selling] to use them in offers and invoices.`,
        },
        {
          title: "3) 가격 책정",
          titleEn: "3) Pricing",
          body: amSub
            ? "판매가는 고객이 실제 결제하는 금액입니다. 상위 판매가와 플랫폼 수수료(마진의 10%)는 정산 때 공제됩니다. 부가세를 '별도'로 두면 결제액은 판매가 + 부가세가 됩니다. 판매가를 바꾸면 이후 만드는 오퍼·청구서부터 적용되고, 이미 발행한 건은 그대로입니다."
            : "판매가는 고객이 실제 결제하는 금액입니다. 본사 공급가와 플랫폼 수수료(마진의 10%)는 정산 때 공제되므로, 원하는 마진을 더해 판매가를 정하세요. 부가세를 '별도'로 두면 결제액은 판매가 + 부가세가 됩니다. 판매가를 바꾸면 이후 만드는 오퍼·청구서부터 적용되고, 이미 발행한 건은 그대로입니다.",
          bodyEn:
            "The sell price is what the client actually pays. The supply price and the 10% platform fee on your margin are deducted at settlement. With VAT 'excluded', the charged amount is price + VAT. Price changes apply to offers and invoices created afterwards; issued ones stay unchanged.",
        },
        {
          title: "4) 오퍼(견적) 보내기",
          titleEn: "4) Send an offer (quote)",
          body: "오퍼 탭에서 상품과 고객(선택)을 고르고, 필요하면 이 고객만의 판매가와 유효기간을 넣어 [오퍼 생성]합니다. 생성된 링크(/offers/토큰)를 복사해 고객에게 전달하세요. 오퍼는 안내용이라 결제 버튼이 없고, 고객이 동의하면 다음 단계로 청구서를 발행합니다.",
          bodyEn:
            "On the Offers tab pick the product and (optionally) the client, adjust the price or validity if needed, and create the offer. Copy the link (/offers/token) and send it to the client. Offers are informational — issue an invoice once the client agrees.",
        },
        {
          title: "5) 청구서 발행 · 고객 결제",
          titleEn: "5) Issue the invoice · client pays",
          body: "청구서 탭에서 오퍼를 고르고 이용 시작·종료일(비우면 결제일부터 상품 기간), 부가세(별도일 때 금액)를 넣어 [청구서 발행]합니다. 번호(INV-날짜-코드)가 붙은 링크(/invoices/토큰)를 복사해 고객에게 보내면, 고객은 그 페이지에서 카드로 결제합니다(STORYUP 수납). 아직 결제 전인 청구서는 [취소]할 수 있고, 가격을 바꿔야 하면 기존 건을 취소한 뒤 새 오퍼 → 새 청구서로 다시 발행하세요.",
          bodyEn:
            "On the Invoices tab choose the offer, set the service period (optional) and VAT amount, then issue. Send the numbered link (/invoices/token); the client pays by card there (STORYUP collects). Unpaid invoices can be voided; to change the price, void and re-issue from a new offer.",
        },
        {
          title: "6) 결제 완료 후 자동 처리",
          titleEn: "6) What happens after payment",
          body: "결제가 확인되면 청구서가 '결제 완료'로 바뀌고 ① 상품에 연결된 고객 플랜(예: Basic 30일)이 고객 계정에 부여됩니다(이미 더 높은 플랜을 쓰는 고객은 그대로 유지). ② 상품에 포함된 작업권(요약 쇼츠·유사영상·Lite 계정 등)이 내 계정에 자동 지급됩니다. ③ 정산 기록이 생깁니다. 고객이 아직 스토리업 계정이 없으면 결제 때 쓴 이메일로 가입하면 연결되고, 안 되면 본사에서 재처리합니다.",
          bodyEn:
            "Once paid: ① the linked client plan is granted to the client account (a higher active plan is kept), ② the service credits included in the product are granted to you, ③ a settlement record is created. If the client has no account yet, signing up with the payment email links it; otherwise the head office reprocesses.",
        },
        {
          title: "7) 정산 확인",
          titleEn: "7) Settlement",
          body: "정산 탭에서 총 수납액·정산 예정·보류·지급 완료를 확인합니다. 실제 송금은 본사가 확인 후 처리합니다(약 2주). 세금·PG 수수료·환불은 별도 정책을 따릅니다.",
          bodyEn:
            "The Settlement tab shows gross, pending, held and paid amounts. Payouts are made by the head office after verification (about two weeks).",
        },
        {
          title: "8) 추가 판매(업세일)",
          titleEn: "8) Upselling",
          body: "고객이 플랜 한도(블로그·카드뉴스·이미지 등)를 넘기면 고객 화면에 '담당 파트너 문의'가 뜹니다. 문의 스레드에서 상황을 듣고, 추가 이용권·Pro 상품 등을 같은 방법(오퍼 → 청구서)으로 판매하세요. 요약 쇼츠·유사영상 같은 작업은 해당 작업권이 포함된 상품을 판매해야 쓸 수 있습니다.",
          bodyEn:
            "When a client hits plan limits, they see 'Ask my partner'. Discuss in the inquiry thread and sell add-ons or Pro the same way (offer → invoice). Tools like recap shorts or similar videos require selling a product that includes those credits.",
        },
      ],
      link: {
        href: "/partner/sales",
        label: "상품 · 판매 관리",
        labelEn: "Products & sales",
      },
    });
  }

  sections.push({
    icon: "coin",
    title: "작업권",
    titleEn: "Service credits",
    items: [
      "작업권은 요약 쇼츠·AI 이미지·유사영상·Lite 계정 생성에 쓰는 파트너 전용 이용권입니다(고객의 플랜 한도와 별개).",
      "고객이 내 상품(오퍼·청구서)을 결제하면 상품에 포함된 작업권이 자동으로 생깁니다. 별도로 구매하지 않으며, 예전 패킷 잔액은 작업권으로 바뀌어 있습니다.",
      "서비스별 사용량: 요약 쇼츠 1편 = 1편 · 쇼츠 장면 AI 이미지 1장 = 1장 · 유사영상 10편 1회 = 1회 × 길이 배수(10초 ×2 …) × 화질 배수(720p ×2, 1080p ×5) · Lite 계정 생성/30일 연장 = 1개.",
      "보유 작업권은 파트너 홈 상단 카드와 '영상 만들기' 화면에서 확인합니다. 작업이 전부 실패하거나 내레이션 전에 삭제하면 사용한 작업권은 자동으로 돌아옵니다.",
      "계약 선지급·테스트가 필요하면 본사(관리자)가 작업권을 직접 부여할 수 있습니다.",
    ],
    itemsEn: [
      "Service credits are partner-only units used by recap shorts, AI images, similar videos and Lite accounts (separate from client plan limits).",
      "They are granted automatically when a client pays for your product; nothing is purchased separately. Old packet balances were converted to credits.",
      "Usage: recap short = 1 · AI scene image = 1 · similar video set (10 videos) = 1 × length multiplier × quality multiplier (720p ×2, 1080p ×5) · Lite account create/extend = 1.",
      "Balances are shown on the partner home and the video hub. Credits are refunded automatically when a job fully fails or is deleted before narration.",
      "The head office can grant credits directly for contracts or testing.",
    ],
    link: { href: "/partner/sales", label: "상품 만들고 청구서 보내기", labelEn: "Create a product & invoice" },
  });

  sections.push({
    icon: "sparkles",
    title: "AI 에이전트로 콘텐츠 대행",
    titleEn: "Running content with the AI agent",
    items: [
      "고객 사업장의 [에이전트]에서 채팅으로 블로그·카드뉴스·SNS 글을 생성합니다.",
      "생성한 콘텐츠는 바로 발행하거나 예약 발행할 수 있고, 오토파일럿을 켜면 고객별 자동 제안·자동 실행까지 맡길 수 있습니다.",
      "에이전트가 만든 블로그·카드뉴스는 고객이 결제한 플랜 한도(예: Basic 블로그 20건/월)에서 차감됩니다. 한도를 다 쓰면 추가 이용권이나 Pro 상품을 판매(결제)한 뒤 계속할 수 있습니다.",
      "연결된 채널(페이스북 등)로 바로 게시할 수 있습니다.",
    ],
    itemsEn: [
      "Create blog posts, card news, and SNS copy via chat in each business's [Agent].",
      "Publish immediately or schedule; turn on Autopilot to propose and auto-run marketing per client.",
      "Agent-made content counts against the client's paid plan limits. When the limit is used up, sell an add-on or Pro product to continue.",
      "Post directly to connected channels (e.g., Facebook).",
    ],
  });

  sections.push({
    icon: "video",
    title: "영상 제작",
    titleEn: "Video production",
    items: [
      "[유사 영상 10개] — 원본 영상 1개와 컨셉을 넣으면 같은 느낌의 영상 10편을 한 번에 만듭니다(기본 480p·5초 = 유사영상 작업권 1회; 길이·화질(720p ×2, 1080p ×5)에 따라 배수 사용).",
      ...(PROVIDEO_ENABLED
        ? ["[전문 영상 스튜디오] — 스토리→이미지/에셋→영상→음악까지 단계별로 제작합니다."]
        : []),
      "완성 영상은 내려받아 유튜브·틱톡·릴스 등에 올리면 됩니다.",
    ],
    itemsEn: [
      "[10 similar videos] — give one source video + a concept to generate 10 videos in one go (480p·5s = 1 credit; longer length or higher quality uses a multiple).",
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
  });

  if (RECAP_SHORTS_ENABLED) {
    sections.push({
      icon: "megaphone",
      title: "블로그 요약 쇼츠",
      titleEn: "Blog recap shorts",
      items: [
        "고객 사업장의 발행 블로그 글 1개를 골라 30~40초 내레이션 요약 쇼츠를 만듭니다.",
        "순서: 대본 만들기(요약 쇼츠 작업권 1편 사용, AI가 장면 5~7개로 요약) → 내레이션 만들기(음성 합성) → (AI 이미지 선택 시) 이미지 만들기 → 영상 만들기(브라우저에서 자막·음악 합성, mp4 저장).",
        "이미지 소스는 '카드뉴스 배경'(추가 사용 없음) 또는 'AI 생성'(장당 AI 이미지 작업권 1장) 중 선택합니다.",
        "대본·자막은 장면별로 직접 고칠 수 있고, 내레이션을 고치면 그 장면만 다시 합성됩니다.",
        "원문에 없는 수치·효과·가격은 대본에 넣지 않도록 설계돼 있지만, 올리기 전 한 번 확인하세요.",
      ],
      itemsEn: [
        "Pick one published blog post of a client business and make a 30–40s narrated recap short.",
        "Flow: Make script (1 recap credit; AI condenses into 5–7 scenes) → Make narration (TTS) → (if AI images) Make images → Make video (captions + music mixed in the browser, saved as mp4).",
        "Image source: 'card news backgrounds' (no extra credits) or 'AI generated' (1 image credit per scene).",
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

  if (canProvision) {
    sections.push({
      icon: "plus",
      title: "고객 계정 직접 생성 (별도계약 · Lite)",
      titleEn: "Creating client accounts (contract · Lite)",
      items: [
        "파트너 홈의 '고객 계정 직접 생성'에서 아이디(이메일)·표시 이름·초기 비밀번호를 입력하면 고객이 가입하지 않아도 계정이 바로 만들어지고 내 고객으로 연결됩니다.",
        "계정 1개 = 30일 이용권 = Lite 계정 작업권 1개. 작업권은 'Lite 계정 30일' 상품을 고객에게 판매(결제)하거나 본사가 부여하면 생깁니다.",
        "Lite 계정 제공량: 랜딩페이지 1개 · 블로그 10건/월 · 카드뉴스 6건/월 · 카드뉴스 쇼츠 3편/월. 만료되면 무료 플랜으로 내려가니 목록의 '30일 연장'으로 이어가세요. 고객이 이미 Basic·Pro로 전환했다면 연장되지 않습니다(작업권 미사용).",
        "초기 비밀번호는 저장되지 않습니다. 고객에게 직접 전달하고 첫 로그인 후 변경하도록 안내하세요.",
        "이 권한은 내 아래 파트너(영업)에게도 상속됩니다(각자 자기 작업권 사용).",
      ],
      itemsEn: [
        "Under 'Create client accounts' on the partner home, enter an email, display name and initial password to create an account instantly and link it as your client.",
        "One account = 30 days = 1 Lite account credit, earned by selling the 'Lite account 30 days' product or granted by the head office.",
        "Lite limits: 1 landing page · 10 blog posts/mo · 6 card news/mo · 3 shorts/mo. Expired accounts fall back to Free; use 'Extend 30d'. Clients already on Basic/Pro are not extended (no credit used).",
        "The initial password is not stored; hand it to the client and ask them to change it after first login.",
        "Your sales partners inherit this capability (using their own credits).",
      ],
    });
  }

  if (canManageSubs) {
    sections.push({
      icon: "users",
      title: "파트너(영업) 관리",
      titleEn: "Managing sales partners",
      items: [
        "이메일로 파트너(영업)을 등록하면 즉시 활성화됩니다(승인 불필요). 영업자가 리크루트한 영업자는 이렇게 내 아래에 둡니다.",
        "파트너(영업)은 내 상품을 연결해 자기 판매가로 판매합니다. 원가·공급가·마진은 파트너(영업)에게 보이지 않습니다.",
        "파트너(영업)이 판매하면 작업권은 판매한 파트너(영업)에게, 정산은 나(상위 판매가 − 본사 공급가 마진)와 파트너(영업) 양쪽에 기록됩니다.",
        "파트너(영업)의 랜딩·블로그·카드뉴스·이벤트·트래픽 활동을 모니터링할 수 있습니다. 실제 송금은 수동입니다.",
      ],
      itemsEn: [
        "Register a sales partner by email; they are activated immediately (no approval needed).",
        "Sales partners link your products and sell at their own price; cost, supply price and margin are hidden from them.",
        "When a sales partner sells, the credits go to them and settlements are recorded for both of you.",
        "You can monitor their landing pages, blogs, card news, events and traffic. Payout is manual.",
      ],
      link: {
        href: "/partner/sub-partners",
        label: "파트너(영업) 관리",
        labelEn: "Sales partners",
      },
    });
  }

  sections.push(
    {
      icon: "chart",
      title: "정산 · 수익",
      titleEn: "Settlement & earnings",
      items: [
        "파트너 홈 상단에 '정산 예정 수익'과 '누적 지급'이 표시되고, 상품·판매 관리 › 정산 탭에서 총 수납·정산 예정·보류·지급 완료를 볼 수 있습니다.",
        "정산 예정액은 고객 결제액에서 본사 정산 정책에 따라 산정된 금액이며, 구매확정·입금확인 후 약 2주 내에 정산됩니다.",
        "실제 지급(송금)은 본사 담당자가 확인 후 처리합니다.",
      ],
      itemsEn: [
        "The partner home header shows 'pending earnings' and 'total paid'; the Settlement tab shows gross, pending, held and paid.",
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
              ? "파트너 영역의 기능과 사용 방법을 한눈에 정리했습니다. 상품 구성부터 가격 책정, 청구서 발행, 결제 후 처리까지 순서대로 따라 하세요."
              : "Everything in the partner area and how to use it — from building products and pricing to invoicing and what happens after payment."}
          </p>
        </div>
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
            {s.steps && (
              <ol className="mt-3 space-y-2">
                {s.steps.map((st, k) => (
                  <li key={k} className="rounded-xl border border-border bg-surface-2/60 p-3">
                    <p className="text-sm font-semibold">{ko ? st.title : st.titleEn}</p>
                    <p className="mt-1 text-sm leading-relaxed text-muted">
                      {ko ? st.body : st.bodyEn}
                    </p>
                  </li>
                ))}
              </ol>
            )}
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
            ? "기능·작업권·정산 관련 문의는 본사(관리자)에게 연락하세요. 배정·작업권 부여·정산은 본사에서 처리합니다."
            : "For questions about features, service credits, or settlement, contact the head office (admin), which handles assignments, credit grants, and payouts."}
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
