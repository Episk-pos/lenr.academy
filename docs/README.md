# 📚 LENR Academy Documentation

**Project**: LENR Academy - Nuclear Reaction Database & Cascade Simulator  
**Last Updated**: October 28, 2025

---

## 🚀 Quick Start

**New to the project?** Start here:

1. **[../QUICKSTART.md](../QUICKSTART.md)** - 5-minute quick start guide
2. **[THREE_SESSION_SUMMARY.md](THREE_SESSION_SUMMARY.md)** - Recent development summary
3. **[development/DEVELOPMENT.md](development/DEVELOPMENT.md)** - Full development guide

**Testing the app?**
- **[testing/TESTING_GUIDE.md](testing/TESTING_GUIDE.md)** - User testing scenarios

---

## 📁 Documentation Structure

### 🔧 Development
**For developers building features**

| Document | Purpose |
|----------|---------|
| [development/DEVELOPMENT.md](development/DEVELOPMENT.md) | Complete development guide and setup |
| [development/IMPLEMENTATION_GUIDE.md](development/IMPLEMENTATION_GUIDE.md) | Implementation patterns and best practices |
| [development/WEIGHTED_FUEL_IMPLEMENTATION.md](development/WEIGHTED_FUEL_IMPLEMENTATION.md) | Weighted fuel proportions technical details |
| [development/CONSOLE_WARNINGS_GUIDE.md](development/CONSOLE_WARNINGS_GUIDE.md) | Console warning debugging guide |

### 🧪 Testing
**For QA engineers and test developers**

| Document | Purpose |
|----------|---------|
| [testing/TESTING_GUIDE.md](testing/TESTING_GUIDE.md) | ⭐ User testing scenarios and smoke tests |
| [testing/CASCADE_TESTING_PLAN.md](testing/CASCADE_TESTING_PLAN.md) | E2E test plan for cascade features |
| [testing/DECAY_CHAIN_TESTS_FINAL_REPORT.md](testing/DECAY_CHAIN_TESTS_FINAL_REPORT.md) | Final test results (100% pass rate) |
| [testing/DECAY_CHAIN_TEST_RESULTS.md](testing/DECAY_CHAIN_TEST_RESULTS.md) | Initial test run analysis |
| [testing/TEST_FIXES_NEEDED.md](testing/TEST_FIXES_NEEDED.md) | Known test issues and fixes |
| [testing/UNIT_TESTS_STATUS.md](testing/UNIT_TESTS_STATUS.md) | Unit test coverage status |

### ✨ Features
**Feature-specific documentation**

| Document | Purpose |
|----------|---------|
| [features/README_WEIGHTED_FUEL.md](features/README_WEIGHTED_FUEL.md) | ⭐ Weighted fuel proportions user guide |
| [features/SANKEY_WEIGHTED_VISUALIZATION.md](features/SANKEY_WEIGHTED_VISUALIZATION.md) | Sankey diagram visualization guide |
| [features/PHASE_1_COMPLETION_SUMMARY.md](features/PHASE_1_COMPLETION_SUMMARY.md) | Phase 1 implementation summary |
| [features/PHASE_2_MATERIALS_CATALOG_PLAN.md](features/PHASE_2_MATERIALS_CATALOG_PLAN.md) | Phase 2 roadmap (materials catalog) |

### 📤 PR Submission
**For submitting pull requests**

