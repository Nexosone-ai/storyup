import "server-only";

/**
 * GitHub Skill Hub — 공개 저장소에서 Skill 패키지를 '안전하게' 가져와 분석한다.
 * - api.github.com / raw.githubusercontent.com 만 사용(경로/ref는 추측하지 않고 API로 확인).
 * - 특정 commit SHA로 고정(브랜치 최신 자동 사용 안 함).
 * - symlink/submodule, 과대 파일/개수/깊이 차단. 외부 스크립트/압축은 실행하지 않음.
 * - 실행(D단계)과 분리. 여기선 메타데이터·라이선스·지원수준 분석만.
 * - 토큰(GITHUB_TOKEN)은 서버에서만 사용, 프런트/Skill 컨텍스트에 노출하지 않는다.
 */

export const GH_LIMITS = {
  maxFiles: 200,
  maxSkillMdBytes: 256 * 1024,
  maxScanDirs: 40,
} as const;

export type SkillType = "A" | "B" | "C" | "D";
export type SupportLevel = "instructions" | "adapter" | "blocked";

export interface SkillFile {
  path: string;
  size: number;
  type: "file" | "dir" | "symlink" | "submodule" | "other";
  sha: string;
}

export interface SkillAnalysis {
  repo: string; // owner/repo
  ref: string | null;
  commitSha: string;
  skillPath: string;
  skillName: string;
  description: string | null;
  license: string | null;
  compatibility: string | null;
  allowedTools: string | null;
  skillType: SkillType;
  supportLevel: SupportLevel;
  supportReason: string;
  files: SkillFile[];
  bodyExcerpt: string;
}

export class GithubImportError extends Error {}

const NAME_RE = /^[A-Za-z0-9_.-]+$/;

export function parseGithubUrl(
  url: string,
): { owner: string; repo: string; ref: string | null; path: string } | null {
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || u.hostname.toLowerCase() !== "github.com") return null;
  const parts = u.pathname.replace(/^\/+|\/+$/g, "").split("/");
  if (parts.length < 2) return null;
  const owner = parts[0];
  const repo = parts[1].replace(/\.git$/, "");
  if (!NAME_RE.test(owner) || !NAME_RE.test(repo)) return null;
  let ref: string | null = null;
  let path = "";
  if (parts.length >= 4 && (parts[2] === "tree" || parts[2] === "blob")) {
    ref = parts[3];
    path = parts.slice(4).join("/");
  }
  // blob이 SKILL.md를 직접 가리키면 폴더로 보정.
  if (parts[2] === "blob" && path.toLowerCase().endsWith("/skill.md"))
    path = path.slice(0, -"/SKILL.md".length);
  else if (parts[2] === "blob" && path.toLowerCase() === "skill.md") path = "";
  return { owner, repo, ref, path };
}

async function gh(url: string, accept = "application/vnd.github+json"): Promise<Response> {
  const token = process.env.GITHUB_TOKEN;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12_000);
  try {
    return await fetch(url, {
      headers: {
        Accept: accept,
        "User-Agent": "storyup-skill-hub",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal: ctrl.signal,
      cache: "no-store",
    });
  } finally {
    clearTimeout(t);
  }
}

async function resolveCommit(owner: string, repo: string, ref: string | null): Promise<string> {
  // ref 없으면 기본 브랜치.
  let r = ref;
  if (!r) {
    const res = await gh(`https://api.github.com/repos/${owner}/${repo}`);
    if (res.status === 404) throw new GithubImportError("저장소를 찾을 수 없어요(공개 저장소만 지원).");
    if (!res.ok) throw new GithubImportError("저장소 정보를 가져오지 못했어요.");
    const j = (await res.json()) as { default_branch?: string; private?: boolean };
    if (j.private) throw new GithubImportError("비공개 저장소는 지원하지 않아요.");
    r = j.default_branch ?? "main";
  }
  const res = await gh(`https://api.github.com/repos/${owner}/${repo}/commits/${encodeURIComponent(r)}`);
  if (!res.ok) throw new GithubImportError("ref(브랜치/태그/커밋)를 확인하지 못했어요.");
  const j = (await res.json()) as { sha?: string };
  if (!j.sha) throw new GithubImportError("commit을 확인하지 못했어요.");
  return j.sha;
}

async function listDir(owner: string, repo: string, sha: string, path: string): Promise<SkillFile[]> {
  const res = await gh(
    `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURI(path)}?ref=${sha}`,
  );
  if (res.status === 404) return [];
  if (!res.ok) throw new GithubImportError("폴더 내용을 가져오지 못했어요.");
  const j = await res.json();
  const arr = Array.isArray(j) ? j : [j];
  return arr.slice(0, GH_LIMITS.maxFiles).map(
    (e: { path: string; size?: number; type?: string; sha?: string }): SkillFile => ({
      path: e.path,
      size: e.size ?? 0,
      type:
        e.type === "file" || e.type === "dir" || e.type === "symlink" || e.type === "submodule"
          ? e.type
          : "other",
      sha: e.sha ?? "",
    }),
  );
}

