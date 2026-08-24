import { cookies } from "next/headers";

export type Locale = "ko" | "en";

export const LOCALE_COOKIE = "locale";

/** Reads the locale from the cookie (server). Defaults to Korean. */
export async function getLocale(): Promise<Locale> {
  const store = await cookies();
  return store.get(LOCALE_COOKIE)?.value === "en" ? "en" : "ko";
}

export const translations = {
  ko: {
    nav: { login: "로그인", start: "무료로 시작하기" },
    landing: {
      eyebrow: "AI 비즈니스 브랜딩 플랫폼",
      title1: "당신의 이야기를",
      title2: "비즈니스",
      title3: "로.",
      sub: "사업 이야기를 들려주세요. AI가 브랜드, 홈페이지, 블로그 콘텐츠로 만들어드립니다.",
      cta: "무료로 시작하기",
      how: "어떻게 작동하나요?",
      processEyebrow: "작동 방식",
      processTitle: "이야기 하나가 온라인 비즈니스가 되기까지",
      steps: [
        { t: "STORY", d: "당신의 사업 이야기를 들려주세요." },
        { t: "BRAND", d: "AI가 브랜드 스토리를 만듭니다." },
        { t: "WEBSITE", d: "몇 분 안에 비즈니스 홈페이지를 만듭니다." },
        { t: "CONTENT", d: "블로그 콘텐츠를 생성합니다." },
        { t: "GROW", d: "온라인에서 고객을 만날 준비를 합니다." },
      ],
      features: [
        {
          t: "AI 브랜드 스토리",
          d: "몇 가지 질문에 답하면 진정성 있는 브랜드 스토리와 슬로건이 완성됩니다.",
        },
        {
          t: "자동 홈페이지 생성",
          d: "전문 지식 없이도 바로 공개할 수 있는 비즈니스 홈페이지를 만듭니다.",
        },
        {
          t: "블로그 & 마케팅 콘텐츠",
          d: "블로그 글을 쓰고 인스타·페이스북 게시물로 바로 바꿔보세요.",
        },
      ],
      ctaTitle: "지금 바로 시작해보세요",
      ctaSub: "사업 이야기 하나면 충분합니다. STORYUP이 브랜드와 콘텐츠로 만들어드립니다.",
    },
    footer: { tagline: "당신의 이야기를 비즈니스로. · Turn Your Story Into Business." },
    auth: {
      loginTitle: "다시 오신 걸 환영해요",
      loginSub: "STORYUP 계정으로 로그인하세요.",
      signupTitle: "STORYUP 시작하기",
      signupSub: "이야기 하나면 충분합니다.",
      resetTitle: "비밀번호 재설정",
      resetSub: "가입한 이메일로 재설정 링크를 보내드립니다.",
      email: "이메일",
      password: "비밀번호",
      name: "이름",
      login: "로그인",
      signup: "무료로 시작하기",
      sendReset: "재설정 링크 보내기",
      forgot: "비밀번호를 잊으셨나요?",
      noAccount: "아직 계정이 없나요?",
      haveAccount: "이미 계정이 있나요?",
      toSignup: "회원가입",
      toLogin: "로그인",
      backLogin: "← 로그인으로 돌아가기",
      home: "← 홈으로",
      pwHint: "6자 이상 입력해주세요.",
    },
    onboarding: {
      later: "나중에 하기",
      step: "Step",
      of: "of",
      back: "이전",
      next: "다음",
      create: "브랜드 만들기",
      required: "이 항목을 입력해주세요.",
      q: [
        { t: "사업 또는 프로젝트 이름은 무엇인가요?", h: "나중에 언제든 바꿀 수 있어요.", p: "예: 카페 모멘트" },
        { t: "어떤 사업을 하고 계신가요?", h: "", p: "" },
        { t: "왜 이 사업을 시작하셨나요?", h: "", p: "사업을 시작하게 된 계기나 특별한 이야기를 자유롭게 들려주세요." },
        { t: "주요 고객은 누구인가요?", h: "", p: "예: 20~30대 직장인, 지역 주민, 외국인 관광객, 스타트업, 기업 고객" },
        { t: "우리 사업의 가장 큰 장점은 무엇인가요?", h: "", p: "예: 직접 로스팅한 커피, 매일 만드는 디저트, 편안한 공간" },
        { t: "고객에게 어떤 이미지로 기억되고 싶나요?", h: "", p: "" },
      ],
    },
  },
  en: {
    nav: { login: "Log in", start: "Get started free" },
    landing: {
      eyebrow: "AI business branding platform",
      title1: "Turn your story",
      title2: "into business",
      title3: ".",
      sub: "Tell us your business story. AI turns it into your brand, website, and blog content.",
      cta: "Get started free",
      how: "How it works",
      processEyebrow: "How it works",
      processTitle: "From a single story to an online business",
      steps: [
        { t: "STORY", d: "Tell us your business story." },
        { t: "BRAND", d: "AI writes your brand story." },
        { t: "WEBSITE", d: "Get a business homepage in minutes." },
        { t: "CONTENT", d: "Generate blog content." },
        { t: "GROW", d: "Get ready to meet customers online." },
      ],
      features: [
        {
          t: "AI brand story",
          d: "Answer a few questions and get an authentic brand story and slogan.",
        },
        {
          t: "Automatic homepage",
          d: "A publish-ready business website — no technical skills needed.",
        },
        {
          t: "Blog & marketing content",
          d: "Write blog posts and turn them into Instagram & Facebook posts instantly.",
        },
      ],
      ctaTitle: "Start right now",
      ctaSub: "One business story is all it takes. STORYUP turns it into your brand and content.",
    },
    footer: { tagline: "Turn Your Story Into Business." },
    auth: {
      loginTitle: "Welcome back",
      loginSub: "Log in to your STORYUP account.",
      signupTitle: "Get started with STORYUP",
      signupSub: "One story is all it takes.",
      resetTitle: "Reset password",
      resetSub: "We'll email a reset link to your account.",
      email: "Email",
      password: "Password",
      name: "Name",
      login: "Log in",
      signup: "Get started free",
      sendReset: "Send reset link",
      forgot: "Forgot your password?",
      noAccount: "Don't have an account?",
      haveAccount: "Already have an account?",
      toSignup: "Sign up",
      toLogin: "Log in",
      backLogin: "← Back to log in",
      home: "← Home",
      pwHint: "Use at least 6 characters.",
    },
    onboarding: {
      later: "Do it later",
      step: "Step",
      of: "of",
      back: "Back",
      next: "Next",
      create: "Create my brand",
      required: "Please fill in this field.",
      q: [
        { t: "What's your business or project name?", h: "You can change this anytime.", p: "e.g. Cafe Moment" },
        { t: "What kind of business is it?", h: "", p: "" },
        { t: "Why did you start this business?", h: "", p: "Share the reason or story behind starting your business." },
        { t: "Who are your main customers?", h: "", p: "e.g. 20-30s professionals, local residents, tourists, startups, enterprises" },
        { t: "What's your biggest strength?", h: "", p: "e.g. house-roasted coffee, fresh daily desserts, a cozy space" },
        { t: "How do you want customers to remember you?", h: "", p: "" },
      ],
    },
  },
};

export type Dict = (typeof translations)["ko"];

export async function getDict(): Promise<{ locale: Locale; t: Dict }> {
  const locale = await getLocale();
  return { locale, t: translations[locale] };
}
