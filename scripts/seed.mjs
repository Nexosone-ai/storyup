// Seed a complete CAFE MOMENT demo business.
// Run:  npm run seed
// Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local
// (loaded automatically via `node --env-file`).

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local",
  );
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const DEMO_EMAIL = "demo@storyup.app";
const DEMO_PASSWORD = "storyup1234";

async function getOrCreateUser() {
  const { data, error } = await admin.auth.admin.createUser({
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    email_confirm: true,
    user_metadata: { name: "데모 사용자" },
  });
  if (data?.user) return data.user;

  if (error && !/already/i.test(error.message)) throw error;

  // Already exists — find them.
  const { data: list } = await admin.auth.admin.listUsers();
  const user = list.users.find((u) => u.email === DEMO_EMAIL);
  if (!user) throw new Error("Could not resolve demo user");
  return user;
}

const websiteContent = {
  hero: {
    businessName: "CAFE MOMENT",
    headline: "잠깐 쉬어가도 괜찮아요",
    shortDescription:
      "직접 로스팅한 커피와 매일 만드는 디저트, 그리고 편안한 공간. 카페 모멘트에서 당신의 하루에 여유 한 잔을 더하세요.",
    ctaLabel: "찾아오시는 길",
  },
  story: {
    title: "Our Story",
    body: "회사 생활을 하면서, 하루 중 잠깐이라도 사람들이 편안하게 쉬어갈 수 있는 공간이 있었으면 좋겠다고 생각했습니다.\n\n그래서 작은 동네 카페를 시작했습니다. 커피 한 잔에 담긴 여유가 누군가의 하루를 조금 더 따뜻하게 만들기를 바랍니다.",
  },
  offers: {
    title: "What We Offer",
    items: [
      {
        title: "직접 로스팅 커피",
        description: "매장에서 직접 로스팅한 신선한 원두로 내린 스페셜티 커피.",
      },
      {
        title: "매일 만드는 디저트",
        description: "그날 아침 직접 구운 케이크와 쿠키를 만나보세요.",
      },
      {
        title: "편안한 공간",
        description: "혼자여도, 함께여도 편안한 동네 사랑방 같은 자리.",
      },
    ],
  },
  whyChooseUs: {
    title: "Why Choose Us",
    items: [
      {
        title: "신선함",
        description: "로스팅부터 디저트까지 매일 신선하게 준비합니다.",
      },
      {
        title: "따뜻함",
        description: "이름을 기억하는 단골 같은 편안한 응대.",
      },
      {
        title: "여유",
        description: "바쁜 하루 속 잠깐의 쉼표가 되어드립니다.",
      },
    ],
  },
  contact: {
    phone: "02-123-4567",
    email: "hello@cafemoment.kr",
    address: "서울시 어딘가 동네길 12",
    instagram: "@cafe.moment",
    website: "cafemoment.kr",
  },
};

const blogContent = `## 봄에 어울리는 딸기 케이크가 나왔어요

카페 모멘트의 새로운 시즌 디저트, **딸기 생크림 케이크**를 소개합니다.

제철을 맞은 신선한 딸기를 듬뿍 올리고, 부드러운 생크림과 촉촉한 시트로 완성했어요.

- 매일 아침 직접 구운 시트
- 당도 높은 제철 딸기만 사용
- 과하지 않은 담백한 생크림

따뜻한 커피 한 잔과 함께, 봄의 여유를 즐겨보세요. 카페 모멘트에서 기다리고 있겠습니다.`;

