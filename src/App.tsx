import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import Home from "@/pages/Home";
import CompanyPage from "@/pages/CompanyPage";
import AnalysisPage from "@/pages/AnalysisPage";
import HistoryPage from "@/pages/HistoryPage";
import OpportunitiesPage from "@/pages/OpportunitiesPage";
import OpportunityDetailPage from "@/pages/OpportunityDetailPage";

export default function App() {
  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/entreprise/:siren" element={<CompanyPage />} />
          <Route path="/analyse/:scanId" element={<AnalysisPage />} />
          <Route path="/opportunites" element={<OpportunitiesPage />} />
          <Route path="/opportunites/:opportunityId" element={<OpportunityDetailPage />} />
          <Route path="/historique" element={<HistoryPage />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}
