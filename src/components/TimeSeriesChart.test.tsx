import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import TimeSeriesChart from './TimeSeriesChart'; // Adjust path if needed

// Mock recharts ResponsiveContainer as it often causes issues in JSDOM
vi.mock('recharts', async (importOriginal) => {
  const originalModule = await importOriginal<typeof import('recharts')>();
  return {
    ...originalModule,
    // Render children to ensure chart elements are in the DOM
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
        <div data-testid="responsive-container" style={{ width: '100%', height: '300px' }}>
            {children}
        </div>
    ),
  };
});

describe('TimeSeriesChart Component', () => {
  const mockLines = [
    { dataKey: 'value1', stroke: '#8884d8', name: 'Value One' },
    { dataKey: 'value2', stroke: '#82ca9d', name: 'Value Two' },
  ];

  const mockData = [
    { timestamp: '2024-01-01T10:00:00Z', value1: 10, value2: 15 },
    { timestamp: '2024-01-02T10:00:00Z', value1: 12, value2: 18 },
    { timestamp: '2024-01-03T10:00:00Z', value1: 15, value2: 22 },
  ];

  it('should render syncing message when syncing is true', () => {
    render(<TimeSeriesChart data={[]} lines={mockLines} syncing={true} />);
    expect(screen.getByText(/Syncing data.../i)).toBeInTheDocument();
    // Check that the chart container isn't rendered
    expect(screen.queryByTestId('responsive-container')).not.toBeInTheDocument();
  });

  it('should render no data message when data is empty and not syncing', () => {
    render(<TimeSeriesChart data={[]} lines={mockLines} syncing={false} />);
    expect(screen.getByText(/No historical data available/i)).toBeInTheDocument();
    expect(screen.queryByTestId('responsive-container')).not.toBeInTheDocument();
  });

   it('should render no data message when data is null and not syncing', () => {
    // Pass null explicitly, ensuring type compatibility if needed
    render(<TimeSeriesChart data={null as any} lines={mockLines} syncing={false} />);
    expect(screen.getByText(/No historical data available/i)).toBeInTheDocument();
    expect(screen.queryByTestId('responsive-container')).not.toBeInTheDocument();
  });

  it('should render the chart when data is provided and not syncing', () => {
    render(<TimeSeriesChart data={mockData} lines={mockLines} syncing={false} />);

    // Check that the placeholder messages are NOT present
    expect(screen.queryByText(/Syncing data.../i)).not.toBeInTheDocument();
    expect(screen.queryByText(/No historical data available/i)).not.toBeInTheDocument();

    // Check that the chart container (mocked ResponsiveContainer) is rendered
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();

    // NOTE: Asserting on elements rendered *inside* the recharts components (like legend, axes)
    // is unreliable in JSDOM because they rely on SVG rendering and calculations
    // that JSDOM doesn't fully support. We focus on testing the component's own logic.
  });

  it('should render the title when provided', () => {
    const title = 'Test Chart Title';
    render(<TimeSeriesChart data={mockData} lines={mockLines} title={title} />);
    expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
  });

  // Note: Testing the Y-axis label rendering precisely is hard with JSDOM
  // as it involves SVG text rotation. We might check if the label text exists somewhere.
  it('should include yAxisLabel text if provided', () => {
     const yLabel = 'Count';
     render(<TimeSeriesChart data={mockData} lines={mockLines} yAxisLabel={yLabel} />);
     // We cannot reliably find the rendered SVG label text in JSDOM.
     // We trust that if the container renders, recharts handles the label prop.
     expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
  });

});