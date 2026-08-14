import { Logo } from "@/components/ui/Logo";

export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto max-w-6xl px-5 py-12 sm:px-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <Logo />
            <p className="text-sm text-muted">
              당신의 이야기를 비즈니스로. · Turn Your Story Into Business.
            </p>
          </div>
          <p className="eyebrow">© {new Date().getFullYear()} STORYUP</p>
        </div>
      </div>
    </footer>
  );
}
