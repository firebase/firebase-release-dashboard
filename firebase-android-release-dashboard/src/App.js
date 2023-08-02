import React, {useEffect} from "react";
import {Box, CssBaseline, ThemeProvider} from "@material-ui/core";

import AppErrorBoundary from "./components/Error/AppErrorBoundary";
import Footer from "./components/Footer";
import Header from "./components/Header";
import MainContent from "./components/MainContent";
import theme from "./config/theme";
import {loadGoogleFont} from "./services/fontLoader";
import {useAuthentication} from "./hooks/useAuthentication";

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
        <Box>
          <Header isLoggedIn={isLoggedIn} setIsLoggedIn={setIsLoggedIn}/>
          <MainContent/>
          <Footer />
        </Box>
      </ThemeProvider>
    </AppErrorBoundary>
  );
}

export default App;
