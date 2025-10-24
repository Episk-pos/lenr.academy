import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import * as Sentry from '@sentry/react'
import { DatabaseProvider } from './contexts/DatabaseContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { LayoutProvider } from './contexts/LayoutContext'
import { QueryStateProvider } from './contexts/QueryStateContext'
import Layout from './components/Layout'
import Home from './pages/Home'
import FusionQuery from './pages/FusionQuery'
import FissionQuery from './pages/FissionQuery'
import TwoToTwoQuery from './pages/TwoToTwoQuery'
import ShowElementData from './pages/ShowElementData'
import TablesInDetail from './pages/TablesInDetail'
import AllTables from './pages/AllTables'
import CascadesAll from './pages/CascadesAll'
import PrivacyPreferences from './pages/PrivacyPreferences'
import SentryTest from './pages/SentryTest'
import ErrorDisplay from './components/ErrorDisplay'
import PWAUpdatePrompt from './components/PWAUpdatePrompt'
import PWAInstallPrompt from './components/PWAInstallPrompt'
import OfflineIndicator from './components/OfflineIndicator'

function App() {
  return (
    <Sentry.ErrorBoundary
      fallback={({ error, resetError }) => {
        // Check if this is a database error
        const errorMessage = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
        const isDatabaseError = errorMessage.includes('database') || errorMessage.includes('sql');
        const errorObj = error instanceof Error ? error : new Error(String(error));

        return (
          <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
            <div className="w-full flex justify-center">
              <ErrorDisplay
                error={errorObj}
                resetError={resetError}
                errorBoundary="App"
                isDatabaseError={isDatabaseError}
              />
            </div>
          </div>
        );
      }}
    >
      <ThemeProvider>
        <DatabaseProvider>
          <QueryStateProvider>
            <Router>
              <LayoutProvider>
              {/* PWA Components */}
              <PWAUpdatePrompt />
              <OfflineIndicator />
              <PWAInstallPrompt />

              <Layout>
                <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/fusion" element={<FusionQuery />} />
                <Route path="/fission" element={<FissionQuery />} />
                <Route path="/twotwo" element={<TwoToTwoQuery />} />
                <Route path="/element-data" element={<ShowElementData />} />
                <Route path="/tables" element={<TablesInDetail />} />
                <Route path="/all-tables" element={<AllTables />} />
                <Route path="/cascades" element={<CascadesAll />} />
                <Route path="/privacy" element={<PrivacyPreferences />} />
                {/* Sentry test page - only available in development or with ?debug=true */}
                {(import.meta.env.MODE === 'development' || new URLSearchParams(window.location.search).get('debug') === 'true') && (
                  <Route path="/sentry-test" element={<SentryTest />} />
                )}
                </Routes>
              </Layout>
            </LayoutProvider>
          </Router>
          </QueryStateProvider>
        </DatabaseProvider>
      </ThemeProvider>
    </Sentry.ErrorBoundary>
  )
}

export default App
