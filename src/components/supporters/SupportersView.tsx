"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, Badge } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Textarea, Label, Select } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Spinner";
import { useLocale } from "@/components/i18n/LocaleProvider";
import { cn } from "@/utils/cn";
import {
  SUPPORTER_ROLES,
  SUPPORTER_ROLE_LABEL,
  PROJECT_STATUS_LABEL,
  type SupporterRole,
} from "@/types/domain";
import type { SupporterCard, MySupporter, ProjectRow } from "@/lib/supporters";
import {
  saveSupporterProfile,
  requestProject,
  updateProjectStatus,
} from "@/app/dashboard/supporters/actions";

type Tab = "browse" | "profile" | "projects";

/** 도메인 상수의 한국어 라벨에 대응하는 영어 라벨 (표시 전용). */
const ROLE_LABEL_EN: Record<SupporterRole, string> = {
  designer: "Designer",
  editor: "Video editor",
  musician: "Music producer",
};

const PROJECT_STATUS_EN: Record<string, string> = {
  requested: "Requested",
  accepted: "Accepted",
  declined: "Declined",
  completed: "Completed",
};

export function SupportersView({
  directory,
  myProfile,
  businesses,
  projects,
}: {
  directory: SupporterCard[];
  myProfile: MySupporter | null;
  businesses: { id: string; name: string }[];
  projects: ProjectRow[];
}) {
  const ko = useLocale() === "ko";
  const [tab, setTab] = useState<Tab>("browse");
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="eyebrow mb-2">{ko ? "서포터즈" : "Supporters"}</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          {ko ? "전문가와 협업하기" : "Collaborate with experts"}
        </h1>
      </div>

      <div className="flex gap-1 rounded-xl border border-border bg-surface p-1">
        {(
          [
            ["browse", ko ? "둘러보기" : "Browse"],
            ["profile", ko ? "내 프로필" : "My profile"],
            [
              "projects",
              `${ko ? "내 프로젝트" : "My projects"}${projects.length ? ` (${projects.length})` : ""}`,
            ],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              "flex-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              tab === id
                ? "bg-primary-soft text-primary"
                : "text-muted hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "browse" && (
        <Directory directory={directory} businesses={businesses} />
      )}
      {tab === "profile" && <ProfileForm profile={myProfile} />}
      {tab === "projects" && <Projects projects={projects} />}
    </div>
  );
}

/* ---------------- Directory ---------------- */
function Directory({
  directory,
  businesses,
}: {
  directory: SupporterCard[];
  businesses: { id: string; name: string }[];
}) {
  const ko = useLocale() === "ko";
  if (directory.length === 0)
    return (
      <p className="rounded-2xl border border-dashed border-border bg-surface p-10 text-center text-muted">
        {ko
          ? "아직 등록된 서포터가 없습니다. ‘내 프로필’에서 첫 서포터로 등록해보세요."
          : "No supporters registered yet. Be the first — sign up under My profile."}
      </p>
    );
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {directory.map((s) => (
        <SupporterCardItem key={s.id} supporter={s} businesses={businesses} />
      ))}
    </div>
  );
}