async function rawFile(owner: string, repo: string, sha: string, filePath: string): Promise<string> {
  const res = await gh(
    `https://raw.githubusercontent.com/${owner}/${repo}/${sha}/${encodeURI(filePath)}`,
    "text/plain",
  );
  if (!res.ok) throw new GithubImportError("파일을 읽지 못했어요.");
  const buf = await res.arrayBuffer();
  if (buf.byteLength > GH_LIMITS.maxSkillMdBytes) throw new GithubImportError("SKILL.md가 너무 커요.");
  return new TextDecoder().decode(buf);
}

/** SKILL.md frontmatter(최소 파싱) + 본문. */
function parseFrontmatter(md: string): {
  fields: Record<string, string>;
  body: string;
} {
  const m = /^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/.exec(md);
  const fields: Record<string, string> = {};
  let body = md;
  if (m) {
    body = m[2] ?? "";
    for (const line of m[1].split("\n")) {
      const kv = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(line);
      if (kv) fields[kv[1].toLowerCase()] = kv[2].trim().replace(/^["']|["']$/g, "");
    }
  }
  return { fields, body };
}

/** URL로부터 Skill을 가져와 분석(저장은 호출부). */
export async function analyzeGithubSkill(url: string): Promise<SkillAnalysis> {
  const parsed = parseGithubUrl(url);
  if (!parsed) throw new GithubImportError("github.com 저장소 URL이 아니에요.");
  const { owner, repo, ref, path } = parsed;

  const commitSha = await resolveCommit(owner, repo, ref);

  // SKILL.md 위치 찾기: path에 바로 있거나, 한 단계 하위 폴더 스캔.
  let skillDir = path;
  let entries = await listDir(owner, repo, commitSha, path);
  const hasSkill = (es: SkillFile[]) =>
    es.some((e) => e.type === "file" && /(^|\/)SKILL\.md$/i.test(e.path));
  if (!hasSkill(entries)) {
    const dirs = entries.filter((e) => e.type === "dir").slice(0, GH_LIMITS.maxScanDirs);
    let found = false;
    for (const d of dirs) {
      const sub = await listDir(owner, repo, commitSha, d.path);
      if (hasSkill(sub)) {
        skillDir = d.path;
        entries = sub;
        found = true;
        break;
      }
    }
    if (!found) throw new GithubImportError("SKILL.md를 찾지 못했어요(Agent Skills 저장소/폴더인지 확인).");
  }

  const skillMd = entries.find((e) => /(^|\/)SKILL\.md$/i.test(e.path))!;
  const md = await rawFile(owner, repo, commitSha, skillMd.path);
  const { fields, body } = parseFrontmatter(md);

  // 라이선스 감지: frontmatter + 폴더/루트의 LICENSE류.
  const licName = /^(LICENSE|LICENCE|COPYING)(\.[A-Za-z0-9]+)?$/i;
  let license: string | null = fields.license ?? null;
  if (!license) {
    if (entries.some((e) => licName.test(e.path.split("/").pop() ?? ""))) license = "저장소 폴더 LICENSE 파일 있음(내용 확인 필요)";
    else {
      const rootEntries = skillDir ? await listDir(owner, repo, commitSha, "") : entries;
      if (rootEntries.some((e) => licName.test(e.path.split("/").pop() ?? ""))) license = "저장소 루트 LICENSE 있음(내용 확인 필요)";
    }
  }

  // 타입/지원수준 분류.
  const names = entries.map((e) => (e.path.split("/").pop() ?? "").toLowerCase());
  const hasScripts = entries.some((e) => e.type === "dir" && /(^|\/)scripts$/i.test(e.path));
  const hasAssets = entries.some((e) => e.type === "dir" && /(^|\/)assets$/i.test(e.path));
  const unsafe = entries.find((e) => e.type === "symlink" || e.type === "submodule");

  let skillType: SkillType = "A";
  let supportLevel: SupportLevel = "instructions";
  let supportReason = "SKILL.md 지침을 디자인 변경안 생성에 참고(원본 실행 없음).";
  if (unsafe) {
    supportLevel = "blocked";
    supportReason = `안전하지 않은 항목(${unsafe.type})이 있어 차단했어요.`;
    skillType = "D";
  } else if (hasScripts || fields["allowed-tools"]) {
    skillType = "C";
    supportLevel = "adapter";
    supportReason = "스크립트/도구 실행을 요구해요. 기본 버전에선 실행하지 않고 '어댑터 필요'로 표시합니다.";
  } else if (hasAssets) {
    skillType = "B";
    supportLevel = "instructions";
    supportReason = "에셋/템플릿 포함. 지침은 지원하되 폰트·이미지 권리는 별도 확인이 필요해요.";
  }
  void names;

  return {
    repo: `${owner}/${repo}`,
    ref,
    commitSha,
    skillPath: skillDir,
    skillName: (fields.name || skillMd.path.replace(/\/SKILL\.md$/i, "").split("/").pop() || "skill").slice(0, 80),
    description: fields.description ? fields.description.slice(0, 500) : null,
    license,
    compatibility: fields.compatibility ? fields.compatibility.slice(0, 300) : null,
    allowedTools: fields["allowed-tools"] ?? null,
    skillType,
    supportLevel,
    supportReason,
    files: entries.slice(0, GH_LIMITS.maxFiles),
    bodyExcerpt: body.slice(0, 2000),
  };
}
