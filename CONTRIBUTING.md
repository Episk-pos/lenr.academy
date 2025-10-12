# Contributing to LENR Academy

Thank you for your interest in contributing to LENR Academy! This document provides guidelines for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [How to Contribute](#how-to-contribute)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Submitting Changes](#submitting-changes)
- [Community](#community)

## Code of Conduct

This is an open science project focused on advancing LENR research and education. We expect all contributors to:

- Be respectful and constructive in discussions
- Focus on scientific accuracy and data integrity
- Welcome newcomers and help them get started
- Give credit where credit is due
- Maintain the open source spirit (AGPL-3.0)

## Getting Started

### Prerequisites

- **Node.js** 18+ or 20+ (check with `node --version`)
- **npm** or **yarn**
- **Git**
- A modern browser with WebAssembly support (Chrome 70+, Firefox 65+, Safari 14+)

### Clone the Repository

```bash
git clone https://github.com/Episk-pos/lenr.academy.git
cd lenr.academy
```

### Install Dependencies

```bash
npm install
```

### Database File

The 161MB `parkhomov.db` file is tracked using **Git LFS** (Large File Storage). When you clone the repository, Git LFS will automatically download the database file to `/public/parkhomov.db`.

**First time using Git LFS?** Install it before cloning:

```bash
# macOS
brew install git-lfs

# Ubuntu/Debian
sudo apt-get install git-lfs

# Fedora/RHEL
sudo dnf install git-lfs

# Manjaro/Arch
sudo pacman -S git-lfs

# Windows
# Download from https://git-lfs.github.com/
```

After installing, initialize Git LFS:

```bash
git lfs install
```

If you cloned before installing Git LFS, pull the database file:

```bash
git lfs pull
```

### Start Development Server

```bash
npm run dev
```

Visit http://localhost:5173 to see your local instance.

## How to Contribute

### Reporting Bugs

Found a bug? Please [open a bug report](https://github.com/Episk-pos/lenr.academy/issues/new?labels=bug&template=bug_report.yml) using our issue template.

**Before submitting:**
- Search existing issues to avoid duplicates
- Test on the latest version at https://lenr.academy
- Include browser, OS, and device information
- Provide console errors if available (F12 or Cmd+Option+I)

### Suggesting Features

Have an idea? [Request a feature](https://github.com/Episk-pos/lenr.academy/issues/new?labels=enhancement&template=feature_request.yml) or start a [GitHub Discussion](https://github.com/Episk-pos/lenr.academy/discussions).

**Great areas for contribution:**
- Data visualization (charts, graphs, network diagrams)
- Cascade simulation algorithm improvements
- Performance optimizations (Web Workers, lazy loading)
- Educational content (tutorials, glossaries)
- Additional datasets or reaction databases
- Mobile/tablet experience improvements
- Accessibility enhancements

### Good First Issues

Look for issues labeled [`good first issue`](https://github.com/Episk-pos/lenr.academy/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22) - these are beginner-friendly and well-documented.

### Project Board Workflow

We use a [GitHub Project Board](https://github.com/orgs/Episk-pos/projects/1) to track development progress:

- **Triage** - New issues awaiting review
- **Backlog** - Validated but not yet prioritized
- **Ready** - Clear requirements, ready to work on (look for "good first issue" labels!)
- **In Progress** - Actively being worked on
- **Review** - Pull requests under review
- **Done** - Completed work (auto-archived after 14 days)

**To pick up an issue:**
1. Browse the "Ready" column or check the [Community Contributions view](https://github.com/orgs/Episk-pos/projects/1/views/2)
2. Comment on the issue expressing interest
3. Wait for maintainer confirmation
4. Self-assign and start work
5. Issue automatically moves to "In Progress"

## Development Workflow

### Branch Naming

Create a descriptive branch from `main`:

```bash
git checkout -b feature/add-energy-chart
git checkout -b fix/periodic-table-selection
git checkout -b docs/update-cascade-guide
```

**Naming conventions:**
- `feature/` - New features
- `fix/` - Bug fixes
- `refactor/` - Code refactoring
- `docs/` - Documentation updates
- `perf/` - Performance improvements
- `test/` - Test additions/fixes

### Commit Messages

Write clear, concise commit messages:

```bash
git commit -m "feat: add energy distribution chart to fusion query"
git commit -m "fix: periodic table element selection on mobile"
git commit -m "docs: update cascade simulation parameters"
```

**Format:** `type: description`

**Types:**
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation
- `style` - Formatting (no code change)
- `refactor` - Code restructuring
- `perf` - Performance improvement
- `test` - Adding/updating tests
- `chore` - Maintenance tasks

## Coding Standards

### TypeScript

- **Use TypeScript strictly** - No `any` types unless absolutely necessary
- Define proper interfaces in `src/types/index.ts`
- Add JSDoc comments for complex functions
- Use meaningful variable and function names

### React

- **Functional components** with hooks (no class components)
- Use the existing context patterns (`useDatabase()`, `useTheme()`)
- Keep components focused and reusable
- Extract complex logic to custom hooks or services

### Styling

- **TailwindCSS** for all styling
- Support both dark and light modes (`dark:` prefix)
- Mobile-first responsive design
- Follow existing component patterns

### File Organization

```
src/
├── components/       # Reusable UI components
├── pages/           # Route/page components
├── services/        # Data layer (database, queries)
├── contexts/        # React Context providers
├── types/           # TypeScript type definitions
└── hooks/           # Custom React hooks (if needed)
```

### Code Quality

Before committing:

```bash
npm run lint        # Check for linting errors
npm run build       # Ensure build succeeds
```

**Standards:**
- No `console.log` in production code
- Remove unused imports and variables
- Code should be self-documenting
- Add comments for complex logic only

## Testing

### Manual Testing

At minimum, test your changes on:
- Desktop browser (Chrome or Firefox)
- Mobile device or responsive mode
- Both dark and light themes

### E2E Tests

We use Playwright for end-to-end testing:

```bash
npm run test:e2e           # Run all E2E tests
npm run test:e2e:ui        # Run with UI mode
npm run test:e2e:chromium  # Run on Chromium only
npm run test:e2e:debug     # Debug mode
```

**When to add tests:**
- New query functionality
- Critical user workflows
- Bug fixes (regression tests)
- Form interactions

### Performance Testing

For database-heavy changes:
- Test with large result sets (10k+ rows)
- Monitor browser memory usage
- Check IndexedDB caching behavior
- Test on slower devices/connections

## Submitting Changes

### Pull Request Process

1. **Push your branch:**
   ```bash
   git push origin feature/your-feature-name
   ```

2. **Open a Pull Request** on GitHub using the [PR template](.github/pull_request_template.md)

3. **Fill out the template completely:**
   - Description of changes
   - Related issues (use `Fixes #123`)
   - Testing performed
   - Screenshots (for UI changes)
   - Checklist items

4. **CI Checks:** Ensure GitHub Actions pass (E2E tests run automatically)

5. **Review Process:**
   - Maintainers will review your PR
   - Address any feedback or requested changes
   - Once approved, a maintainer will merge

### PR Checklist

Before submitting, ensure:

- [ ] Code follows existing style and patterns
- [ ] TypeScript types are properly defined
- [ ] `npm run lint` passes
- [ ] `npm run build` succeeds
- [ ] Tested in browser (desktop + mobile)
- [ ] Dark and light modes work correctly
- [ ] No console errors or warnings
- [ ] Documentation updated (if needed)
- [ ] PR template filled out completely

### Review Criteria

Maintainers will check:
- **Alignment with project goals** - Does this fit LENR Academy's mission?
- **Code quality** - Is it readable, maintainable, and well-structured?
- **Testing** - Is it adequately tested?
- **Performance** - No obvious regressions
- **UI/UX** - Consistent with existing design
- **Documentation** - Sufficient for future maintainers
- **License compliance** - Maintains AGPL-3.0

## Community

### Communication Channels

- **GitHub Issues** - Bug reports and feature requests
- **GitHub Discussions** - Questions, ideas, and general discussion
- **Pull Requests** - Code contributions and reviews

### Getting Help

- Check the [README.md](README.md) for project overview
- Read [CLAUDE.md](CLAUDE.md) for architecture details
- Browse existing issues and discussions
- Ask questions in GitHub Discussions

### Recognition

All contributors are valued! Your contributions will be:
- Credited in commit history
- Recognized in release notes (for significant contributions)
- Listed as a contributor on the GitHub repository

## Development Tips

### Understanding the Architecture

Read [CLAUDE.md](CLAUDE.md) for detailed architecture documentation, including:
- Three-layer architecture (Data, State, UI)
- Database lifecycle and caching
- Query service patterns
- Component communication

### Working with the Database

The 161MB SQLite database uses **sql.js** (SQLite compiled to WebAssembly):

- First load: Downloads from `/public/parkhomov.db`
- Subsequent loads: Cached in IndexedDB
- All queries run client-side in the browser
- See `src/services/queryService.ts` for query patterns

### Key Tables

- `NuclidesPlus` - Isotope data (Z, A, binding energy, half-life)
- `ElementPropertiesPlus` - Chemical element properties
- `FusionAll` - A + B → C reactions
- `FissionAll` - A → B + C reactions
- `TwoToTwoAll` - A + B → C + D reactions

### Common Tasks

**Add a new query filter:**
1. Update `QueryFilter` interface in `src/types/index.ts`
2. Add UI controls in the relevant query page
3. Modify SQL builder in `src/services/queryService.ts`
4. Test with various combinations

**Add a new component:**
1. Create in `src/components/YourComponent.tsx`
2. Use existing patterns (functional component + hooks)
3. Support dark mode with `dark:` Tailwind classes
4. Make it responsive with Tailwind breakpoints

**Optimize a query:**
1. Check `executionTime` returned from queries
2. Use SQL EXPLAIN to understand query plan
3. Consider indexes (database-level optimization)
4. Add pagination or limit results for large datasets

## Questions?

- Open a [GitHub Discussion](https://github.com/Episk-pos/lenr.academy/discussions)
- Tag issues with `question` label
- Check existing documentation in the repo

## License

By contributing, you agree that your contributions will be licensed under the same [AGPL-3.0](LICENSE.md) license that covers this project.

---

**Thank you for contributing to LENR Academy! Together we're building open tools for nuclear science research and education.** 🔬
