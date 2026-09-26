"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/icons";
import { savePushSubscriptionAction } from "@/app/dashboard/push-actions";

/** VAPID 공개키(base64url) → Uint8Array (applicationServerKey 형식). */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

type State = "loading" | "unsupported" | "on" | "off" | "denied";

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

/**
 * 브라우저 알림(웹 푸시) 켜기 — 만기 등 알림을 앱을 닫아도 받는다.
 * 권한 요청 → PushManager 구독 → 서버 저장. 이미 켜졌거나 미지원이면 그에 맞게 표시.
 */
export function EnablePushButton({ ko }: { ko: boolean }) {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const decide = () => {
      const supported =
        typeof window !== "undefined" &&
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window &&
        !!VAPID;
      if (!supported) {
        setState("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        setState("denied");
        return;
      }
      // 이미 구독돼 있는지 확인
      navigator.serviceWorker
        .getRegistration()
        .then((reg) => reg?.pushManager.getSubscription())
        .then((sub) => setState(sub ? "on" : "off"))
        .catch(() => setState("off"));
    };
    decide();
  }, []);

  const enable = async () => {
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setState(perm === "denied" ? "denied" : "off");
        return;
      }
      const reg =
        (await navigator.serviceWorker.getRegistration()) ??
        (await navigator.serviceWorker.register("/sw.js"));
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID as string) as BufferSource,
      });
      const json = sub.toJSON();
      const keys = json.keys ?? {};
      const res = await savePushSubscriptionAction({
        endpoint: json.endpoint ?? sub.endpoint,
        p256dh: keys.p256dh ?? "",
        auth: keys.auth ?? "",
      });
      setState(res.error ? "off" : "on");
    } catch {
      setState("off");
    } finally {
      setBusy(false);
    }
  };

  if (state === "loading" || state === "unsupported") return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-4">
      <div className="flex items-center gap-3">
        <span className="grid size-9 place-items-center rounded-full bg-primary-soft text-primary">
          <Icon.bell width={18} height={18} />
        </span>
        <div>
          <p className="text-sm font-semibold">
            {ko ? "브라우저 알림" : "Browser notifications"}
          </p>
          <p className="text-xs text-muted">
            {state === "on"
              ? ko
                ? "켜짐 — 만기 등 중요 소식을 받아요."
                : "On — you'll get expiry and important alerts."
              : state === "denied"
                ? ko
                  ? "차단됨 — 브라우저 설정에서 알림을 허용해주세요."
                  : "Blocked — allow notifications in your browser settings."
                : ko
                  ? "앱을 닫아도 만기 알림 등을 받을 수 있어요."
                  : "Get expiry alerts even when the app is closed."}
          </p>
        </div>
      </div>
      {state === "off" && (
        <button
          type="button"
          onClick={enable}
          disabled={busy}
          className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
        >
          {busy ? (ko ? "설정 중…" : "Enabling…") : ko ? "알림 켜기" : "Enable"}
        </button>
      )}
      {state === "on" && (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-primary-soft px-3 py-1.5 text-sm font-semibold text-primary">
          <Icon.check width={16} height={16} />
          {ko ? "켜짐" : "On"}
        </span>
      )}
    </div>
  );
}
