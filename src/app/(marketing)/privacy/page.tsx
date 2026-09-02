import { LegalPage } from "@/components/marketing/LegalPage";

export const metadata = { title: "개인정보처리방침" };

export default function PrivacyPage() {
  return (
    <LegalPage title="개인정보처리방침" updated="2026년 8월 31일">
      <h2>1. 수집하는 개인정보</h2>
      <ul>
        <li>회원가입: 이메일, 이름(또는 구글 계정 프로필 정보)</li>
        <li>서비스 이용: 입력한 사업 정보, 생성·게시한 콘텐츠</li>
        <li>
          결제: 주문 정보(주문번호·금액·결제 수단 종류). 카드번호 등 민감한
          결제 정보는 결제대행사(PortOne·토스페이먼츠)가 처리하며 서비스는
          저장하지 않습니다.
        </li>
      </ul>

      <h2>2. 이용 목적</h2>
      <ul>
        <li>회원 식별 및 서비스 제공</li>
        <li>AI 콘텐츠 생성 및 게시 기능 제공</li>
        <li>크레딧 충전·차감 및 결제 관리</li>
        <li>고객 문의 대응</li>
      </ul>

      <h2>3. 처리 위탁</h2>
      <ul>
        <li>인증·데이터 보관: Supabase</li>
        <li>호스팅: Vercel</li>
        <li>결제 처리: PortOne, 토스페이먼츠</li>
        <li>AI 콘텐츠 생성: Anthropic</li>
      </ul>

      <h2>문의</h2>
      <p>
        개인정보 처리에 관한 문의는 서비스 내 고객 지원 채널을 통해
        접수할 수 있습니다.
      </p>
    </LegalPage>
  );
}
