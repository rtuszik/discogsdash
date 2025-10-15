import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest"; // Added beforeEach
import ValuableItemsList from "./ValuableItemsList"; // Adjust path if needed

// Mock next/image
vi.mock("next/image", () => ({
    default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} data-testid="next-image" />,
}));

// Mock currency formatter
const mockCurrencyFormatter = vi.fn((value) => (value === null ? "N/A" : `$${value.toFixed(2)}`));

describe("ValuableItemsList Component", () => {
    const mockItems = [
        {
            id: 1,
            release_id: 101,
            artist: "Artist A",
            title: "Album 1",
            cover_image_url: "img1.jpg",
            condition: "NM",
            suggested_value: 25.5,
        },
        {
            id: 2,
            release_id: 102,
            artist: "Artist B",
            title: "Album 2",
            cover_image_url: "img2.jpg",
            condition: "VG+",
            suggested_value: 10.0,
        },
        {
            id: 3,
            release_id: 103,
            artist: null,
            title: null,
            cover_image_url: null,
            condition: null,
            suggested_value: null,
        }, // Item with missing data
    ];

    beforeEach(() => {
        mockCurrencyFormatter.mockClear();
    });

    it('should render "No items" message when items array is empty', () => {
        render(<ValuableItemsList title="Test List" items={[]} currencyFormatter={mockCurrencyFormatter} />);
        expect(screen.getByText("No items to display.")).toBeInTheDocument();
    });

    it('should render "No items" message when items prop is null', () => {
        render(<ValuableItemsList title="Test List" items={null as any} currencyFormatter={mockCurrencyFormatter} />);
        expect(screen.getByText("No items to display.")).toBeInTheDocument();
    });

    it("should render the title", () => {
        const title = "Top Valuable Items";
        render(<ValuableItemsList title={title} items={mockItems} currencyFormatter={mockCurrencyFormatter} />);
        expect(screen.getByRole("heading", { name: title })).toBeInTheDocument();
    });

    it("should render the correct number of list items", () => {
        render(<ValuableItemsList title="Test List" items={mockItems} currencyFormatter={mockCurrencyFormatter} />);
        const listItems = screen.getAllByRole("listitem");
        expect(listItems).toHaveLength(mockItems.length);
    });

    it("should display item details correctly", () => {
        render(<ValuableItemsList title="Test List" items={mockItems} currencyFormatter={mockCurrencyFormatter} />);
        const firstItem = mockItems[0];

        // Check details of the first item
        expect(screen.getByText(`${firstItem.title}`)).toBeInTheDocument();
        expect(screen.getByText(`${firstItem.artist}`)).toBeInTheDocument();
        expect(screen.getByText(`Cond: ${firstItem.condition}`)).toBeInTheDocument();
        expect(screen.getByText(mockCurrencyFormatter(firstItem.suggested_value))).toBeInTheDocument();
        expect(mockCurrencyFormatter).toHaveBeenCalledWith(firstItem.suggested_value);

        // Check rank (based on index)
        expect(screen.getByText("1.")).toBeInTheDocument();

        // Check image source (proxied)
        const img = screen.getAllByTestId("next-image")[0] as HTMLImageElement;
        expect(img.src).toContain(`/api/image-proxy?url=${encodeURIComponent(firstItem.cover_image_url!)}`);
        expect(img.alt).toBe(firstItem.title);
    });

    it("should display fallback text for missing title and artist", () => {
        render(<ValuableItemsList title="Test List" items={mockItems} currencyFormatter={mockCurrencyFormatter} />);
        expect(screen.getByText("Unknown Title")).toBeInTheDocument();
        expect(screen.getByText("Unknown Artist")).toBeInTheDocument();
    });

    it("should not display condition if it is null", () => {
        render(<ValuableItemsList title="Test List" items={mockItems} currencyFormatter={mockCurrencyFormatter} />);
        // Find the list item corresponding to the item with null condition
        const thirdItem = screen.getByText("Unknown Title").closest("li");
        expect(thirdItem).not.toHaveTextContent("Cond:");
    });

    it("should use placeholder image when cover_image_url is null", () => {
        render(<ValuableItemsList title="Test List" items={mockItems} currencyFormatter={mockCurrencyFormatter} />);
        const placeholderImage = screen.getAllByTestId("next-image")[2] as HTMLImageElement; // Third item has null image
        const placeholderPath = "/file.svg";
        expect(placeholderImage.src).toContain(`/api/image-proxy?url=${encodeURIComponent(placeholderPath)}`);
        expect(placeholderImage.alt).toBe("Album cover"); // Correct fallback alt text
    });

    it("should call currencyFormatter with null when suggested_value is null", () => {
        render(<ValuableItemsList title="Test List" items={mockItems} currencyFormatter={mockCurrencyFormatter} />);
        expect(mockCurrencyFormatter).toHaveBeenCalledWith(null);
        expect(screen.getByText("N/A")).toBeInTheDocument(); // Assuming formatter returns 'N/A' for null
    });
});
