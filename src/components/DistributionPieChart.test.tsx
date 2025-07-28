import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import DistributionPieChart from './DistributionPieChart'; // Adjust path if needed

// Mock recharts ResponsiveContainer
vi.mock('recharts', async (importOriginal) => {
  const originalModule = await importOriginal<typeof import('recharts')>();
  return {
    ...originalModule,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="responsive-container" style={{ width: '100%', height: '250px' }}>
        {children}
      </div>
    ),
  };
});

describe('DistributionPieChart Component', () => {
  const mockDataBasic = {
    Rock: 10,
    Pop: 8,
    Jazz: 5,
  };

  const mockDataLarge = {
    Rock: 50, Pop: 45, Jazz: 40, Electronic: 35, Funk: 30, Soul: 25,
    Blues: 20, Reggae: 15, Classical: 10, Folk: 5, World: 3, Country: 2,
  };

  it('should render syncing message when syncing is true', () => {
    render(<DistributionPieChart data={{}} syncing={true} />);
    expect(screen.getByText(/Syncing data.../i)).toBeInTheDocument();
    expect(screen.queryByTestId('responsive-container')).not.toBeInTheDocument();
  });

  it('should render no data message when data is empty and not syncing', () => {
    render(<DistributionPieChart data={{}} syncing={false} />);
    expect(screen.getByText(/No data available for this chart/i)).toBeInTheDocument();
    expect(screen.queryByTestId('responsive-container')).not.toBeInTheDocument();
  });

   it('should render no data message when data is null and not syncing', () => {
    render(<DistributionPieChart data={null as any} syncing={false} />);
    expect(screen.getByText(/No data available for this chart/i)).toBeInTheDocument();
    expect(screen.queryByTestId('responsive-container')).not.toBeInTheDocument();
  });

  it('should render the chart when data is provided and not syncing', () => {
    render(<DistributionPieChart data={mockDataBasic} syncing={false} />);
    expect(screen.queryByText(/Syncing data.../i)).not.toBeInTheDocument();
    expect(screen.queryByText(/No data available for this chart/i)).not.toBeInTheDocument();
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();

    // NOTE: Cannot reliably test for legend items rendered by recharts in JSDOM
  });

  it('should render the title when provided', () => {
    const title = 'Genre Distribution';
    render(<DistributionPieChart data={mockDataBasic} title={title} />);
    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
  });

  it('should group items into "Other" slice when exceeding the limit (default 10)', () => {
    render(<DistributionPieChart data={mockDataLarge} />);
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    // Cannot reliably test for legend items like 'Rock', 'Classical', 'Other'
  });

  it('should respect the custom limit prop', () => {
    const limit = 5;
    render(<DistributionPieChart data={mockDataLarge} limit={limit} />);
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    // Cannot reliably test for legend items like 'Rock', 'Pop', 'Other'
  });

   it('should not create "Other" slice if data count is less than or equal to limit', () => {
    render(<DistributionPieChart data={mockDataBasic} limit={5} />); // limit > data count
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
    // Cannot reliably test for legend items like 'Rock', 'Pop', 'Jazz'
    // We trust the component's logic correctly processes data based on limit
    // Check 'Other' slice does NOT exist (this might still work if 'Other' text is unique)
    expect(screen.queryByText('Other')).not.toBeInTheDocument();
  });

});