async function seed() {
  const user = await getOrCreateUser();
  console.log("Demo user:", user.email);

  // Ensure profile exists.
  await admin
    .from("profiles")
    .upsert(
      { user_id: user.id, name: "데모 사용자", email: DEMO_EMAIL },
      { onConflict: "user_id" },
    );

  // Reset any previous demo business (cascades to brand/website/blog).
  await admin.from("businesses").delete().eq("slug", "cafe-moment");

  const { data: business, error: bErr } = await admin
    .from("businesses")
    .insert({
      user_id: user.id,
      name: "CAFE MOMENT",
      category: "Cafe",
      description: "Coffee & Dessert",
      founder_story:
        "회사 생활을 하면서 하루 중 잠깐이라도 사람들이 편안하게 쉬어갈 수 있는 공간이 있었으면 좋겠다고 생각했습니다. 그래서 작은 동네 카페를 시작했습니다.",
      target_customer: "20~40대 직장인 및 지역 주민",
      strengths: "직접 로스팅한 커피, 매일 만드는 디저트, 편안한 공간",
      tone: "Friendly",
      slug: "cafe-moment",
    })
    .select("id")
    .single();
  if (bErr) throw bErr;

  await admin.from("brand_profiles").insert({
    business_id: business.id,
    brand_name: "CAFE MOMENT",
    headline: "잠깐 쉬어가도 괜찮아요",
    slogan: "당신의 하루에 여유 한 잔",
    short_description:
      "직접 로스팅한 커피와 매일 만드는 디저트가 있는 편안한 동네 카페.",
    brand_story:
      "회사 생활을 하면서, 하루 중 잠깐이라도 사람들이 편안하게 쉬어갈 수 있는 공간이 있었으면 좋겠다고 생각했습니다. 그래서 작은 동네 카페를 시작했습니다. 커피 한 잔에 담긴 여유가 누군가의 하루를 따뜻하게 만들기를 바랍니다.",
    mission: "바쁜 일상 속에서 누구나 편히 쉬어갈 수 있는 공간을 만듭니다.",
    target_customer: "20~40대 직장인 및 지역 주민",
    key_strengths: ["직접 로스팅한 커피", "매일 만드는 디저트", "편안한 공간"],
    brand_keywords: ["동네카페", "스페셜티커피", "수제디저트", "여유", "휴식"],
    tone: "Friendly",
  });

  await admin.from("websites").insert({
    business_id: business.id,
    slug: "cafe-moment",
    content: websiteContent,
    status: "published",
    published_at: new Date().toISOString(),
  });

  const { data: post } = await admin
    .from("blog_posts")
    .insert({
      business_id: business.id,
      title: "봄에 어울리는 딸기 케이크가 나왔어요",
      slug: "strawberry-cake",
      summary: "제철 딸기를 듬뿍 올린 카페 모멘트의 새 시즌 디저트를 소개합니다.",
      content: blogContent,
      keywords: ["딸기케이크", "시즌디저트", "카페모멘트", "동네카페"],
      seo_title: "봄 딸기 생크림 케이크 | 카페 모멘트",
      seo_description:
        "제철 딸기를 듬뿍 올린 카페 모멘트의 봄 시즌 딸기 생크림 케이크.",
      social_caption: "🍓 봄이 왔어요! 카페 모멘트의 딸기 생크림 케이크 신메뉴 출시",
      status: "published",
      published_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  await admin.from("marketing_contents").insert([
    {
      business_id: business.id,
      blog_post_id: post?.id ?? null,
      platform: "instagram",
      content:
        "🍓 봄이 왔어요\n카페 모멘트의 새 시즌 딸기 생크림 케이크 🍰\n\n매일 아침 직접 구운 시트에 제철 딸기를 듬뿍 올렸어요.\n따뜻한 커피 한 잔과 함께 여유를 즐겨보세요 ☕\n\n#카페모멘트 #딸기케이크 #동네카페 #스페셜티커피 #수제디저트 #봄디저트 #카페스타그램",
    },
    {
      business_id: business.id,
      blog_post_id: post?.id ?? null,
      platform: "facebook",
      content:
        "카페 모멘트의 봄 시즌 신메뉴, 딸기 생크림 케이크가 출시되었습니다. 매일 아침 직접 구운 시트에 제철 딸기를 듬뿍 올리고 담백한 생크림으로 완성했어요. 직접 로스팅한 따뜻한 커피 한 잔과 함께, 바쁜 하루 속 여유를 즐겨보세요. #카페모멘트 #딸기케이크",
    },
  ]);

  console.log("\n✅ Seed complete.");
  console.log("   Login:  ", DEMO_EMAIL, "/", DEMO_PASSWORD);
  console.log("   Site:    /site/cafe-moment");
  console.log("   Blog:    /site/cafe-moment/blog/strawberry-cake");
}

seed().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
