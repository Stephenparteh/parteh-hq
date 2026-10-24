import { Route, Routes } from "react-router-dom";
import { ToastProvider } from "./context/Toast.jsx";
import { AuthProvider } from "./context/Auth.jsx";
import { DataProvider } from "./context/Data.jsx";
import { PopProvider } from "./context/Pop.jsx";
import { SheetProvider } from "./components/ProjectSheet.jsx";
import WakingBanner from "./components/WakingBanner.jsx";
import Shell from "./components/Shell.jsx";
import Login from "./pages/Login.jsx";

// The router is added in main.jsx (and in the tests).
export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <DataProvider>
          <PopProvider>
            <SheetProvider>
              <WakingBanner />
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/*" element={<Shell />} />
              </Routes>
            </SheetProvider>
          </PopProvider>
        </DataProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
