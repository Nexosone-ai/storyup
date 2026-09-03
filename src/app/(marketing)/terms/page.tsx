import { LegalPage } from "@/components/marketing/LegalPage";

export const metadata = { title: "이용약관" };

export default function TermsPage() {
  return (
    <LegalPage title="이용약관" updated="2026년 8월 31일">
      <h2>제1조 (목적)</h2>
      <p>
        본 약관은 STORYUP(이하 &ldquo;서비스&rdquo;)의 이용 조건 및 절차,
        회사와 이용자의 권리·의무·책임 사항을 규정함을 목적으로 합니다.
      </p>

      <h2>제2조 (서비스의 내용)</h2>
      <p>
        서비스는 이용자가 입력한 사업 정보를 바탕으로 AI가 브랜드 스토리,
        랜딩페이지, 블로그·SNS 콘텐츠 등을 생성·게시할 수 있도록 지원하는 도구를
        제공합니다.
      </p>

      <h2>제3조 (크레딧 및 결제)</h2>
      <p>
        유료 기능 이용을 위한 크레딧의 성격·사용·환불은{" "}
        <a href="/credit-policy" className="text-primary underline">
          크레딧 정책
        </a>{" "}
        및{" "}
        <a href="/refund-policy" className="text-primary underline">
          취소·환불 정책
        </a>
        을 따릅니다.
      </p>

      <h2>제4조 (이용자의 의무)</h2>
      <ul>
        <li>타인의 권리를 침해하거나 법령에 위반되는 콘텐츠를 생성·게시하지 않습니다.</li>
        <li>허위 사업 정보를 게시하지 않습니다.</li>
        <li>계정 정보를 타인과 공유하지 않습니다.</li>
      </ul>

      <h2>제5조 (AI 생성 콘텐츠)</h2>
      <p>
        AI가 생성한 콘텐츠의 정확성·적법성은 게시 전 이용자가 확인해야 하며,
        게시된 콘텐츠에 대한 책임은 이용자에게 있습니다.
      </p>

    </LegalPage>
  );
}
