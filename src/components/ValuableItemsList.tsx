import React from 'react';
import Image from 'next/image'; // Use Next.js Image for optimization

// Define the structure for a single item in the list
// Matches the ValuableItem interface from the API route
interface Item {
  id: number; // instance_id
  release_id: number;
  artist: string | null;
  title: string | null;
  cover_image_url: string | null;
  condition: string | null;
  suggested_value: number | null;
}

interface ValuableItemsListProps {
  title: string;
  items: Item[];
  currencyFormatter: (value: number | null) => string; // Pass formatter function as prop
}

// Placeholder image URL (replace with a local or better remote placeholder if desired)
const PLACEHOLDER_IMAGE = '/file.svg'; // Assuming file.svg exists in public

export default function ValuableItemsList({ title, items, currencyFormatter }: ValuableItemsListProps) {

  if (!items || items.length === 0) {
    return (
      <div className="bg-neutral-800 p-4 md:p-6 rounded-lg shadow-md">
        <h2 className="text-xl font-semibold text-neutral-100 mb-4">{title}</h2>
        <p className="text-neutral-500">No items to display.</p>
      </div>
    );
  }

  return (
    <div className="bg-neutral-800 p-4 md:p-6 rounded-lg shadow-md">
      <h2 className="text-xl font-semibold text-neutral-100 mb-4">{title}</h2>
      <ul className="space-y-3 max-h-96 overflow-y-auto"> {/* Limit height and enable scroll */}
        {items.map((item, index) => (
          <li key={item.id || index} className="flex items-center space-x-3 p-2 rounded hover:bg-neutral-700 transition-colors duration-150">
            {/* Rank */}
            <span className="text-sm font-medium text-neutral-500 w-6 text-right">{index + 1}.</span>

            {/* Artwork */}
            <div className="flex-shrink-0 w-12 h-12 bg-neutral-700 rounded overflow-hidden relative">
              <Image
                src={item.cover_image_url || PLACEHOLDER_IMAGE}
                alt={item.title || 'Album cover'}
                fill // Use fill layout
                style={{ objectFit: 'cover' }} // Ensure image covers the area
                unoptimized={!item.cover_image_url} // Avoid optimizing placeholder
                onError={(_e) => { // Prefix unused variable
                  // Optional: Handle image loading errors, e.g., set to placeholder
                  // (Next.js Image might handle some cases automatically)
                  // console.warn(`Failed to load image: ${item.cover_image_url}`);
                  // e.currentTarget.src = PLACEHOLDER_IMAGE; // Simple fallback
                }}
              />
            </div>

            {/* Details */}
            <div className="flex-grow min-w-0">
              <p className="text-sm font-semibold text-neutral-100 truncate" title={item.title || 'Unknown Title'}>
                {item.title || 'Unknown Title'}
              </p>
              <p className="text-xs text-neutral-400 truncate" title={item.artist || 'Unknown Artist'}>
                {item.artist || 'Unknown Artist'}
              </p>
              {item.condition && (
                 <p className="text-xs text-neutral-500">Cond: {item.condition}</p>
              )}
            </div>

            {/* Value */}
            <div className="flex-shrink-0 text-right">
              <p className="text-sm font-semibold text-neutral-100">
                {currencyFormatter(item.suggested_value)}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}