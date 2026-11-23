import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import en from '../i18n/locales/en.json';
import { mockReactI18next } from '../test-utils/i18nMock';

vi.mock('react-i18next', () => mockReactI18next);

import Home from './Home';

function renderWithRouter() {
  return render(
    <MemoryRouter>
      <Home />
    </MemoryRouter>
  );
}

describe('Home', () => {
  it('renders page title', () => {
    renderWithRouter();
    expect(screen.getByText(en.home.title)).toBeInTheDocument();
  });

  it('renders subtitle', () => {
    renderWithRouter();
    expect(screen.getByText(en.home.subtitle)).toBeInTheDocument();
  });

  it('renders query reactions section', () => {
    renderWithRouter();
    expect(screen.getByText(en.home.queryReactions.title)).toBeInTheDocument();
  });

  it('renders reaction simulations section', () => {
    renderWithRouter();
    expect(screen.getByText(en.home.simulations.title)).toBeInTheDocument();
  });

  it('renders element data section', () => {
    renderWithRouter();
    expect(screen.getByText(en.home.elementData.title)).toBeInTheDocument();
  });

  it('renders navigation links', () => {
    renderWithRouter();
    const fusionLink = screen.getByText(`→ ${en.home.queryReactions.fusionReactions}`);
    expect(fusionLink.closest('a')).toHaveAttribute('href', '/fusion');
    const fissionLink = screen.getByText(`→ ${en.home.queryReactions.fissionReactions}`);
    expect(fissionLink.closest('a')).toHaveAttribute('href', '/fission');
  });

  it('renders open source section', () => {
    renderWithRouter();
    expect(screen.getByText(en.home.openSource.title)).toBeInTheDocument();
  });

  it('renders GitHub link', () => {
    renderWithRouter();
    const ghLink = screen.getByText(en.home.openSource.viewGitHub);
    expect(ghLink.closest('a')).toHaveAttribute('href', 'https://github.com/Episk-pos/lenr.academy');
  });

  it('renders nanosoft link', () => {
    renderWithRouter();
    const nanosoftLink = screen.getByText(`→ ${en.home.aboutData.visitNanosoft}`);
    expect(nanosoftLink.closest('a')).toHaveAttribute('href', 'https://nanosoft.co.nz');
  });

  it('renders about data section', () => {
    renderWithRouter();
    expect(screen.getByText(en.home.aboutData.title)).toBeInTheDocument();
  });

  it('renders patterns & pathways section', () => {
    renderWithRouter();
    expect(screen.getByText(en.home.patterns.title)).toBeInTheDocument();
    expect(screen.getByText(en.home.patterns.description)).toBeInTheDocument();
  });

  it('renders patterns & pathways links in order with correct hrefs', () => {
    renderWithRouter();
    const card = screen.getByText(en.home.patterns.title).closest('.card') as HTMLElement;
    const links = Array.from(card.querySelectorAll('a')).map((a) => [a.textContent, a.getAttribute('href')]);
    expect(links).toEqual([
      [`→ ${en.home.patterns.transmutations}`, '/transmutations'],
      [`→ ${en.home.patterns.mullerResonance}`, '/muller-resonance'],
      [`→ ${en.home.patterns.russellChart}`, '/element-data?tab=russell'],
      [`→ ${en.home.patterns.segreChart}`, '/element-data?tab=integrated'],
    ]);
  });
});