function SupporterCardItem({
  supporter,
  businesses,
}: {
  supporter: SupporterCard;
  businesses: { id: string; name: string }[];
}) {
  const ko = useLocale() === "ko";
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [businessId, setBusinessId] = useState(businesses[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [budget, setBudget] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  const submit = () =>
    start(async () => {
      setError(null);
      const res = await requestProject({
        businessId,
        supporterUserId: supporter.user_id,
        supporterName: supporter.display_name,
        title,
        description: desc,
        budgetPoints: budget ? Number(budget) : null,
      });
      if (res.error) setError(res.error);
      else {
        setDone(true);
        setOpen(false);
        setTitle("");
        setDesc("");
        setBudget("");
        router.refresh();
      }
    });

  return (
    <Card className="flex flex-col">
      <div className="flex items-center justify-between">
        <Badge tone="primary">
          {(ko
            ? SUPPORTER_ROLE_LABEL[supporter.role as SupporterRole]
            : ROLE_LABEL_EN[supporter.role as SupporterRole]) ?? supporter.role}
        </Badge>
      </div>
      <h3 className="mt-3 text-lg font-semibold">{supporter.display_name}</h3>
      {supporter.bio && (
        <p className="mt-1 text-sm leading-relaxed text-muted">{supporter.bio}</p>
      )}
      {supporter.skills.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {supporter.skills.map((sk) => (
            <span
              key={sk}
              className="rounded-full bg-surface-muted px-2.5 py-0.5 text-xs text-muted"
            >
              {sk}
            </span>
          ))}
        </div>
      )}
      {supporter.portfolio_url && (
        <a
          href={supporter.portfolio_url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 text-sm font-medium text-primary hover:underline"
        >
          {ko ? "포트폴리오 보기 →" : "View portfolio →"}
        </a>
      )}

      <div className="mt-4 border-t border-border pt-4">
        {done ? (
          <p className="text-sm text-primary">
            {ko ? "의뢰가 전달되었습니다." : "Your request has been sent."}
          </p>
        ) : businesses.length === 0 ? (
          <p className="text-xs text-muted">
            {ko
              ? "의뢰하려면 먼저 비즈니스를 만들어주세요."
              : "Create a business first to send a request."}
          </p>
        ) : !open ? (
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            {ko ? "프로젝트 의뢰" : "Request a project"}
          </Button>
        ) : (
          <div className="space-y-2">
            <Select
              value={businessId}
              onChange={(e) => setBusinessId(e.target.value)}
            >
              {businesses.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </Select>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={ko ? "프로젝트 제목" : "Project title"}
            />
            <Textarea
              className="min-h-16"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder={ko ? "요청 내용" : "What you need"}
            />
            <Input
              type="number"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder={ko ? "예산 포인트 (선택)" : "Budget in points (optional)"}
            />
            {error && <p className="text-sm text-danger">{error}</p>}
            <div className="flex gap-2">
              <Button size="sm" onClick={submit} disabled={pending}>
                {pending ? (
                  <Spinner className="size-4" />
                ) : ko ? (
                  "의뢰 보내기"
                ) : (
                  "Send request"
                )}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
                {ko ? "취소" : "Cancel"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

/* ---------------- My profile ---------------- */
function ProfileForm({ profile }: { profile: MySupporter | null }) {
  const ko = useLocale() === "ko";
  const router = useRouter();
  const [role, setRole] = useState<SupporterRole>(
    (profile?.role as SupporterRole) ?? "designer",
  );
  const [name, setName] = useState(profile?.display_name ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [skills, setSkills] = useState((profile?.skills ?? []).join(", "));
  const [portfolio, setPortfolio] = useState(profile?.portfolio_url ?? "");
  const [contact, setContact] = useState(profile?.contact ?? "");
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      setNote(null);
      const res = await saveSupporterProfile({
        role,
        displayName: name,
        bio,
        skills: skills
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
        portfolioUrl: portfolio,
        contact,
      });
      setNote(res.error ?? (ko ? "저장되었습니다." : "Saved."));
      if (!res.error) router.refresh();
    });

  return (
    <Card className="space-y-4">
      <div>
        <Label htmlFor="sp-role">{ko ? "역할" : "Role"}</Label>
        <Select
          id="sp-role"
          value={role}
          onChange={(e) => setRole(e.target.value as SupporterRole)}
        >
          {SUPPORTER_ROLES.map((r) => (
            <option key={r} value={r}>
              {ko ? SUPPORTER_ROLE_LABEL[r] : ROLE_LABEL_EN[r]}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="sp-name">{ko ? "활동 이름" : "Display name"}</Label>
        <Input id="sp-name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="sp-bio">{ko ? "소개" : "Bio"}</Label>
        <Textarea
          id="sp-bio"
          className="min-h-20"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder={
            ko
              ? "어떤 작업을 하는지 소개해주세요."
              : "Describe the kind of work you do."
          }
        />
      </div>
      <div>
        <Label htmlFor="sp-skills">
          {ko ? "전문 분야 (쉼표로 구분)" : "Specialties (comma-separated)"}
        </Label>
        <Input
          id="sp-skills"
          value={skills}
          onChange={(e) => setSkills(e.target.value)}
          placeholder={ko ? "브랜딩, 로고, 패키지" : "Branding, logo, packaging"}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="sp-portfolio">
            {ko ? "포트폴리오 URL" : "Portfolio URL"}
          </Label>
          <Input
            id="sp-portfolio"
            value={portfolio}
            onChange={(e) => setPortfolio(e.target.value)}
            placeholder="https://"
          />
        </div>
        <div>
          <Label htmlFor="sp-contact">{ko ? "연락처" : "Contact"}</Label>
          <Input
            id="sp-contact"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder={ko ? "이메일 / SNS" : "Email / social handle"}
          />
        </div>
      </div>
      {note && <p className="text-sm text-primary">{note}</p>}
      <Button onClick={save} disabled={pending}>
        {pending ? (
          <Spinner className="size-4" />
        ) : profile ? (
          ko ? "프로필 수정" : "Update profile"
        ) : ko ? (
          "서포터로 등록"
        ) : (
          "Register as supporter"
        )}
      </Button>
    </Card>
  );
}

/* ---------------- My projects ---------------- */
function Projects({ projects }: { projects: ProjectRow[] }) {
  const ko = useLocale() === "ko";
  const router = useRouter();
  const [pending, start] = useTransition();

  const act = (id: string, status: "accepted" | "declined" | "completed") =>
    start(async () => {
      await updateProjectStatus(id, status);
      router.refresh();
    });

  if (projects.length === 0)
    return (
      <p className="rounded-2xl border border-dashed border-border bg-surface p-10 text-center text-muted">
        {ko ? "아직 프로젝트가 없습니다." : "No projects yet."}
      </p>
    );

  return (
    <ul className="space-y-3">
      {projects.map((p) => (
        <li key={p.id} className="rounded-2xl border border-border bg-surface p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate font-semibold">{p.title}</p>
                <Badge tone={p.status === "completed" ? "success" : "muted"}>
                  {(ko
                    ? PROJECT_STATUS_LABEL[p.status]
                    : PROJECT_STATUS_EN[p.status]) ?? p.status}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted">
                {p.asSupporter
                  ? `${ko ? "의뢰" : "Client"}: ${p.business_name}`
                  : `${ko ? "담당" : "Supporter"}: ${p.supporter_name}`}
                {p.budget_points ? ` · ${p.budget_points.toLocaleString()}P` : ""}
              </p>
              {p.description && (
                <p className="mt-2 text-sm leading-relaxed text-foreground/85">
                  {p.description}
                </p>
              )}
            </div>
          </div>

          <div className="mt-3 flex gap-2">
            {p.asSupporter && p.status === "requested" && (
              <>
                <Button size="sm" onClick={() => act(p.id, "accepted")} disabled={pending}>
                  {ko ? "수락" : "Accept"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => act(p.id, "declined")} disabled={pending}>
                  {ko ? "거절" : "Decline"}
                </Button>
              </>
            )}
            {!p.asSupporter && p.status === "accepted" && (
              <Button size="sm" onClick={() => act(p.id, "completed")} disabled={pending}>
                {ko ? "완료 처리" : "Mark complete"}
              </Button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
