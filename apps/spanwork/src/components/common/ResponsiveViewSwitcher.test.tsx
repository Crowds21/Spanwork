import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ResponsiveViewSwitcher } from './ResponsiveViewSwitcher';

const options = [
  { value: 'list' as const, label: '列表' },
  { value: 'kanban' as const, label: '看板' },
  { value: 'calendar' as const, label: '日历' },
];

describe('ResponsiveViewSwitcher', () => {
  it('renders all option labels in desktop segmented control', () => {
    render(
      <ResponsiveViewSwitcher value="list" onChange={() => {}} options={options} />,
    );

    const desktop = screen.getByTestId('desktop-view-switcher');
    expect(within(desktop).getByRole('button', { name: /看板/ })).toBeInTheDocument();
    expect(within(desktop).getByRole('button', { name: /列表/ })).toBeInTheDocument();
    expect(within(desktop).getByRole('button', { name: /日历/ })).toBeInTheDocument();
  });

  it('renders mobile select with current value', () => {
    render(
      <ResponsiveViewSwitcher value="kanban" onChange={() => {}} options={options} />,
    );

    const comboboxes = screen.getAllByRole('combobox');
    expect(comboboxes.some((el) => el.textContent?.includes('看板'))).toBe(true);
  });

  it('calls onChange when desktop button clicked', () => {
    let selected = 'list';

    render(
      <ResponsiveViewSwitcher
        value="list"
        onChange={(v) => {
          selected = v;
        }}
        options={options}
      />,
    );

    const desktop = screen.getByTestId('desktop-view-switcher');
    fireEvent.click(within(desktop).getByRole('button', { name: /看板/ }));
    expect(selected).toBe('kanban');
  });
});
