import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "PayZone Afrique — Wave, Attijari, Wafacash, CIH" },
      {
        name: "description",
        content:
          "PayZone Afrique — accédez à Wave, Attijari Bank, Wafacash et CIH Bank depuis un seul portail sécurisé.",
      },
      { property: "og:title", content: "PayZone Afrique" },
      { property: "og:description", content: "Wave, Attijari, Wafacash & CIH en un clic." },
    ],
  }),
});

type Cat = {
  key: string;
  name: string;
  tag: string;
  href: string;
  external?: boolean;
  bg: string;
  fg: string;
  logo: string;
};

const CATS: Cat[] = [
  { key: "wave", name: "Wave", tag: "Mobile Money", href: "/wave/index.html", external: true, bg: "#1DC4F5", fg: "#0b2a5b", logo: "/logos/wave.png" },
  { key: "attijari", name: "Attijari Bank", tag: "Banque", href: "/attijari", bg: "#ffffff", fg: "#1a1a1a", logo: "/logos/attijari.png" },
  { key: "wafacash", name: "Wafacash", tag: "Transfert d'argent", href: "/wafacash", bg: "#ffffff", fg: "#1a1a1a", logo: "/logos/wafacash.png" },
  { key: "cih", name: "CIH Bank", tag: "Banque", href: "/cih", bg: "#ffffff", fg: "#1a1a1a", logo: "/logos/cih.png" },
];

function Index() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      <header className="mx-auto max-w-md px-6 pt-10 pb-6 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white text-2xl font-black shadow-lg">
          P
        </div>
        <h1 className="text-2xl font-black tracking-tight text-slate-900">PayZone Afrique</h1>
        <p className="mt-1 text-sm text-slate-500">Vos banques et mobile money, un seul portail.</p>
      </header>

      <main className="mx-auto max-w-md px-4 pb-16">
        <h2 className="mb-3 px-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Catégories</h2>
        <div className="grid grid-cols-2 gap-3">
          {CATS.map((c) => {
            const inner = (
              <div
                className="flex h-40 flex-col items-center justify-center gap-3 rounded-2xl p-4 shadow-md ring-1 ring-slate-200 transition active:scale-95"
                style={{ backgroundColor: c.bg, color: c.fg }}
              >
                <img src={c.logo} alt={c.name} className="h-16 w-auto max-w-[80%] object-contain" />
                <div className="text-center">
                  <div className="text-base font-black leading-tight">{c.name}</div>
                  <div className="text-xs opacity-70">{c.tag}</div>
                </div>
              </div>
            );
            return c.external ? (
              <a key={c.key} href={c.href}>{inner}</a>
            ) : (
              <Link key={c.key} to={c.href}>{inner}</Link>
            );
          })}
        </div>

        <p className="mt-8 text-center text-xs text-slate-400">© {new Date().getFullYear()} PayZone Afrique</p>
      </main>
    </div>
  );
}
