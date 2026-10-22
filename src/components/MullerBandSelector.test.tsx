import { describe, it, expect, vi } from 'vitest'
import { useState } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import MullerBandSelector from './MullerBandSelector'
import type { BandSelection } from '../services/mullerResonanceService'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

function Harness({ initial, onChange }: { initial: BandSelection; onChange: (s: BandSelection) => void }) {
  const [value, setValue] = useState(initial)
  return (
    <MullerBandSelector
      value={value}
      onChange={s => { setValue(s); onChange(s) }}
    />
  )
}

describe('MullerBandSelector', () => {
  it('defaults to "Ratio only" pressed', () => {
    render(<Harness initial={{ band: 'none', min: 0, max: 0 }} onChange={() => {}} />)
    expect(screen.getByTestId('band-chip-none')).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('band-chip-mm')).toHaveAttribute('aria-pressed', 'false')
    expect(screen.queryByTestId('band-custom-min')).toBeNull()
    expect(screen.queryByTestId('band-ladder-hint')).toBeNull()
  })

  it('shows the click-a-row ladder hint only when a band is active', () => {
    render(<Harness initial={{ band: 'none', min: 0, max: 0 }} onChange={() => {}} />)
    expect(screen.queryByTestId('band-ladder-hint')).toBeNull()
    fireEvent.click(screen.getByTestId('band-chip-um'))
    expect(screen.getByTestId('band-ladder-hint')).toHaveTextContent('mullerResonance.band.ladderHint')
    fireEvent.click(screen.getByTestId('band-chip-none'))
    expect(screen.queryByTestId('band-ladder-hint')).toBeNull()
  })

  it('selects presets with their metre ranges', () => {
    const onChange = vi.fn()
    render(<Harness initial={{ band: 'none', min: 0, max: 0 }} onChange={onChange} />)
    fireEvent.click(screen.getByTestId('band-chip-mm'))
    expect(onChange).toHaveBeenLastCalledWith({ band: 'mm', min: 1e-3, max: 1 })
    expect(screen.getByTestId('band-chip-mm')).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByTestId('band-chip-cm-m'))
    expect(onChange).toHaveBeenLastCalledWith({ band: 'cm-m', min: 1e-2, max: 10 })
  })

  it('seeds Custom from the active preset and commits edits in the chosen unit', () => {
    const onChange = vi.fn()
    render(<Harness initial={{ band: 'um', min: 1e-6, max: 1e-3 }} onChange={onChange} />)
    fireEvent.click(screen.getByTestId('band-chip-custom'))
    expect(onChange).toHaveBeenLastCalledWith({ band: 'custom', min: 1e-6, max: 1e-3 })
    expect(screen.getByTestId('band-custom-unit')).toHaveValue('um')
    expect(screen.getByTestId('band-custom-min')).toHaveValue(1)
    expect(screen.getByTestId('band-custom-max')).toHaveValue(1000)

    fireEvent.change(screen.getByTestId('band-custom-max'), { target: { value: '50' } })
    const last = onChange.mock.lastCall![0] as BandSelection
    expect(last.band).toBe('custom')
    expect(last.max).toBeCloseTo(50e-6, 15)
  })

  it('flags an invalid custom range without committing it', () => {
    const onChange = vi.fn()
    render(<Harness initial={{ band: 'custom', min: 1e-3, max: 1 }} onChange={onChange} />)
    fireEvent.change(screen.getByTestId('band-custom-min'), { target: { value: '5000' } })
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole('alert')).toHaveTextContent('mullerResonance.band.invalidRange')
  })
})
