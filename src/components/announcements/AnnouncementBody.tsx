/**
 * 공지 팝업 본문(이미지·제목·내용·버튼) — 프레젠테이션 전용.
 * 실제 팝업(AnnouncementPopup)과 관리자 미리보기가 함께 쓴다.
 */
export interface AnnouncementContent {
  title: string;
  body: string;
  imageUrl: string | null;
  linkUrl: string | null;
  linkLabel: string | null;
}

export function AnnouncementBody({
  content,
  onLinkClick,
}: {
  content: AnnouncementContent;
  /** 버튼 클릭 시 부가 처리(추적/닫기 등). 링크 이동은 기본 동작 유지. */
  onLinkClick?: () => void;
}) {
  const { title, body, imageUrl, linkUrl, linkLabel } = content;
  return (
    <div>
      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- 관리자가 넣는 외부 이미지 URL
        <img
          src={imageUrl}
          alt=""
          className="mb-4 max-h-56 w-full rounded-xl object-cover"
        />
      )}
      <h3 className="text-lg font-bold tracking-tight">
        {title || "(제목 없음)"}
      </h3>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted">
        {body || "(내용을 입력하면 여기에 표시됩니다)"}
      </p>
      {linkUrl && linkLabel && (
        <a
          href={linkUrl}
          target={linkUrl.startsWith("/") ? undefined : "_blank"}
          rel={linkUrl.startsWith("/") ? undefined : "noopener noreferrer"}
          onClick={onLinkClick}
          className="mt-4 inline-flex items-center justify-center rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          {linkLabel}
        </a>
      )}
    </div>
  );
}
