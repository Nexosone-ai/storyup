import { LegalPage } from "@/components/marketing/LegalPage";

export const metadata = { title: "개인정보처리방침" };

export default function PrivacyPage() {
  return (
    <LegalPage title="개인정보처리방침" updated="2026년 11월 11일">
      <h2>1. 수집하는 개인정보</h2>
      <ul>
        <li>
          회원가입: 이메일, 이름. 소셜 로그인(구글·카카오·페이스북) 이용 시
          해당 계정이 제공하는 기본 프로필 정보(이름, 이메일, 프로필 사진)
        </li>
        <li>서비스 이용: 입력한 사업 정보, 생성·게시한 콘텐츠</li>
        <li>
          결제: 주문 정보(주문번호·금액·결제 수단 종류). 카드번호 등 민감한
          결제 정보는 결제대행사(PortOne·KG이니시스)가 처리하며 서비스는
          저장하지 않습니다.
        </li>
      </ul>

      <h2>2. 이용 목적</h2>
      <ul>
        <li>회원 식별 및 서비스 제공</li>
        <li>AI 콘텐츠 생성 및 게시 기능 제공</li>
        <li>구독 결제 및 서비스 이용권(UP) 지급·차감 관리</li>
        <li>고객 문의 대응</li>
      </ul>

      <h2>3. 처리 위탁</h2>
      <ul>
        <li>인증·데이터 보관: Supabase</li>
        <li>호스팅: Vercel</li>
        <li>결제 처리: PortOne(포트원)·KG이니시스</li>
        <li>AI 콘텐츠 생성: Anthropic, OpenAI</li>
      </ul>

      <h2>4. 보유 기간 및 파기</h2>
      <ul>
        <li>
          개인정보는 회원 탈퇴 또는 삭제 요청 시 지체 없이 파기합니다. 파기
          시 전자 파일은 복구할 수 없는 방법으로 삭제합니다.
        </li>
        <li>
          단, 전자상거래 등에서의 소비자보호에 관한 법률 등 관계 법령에 따라
          보존 의무가 있는 정보(계약·결제·대금 기록 5년, 소비자 불만·분쟁
          처리 기록 3년 등)는 해당 기간 동안 분리 보관한 뒤 파기합니다.
        </li>
      </ul>

      <h2 id="data-deletion" className="scroll-mt-24">
        5. 개인정보 삭제 요청(데이터 삭제 안내)
      </h2>
      <p>
        회원은 언제든지 본인의 계정과 개인정보의 삭제를 요청할 수 있습니다.
        소셜 로그인(구글·카카오·페이스북)으로 가입한 계정도 동일하게
        적용됩니다.
      </p>
      <ul>
        <li>
          요청 방법: 로그인 후 서비스 내 <strong>고객지원(문의하기)</strong>{" "}
          채널에서 &ldquo;계정 및 개인정보 삭제&rdquo;를 요청해주세요. 가입한
          이메일 주소를 함께 적어주시면 본인 확인 후 처리됩니다.
        </li>
        <li>
          처리 기한: 요청 접수 후 <strong>7일 이내</strong>에 계정과 함께
          수집된 개인정보, 입력한 사업 정보, 생성·게시한 콘텐츠를 삭제합니다.
        </li>
        <li>
          예외: 4항의 법령상 보존 의무가 있는 결제·거래 기록은 해당 기간 동안
          분리 보관 후 파기합니다.
        </li>
        <li>
          소셜 계정 연결 해제: 각 플랫폼의 설정(예: 페이스북 &gt; 설정 &gt;
          앱 및 웹사이트)에서 STORYUP 연결을 직접 해제할 수도 있습니다. 이
          경우에도 서비스에 보관된 정보 삭제는 위 요청 절차를 통해
          처리됩니다.
        </li>
      </ul>

      <h2 id="ads" className="scroll-mt-24">
        6. 광고 및 쿠키(Google AdSense)
      </h2>
      <p>
        STORYUP은 무료 플랜 이용자가 발행한 공개 페이지 중 운영자가 검수해 광고 게재를
        허용한 페이지에 Google AdSense 광고를 게재합니다. 유료 플랜 이용자가 본인 명의의
        AdSense 계정을 연결한 사이트에는 해당 이용자의 광고가 게재됩니다.
      </p>
      <ul>
        <li>
          Google을 포함한 제3자 광고 공급업체는 쿠키(예: Google의 DART 쿠키)를 사용해
          이용자의 이 사이트 및 다른 웹사이트 방문 기록을 바탕으로 광고를 게재합니다.
        </li>
        <li>
          Google의 광고 쿠키 사용으로 Google과 그 파트너는 이용자의 이 사이트 및 다른
          사이트 방문 정보를 기반으로 광고를 게재할 수 있습니다.
        </li>
        <li>
          이용자는{" "}
          <a
            href="https://www.google.com/settings/ads"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline"
          >
            Google 광고 설정
          </a>
          에서 개인 맞춤 광고를 선택 해제할 수 있고,{" "}
          <a
            href="https://www.aboutads.info/choices/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline"
          >
            www.aboutads.info
          </a>
          에서 일부 제3자 공급업체의 개인 맞춤 광고용 쿠키 사용을 해제할 수 있습니다.
        </li>
        <li>
          Google이 광고 서비스에서 데이터를 사용하는 방식은{" "}
          <a
            href="https://policies.google.com/technologies/partner-sites"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline"
          >
            Google 파트너 사이트 데이터 사용 안내
          </a>
          에서 확인할 수 있습니다.
        </li>
        <li>
          광고 쿠키는 브라우저 설정에서 차단·삭제할 수 있으며, 차단해도 서비스의 핵심 기능
          이용에는 영향이 없습니다. 광고 게재 기준은{" "}
          <a href="/editorial-policy" className="text-primary underline">
            콘텐츠·광고 정책
          </a>
          에 있습니다.
        </li>
      </ul>

      <h2>7. 문의</h2>
      <p>
        개인정보 처리에 관한 문의는 서비스 내 고객 지원 채널을 통해
        접수할 수 있습니다.
      </p>
    </LegalPage>
  );
}
