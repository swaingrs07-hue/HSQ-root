import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, Sparkles, MapPin, IndianRupee, Home, Filter, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation } from "@tanstack/react-query";

interface SearchFilters {
  city?: string | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  amenities?: string[] | null;
  roomType?: string | null;
  occupancy?: number | null;
  keywords?: string[] | null;
  sortBy?: "price_low" | "price_high" | "availability" | null;
}

interface SearchResult {
  properties: {
    id: string;
    name: string;
    displayName: string | null;
    city: string | null;
    address: string | null;
    amenities: string[];
    lowestPrice: number;
    highestPrice: number;
    totalAvailableBeds: number;
    roomTypes: {
      id: string;
      name: string;
      customName: string | null;
      basePrice: number;
      occupancy: number;
      availableBeds: number;
    }[];
  }[];
  filters: SearchFilters;
  interpretation: string;
  totalResults: number;
}

interface SuggestedFilters {
  cities: string[];
  amenities: string[];
  priceRanges: { label: string; min: number; max: number }[];
}

interface SmartSearchProps {
  onSearchResults?: (results: SearchResult) => void;
  placeholder?: string;
  className?: string;
}

const EXAMPLE_QUERIES = [
  "Rooms under ₹15,000 in Mumbai",
  "Double sharing with AC",
  "Single room near Juhu",
  "Budget rooms with WiFi",
  "Premium rooms in Andheri",
];

