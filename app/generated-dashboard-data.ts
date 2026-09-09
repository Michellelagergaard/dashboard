// Denne fil indeholder kun en sikker udviklingsværdi i Git.
// GitHub Actions overskriver den midlertidigt med et anonymiseret Ungapped-udtræk før Azure-udgivelse.
import type { LiveDashboardData } from "./live-data";

export const generatedDashboardData: LiveDashboardData = {
  mailings: [],
  updatedAt: null,
  status: "unavailable",
};
