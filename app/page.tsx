import type { Metadata } from "next";
import dashboardData from "@/artifacts/dashboard.json";
import Dashboard from "./Dashboard";

export const metadata: Metadata = {
  title: "TradeWatch Lebanon",
  description: "Where does Lebanon’s trade data stop looking normal?",
};

export default function Home() {
  return <Dashboard data={dashboardData} />;
}