| Document | Purpose |
|----------|---------|
| [pr-submission/PULL_REQUEST_DOCUMENTATION.md](pr-submission/PULL_REQUEST_DOCUMENTATION.md) | ⭐ Complete PR overview |
| [pr-submission/PR_SUBMISSION_CHECKLIST.md](pr-submission/PR_SUBMISSION_CHECKLIST.md) | Pre-submission checklist |
| [pr-submission/GIT_COMMIT_MESSAGE.md](pr-submission/GIT_COMMIT_MESSAGE.md) | Commit message templates |
| [pr-submission/CHANGELOG_ENTRY.md](pr-submission/CHANGELOG_ENTRY.md) | Changelog format and entries |
| [pr-submission/📦_READY_FOR_PR.md](pr-submission/📦_READY_FOR_PR.md) | PR readiness checklist |
| [pr-submission/PR #67 Cascades Report .md](pr-submission/PR%20%2367%20Cascades%20Report%20.md) | Session 3 cascade testing report |

### 🔍 Troubleshooting
**When things go wrong**

| Document | Purpose |
|----------|---------|
| [troubleshooting/DATABASE_TROUBLESHOOTING.md](troubleshooting/DATABASE_TROUBLESHOOTING.md) | ⭐ Fix database errors |
| [troubleshooting/DATABASE_FIX_SUMMARY.md](troubleshooting/DATABASE_FIX_SUMMARY.md) | Database fix history |
| [troubleshooting/ACCESSIBILITY_FIXES.md](troubleshooting/ACCESSIBILITY_FIXES.md) | Accessibility issue fixes |

### 🚀 Operations
**Deployment, releases, and screenshots**

| Document | Purpose |
|----------|---------|
| [operations/RELEASING.md](operations/RELEASING.md) | Release process and versioning |
| [operations/SENTRY_SETUP.md](operations/SENTRY_SETUP.md) | Error monitoring setup |
| [operations/SCREENSHOT_QUICKSTART.md](operations/SCREENSHOT_QUICKSTART.md) | Screenshot automation guide |
| [operations/PR_SCREENSHOTS.md](operations/PR_SCREENSHOTS.md) | PR screenshot requirements |

### 🏗️ Architecture
**System design and architecture**

| Document | Purpose |
|----------|---------|
| [architecture/DOCUMENTATION_INDEX.md](architecture/DOCUMENTATION_INDEX.md) | Legacy documentation index |
| [architecture/NETWORK_VISUALIZATION_REDESIGN.md](architecture/NETWORK_VISUALIZATION_REDESIGN.md) | Network diagram redesign docs |

---

## 🎯 Documentation by Role

### I'm a **Reviewer/Admin**
1. Start: [pr-submission/PULL_REQUEST_DOCUMENTATION.md](pr-submission/PULL_REQUEST_DOCUMENTATION.md)
2. Test Results: [testing/DECAY_CHAIN_TESTS_FINAL_REPORT.md](testing/DECAY_CHAIN_TESTS_FINAL_REPORT.md)
3. Summary: [THREE_SESSION_SUMMARY.md](THREE_SESSION_SUMMARY.md)

### I'm a **Developer**
1. Setup: [development/DEVELOPMENT.md](development/DEVELOPMENT.md)
2. Implementation: [development/IMPLEMENTATION_GUIDE.md](development/IMPLEMENTATION_GUIDE.md)
3. Contributing: [../CONTRIBUTING.md](../CONTRIBUTING.md)

### I'm a **QA Tester**
1. Test Guide: [testing/TESTING_GUIDE.md](testing/TESTING_GUIDE.md)
2. Test Results: [testing/DECAY_CHAIN_TESTS_FINAL_REPORT.md](testing/DECAY_CHAIN_TESTS_FINAL_REPORT.md)
3. Known Issues: [testing/TEST_FIXES_NEEDED.md](testing/TEST_FIXES_NEEDED.md)

### I'm an **End User**
1. Quick Start: [../QUICKSTART.md](../QUICKSTART.md)
2. Features: [features/README_WEIGHTED_FUEL.md](features/README_WEIGHTED_FUEL.md)
3. Troubleshooting: [troubleshooting/DATABASE_TROUBLESHOOTING.md](troubleshooting/DATABASE_TROUBLESHOOTING.md)

---

## 📊 Recent Development

### Three-Session Summary (Oct 26-28, 2025)
**[THREE_SESSION_SUMMARY.md](THREE_SESSION_SUMMARY.md)** - Complete summary of recent work:

- **Session 1 (Oct 26)**: Implemented weighted fuel proportions (GitHub Issue #96 Phase 1)
- **Session 2 (Oct 27)**: Analyzed decay chain test coverage and created test plan
- **Session 3 (Oct 28)**: Implemented 23 E2E tests with 100% pass rate

**Stats**:
- 23 new E2E tests (100% passing)
- 15+ documentation files created
- 5,000+ lines of documentation
- Production-ready features

---

## 🔗 External Resources

- **Main Repository**: [ConsciousEnergy/lenr.academy](https://github.com/ConsciousEnergy/lenr.academy)
- **Issue #96**: [Weighted Fuel Proportions](https://github.com/Episk-pos/lenr.academy/issues/96)
- **PR #67**: Decay Chain Visualization (pending review)

---

## 📝 Additional Documentation

### In Root Directory
- [../README.md](../README.md) - Project overview
- [../CONTRIBUTING.md](../CONTRIBUTING.md) - How to contribute
- [../LICENSE.md](../LICENSE.md) - MIT License
- [../QUICKSTART.md](../QUICKSTART.md) - Quick start guide
- [../CLAUDE.md](../CLAUDE.md) - AI assistant context

### Screenshots
- [screenshots/desktop/](screenshots/desktop/) - Desktop screenshots
- [screenshots/mobile/](screenshots/mobile/) - Mobile screenshots

---

## 🗂️ File Organization

This documentation was reorganized on **October 28, 2025** to improve structure and discoverability.

See [FILE_ORGANIZATION_PLAN.md](FILE_ORGANIZATION_PLAN.md) for details on the reorganization.

**Key Changes**:
- ✅ Moved 30+ files from root to organized folders
- ✅ Created logical folder structure
- ✅ Added comprehensive indexes
- ✅ Updated all cross-references

---

## 🤝 Contributing to Documentation

When adding documentation:
1. **Choose the right folder** based on purpose
2. **Update this README.md** with new entries
3. **Use consistent formatting** (Markdown, headers, links)
4. **Add cross-references** where relevant
5. **Keep file names descriptive** (UPPERCASE_SNAKE_CASE.md)

---

## 📞 Need Help?

Can't find what you're looking for?

1. Check [THREE_SESSION_SUMMARY.md](THREE_SESSION_SUMMARY.md) for recent work
2. Search by keyword using your editor's search (Ctrl+Shift+F)
3. Review [architecture/DOCUMENTATION_INDEX.md](architecture/DOCUMENTATION_INDEX.md) (legacy index)

---

**Last Updated**: October 28, 2025  
**Maintained By**: Development Team  
**Structure Version**: 2.0 (Post-reorganization)

