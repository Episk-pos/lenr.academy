import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import * as Sentry from '@sentry/react'
import { DatabaseProvider } from './contexts/DatabaseContext'
import { ThemeProvider } from './contexts/ThemeContext'
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
import DatabaseErrorCard from './components/DatabaseErrorCard'

function App() {
  return (
    <Sentry.ErrorBoundary
      fallback={({ error, resetError }) => {
        // Check if this is a database error
        const errorMessage = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
        const isDatabaseError = errorMessage.includes('database') || errorMessage.includes('sql');

        return (
          <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
            <div className="max-w-2xl w-full">
              {isDatabaseError ? (
                <DatabaseErrorCard error={error instanceof Error ? error : new Error(String(error))} />
              ) : (
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
                  <h1 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">
                    Something went wrong
                  </h1>
                  <p className="text-gray-700 dark:text-gray-300 mb-4">
                    We're sorry, but the application encountered an unexpected error.
                    This error has been automatically reported to our team.
                  </p>
                  <details className="mb-6">
                    <summary className="cursor-pointer text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200">
                      Technical details
                    </summary>
                    <pre className="mt-2 p-4 bg-gray-100 dark:bg-gray-900 rounded text-xs overflow-auto">
                      {error instanceof Error ? error.message : String(error)}
                    </pre>
                  </details>
                  <div className="flex gap-4">
                    <button
                      onClick={resetError}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    >
                      Try again
                    </button>
                    <button
                      onClick={() => window.location.href = '/'}
                      className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
                    >
                      Return to home
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      }}
    >
      <ThemeProvider>
        <DatabaseProvider>
          <Router>
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
          </Router>
        </DatabaseProvider>
      </ThemeProvider>
    </Sentry.ErrorBoundary>
  )
}

export default App
