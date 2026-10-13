/** 광고 시스템 준비중 플레이스홀더 — 메뉴는 유지하되 기능은 비활성. */
export function AdsComingSoon({ admin = false }: { admin?: boolean }) {
  return (
    <div className="mx-auto max-w-lg">
      <div className="rounded-2xl border border-dashed border-border bg-surface p-10 text-center">
        <p className="text-3xl">🚧</p>
        <h1 className="mt-3 text-xl font-semibold tracking-tight">
          광고 서비스 준비중
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          {admin
            ? "광고 마켓플레이스(CPC·CPV·CPA) 운영 준비 중입니다. 곧 오픈 예정이에요."
            : "곧 StoryUp 광고 서비스가 열립니다. 블로그에 광고를 받아 수익을 내고, 내 비즈니스를 광고로 알릴 수 있어요. 준비가 끝나면 알려드릴게요."}
        </p>
      </div>
    </div>
  );
}
