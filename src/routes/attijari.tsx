import { createFileRoute } from "@tanstack/react-router";
import BankApp from "../components/BankApp";

export const Route = createFileRoute("/attijari")({
  component: () => (
    <BankApp
      config={{
        key: "attijari",
        name: "Attijari Bank",
        slogan: "Banque nouvelle génération",
        primary: "#E30613",
        primaryDark: "#8a0009",
        onPrimary: "#ffffff",
        accent: "#ffe4e6",
        logo: (<img src="/logos/attijari.png" alt="attijari" className="h-7 w-7 rounded-full bg-white object-contain p-0.5" />),
      }}
    />
  ),
  head: () => ({
    meta: [
      { title: "Attijari Bank — PayZone Afrique" },
      { name: "description", content: "Espace client Attijari Bank : solde, transferts, factures et retraits." },
      { property: "og:title", content: "Attijari Bank" },
      { property: "og:description", content: "Votre banque au quotidien." },
    ],
  }),
});