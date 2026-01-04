import React, { useRef, useEffect, useState } from 'react';
import { useJsApiLoader } from '@react-google-maps/api';
import { Input } from './ui/input';
import { MapPin } from 'lucide-react';

// Use same libraries as LogisticsPage to avoid conflicts
const libraries = ['places', 'geometry'];
const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

export const AddressAutocomplete = ({ 
  value, 
  onChange, 
  placeholder = "Wpisz adres...",
  className = "",
  disabled = false 
}) => {
  const inputRef = useRef(null);
  const autocompleteRef = useRef(null);
  const [inputValue, setInputValue] = useState(value || '');
  const [mapsLoaded, setMapsLoaded] = useState(false);

  // Check if Google Maps is already loaded (by parent component)
  useEffect(() => {
    if (window.google && window.google.maps && window.google.maps.places) {
      setMapsLoaded(true);
    }
  }, []);

  // Only use loader if maps not already loaded
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries,
    // Skip loading if already available
    preventGoogleFontsLoading: true
  });

  // Combined loaded state
  const apiReady = mapsLoaded || isLoaded;

  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  useEffect(() => {
    if (!apiReady || !inputRef.current || autocompleteRef.current) return;
    if (!window.google || !window.google.maps || !window.google.maps.places) return;

    // Initialize Google Places Autocomplete
    autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
      types: ['address'],
      componentRestrictions: { country: ['pl', 'de', 'cz', 'sk', 'lt', 'lv', 'ee', 'ua', 'by'] }, // Poland and neighboring countries
      fields: ['formatted_address', 'geometry', 'address_components']
    });

    // Listen for place selection
    autocompleteRef.current.addListener('place_changed', () => {
      const place = autocompleteRef.current.getPlace();
      
      if (place && place.formatted_address) {
        setInputValue(place.formatted_address);
        onChange(place.formatted_address, {
          lat: place.geometry?.location?.lat(),
          lng: place.geometry?.location?.lng(),
          components: place.address_components
        });
      }
    });

    return () => {
      if (autocompleteRef.current && window.google?.maps?.event) {
        window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
      }
    };
  }, [apiReady, onChange]);

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    // Only call onChange for manual input (without coordinates)
    onChange(newValue, null);
  };

  if (!GOOGLE_MAPS_API_KEY) {
    // Fallback to regular input if no API key
    return (
      <Input
        value={inputValue}
        onChange={handleInputChange}
        placeholder={placeholder}
        className={className}
        disabled={disabled}
      />
    );
  }

  return (
    <div className="relative">
      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">
        <MapPin className="h-4 w-4" />
      </div>
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        placeholder={placeholder}
        disabled={disabled || !apiReady}
        className={`flex h-10 w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
        autoComplete="off"
      />
    </div>
  );
};

export default AddressAutocomplete;
