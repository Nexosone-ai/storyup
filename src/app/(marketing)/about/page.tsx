import Link from "next/link";
import { LegalPage } from "@/components/marketing/LegalPage";
import { COMPANY } from "@/lib/company";

export const metadata = {
  title: "STORYUP 소개 · 운영사 · 콘텐츠 제작 방식",
  description:
    "STORYUP은 소상공인·창작자가 AI 초안으로 시작해 직접 다듬은 랜딩페이지·블로그·카드뉴스를 발행하는 서비스입니다. 운영사, 제작 방식, 검수 기준을 공개합니다.",
};

/**
 * 공개 소개 페이지 — 방문자(검색엔진·광고 심사 포함)가 로그인 없이 서비스의 실체를 확인할 수 있게
 * 무엇을 만드는지, 누가 운영하는지, AI 초안을 사람이 어떻게 고치는지, 공개 글을 어떻게 검수하는지 적는다.
 */
export default function AboutPage() {
  return (
    <LegalPage title="STORYUP 소개" updated="2026년 11월 11일">
      <h2>무엇을 하는 서비스인가요</h2>
      <p>
        STORYUP(스토리업)은 가게·공방·작가처럼 혼자 마케팅까지 해야 하는 분들이{" "}
        <b>자기 이야기로 홈페이지(랜딩페이지)와 블로그, SNS 카드뉴스를 직접 만들어 발행</b>
        하는 도구입니다. 사장님이 가게 소개·메뉴·운영 이야기를 입력하면 AI가 초안을 쓰고,
        사장님이 사진·가격·경험을 넣어 고친 뒤 자기 주소(storyup.me/site/… 또는 개인
        도메인)로 발행합니다. 발행된 페이지의 글쓴이는 서비스가 아니라 그 가게·창작자입니다.
      </p>
      <ul>
        <li>랜딩페이지: 업종별 템플릿에 브랜드 스토리·메뉴·위치·예약·쿠폰 블록을 조합</li>
        <li>블로그: 주제·참고자료(URL·파일)·음성 메모로 초안 생성 → 위지윅 편집기에서 수정</li>
        <li>카드뉴스·쇼츠: 발행 글을 바탕으로 6장 카드와 짧은 영상 제작</li>
        <li>작가·예술가: 음악 앨범(LP 플레이어)·작품 갤러리 섹션</li>
      </ul>
      <p>
        실제로 만들어진 페이지는{" "}
        <Link href="/showcase" className="text-primary underline">
          스토리들(쇼케이스)
        </Link>
        에서 로그인 없이 볼 수 있습니다.
      </p>

      <h2>AI 초안과 사람의 수정</h2>
      <p>
        AI는 초안만 씁니다. 생성 단계에서부터 <b>입력에 없는 수치·통계·사례를 지어내지 않고,
        가상의 예시는 &lsquo;예시&rsquo;로 표시하며, 효과·수익·건강 효능을 보장처럼 쓰지 않도록</b>{" "}
        규칙을 두고 있습니다. 그다음 작성자가 편집기에서 실제 사진·가격·경험을 넣고 문장을
        고칩니다. 편집기는 발행 전에 근거 없는 보장 표현, 가상 인물, 출처 없는 수치, 인증·수상
        주장, 분량 부족을 자동으로 짚어 줍니다. 발행 여부와 최종 내용의 책임은 작성자에게
        있습니다.
      </p>

      <h2>공개 글 검수와 광고</h2>
      <p>
        발행된 글은 바로 공개되지만, <b>STORYUP이 광고(Google AdSense)를 싣는 페이지는
        운영자가 검수한 글로 제한</b>합니다. 무료 플랜 사이트의 글은 운영자가 사실·근거·사례
        표기·분량을 확인한 뒤 &lsquo;광고 게재 가능&rsquo;으로 표시하며, 그 전에는 광고가
        나오지 않습니다. 검수에서 문제가 발견되면 작성자에게 수정을 요청합니다. 자세한 기준은{" "}
        <Link href="/editorial-policy" className="text-primary underline">
          콘텐츠·광고 정책
        </Link>
        에 있습니다.
      </p>

      <h2>운영사 정보</h2>
      <ul>
        <li>상호: {COMPANY.name}</li>
        <li>대표: {COMPANY.representative}</li>
        <li>사업자등록번호: {COMPANY.businessNumber}</li>
        <li>통신판매업신고: {COMPANY.mailOrderNumber}</li>
        <li>주소: {COMPANY.address}</li>
        <li>고객센터: {[COMPANY.supportEmail, COMPANY.supportPhone].filter(Boolean).join(" · ")}</li>
      </ul>
      <p>
        문의·수정 요청·권리 침해 신고는 고객센터 또는 로그인 후 서비스 내 고객지원(문의하기)
        채널로 보내주세요. 접수 후 영업일 기준 3일 안에 답변합니다.
      </p>
    </LegalPage>
  );
}
