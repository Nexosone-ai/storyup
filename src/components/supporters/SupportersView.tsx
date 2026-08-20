"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card, Badge } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input, Textarea, Label, Select } from "@/components/ui/Field";
import { Spinner } from "@/components/ui/Spinner";
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
  const [tab, setTab] = useState<Tab>("browse");
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="eyebrow mb-2">서포터즈</p>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          전문가와 협업하기
        </h1>
      </div>

      <div className="flex gap-1 rounded-xl border border-border bg-surface p-1">
        {(
          [
            ["browse", "둘러보기"],
            ["profile", "내 프로필"],
            ["projects", `내 프로젝트${projects.length ? ` (${projects.length})` : ""}`],
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
  if (directory.length === 0)
    return (
      <p className="rounded-2xl border border-dashed border-border bg-surface p-10 text-center text-muted">
        아직 등록된 서포터가 없습니다. ‘내 프로필’에서 첫 서포터로 등록해보세요.
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
          {SUPPORTER_ROLE_LABEL[supporter.role as SupporterRole] ?? supporter.role}
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
          포트폴리오 보기 →
        </a>
      )}

      <div className="mt-4 border-t border-border pt-4">
        {done ? (
          <p className="text-sm text-primary">의뢰가 전달되었습니다.</p>
        ) : businesses.length === 0 ? (
          <p className="text-xs text-muted">
            의뢰하려면 먼저 비즈니스를 만들어주세요.
          </p>
        ) : !open ? (
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            프로젝트 의뢰
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
              placeholder="프로젝트 제목"
            />
            <Textarea
              className="min-h-16"
              value={desc}
              onChange={(e) => setDesc(e.target.value)}
              placeholder="요청 내용"
            />
            <Input
              type="number"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="예산 포인트 (선택)"
            />
            {error && <p className="text-sm text-danger">{error}</p>}
            <div className="flex gap-2">
              <Button size="sm" onClick={submit} disabled={pending}>
                {pending ? <Spinner className="size-4" /> : "의뢰 보내기"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
                취소
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
      setNote(res.error ?? "저장되었습니다.");
      if (!res.error) router.refresh();
    });

  return (
    <Card className="space-y-4">
      <div>
        <Label htmlFor="sp-role">역할</Label>
        <Select
          id="sp-role"
          value={role}
          onChange={(e) => setRole(e.target.value as SupporterRole)}
        >
          {SUPPORTER_ROLES.map((r) => (
            <option key={r} value={r}>
              {SUPPORTER_ROLE_LABEL[r]}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="sp-name">활동 이름</Label>
        <Input id="sp-name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="sp-bio">소개</Label>
        <Textarea
          id="sp-bio"
          className="min-h-20"
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="어떤 작업을 하는지 소개해주세요."
        />
      </div>
      <div>
        <Label htmlFor="sp-skills">전문 분야 (쉼표로 구분)</Label>
        <Input
          id="sp-skills"
          value={skills}
          onChange={(e) => setSkills(e.target.value)}
          placeholder="브랜딩, 로고, 패키지"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label htmlFor="sp-portfolio">포트폴리오 URL</Label>
          <Input
            id="sp-portfolio"
            value={portfolio}
            onChange={(e) => setPortfolio(e.target.value)}
            placeholder="https://"
          />
        </div>
        <div>
          <Label htmlFor="sp-contact">연락처</Label>
          <Input
            id="sp-contact"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            placeholder="이메일 / SNS"
          />
        </div>
      </div>
      {note && <p className="text-sm text-primary">{note}</p>}
      <Button onClick={save} disabled={pending}>
        {pending ? <Spinner className="size-4" /> : profile ? "프로필 수정" : "서포터로 등록"}
      </Button>
    </Card>
  );
}

/* ---------------- My projects ---------------- */
function Projects({ projects }: { projects: ProjectRow[] }) {
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
        아직 프로젝트가 없습니다.
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
                  {PROJECT_STATUS_LABEL[p.status] ?? p.status}
                </Badge>
              </div>
              <p className="mt-1 text-sm text-muted">
                {p.asSupporter
                  ? `의뢰: ${p.business_name}`
                  : `담당: ${p.supporter_name}`}
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
                  수락
                </Button>
                <Button size="sm" variant="outline" onClick={() => act(p.id, "declined")} disabled={pending}>
                  거절
                </Button>
              </>
            )}
            {!p.asSupporter && p.status === "accepted" && (
              <Button size="sm" onClick={() => act(p.id, "completed")} disabled={pending}>
                완료 처리
              </Button>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}
