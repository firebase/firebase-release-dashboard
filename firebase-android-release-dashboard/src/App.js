import React, {useEffect} from "react";
import {Route, BrowserRouter as Router, Routes} from "react-router-dom";

import {Box, CssBaseline, ThemeProvider} from "@material-ui/core";

import AppErrorBoundary from "./components/Error/AppErrorBoundary";
import Footer from "./components/Footer";
import Header from "./components/Header";
import MainContent from "./components/MainContent";
import AdminMain from "./components/AdminPage/AdminMain";
import theme from "./config/theme";
import {useAuthentication} from "./hooks/useAuthentication";
import {loadGoogleFont} from "./services/fontLoader";

/**
 * Main App component responsible for layout and data fetching.
 *
 * @return {JSX.Element} The rendered App component
 */
function App() {
  const {isLoggedIn, setIsLoggedIn} = useAuthentication();

  useEffect(() => {
    loadGoogleFont();
  }, []);

  return (
    <AppErrorBoundary>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Router>
          <Box>
            <Header isLoggedIn={isLoggedIn} setIsLoggedIn={setIsLoggedIn}/>
            <Routes>
              <Route path="/admin" element={<AdminMain />} />
              <Route path="/" element={<MainContent />} />
            </Routes>
            <Footer />
          </Box>
        </Router>
      </ThemeProvider>
    </AppErrorBoundary>
  );
}

export default App;
