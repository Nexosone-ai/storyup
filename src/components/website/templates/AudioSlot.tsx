"use client";

import { useRef, useState } from "react";
import { createAudioUploadUrl } from "@/app/business/actions";
import { createClient } from "@/lib/supabase/client";
import { useLocale } from "@/components/i18n/LocaleProvider";

const extFromName = (name: string) => {
  const m = name.toLowerCase().match(/\.([a-z0-9]{1,5})$/);
  return m ? m[1] : "mp3";
};

/**
 * 에디터용 mp3 업로드 슬롯(음악 앨범 트랙). 서명 URL → Storage 직접 업로드(공개 버킷)
 * → 공개 URL을 onChange로 저장. 업로드 권한(유료 플랜)은 서버 액션이 최종 판단한다.
 */
export function AudioSlot({
  value,
  onChange,
  businessId,
}: {
  value?: string;
  onChange: (url: string) => void;
  businessId: string;
}) {
  const ko = useLocale() === "ko";
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setErr(null);
    if (file.size > 25 * 1024 * 1024) {
      setErr(ko ? "음악 파일은 25MB 이하여야 합니다." : "Audio must be 25MB or smaller.");
      return;
    }
    setBusy(true);
    try {
      const ticket = await createAudioUploadUrl(businessId, extFromName(file.name));
      if (ticket.error || !ticket.path || !ticket.token || !ticket.publicUrl) {
        setErr(ticket.error ?? (ko ? "업로드 실패" : "Upload failed"));
        return;
      }
      const supabase = createClient();
      const { error: upErr } = await supabase.storage
        .from("site-audio")
        .uploadToSignedUrl(ticket.path, ticket.token, file, {
          contentType: file.type || "audio/mpeg",
        });
      if (upErr) {
        setErr(ko ? "업로드에 실패했습니다. 다시 시도해주세요." : "Upload failed. Try again.");
        return;
      }
      onChange(ticket.publicUrl);
    } catch {
      setErr(ko ? "업로드 중 문제가 발생했습니다." : "Something went wrong during upload.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-lg border border-dashed border-border bg-surface-muted/40 p-3">
      <input
        ref={inputRef}
        type="file"
        accept="audio/*,.mp3,.m4a,.wav"
        className="hidden"
        onChange={onFile}
      />
      {value ? (
        <div className="space-y-2">
          <audio controls preload="none" src={value} className="w-full">
            <track kind="captions" />
          </audio>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              className="rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium hover:bg-surface"
            >
              {busy ? (ko ? "업로드 중…" : "Uploading…") : ko ? "파일 교체" : "Replace"}
            </button>
            <button
              type="button"
              onClick={() => onChange("")}
              disabled={busy}
              className="rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-danger hover:bg-surface"
            >
              {ko ? "제거" : "Remove"}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-md border border-border bg-background px-3 py-2.5 text-sm font-medium hover:bg-surface"
        >
          {busy ? (ko ? "업로드 중…" : "Uploading…") : ko ? "🎵 mp3 업로드" : "🎵 Upload mp3"}
        </button>
      )}
      {err && <p className="mt-1.5 text-xs text-danger">{err}</p>}
    </div>
  );
}
