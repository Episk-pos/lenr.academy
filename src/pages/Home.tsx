import { Link } from 'react-router-dom'
import { Atom, Database, Beaker, Zap } from 'lucide-react'

export default function Home() {
  return (
    <div className="max-w-6xl mx-auto">
      <div className="text-center mb-12">
        <div className="flex justify-center mb-4">
          <Atom className="w-16 h-16 text-primary-600" />
        </div>
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
          The Nanosoft Package
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
          Interactive tools for exploring Low Energy Nuclear Reactions (LENR) and cold fusion transmutation pathways
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
          Based on the groundbreaking work of Dr. Alexander Parkhomov
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-12">
        <div className="card p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Beaker className="w-6 h-6 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Query Nuclear Reactions</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                Search through thousands of exothermic fusion, fission, and two-to-two nuclear transmutation reactions
              </p>
              <div className="space-y-2">
                <Link to="/fusion" className="block text-primary-600 hover:text-primary-700 text-sm font-medium">
                  → Fusion Reactions
                </Link>
                <Link to="/fission" className="block text-primary-600 hover:text-primary-700 text-sm font-medium">
                  → Fission Reactions
                </Link>
                <Link to="/twotwo" className="block text-primary-600 hover:text-primary-700 text-sm font-medium">
                  → Two-To-Two Reactions
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <Zap className="w-6 h-6 text-green-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Cascade Simulations</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                Model chain reactions and predict reaction products from cascading LENR processes
              </p>
              <div className="space-y-2">
                <Link to="/cascades" className="block text-primary-600 hover:text-primary-700 text-sm font-medium">
                  → Run Cascade Simulations
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Database className="w-6 h-6 text-purple-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Element & Nuclide Data</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                Browse comprehensive tables of nuclear and chemical properties
              </p>
              <div className="space-y-2">
                <Link to="/element-data" className="block text-primary-600 hover:text-primary-700 text-sm font-medium">
                  → Show Element Data
                </Link>
                <Link to="/tables" className="block text-primary-600 hover:text-primary-700 text-sm font-medium">
                  → Tables in Detail
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-orange-100 rounded-lg">
              <Database className="w-6 h-6 text-orange-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Advanced Queries</h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm mb-4">
                Execute custom SQL queries across all reaction and property tables
              </p>
              <div className="space-y-2">
                <Link to="/all-tables" className="block text-primary-600 hover:text-primary-700 text-sm font-medium">
                  → All Tables Query Tool
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card p-6 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">About the Parkhomov Tables</h2>
        <div className="prose prose-sm max-w-none text-gray-700 dark:text-gray-300">
          <p className="mb-3">
            This package is based on the pioneering work of Russian physicist <strong>Dr. Alexander Parkhomov</strong>,
            who published comprehensive tables of possible cold nuclear transmutation reactions in 2018.
          </p>
          <p className="mb-3">
            Using computer analysis of 280 stable nuclides, Dr. Parkhomov identified:
          </p>
          <ul className="list-disc list-inside mb-3 space-y-1">
            <li><strong>1,389 fusion reactions</strong> - combining lighter elements</li>
            <li><strong>817 fission reactions</strong> - splitting heavier elements</li>
            <li><strong>516,789 two-to-two reactions</strong> - transforming pairs of nuclides</li>
          </ul>
          <p className="mb-3">
            All reactions in these tables are <strong>exothermic</strong> (energy-producing) and represent
            thermodynamically favorable pathways for nuclear transmutation at low energies.
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Developed by R.W. Greenyer and P.W. Power for the Martin Fleischmann Memorial Project
          </p>
        </div>
      </div>

      <div className="card p-6 mt-6 border-2 border-gray-200 dark:border-gray-700">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Original Application</h2>
        <p className="text-gray-700 dark:text-gray-300 mb-3">
          This is a modern reimplementation of the original Nanosoft Package, which was developed as a
          PHP web application to explore Dr. Parkhomov's nuclear transmutation tables.
        </p>
        <p className="text-gray-700 dark:text-gray-300 mb-4">
          The original application and comprehensive documentation can be found at:
        </p>
        <a
          href="https://nanosoft.co.nz"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
        >
          Visit nanosoft.co.nz
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
          We are grateful to R. W. Greenyer and P. W. Power for their pioneering work in making this important research accessible.
        </p>
      </div>

      <div className="card p-6 mt-6 bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-800 dark:to-blue-900/20">
        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">Open Source Project</h2>
        <p className="text-gray-700 dark:text-gray-300 mb-4">
          This project is open source and licensed under the GNU Affero General Public License v3.0 (AGPL-3.0).
          We welcome contributions, bug reports, and feature requests from the community.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <a
            href="https://github.com/Episk-pos/lenr.academy"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-gray-900 dark:bg-gray-700 text-white rounded-lg hover:bg-gray-800 dark:hover:bg-gray-600 transition-colors font-medium"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
            </svg>
            View on GitHub
          </a>
          <a
            href="https://github.com/Episk-pos/lenr.academy/discussions"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
          >
            Join Discussions
          </a>
          <a
            href="https://github.com/Episk-pos/lenr.academy/issues"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-2 border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
          >
            Report Issue
          </a>
          <a
            href="https://github.com/Episk-pos/lenr.academy/issues/new?labels=enhancement"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border-2 border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
          >
            Request Feature
          </a>
        </div>
      </div>
    </div>
  )
}
