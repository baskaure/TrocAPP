export function AppFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-20 w-full border-t border-slate-100 bg-slate-50 py-12">
      <div className="mx-auto flex max-w-screen-2xl flex-col items-center justify-center gap-6 px-6 md:px-8">
        <div className="flex flex-wrap justify-center gap-6 md:gap-8">
          <span className="cursor-default text-xs font-inter uppercase tracking-widest text-slate-400">Confidentialité</span>
          <span className="cursor-default text-xs font-inter uppercase tracking-widest text-slate-400">Conditions</span>
          <a
            href="mailto:contact@bontroc.fr"
            className="text-xs font-inter uppercase tracking-widest text-slate-400 transition-colors hover:text-primary"
          >
            Contact
          </a>
        </div>
        <p className="text-center text-xs font-inter uppercase tracking-widest text-slate-600">
          © {year} BonTroc. L&apos;échange intelligent.
        </p>
      </div>
    </footer>
  );
}
