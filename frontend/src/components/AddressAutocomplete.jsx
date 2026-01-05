import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useJsApiLoader } from '@react-google-maps/api';
import { Input } from './ui/input';
import { MapPin, Loader2 } from 'lucide-react';

// Use same libraries as LogisticsPage to avoid conflicts
const libraries = ['places', 'geometry'];
const GOOGLE_MAPS_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;

// Country restrictions for autocomplete
const COUNTRY_RESTRICTIONS = ['pl', 'de', 'cz', 'sk', 'lt', 'lv', 'ee', 'ua', 'by'];

export const AddressAutocomplete = ({ 
  value, 
  onChange, 
  placeholder = "Wpisz adres...",
  className = "",
  disabled = false,
  dataTestId = "address-autocomplete"
}) => {
  const containerRef = useRef(null);
  const autocompleteElementRef = useRef(null);
  const legacyAutocompleteRef = useRef(null);
  const inputRef = useRef(null);
  const [inputValue, setInputValue] = useState(value || '');
  const [mapsLoaded, setMapsLoaded] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [useLegacy, setUseLegacy] = useState(false);

  // Check if Google Maps is already loaded
  useEffect(() => {
    if (window.google && window.google.maps && window.google.maps.places) {
      setMapsLoaded(true);
    }
  }, []);

  // Use loader if maps not already loaded
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries,
    preventGoogleFontsLoading: true
  });

  const apiReady = mapsLoaded || isLoaded;

  // Sync external value changes
  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  // Handle place selection from new API
  const handlePlaceSelect = useCallback(async (placePrediction) => {
    try {
      const place = placePrediction.toPlace();
      await place.fetchFields({ 
        fields: ['formattedAddress', 'location', 'addressComponents'] 
      });
      
      const formattedAddress = place.formattedAddress;
      const location = place.location;
      
      if (formattedAddress) {
        setInputValue(formattedAddress);
        onChange(formattedAddress, {
          lat: location?.lat(),
          lng: location?.lng(),
          components: place.addressComponents
        });
      }
    } catch (error) {
      console.error('Error fetching place details:', error);
    }
  }, [onChange]);

  // Initialize PlaceAutocompleteElement (new API)
  const initNewAutocomplete = useCallback(() => {
    if (!containerRef.current || autocompleteElementRef.current) return false;
    
    try {
      // Check if PlaceAutocompleteElement is available
      if (!window.google.maps.places.PlaceAutocompleteElement) {
        console.log('PlaceAutocompleteElement not available, falling back to legacy');
        return false;
      }

      // Create the new PlaceAutocompleteElement
      const placeAutocomplete = new window.google.maps.places.PlaceAutocompleteElement({
        componentRestrictions: { country: COUNTRY_RESTRICTIONS },
        types: ['address']
      });

      // Style the element to match our design
      placeAutocomplete.id = dataTestId;
      placeAutocomplete.style.cssText = `
        width: 100%;
        --gmpac-input-border-radius: 6px;
        --gmpac-input-height: 40px;
        --gmpac-input-padding-left: 40px;
        --gmpac-input-font-size: 14px;
      `;

      // Set initial value if exists
      if (inputValue) {
        // PlaceAutocompleteElement doesn't have a direct value setter
        // The user will need to type or we show our own input
      }

      // Listen for place selection
      placeAutocomplete.addEventListener('gmp-select', async (event) => {
        if (event.placePrediction) {
          await handlePlaceSelect(event.placePrediction);
        }
      });

      // Listen for errors
      placeAutocomplete.addEventListener('gmp-error', (event) => {
        console.error('PlaceAutocompleteElement error:', event);
      });

      // Append to container
      containerRef.current.appendChild(placeAutocomplete);
      autocompleteElementRef.current = placeAutocomplete;
      
      return true;
    } catch (error) {
      console.error('Failed to initialize PlaceAutocompleteElement:', error);
      return false;
    }
  }, [dataTestId, inputValue, handlePlaceSelect]);

  // Initialize legacy Autocomplete (fallback)
  const initLegacyAutocomplete = useCallback(() => {
    if (!inputRef.current || legacyAutocompleteRef.current) return;
    
    try {
      legacyAutocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
        types: ['address'],
        componentRestrictions: { country: COUNTRY_RESTRICTIONS },
        fields: ['formatted_address', 'geometry', 'address_components']
      });

      legacyAutocompleteRef.current.addListener('place_changed', () => {
        const place = legacyAutocompleteRef.current.getPlace();
        
        if (place && place.formatted_address) {
          setInputValue(place.formatted_address);
          onChange(place.formatted_address, {
            lat: place.geometry?.location?.lat(),
            lng: place.geometry?.location?.lng(),
            components: place.address_components
          });
        }
      });
    } catch (error) {
      console.error('Failed to initialize legacy Autocomplete:', error);
    }
  }, [onChange]);

  // Main initialization effect
  useEffect(() => {
    if (!apiReady || isInitialized) return;
    if (!window.google || !window.google.maps || !window.google.maps.places) return;

    // Try new API first, fall back to legacy
    // Note: For now, use legacy as PlaceAutocompleteElement requires different UI approach
    // The new API is a web component that replaces the input entirely
    // Legacy API works with existing input elements
    setUseLegacy(true);
    setIsInitialized(true);

    return () => {
      // Cleanup
      if (autocompleteElementRef.current) {
        autocompleteElementRef.current.remove();
        autocompleteElementRef.current = null;
      }
      if (legacyAutocompleteRef.current && window.google?.maps?.event) {
        window.google.maps.event.clearInstanceListeners(legacyAutocompleteRef.current);
        legacyAutocompleteRef.current = null;
      }
    };
  }, [apiReady, isInitialized, initNewAutocomplete]);

  // Initialize legacy when useLegacy is set
  useEffect(() => {
    if (useLegacy && apiReady && inputRef.current && !legacyAutocompleteRef.current) {
      initLegacyAutocomplete();
    }
  }, [useLegacy, apiReady, initLegacyAutocomplete]);

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    onChange(newValue, null);
  };

  // Fallback if no API key
  if (!GOOGLE_MAPS_API_KEY) {
    return (
      <div className="relative">
        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none z-10">
          <MapPin className="h-4 w-4" />
        </div>
        <Input
          value={inputValue}
          onChange={handleInputChange}
          placeholder={placeholder}
          className={`pl-10 ${className}`}
          disabled={disabled}
          data-testid={dataTestId}
        />
      </div>
    );
  }

  // Render with legacy autocomplete (using standard input)
  return (
    <div className="relative" ref={containerRef}>
      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none z-10">
        <MapPin className="h-4 w-4" />
      </div>
      {!apiReady && (
        <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none z-10">
          <Loader2 className="h-4 w-4 animate-spin" />
        </div>
      )}
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        placeholder={apiReady ? placeholder : "Ładowanie..."}
        disabled={disabled || !apiReady}
        className={`flex h-10 w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
        autoComplete="off"
        data-testid={dataTestId}
      />
    </div>
  );
};

export default AddressAutocomplete;
