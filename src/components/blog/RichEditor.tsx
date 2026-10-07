"use client";

import { useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import { Node, mergeAttributes } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { TextStyle, FontSize, Color } from "@tiptap/extension-text-style";
import TextAlign from "@tiptap/extension-text-align";
import Image from "@tiptap/extension-image";
import Youtube from "@tiptap/extension-youtube";
import { Icon } from "@/components/ui/icons";
import { Spinner } from "@/components/ui/Spinner";
import { uploadSiteImage } from "@/app/business/actions";
import { resizeImage } from "@/components/website/templates/ImageSlot";
import { looksLikeHtml, markdownToEditorHtml } from "@/utils/markdown";
import {
  IMAGE_STYLES,
  IMAGE_STYLE_META,
  type ImageStyleId,
} from "@/lib/ai/image/style";

/**
 * 블로그 본문 위지윅(TipTap) 에디터 — 작성 화면이 곧 결과 화면.
 * 글자크기·정렬·제목·목록 + 인라인 이미지(업로드 즉시 표시) + 유튜브/음악 임베드 +
 * AI 이미지 생성/이어쓰기를 한 곳에서 처리한다. 본문은 HTML로 저장한다.
 * 기존 마크다운 글은 열 때 HTML로 변환해 띄우고, 저장하면 HTML로 굳는다.
 */

/** 음악(오디오) 블록 노드 — <audio controls src>. */
const Audio = Node.create({
  name: "audio",
  group: "block",
  atom: true,
  draggable: true,
  selectable: true,
  addAttributes() {
    return { src: { default: null } };
  },
  parseHTML() {
    return [{ tag: "audio[src]" }];
  },
  renderHTML({ HTMLAttributes }) {
    return ["audio", mergeAttributes(HTMLAttributes, { controls: "controls" })];
  },
});

const FONT_SIZES: { label: string; value: string }[] = [
  { label: "작게", value: "14px" },
  { label: "보통", value: "" },
  { label: "조금 크게", value: "20px" },
  { label: "크게", value: "24px" },
  { label: "아주 크게", value: "30px" },
];

export function RichEditor({
  content,
  onChange,
  businessId,
  postId,
  imageStyle,
  onImageStyleChange,
  ko,
}: {
  content: string;
  onChange: (html: string) => void;
  businessId: string;
  postId: string;
  imageStyle: ImageStyleId;
  onImageStyleChange: (s: ImageStyleId) => void;
  ko: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const slotRef = useRef(0);
  const [busy, setBusy] = useState<null | "image" | "ai-image" | "expand">(null);
  const [err, setErr] = useState<string | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        link: {
          openOnClick: false,
          HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
        },
      }),
      TextStyle,
      FontSize,
      Color,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Image.configure({ inline: false }),
      Youtube.configure({ nocookie: true, controls: true }),
      Audio,
    ],
    content: looksLikeHtml(content) ? content : markdownToEditorHtml(content),
    editorProps: {
      attributes: {
        class: "prose max-w-none focus:outline-none min-h-[420px] px-4 py-4",
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  if (!editor) {
    return (
      <div className="grid min-h-[420px] place-items-center rounded-b-2xl">
        <Spinner className="size-5" />
      </div>
    );
  }

  /** 커서가 놓인 블록(단락/제목)의 텍스트와 '그 블록 바로 뒤' 위치를 얻는다. */
  const currentBlock = () => {
    const { state } = editor;
    const $pos = state.doc.resolve(state.selection.from);
    return { text: $pos.parent.textContent.trim(), after: $pos.after() };
  };

  const onPickImage = () => fileRef.current?.click();

  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    void (async () => {
      setBusy("image");
      setErr(null);
      try {
        const resized = await resizeImage(file, 1600);
        const fd = new FormData();
        fd.append("file", resized);
        const up = await uploadSiteImage(businessId, fd);
        if (up.error || !up.url) {
          setErr(up.error ?? (ko ? "업로드에 실패했습니다." : "Upload failed."));
          return;
        }
        editor.chain().focus().setImage({ src: up.url, alt: "" }).run();
      } catch {
        setErr(ko ? "업로드 중 문제가 발생했습니다." : "Upload failed.");
      } finally {
        setBusy(null);
      }
    })();
  };

  const insertYoutube = () => {
    const url = window.prompt(
      ko
        ? "유튜브 링크를 붙여넣으세요 (본문에서 바로 재생됩니다):"
        : "Paste a YouTube link (plays inline in the post):",
    );
    if (!url?.trim()) return;
    editor.chain().focus().setYoutubeVideo({ src: url.trim() }).run();
  };

  const insertAudio = () => {
    const url = window.prompt(
      ko
        ? "음악/오디오 파일 링크(mp3 등)를 붙여넣으세요:"
        : "Paste a music/audio file link (mp3, etc.):",
    );
    if (!url?.trim()) return;
    editor
      .chain()
      .focus()
      .insertContent({ type: "audio", attrs: { src: url.trim() } })
      .run();
  };

  const insertLink = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt(ko ? "링크 주소:" : "Link URL:", prev ?? "https://");
    if (url === null) return;
    if (!url.trim()) {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: url.trim() })
      .run();
  };

  const setFont = (value: string) => {
    if (!value) editor.chain().focus().unsetFontSize().run();
    else editor.chain().focus().setFontSize(value).run();
  };

  const aiImage = () => {
    const { text, after } = currentBlock();
    setBusy("ai-image");
    setErr(null);
    void (async () => {
      try {
        const res = await fetch("/api/ai/blog-body-image", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            businessId,
            postId,
            paragraph: text,
            slotKey: `rich-${slotRef.current++}-${Date.now()}`,
            style: imageStyle,
          }),
        });
        const json = await res.json();
        if (!res.ok || !json.url) {
          setErr(
            json.error ??
              (ko ? "이미지 생성에 실패했습니다." : "Image generation failed."),
          );
          return;
        }
        // 현재 블록 바로 뒤에 이미지를 넣는다.
        editor
          .chain()
          .focus()
          .insertContentAt(after, { type: "image", attrs: { src: json.url, alt: "" } })
          .run();
      } catch {
        setErr(ko ? "이미지 생성에 실패했습니다." : "Image generation failed.");
      } finally {
        setBusy(null);
      }
    })();
  };

  const expand = () => {
    const { text } = currentBlock();
    if (!text) {
      setErr(
        ko
          ? "이어쓸 단락에 커서를 두고 눌러주세요."
          : "Place the cursor in a paragraph first.",
      );
      return;
    }
    setBusy("expand");
    setErr(null);
    void (async () => {
      try {
        const res = await fetch("/api/ai/blog-expand", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ businessId, postId, paragraph: text }),
        });
        const json = await res.json();
        if (!res.ok || !json.text) {
          setErr(json.error ?? (ko ? "이어쓰기에 실패했습니다." : "Failed."));
          return;
        }
        const { state } = editor;
        const end = state.doc.resolve(state.selection.from).end();
        editor
          .chain()
          .focus()
          .insertContentAt(end, " " + String(json.text).trim())
          .run();
      } catch {
        setErr(ko ? "이어쓰기에 실패했습니다." : "Failed. Please try again.");
      } finally {
        setBusy(null);
      }
    })();
  };

  const curFont = (editor.getAttributes("textStyle").fontSize as string) ?? "";

  return (
    <div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageFile}
      />

      {/* 툴바 */}
      <div className="flex flex-wrap items-center gap-1 border-b border-border px-2 py-1.5">
        <select
          value={curFont}
          onChange={(e) => setFont(e.target.value)}
          title={ko ? "글자 크기" : "Font size"}
          className="h-8 rounded-md border border-border bg-surface px-2 text-xs"
        >
          {FONT_SIZES.map((f) => (
            <option key={f.label} value={f.value}>
              {ko ? f.label : f.value || "Normal"}
            </option>
          ))}
        </select>

        <Divider />
        <TB
          active={editor.isActive("heading", { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          title={ko ? "소제목" : "Heading"}
        >
          H2
        </TB>
        <TB
          active={editor.isActive("heading", { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          title={ko ? "소소제목" : "Subheading"}
        >
          H3
        </TB>
        <TB
          active={editor.isActive("bold")}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title={ko ? "굵게" : "Bold"}
        >
          <b>B</b>
        </TB>
        <TB
          active={editor.isActive("italic")}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title={ko ? "기울임" : "Italic"}
        >
          <i>I</i>
        </TB>
        <TB
          active={editor.isActive("underline")}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          title={ko ? "밑줄" : "Underline"}
        >
          <u>U</u>
        </TB>
        <TB
          active={editor.isActive("strike")}
          onClick={() => editor.chain().focus().toggleStrike().run()}
          title={ko ? "취소선" : "Strikethrough"}
        >
          <s>S</s>
        </TB>
        <label
          className="grid size-8 cursor-pointer place-items-center rounded-md text-muted hover:bg-surface-muted"
          title={ko ? "글자 색" : "Text color"}
        >
          <span
            className="size-4 rounded-full border border-border"
            style={{
              background:
                (editor.getAttributes("textStyle").color as string) ||
                "var(--foreground)",
            }}
          />
          <input
            type="color"
            className="sr-only"
            onChange={(e) =>
              editor.chain().focus().setColor(e.target.value).run()
            }
          />
        </label>

        <Divider />
        <TB
          active={editor.isActive("bulletList")}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title={ko ? "글머리 목록" : "Bullet list"}
        >
          •
        </TB>
        <TB
          active={editor.isActive("orderedList")}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title={ko ? "번호 목록" : "Ordered list"}
        >
          1.
        </TB>
        <TB
          active={editor.isActive({ textAlign: "left" })}
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          title={ko ? "왼쪽 정렬" : "Align left"}
        >
          ⯇
        </TB>
        <TB
          active={editor.isActive({ textAlign: "center" })}
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          title={ko ? "가운데 정렬" : "Align center"}
        >
          ≡
        </TB>
        <TB
          active={editor.isActive({ textAlign: "right" })}
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          title={ko ? "오른쪽 정렬" : "Align right"}
        >
          ⯈
        </TB>
        <TB
          active={editor.isActive("link")}
          onClick={insertLink}
          title={ko ? "링크" : "Link"}
        >
          <Icon.link width={15} height={15} />
        </TB>

        <Divider />
        <TB
          onClick={onPickImage}
          disabled={busy === "image"}
          title={ko ? "사진 올리기" : "Upload image"}
        >
          {busy === "image" ? (
            <Spinner className="size-4" />
          ) : (
            <Icon.image width={16} height={16} />
          )}
        </TB>
        <TB onClick={insertYoutube} title={ko ? "유튜브 영상" : "YouTube video"}>
          <Icon.video width={16} height={16} />
        </TB>
        <TB onClick={insertAudio} title={ko ? "음악/오디오" : "Music / audio"}>
          <span className="text-base leading-none">♪</span>
        </TB>

        <Divider />
        <button
          type="button"
          onClick={aiImage}
          disabled={!!busy}
          title={ko ? "커서 위치에 AI 이미지 생성" : "AI image at cursor"}
          className="flex h-8 items-center gap-1 rounded-md px-2 text-xs font-semibold text-primary hover:bg-primary-soft disabled:opacity-50"
        >
          {busy === "ai-image" ? (
            <Spinner className="size-3.5" />
          ) : (
            <Icon.image width={14} height={14} />
          )}
          {ko ? "AI 이미지" : "AI image"}
        </button>
        <button
          type="button"
          onClick={expand}
          disabled={!!busy}
          title={ko ? "커서 단락을 AI가 이어서 써줘요" : "AI expands this paragraph"}
          className="flex h-8 items-center gap-1 rounded-md px-2 text-xs font-semibold text-primary hover:bg-primary-soft disabled:opacity-50"
        >
          {busy === "expand" ? (
            <Spinner className="size-3.5" />
          ) : (
            <Icon.sparkles width={14} height={14} />
          )}
          {ko ? "이어쓰기" : "Expand"}
        </button>

        <select
          value={imageStyle}
          onChange={(e) => onImageStyleChange(e.target.value as ImageStyleId)}
          title={ko ? "AI 이미지 스타일" : "AI image style"}
          className="ml-auto h-8 rounded-md border border-border bg-surface px-2 text-xs"
        >
          {IMAGE_STYLES.map((s) => (
            <option key={s} value={s}>
              {ko ? IMAGE_STYLE_META[s].ko : IMAGE_STYLE_META[s].en}
            </option>
          ))}
        </select>
      </div>

      {err && (
        <p className="border-b border-border px-4 py-2 text-xs text-danger">
          {err}
        </p>
      )}

      <EditorContent editor={editor} />
    </div>
  );
}

function TB({
  children,
  onClick,
  title,
  active,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title?: string;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`grid size-8 place-items-center rounded-md text-sm font-semibold hover:bg-surface-muted disabled:opacity-50 ${
        active ? "bg-primary-soft text-primary" : "text-muted"
      }`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="mx-0.5 h-5 w-px self-center bg-border" />;
}
