import { Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import Specialists from "./pages/Specialists";
import SpecialistDetail from "./pages/SpecialistDetail";
import Playground from "./pages/Playground";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Specialists />} />
        <Route path="/specialists/:id" element={<SpecialistDetail />} />
        <Route path="/playground/:id" element={<Playground />} />
      </Routes>
    </Layout>
  );
}
