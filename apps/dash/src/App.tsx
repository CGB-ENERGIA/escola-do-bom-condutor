import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import { sessao } from "./lib/api";
import Login from "./pages/Login";
import Dash from "./pages/Dash";
import Teorica from "./pages/Teorica";
import Pratica from "./pages/Pratica";

function Protegido({ children }: { children: React.ReactNode }) {
  return sessao.get() ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Protegido><Layout /></Protegido>}>
        <Route index element={<Dash />} />
        <Route path="teorica" element={<Teorica />} />
        <Route path="pratica" element={<Pratica />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
