# File Organization Plan
## Documentation Structure Cleanup

**Date**: October 28, 2025  
**Purpose**: Organize 40+ documentation files created across 3 development sessions

---

## 🎯 Organization Goals

1. **Clear directory structure** - Easy to navigate
2. **Logical grouping** - Related docs together
3. **Minimize root clutter** - Move docs to proper folders
4. **Maintain discoverability** - Update indexes

---

## 📁 Proposed Directory Structure

```
lenr.academy/
├── README.md                           # Main project README (keep root)
├── CONTRIBUTING.md                     # Contribution guide (keep root)
├── LICENSE.md                          # License (keep root)
├── QUICKSTART.md                       # Quick start guide (keep root)
│
├── docs/                               # All documentation
│   ├── README.md                       # Documentation index (link from main)
│   ├── THREE_SESSION_SUMMARY.md        # 3-session development summary
│   │
│   ├── development/                    # Development guides
│   │   ├── DEVELOPMENT.md
│   │   ├── IMPLEMENTATION_GUIDE.md
│   │   ├── WEIGHTED_FUEL_IMPLEMENTATION.md
│   │   └── CONSOLE_WARNINGS_GUIDE.md
│   │
│   ├── testing/                        # Testing documentation
│   │   ├── TESTING_GUIDE.md
│   │   ├── CASCADE_TESTING_PLAN.md
│   │   ├── DECAY_CHAIN_TEST_RESULTS.md
│   │   ├── DECAY_CHAIN_TESTS_FINAL_REPORT.md
│   │   ├── TEST_FIXES_NEEDED.md
│   │   └── UNIT_TESTS_STATUS.md
│   │
│   ├── features/                       # Feature-specific docs
│   │   ├── README_WEIGHTED_FUEL.md
│   │   ├── SANKEY_WEIGHTED_VISUALIZATION.md
│   │   ├── PHASE_1_COMPLETION_SUMMARY.md
│   │   └── PHASE_2_MATERIALS_CATALOG_PLAN.md
│   │
│   ├── pr-submission/                  # PR and release docs
│   │   ├── PULL_REQUEST_DOCUMENTATION.md
│   │   ├── PR_SUBMISSION_CHECKLIST.md
│   │   ├── GIT_COMMIT_MESSAGE.md
│   │   ├── CHANGELOG_ENTRY.md
│   │   ├── 📦_READY_FOR_PR.md
│   │   └── PR #67 Cascades Report .md
│   │
│   ├── troubleshooting/                # Troubleshooting guides
│   │   ├── DATABASE_TROUBLESHOOTING.md
│   │   ├── DATABASE_FIX_SUMMARY.md
│   │   └── ACCESSIBILITY_FIXES.md
│   │
│   ├── operations/                     # Deployment and ops
│   │   ├── RELEASING.md
│   │   ├── SENTRY_SETUP.md
│   │   ├── SCREENSHOT_QUICKSTART.md
│   │   └── PR_SCREENSHOTS.md
│   │
│   ├── architecture/                   # Architecture docs
│   │   ├── NETWORK_VISUALIZATION_REDESIGN.md
│   │   └── DOCUMENTATION_INDEX.md
│   │
│   └── screenshots/                    # Screenshots (already organized)
│       ├── desktop/
│       └── mobile/
│
├── e2e/                                # E2E tests (already organized)
│   ├── tests/
│   ├── fixtures/
│   └── README.md
│
└── scripts/                            # Scripts (already organized)
```

---

## 🔄 File Moves Required

### From Root → docs/development/
```bash
IMPLEMENTATION_GUIDE.md
WEIGHTED_FUEL_IMPLEMENTATION.md
CONSOLE_WARNINGS_GUIDE.md
```

### From Root → docs/testing/
```bash
TESTING_GUIDE.md
CASCADE_TESTING_PLAN.md
DECAY_CHAIN_TEST_RESULTS.md
DECAY_CHAIN_TESTS_FINAL_REPORT.md
TEST_FIXES_NEEDED.md
UNIT_TESTS_STATUS.md
```

### From Root → docs/features/
```bash
README_WEIGHTED_FUEL.md
SANKEY_WEIGHTED_VISUALIZATION.md
PHASE_1_COMPLETION_SUMMARY.md
PHASE_2_MATERIALS_CATALOG_PLAN.md
```

### From Root → docs/pr-submission/
```bash
PULL_REQUEST_DOCUMENTATION.md
PR_SUBMISSION_CHECKLIST.md
GIT_COMMIT_MESSAGE.md
CHANGELOG_ENTRY.md
📦_READY_FOR_PR.md
"PR #67 Cascades Report .md"
```

### From Root → docs/troubleshooting/
```bash
DATABASE_TROUBLESHOOTING.md
DATABASE_FIX_SUMMARY.md
ACCESSIBILITY_FIXES.md
```

### From Root → docs/architecture/
```bash
DOCUMENTATION_INDEX.md
NETWORK_VISUALIZATION_REDESIGN.md
```

### From docs/ → docs/operations/
```bash
docs/RELEASING.md
docs/SENTRY_SETUP.md
docs/SCREENSHOT_QUICKSTART.md
docs/PR_SCREENSHOTS.md
```

### Keep in Root (Essential Project Files)
```bash
README.md
CONTRIBUTING.md
LICENSE.md
QUICKSTART.md
CLAUDE.md                    # AI assistant context
```

### Archive/Delete (Superseded by THREE_SESSION_SUMMARY.md)
```bash
FINAL_SUMMARY.md            # Replaced by THREE_SESSION_SUMMARY.md
next_steps.md               # Already deleted by user
```

---

## 📝 Files to Update After Move

### 1. Root README.md
Add link to documentation:
```markdown
## 📚 Documentation

See [docs/README.md](docs/README.md) for complete documentation index.

### Quick Links
- [Quick Start Guide](QUICKSTART.md)
- [Development Guide](docs/development/DEVELOPMENT.md)
- [Testing Guide](docs/testing/TESTING_GUIDE.md)
- [Three Session Summary](docs/THREE_SESSION_SUMMARY.md)
```

### 2. docs/README.md (new)
Create comprehensive documentation index linking to all organized files.

### 3. Update Cross-References
Update any internal links in documentation files that reference moved files.

---

## ✅ Benefits

1. **Cleaner Root**: Only 5 essential files in root
2. **Logical Grouping**: Related docs together
3. **Easy Navigation**: Clear folder structure
4. **Better Discoverability**: Organized by purpose
5. **Professional Structure**: Industry-standard layout

---

## 🚀 Implementation Steps

1. ✅ Create directory structure
2. ✅ Move files to new locations
3. ✅ Create docs/README.md index
4. ✅ Update root README.md
5. ✅ Update cross-references
6. ✅ Archive obsolete files
7. ✅ Test all links
8. ✅ Commit organized structure

---

*Generated: October 28, 2025*

