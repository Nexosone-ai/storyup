import { Icon } from "@/components/ui/icons";

export interface SupporterProfileView {
  display_name: string;
  work_status: string | null;
  history: string | null;
  bio: string | null;
  portfolio_url: string | null;
  skills: string[];
}

/** 담당 서포터(파트너) 소개 카드 — 작업 현황·이력·포트폴리오. 읽기 전용. */
export function SupporterProfileCard({
  profile,
  heading = "담당 파트너",
}: {
  profile: SupporterProfileView;
  heading?: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon.briefcase className="size-4 text-muted" />
          <span className="text-xs text-muted">{heading}</span>
        </div>
        {profile.work_status && (
          <span className="rounded-full bg-primary-soft/40 px-2.5 py-0.5 text-xs font-semibold text-primary">
            {profile.work_status}
          </span>
        )}
      </div>
      <p className="mt-1.5 font-semibold">{profile.display_name}</p>
      {profile.bio && <p className="mt-1 text-sm text-muted">{profile.bio}</p>}
      {profile.skills.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {profile.skills.map((s) => (
            <span
              key={s}
              className="rounded-full bg-surface-muted px-2 py-0.5 text-xs text-muted"
            >
              {s}
            </span>
          ))}
        </div>
      )}
      {profile.history && (
        <div className="mt-2">
          <p className="text-xs font-medium text-muted">경력·이력</p>
          <p className="mt-0.5 whitespace-pre-wrap text-sm text-foreground">
            {profile.history}
          </p>
        </div>
      )}
      {profile.portfolio_url && (
        <a
          href={profile.portfolio_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-sm text-primary underline underline-offset-2"
        >
          포트폴리오 보기
        </a>
      )}
    </div>
  );
}
