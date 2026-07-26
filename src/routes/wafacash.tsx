import { createFileRoute } from "@tanstack/react-router";
import BankApp from "../components/BankApp";

export const Route = createFileRoute("/wafacash")({
  component: () => (
    <BankApp
      config={{
        key: "wafacash",
        name: "Wafacash",
        slogan: "Transfert d'argent rapide",
        primary: "#00A651",
        primaryDark: "#00612f",
        onPrimary: "#ffffff",
        accent: "#d1fae5",
        logo: (<img src="/logos/wafacash.png" alt="wafacash" className="h-7 w-7 rounded-full bg-white object-contain p-0.5" />),
      }}
    />
  ),
  head: () => ({
    meta: [
      { title: "Wafacash — PayZone Afrique" },
      { name: "description", content: "Envoyez et recevez de l'argent partout avec Wafacash." },
      { property: "og:title", content: "Wafacash" },
      { property: "og:description", content: "Transfert d'argent rapide et sécurisé." },
    ],
  }),
});