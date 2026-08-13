import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import Specialists from "./pages/Specialists";
import SpecialistDetail from "./pages/SpecialistDetail";
import Playground from "./pages/Playground";
import Pipelines from "./pages/Pipelines";
import PipelineDetail from "./pages/PipelineDetail";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Specialists />} />
        <Route path="/specialists/:id" element={<SpecialistDetail />} />
        <Route path="/playground/:id" element={<Playground />} />
        <Route path="/pipelines" element={<Pipelines />} />
        <Route path="/pipelines/:id" element={<PipelineDetail />} />
      </Routes>
    </Layout>
  );
}
