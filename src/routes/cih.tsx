import { createFileRoute } from "@tanstack/react-router";
import BankApp from "../components/BankApp";

export const Route = createFileRoute("/cih")({
  component: () => (
    <BankApp
      config={{
        key: "cih",
        name: "CIH Bank",
        slogan: "La banque qui vous ressemble",
        primary: "#008C44",
        primaryDark: "#004d24",
        onPrimary: "#ffffff",
        accent: "#d1fae5",
        logo: (<img src="/logos/cih.png" alt="cih" className="h-7 w-7 rounded-full bg-white object-contain p-0.5" />),
      }}
    />
  ),
  head: () => ({
    meta: [
      { title: "CIH Bank — PayZone Afrique" },
      { name: "description", content: "Espace client CIH Bank : comptes, virements et paiements." },
      { property: "og:title", content: "CIH Bank" },
      { property: "og:description", content: "La banque qui vous ressemble." },
    ],
  }),
});