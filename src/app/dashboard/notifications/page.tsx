import { redirect } from "next/navigation";
import Link from "next/link";
import { getUser } from "@/lib/queries";
import { getNotifications } from "@/lib/notifications";
import { getLocale } from "@/lib/i18n";
import { Icon } from "@/components/ui/icons";
import { MarkNotificationsRead } from "@/components/dashboard/MarkNotificationsRead";
import { deleteNotificationAction } from "./actions";
import type { NotificationRow } from "@/types/database";

export const metadata = { title: "알림" };

function timeAgo(iso: string, ko: boolean): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return ko ? "방금 전" : "just now";
  if (min < 60) return ko ? `${min}분 전` : `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return ko ? `${hr}시간 전` : `${hr}h ago`;
  const d = Math.floor(hr / 24);
  if (d < 30) return ko ? `${d}일 전` : `${d}d ago`;
  return new Date(iso).toLocaleDateString(ko ? "ko-KR" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function label(n: NotificationRow, ko: boolean): string {
  const who = n.actor_name || (ko ? "방문자" : "A visitor");
  const title = n.post_title ? `"${n.post_title}"` : ko ? "내 글" : "your post";
  if (n.type === "blog_like")
    return ko
      ? `${who}님이 ${title} 글에 좋아요를 눌렀어요`
      : `${who} liked ${title}`;
  return ko
    ? `${who}님이 ${title} 글에 댓글을 남겼어요`
    : `${who} commented on ${title}`;
}

export default async function NotificationsPage() {
  const user = await getUser();
  if (!user) redirect("/login");
  const [items, locale] = await Promise.all([getNotifications(), getLocale()]);
  const ko = locale === "ko";
  const hasUnread = items.some((n) => !n.read_at);

  return (
    <div className="space-y-6">
      <MarkNotificationsRead hasUnread={hasUnread} />
      <h1 className="text-2xl font-semibold tracking-tight">
        {ko ? "알림" : "Notifications"}
      </h1>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface p-12 text-center">
          <div className="mx-auto grid size-12 place-items-center rounded-full bg-surface-muted text-muted">
            <Icon.bell width={22} height={22} />
          </div>
          <p className="mt-4 font-semibold">
            {ko ? "아직 알림이 없어요" : "No notifications yet"}
          </p>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-muted">
            {ko
              ? "블로그 글에 방문자가 좋아요를 누르거나 댓글을 남기면 여기에 알려드려요."
              : "When visitors like or comment on your blog posts, you'll see it here."}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
          {items.map((n) => {
            const href =
              n.site_slug && n.post_slug
                ? `/site/${n.site_slug}/blog/${n.post_slug}`
                : null;
            const body = (
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <span
                  className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-full ${
                    n.type === "blog_like"
                      ? "bg-primary-soft text-primary"
                      : "bg-surface-muted text-muted"
                  }`}
                >
                  {n.type === "blog_like" ? (
                    <Icon.heart width={18} height={18} />
                  ) : (
                    <Icon.chat width={18} height={18} />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{label(n, ko)}</p>
                  {n.preview && (
                    <p className="mt-0.5 truncate text-sm text-muted">
                      “{n.preview}”
                    </p>
                  )}
                  <p className="mt-1 text-xs text-muted">
                    {timeAgo(n.created_at, ko)}
                  </p>
                </div>
              </div>
            );
            return (
              <li
                key={n.id}
                className={`flex items-center justify-between gap-3 p-4 ${
                  n.read_at ? "" : "bg-primary-soft/30"
                }`}
              >
                {href ? (
                  <Link href={href} className="min-w-0 flex-1">
                    {body}
                  </Link>
                ) : (
                  <div className="min-w-0 flex-1">{body}</div>
                )}
                <form action={deleteNotificationAction.bind(null, n.id)}>
                  <button
                    type="submit"
                    aria-label={ko ? "삭제" : "Delete"}
                    className="shrink-0 rounded-lg p-2 text-muted hover:bg-surface-muted hover:text-danger"
                  >
                    <Icon.x width={16} height={16} />
                  </button>
                </form>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
