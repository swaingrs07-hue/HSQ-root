import { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Building2,
  ChevronDown,
  Search,
  Check,
  Pin,
  Clock,
  Settings,
  Globe,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useProperty } from "@/contexts/property-context";
import { useAuth } from "@/contexts/auth-context";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

interface PropertySwitcherProps {
  className?: string;
}

export function PropertySwitcher({ className }: PropertySwitcherProps) {
  const { user } = useAuth();
  const {
    selectedPropertyId,
    selectedProperty,
    properties,
    isLoading,
    recentPropertyIds,
    pinnedPropertyIds,
    setSelectedProperty,
    togglePinProperty,
  } = useProperty();

  const [open, setOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  const isAdmin = user?.role === "admin" || user?.role === "superadmin";

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (open && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 100);
    }
  }, [open]);

  const filteredProperties = useMemo(() => {
    if (!search) return properties;
    const lowerSearch = search.toLowerCase();
    return properties.filter(
      (p) =>
        p.name.toLowerCase().includes(lowerSearch) ||
        p.location?.toLowerCase().includes(lowerSearch)
    );
  }, [properties, search]);

  const pinnedProperties = useMemo(() => {
    return properties.filter((p) => pinnedPropertyIds.includes(p.id));
  }, [properties, pinnedPropertyIds]);

  const recentProperties = useMemo(() => {
    return recentPropertyIds
      .map((id) => properties.find((p) => p.id === id))
      .filter(Boolean)
      .filter((p) => !pinnedPropertyIds.includes(p!.id))
      .slice(0, 3) as typeof properties;
  }, [properties, recentPropertyIds, pinnedPropertyIds]);

  const handleSelect = (propertyId: string | null) => {
    setSelectedProperty(propertyId);
    setOpen(false);
    setMobileOpen(false);
    setSearch("");
  };

  const PropertyList = () => (
    <div className="space-y-1">
      {isAdmin && (
        <>
          <button
            onClick={() => handleSelect(null)}
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all",
              !selectedPropertyId
                ? "bg-primary/10 text-primary"
                : "hover:bg-slate-100"
            )}
            data-testid="property-all"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <Globe className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">All Properties</p>
              <p className="text-xs text-muted-foreground">View combined data</p>
            </div>
            {!selectedPropertyId && (
              <Check className="h-4 w-4 text-primary flex-shrink-0" />
            )}
          </button>
          <Separator className="my-2" />
        </>
      )}

      {pinnedProperties.length > 0 && (
        <div className="mb-2">
          <p className="text-xs font-medium text-muted-foreground px-3 py-1 flex items-center gap-1">
            <Pin className="h-3 w-3" /> Pinned
          </p>
          {pinnedProperties.map((property) => (
            <PropertyItem
              key={property.id}
              property={property}
              isSelected={selectedPropertyId === property.id}
              isPinned
              onSelect={() => handleSelect(property.id)}
              onTogglePin={() => togglePinProperty(property.id)}
            />
          ))}
        </div>
      )}

      {recentProperties.length > 0 && !search && (
        <div className="mb-2">
          <p className="text-xs font-medium text-muted-foreground px-3 py-1 flex items-center gap-1">
            <Clock className="h-3 w-3" /> Recent
          </p>
          {recentProperties.map((property) => (
            <PropertyItem
              key={property.id}
              property={property}
              isSelected={selectedPropertyId === property.id}
              isPinned={false}
              onSelect={() => handleSelect(property.id)}
              onTogglePin={() => togglePinProperty(property.id)}
            />
          ))}
        </div>
      )}

      <div>
        {!search && (pinnedProperties.length > 0 || recentProperties.length > 0) && (
          <p className="text-xs font-medium text-muted-foreground px-3 py-1 mt-2">
            All Properties
          </p>
        )}
        {filteredProperties
          .filter((property) => {
            if (search) return true;
            return !pinnedPropertyIds.includes(property.id);
          })
          .map((property) => (
            <PropertyItem
              key={property.id}
              property={property}
              isSelected={selectedPropertyId === property.id}
              isPinned={pinnedPropertyIds.includes(property.id)}
              onSelect={() => handleSelect(property.id)}
              onTogglePin={() => togglePinProperty(property.id)}
            />
          ))}
        {filteredProperties.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No properties found
          </p>
        )}
      </div>
    </div>
  );

  return (
    <>
      <div className="hidden md:block">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              role="combobox"
              aria-expanded={open}
              className={cn(
                "justify-between gap-2 min-w-[200px] max-w-[280px] h-10 px-3 border-slate-200 hover:border-primary/50 transition-all",
                className
              )}
              data-testid="button-property-switcher"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className={cn(
                  "w-6 h-6 rounded flex items-center justify-center flex-shrink-0",
                  selectedProperty
                    ? "bg-primary/10"
                    : "bg-gradient-to-br from-violet-500 to-purple-600"
                )}>
                  {selectedProperty ? (
                    <Building2 className="h-3.5 w-3.5 text-primary" />
                  ) : (
                    <Globe className="h-3.5 w-3.5 text-white" />
                  )}
                </div>
                <span className="truncate text-sm font-medium">
                  {selectedProperty?.name || "All Properties"}
                </span>
              </div>
              <ChevronDown className="h-4 w-4 opacity-50 flex-shrink-0" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0 max-h-[80vh] flex flex-col" align="start">
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15 }}
              className="flex flex-col min-h-0 flex-1"
            >
              <div className="p-3 border-b flex-shrink-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    ref={searchInputRef}
                    placeholder="Search properties..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-9 h-9"
                    data-testid="input-property-search"
                  />
                  {search && (
                    <button
                      onClick={() => setSearch("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2"
                    >
                      <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                    </button>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  <kbd className="px-1.5 py-0.5 text-[10px] bg-slate-100 rounded border">⌘K</kbd> to open
                </p>
              </div>
              <ScrollArea className="flex-1 min-h-0 overflow-y-auto">
                <div className="p-2">
                  <PropertyList />
                </div>
              </ScrollArea>
              {isAdmin && (
                <div className="p-2 border-t flex-shrink-0">
                  <Link href="/admin?tab=properties">
                    <Button
                      variant="ghost"
                      className="w-full justify-start gap-2 h-9"
                      onClick={() => setOpen(false)}
                      data-testid="link-manage-properties"
                    >
                      <Settings className="h-4 w-4" />
                      Manage Properties
                    </Button>
                  </Link>
                </div>
              )}
            </motion.div>
          </PopoverContent>
        </Popover>
      </div>

      <div className="md:hidden">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 h-9 px-2.5"
          onClick={() => setMobileOpen(true)}
          data-testid="button-property-switcher-mobile"
        >
          <div className={cn(
            "w-5 h-5 rounded flex items-center justify-center",
            selectedProperty
              ? "bg-primary/10"
              : "bg-gradient-to-br from-violet-500 to-purple-600"
          )}>
            {selectedProperty ? (
              <Building2 className="h-3 w-3 text-primary" />
            ) : (
              <Globe className="h-3 w-3 text-white" />
            )}
          </div>
          <ChevronDown className="h-3.5 w-3.5 opacity-50" />
        </Button>

        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetContent side="bottom" className="rounded-t-3xl px-0 pb-8 max-h-[80vh]">
            <SheetHeader className="px-6 pb-4">
              <SheetTitle>Select Property</SheetTitle>
            </SheetHeader>
            <div className="px-4 pb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search properties..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                  data-testid="input-property-search-mobile"
                />
              </div>
            </div>
            <ScrollArea className="max-h-[50vh] px-4">
              <PropertyList />
            </ScrollArea>
            {isAdmin && (
              <div className="px-4 pt-4 border-t mt-4">
                <Link href="/admin/properties">
                  <Button
                    variant="outline"
                    className="w-full gap-2"
                    onClick={() => setMobileOpen(false)}
                  >
                    <Settings className="h-4 w-4" />
                    Manage Properties
                  </Button>
                </Link>
              </div>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </>
  );
}

interface PropertyItemProps {
  property: {
    id: string;
    name: string;
    location?: string;
    status?: string;
    active?: boolean;
  };
  isSelected: boolean;
  isPinned: boolean;
  onSelect: () => void;
  onTogglePin: () => void;
}

function PropertyItem({
  property,
  isSelected,
  isPinned,
  onSelect,
  onTogglePin,
}: PropertyItemProps) {
  return (
    <div
      className={cn(
        "group flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all",
        isSelected ? "bg-primary/10" : "hover:bg-slate-100"
      )}
      onClick={onSelect}
      data-testid={`property-item-${property.id}`}
    >
      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Building2 className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate text-sm">{property.name}</p>
        {property.location && (
          <p className="text-xs text-muted-foreground truncate">{property.location}</p>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {property.status && (
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] px-1.5 py-0",
              property.active !== false
                ? "border-green-200 bg-green-50 text-green-700"
                : "border-slate-200 bg-slate-50 text-slate-500"
            )}
          >
            {property.active !== false ? "Active" : "Draft"}
          </Badge>
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onTogglePin();
          }}
          className={cn(
            "p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity",
            isPinned ? "opacity-100 text-amber-500" : "text-muted-foreground hover:text-foreground"
          )}
          data-testid={`pin-property-${property.id}`}
        >
          <Pin className={cn("h-3.5 w-3.5", isPinned && "fill-current")} />
        </button>
        {isSelected && (
          <Check className="h-4 w-4 text-primary" />
        )}
      </div>
    </div>
  );
}
