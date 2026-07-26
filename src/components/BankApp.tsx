import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

export type BankConfig = {
  key: string;
  name: string;
  slogan: string;
  primary: string;
  primaryDark: string;
  onPrimary: string;
  accent: string;
  logo: React.ReactNode;
};

type Tx = {
  id: string;
  label: string;
  amount: number;
  date: string;
  type: "in" | "out";
};

type State = {
  balance: number;
  txs: Tx[];
};

const DEFAULT: State = {
  balance: 125000,
  txs: [
    { id: "1", label: "Salaire", amount: 350000, date: "12 Juil.", type: "in" },
    { id: "2", label: "Facture SBEE", amount: 18500, date: "10 Juil.", type: "out" },
    { id: "3", label: "Retrait GAB", amount: 50000, date: "08 Juil.", type: "out" },
  ],
};

function load(key: string): State {
  try {
    const raw = localStorage.getItem(`pz_${key}`);
    if (raw) return JSON.parse(raw);
  } catch {}
  return DEFAULT;
}
function save(key: string, s: State) {
  localStorage.setItem(`pz_${key}`, JSON.stringify(s));
}

const fmt = (n: number) => n.toLocaleString("fr-FR") + " F";

export default function BankApp({ config }: { config: BankConfig }) {
  const [state, setState] = useState<State>(DEFAULT);
  const [visible, setVisible] = useState(false);
  const [modal, setModal] = useState<null | "send" | "recv" | "bill" | "withdraw">(null);
  const [amount, setAmount] = useState("");
  const [label, setLabel] = useState("");

  useEffect(() => {
    setState(load(config.key));
  }, [config.key]);

  const submit = () => {
    const amt = parseInt(amount || "0", 10);
    if (!amt || amt <= 0) return;
    const isOut = modal === "send" || modal === "bill" || modal === "withdraw";
    const labels = {
      send: label || "Transfert",
      recv: label || "Dépôt",
      bill: label || "Paiement facture",
      withdraw: "Retrait GAB",
    } as const;
    const tx: Tx = {
      id: Date.now().toString(),
      label: labels[modal!],
      amount: amt,
      date: new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "short" }),
      type: isOut ? "out" : "in",
    };
    const next: State = {
      balance: state.balance + (isOut ? -amt : amt),
      txs: [tx, ...state.txs].slice(0, 20),
    };
    setState(next);
    save(config.key, next);
    setModal(null);
    setAmount("");
    setLabel("");
  };

  const actions = [
    { k: "send", label: "Envoyer", icon: "↗" },
    { k: "recv", label: "Recevoir", icon: "↙" },
    { k: "bill", label: "Factures", icon: "🧾" },
    { k: "withdraw", label: "Retrait", icon: "🏧" },
  ] as const;

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <div style={{ background: config.primary, color: config.onPrimary }} className="pb-16">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 pt-4">
          <Link to="/" className="text-2xl leading-none opacity-90">
            ←
          </Link>
          <div className="flex items-center gap-2">
            {config.logo}
            <span className="font-black">{config.name}</span>
          </div>
          <div className="h-8 w-8 rounded-full bg-white/20 text-center text-sm leading-8">
            👤
          </div>
        </div>

        <div className="mx-auto max-w-md px-6 pt-6 text-center">
          <div className="text-xs uppercase tracking-widest opacity-80">Solde disponible</div>
          <div className="mt-1 flex items-center justify-center gap-2 text-3xl font-black">
            {visible ? fmt(state.balance) : "•••••• F"}
            <button
              onClick={() => setVisible((v) => !v)}
              className="text-base opacity-70"
              aria-label="toggle"
            >
              {visible ? "🙈" : "👁"}
            </button>
          </div>
          <div className="mt-1 text-xs opacity-80">{config.slogan}</div>
        </div>
      </div>

      {/* Actions card */}
      <div className="mx-auto -mt-10 max-w-md px-4">
        <div className="grid grid-cols-4 gap-2 rounded-2xl bg-white p-4 shadow-lg">
          {actions.map((a) => (
            <button
              key={a.k}
              onClick={() => setModal(a.k)}
              className="flex flex-col items-center gap-1 rounded-xl p-2 transition active:scale-95"
            >
              <span
                className="flex h-11 w-11 items-center justify-center rounded-full text-lg"
                style={{ background: config.accent, color: config.primaryDark }}
              >
                {a.icon}
              </span>
              <span className="text-[11px] font-semibold text-slate-700">{a.label}</span>
            </button>
          ))}
        </div>

        {/* Cards row */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-white p-3 shadow-sm">
            <div className="text-[10px] uppercase text-slate-400">Compte courant</div>
            <div className="mt-1 text-sm font-bold text-slate-900">
              **** 3421
            </div>
            <div className="text-xs text-slate-500">{fmt(state.balance)}</div>
          </div>
          <div className="rounded-xl bg-white p-3 shadow-sm">
            <div className="text-[10px] uppercase text-slate-400">Épargne</div>
            <div className="mt-1 text-sm font-bold text-slate-900">**** 8890</div>
            <div className="text-xs text-slate-500">0 F</div>
          </div>
        </div>

        {/* Transactions */}
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between px-1">
            <h3 className="text-sm font-bold text-slate-800">Transactions</h3>
            <span className="text-xs text-slate-400">Historique</span>
          </div>
          <div className="divide-y divide-slate-100 rounded-2xl bg-white shadow-sm">
            {state.txs.map((t) => (
              <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-full text-sm"
                  style={{
                    background: t.type === "in" ? "#dcfce7" : "#fee2e2",
                    color: t.type === "in" ? "#166534" : "#991b1b",
                  }}
                >
                  {t.type === "in" ? "↙" : "↗"}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-slate-800">{t.label}</div>
                  <div className="text-xs text-slate-400">{t.date}</div>
                </div>
                <div
                  className={`text-sm font-bold ${
                    t.type === "in" ? "text-emerald-600" : "text-rose-600"
                  }`}
                >
                  {t.type === "in" ? "+" : "-"}
                  {fmt(t.amount)}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="py-8 text-center text-[11px] text-slate-400">
          {config.name} — Powered by PayZone Afrique
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center">
          <div className="w-full max-w-md rounded-t-3xl bg-white p-6 sm:rounded-3xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold capitalize">
                {modal === "send" && "Envoyer de l'argent"}
                {modal === "recv" && "Recevoir un dépôt"}
                {modal === "bill" && "Payer une facture"}
                {modal === "withdraw" && "Retrait GAB"}
              </h3>
              <button onClick={() => setModal(null)} className="text-2xl text-slate-400">
                ×
              </button>
            </div>
            {modal !== "withdraw" && (
              <div className="mb-3">
                <label className="text-xs text-slate-500">
                  {modal === "send" ? "Bénéficiaire" : modal === "bill" ? "Facturier" : "Émetteur"}
                </label>
                <input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="Nom / N° compte"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-slate-400"
                />
              </div>
            )}
            <label className="text-xs text-slate-500">Montant (FCFA)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-3 text-lg font-bold outline-none focus:border-slate-400"
            />
            <button
              onClick={submit}
              style={{ background: config.primary, color: config.onPrimary }}
              className="mt-5 w-full rounded-full py-3 font-bold shadow-md active:scale-95"
            >
              Valider
            </button>
          </div>
        </div>
      )}
    </div>
  );
}