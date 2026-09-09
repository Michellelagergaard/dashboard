import { Dashboard } from "./dashboard";
import { getLiveDashboardData } from "./live-data";

export const dynamic = "force-dynamic";

export default async function Home() {
  const data = await getLiveDashboardData();
  return <Dashboard liveData={data} />;
}