export function SmartSearch({ onSearchResults, placeholder, className }: SmartSearchProps) {
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeFilters, setActiveFilters] = useState<SearchFilters>({});
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { data: suggestedFilters } = useQuery<SuggestedFilters>({
    queryKey: ["/api/search/filters"],
    staleTime: 5 * 60 * 1000,
  });

  const searchMutation = useMutation({
    mutationFn: async (searchQuery: string) => {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery, filters: activeFilters }),
      });
      if (!response.ok) throw new Error("Search failed");
      return response.json() as Promise<SearchResult>;
    },
    onSuccess: (data) => {
      setActiveFilters(data.filters);
      onSearchResults?.(data);
      setShowSuggestions(false);
    },
  });

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSearch = () => {
    if (query.trim()) {
      searchMutation.mutate(query);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  const handleExampleClick = (example: string) => {
    setQuery(example);
    searchMutation.mutate(example);
  };

  const handleFilterClick = (type: string, value: string | number) => {
    let newQuery = query;
    if (type === "city") {
      newQuery = `${query} in ${value}`.trim();
    } else if (type === "price") {
      const range = suggestedFilters?.priceRanges.find(r => r.label === value);
      if (range) {
        newQuery = `${query} ${range.max < 100000 ? `under ₹${range.max.toLocaleString("en-IN")}` : `above ₹${range.min.toLocaleString("en-IN")}`}`.trim();
      }
    } else if (type === "amenity") {
      newQuery = `${query} with ${value}`.trim();
    }
    setQuery(newQuery);
    searchMutation.mutate(newQuery);
  };

  const clearSearch = () => {
    setQuery("");
    setActiveFilters({});
    onSearchResults?.({
      properties: [],
      filters: {},
      interpretation: "",
      totalResults: 0,
    });
  };

  const hasActiveFilters = Object.values(activeFilters).some(v => v !== null && v !== undefined && (Array.isArray(v) ? v.length > 0 : true));

  return (
    <div ref={containerRef} className={`relative ${className || ""}`}>
      <div className="relative">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-500" />
          <Search className="w-4 h-4 text-gray-400" />
        </div>
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            setIsFocused(true);
            setShowSuggestions(true);
          }}
          onBlur={() => setIsFocused(false)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || "Search with AI... Try 'rooms under 15000 in Mumbai'"}
          className="pl-16 pr-24 py-6 text-base rounded-full border-2 border-gray-200 focus:border-purple-400 focus:ring-purple-400/20 shadow-lg"
          data-testid="smart-search-input"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          {query && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full"
              onClick={clearSearch}
              data-testid="smart-search-clear"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
          <Button
            onClick={handleSearch}
            disabled={!query.trim() || searchMutation.isPending}
            className="rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 px-4"
            data-testid="smart-search-submit"
          >
            {searchMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "Search"
            )}
          </Button>
        </div>
      </div>

      {hasActiveFilters && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 flex flex-wrap gap-2"
        >
          {activeFilters.city && (
            <Badge variant="secondary" className="flex items-center gap-1 px-3 py-1">
              <MapPin className="w-3 h-3" />
              {activeFilters.city}
            </Badge>
          )}
          {(activeFilters.minPrice || activeFilters.maxPrice) && (
            <Badge variant="secondary" className="flex items-center gap-1 px-3 py-1">
              <IndianRupee className="w-3 h-3" />
              {activeFilters.minPrice && activeFilters.maxPrice
                ? `₹${activeFilters.minPrice.toLocaleString("en-IN")} - ₹${activeFilters.maxPrice.toLocaleString("en-IN")}`
                : activeFilters.maxPrice
                ? `Under ₹${activeFilters.maxPrice.toLocaleString("en-IN")}`
                : `Above ₹${activeFilters.minPrice?.toLocaleString("en-IN")}`}
            </Badge>
          )}
          {activeFilters.roomType && (
            <Badge variant="secondary" className="flex items-center gap-1 px-3 py-1">
              <Home className="w-3 h-3" />
              {activeFilters.roomType}
            </Badge>
          )}
          {activeFilters.amenities?.map((amenity) => (
            <Badge key={amenity} variant="secondary" className="px-3 py-1">
              {amenity}
            </Badge>
          ))}
          {activeFilters.sortBy && (
            <Badge variant="outline" className="flex items-center gap-1 px-3 py-1">
              <Filter className="w-3 h-3" />
              {activeFilters.sortBy === "price_low" ? "Low to High" : activeFilters.sortBy === "price_high" ? "High to Low" : "By Availability"}
            </Badge>
          )}
        </motion.div>
      )}

      <AnimatePresence>
        {showSuggestions && !searchMutation.isPending && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute z-50 w-full mt-2 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden"
          >
            <div className="p-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">
                Try asking
              </p>
              <div className="flex flex-wrap gap-2">
                {EXAMPLE_QUERIES.map((example, index) => (
                  <button
                    key={example}
                    onClick={() => handleExampleClick(example)}
                    className="px-3 py-1.5 text-sm bg-purple-50 text-purple-700 rounded-full hover:bg-purple-100 transition-colors"
                    data-testid={`button-example-query-${index}`}
                  >
                    "{example}"
                  </button>
                ))}
              </div>
            </div>

            {suggestedFilters && (
              <>
                <div className="border-t border-gray-100" />
                <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> Location
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {suggestedFilters.cities.slice(0, 5).map((city, index) => (
                        <button
                          key={city}
                          onClick={() => handleFilterClick("city", city)}
                          className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors"
                          data-testid={`button-filter-city-${index}`}
                        >
                          {city}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                      <IndianRupee className="w-3 h-3" /> Budget
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {suggestedFilters.priceRanges.slice(0, 3).map((range, index) => (
                        <button
                          key={range.label}
                          onClick={() => handleFilterClick("price", range.label)}
                          className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors"
                          data-testid={`button-filter-price-${index}`}
                        >
                          {range.label.split(" ")[0]}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
                      <Home className="w-3 h-3" /> Amenities
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {suggestedFilters.amenities.slice(0, 5).map((amenity, index) => (
                        <button
                          key={amenity}
                          onClick={() => handleFilterClick("amenity", amenity)}
                          className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full hover:bg-gray-200 transition-colors"
                          data-testid={`button-filter-amenity-${index}`}
                        >
                          {amenity}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {searchMutation.data && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-3 text-sm text-gray-600"
        >
          {searchMutation.data.interpretation} • {searchMutation.data.totalResults} result{searchMutation.data.totalResults !== 1 ? "s" : ""}
        </motion.p>
      )}
    </div>
  );
}
