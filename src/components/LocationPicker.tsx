import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MapPin, Search, Loader2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet default marker icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

interface LocationPickerProps {
  address: string;
  latitude: number | null;
  longitude: number | null;
  locationName: string;
  onUpdate: (data: {
    business_address: string;
    business_latitude: number | null;
    business_longitude: number | null;
    business_location_name: string;
  }) => void;
}

function DraggableMarker({
  position,
  onPositionChange,
}: {
  position: [number, number];
  onPositionChange: (lat: number, lng: number) => void;
}) {
  const markerRef = useRef<L.Marker>(null);

  const eventHandlers = {
    dragend() {
      const marker = markerRef.current;
      if (marker) {
        const pos = marker.getLatLng();
        onPositionChange(pos.lat, pos.lng);
      }
    },
  };

  return (
    <Marker
      draggable
      eventHandlers={eventHandlers}
      position={position}
      ref={markerRef}
    />
  );
}

function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 16);
  }, [center, map]);
  return null;
}

export function LocationPicker({
  address,
  latitude,
  longitude,
  locationName,
  onUpdate,
}: LocationPickerProps) {
  const [searchAddress, setSearchAddress] = useState(address || "");
  const [localName, setLocalName] = useState(locationName || "");
  const [searching, setSearching] = useState(false);
  const [mapPosition, setMapPosition] = useState<[number, number] | null>(
    latitude && longitude ? [latitude, longitude] : null
  );
  const [confirmed, setConfirmed] = useState(!!(latitude && longitude));

  useEffect(() => {
    setSearchAddress(address || "");
    setLocalName(locationName || "");
    if (latitude && longitude) {
      setMapPosition([latitude, longitude]);
      setConfirmed(true);
    }
  }, [address, latitude, longitude, locationName]);

  const handleSearch = async () => {
    if (!searchAddress.trim()) {
      toast.error("Digite um endereço para buscar.");
      return;
    }
    setSearching(true);
    setConfirmed(false);

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchAddress)}&limit=1&countrycodes=br`,
        { headers: { "User-Agent": "TheoIA/1.0" } }
      );
      const data = await res.json();
      if (data.length === 0) {
        toast.error("Endereço não encontrado. Tente ser mais específico.");
        return;
      }
      const lat = parseFloat(data[0].lat);
      const lon = parseFloat(data[0].lon);
      setMapPosition([lat, lon]);
      if (!localName.trim()) {
        setLocalName(data[0].display_name?.split(",")[0] || "");
      }
    } catch {
      toast.error("Erro ao buscar endereço. Tente novamente.");
    } finally {
      setSearching(false);
    }
  };

  const handleMarkerDrag = (lat: number, lng: number) => {
    setMapPosition([lat, lng]);
    setConfirmed(false);
  };

  const handleConfirm = () => {
    if (!mapPosition) return;
    setConfirmed(true);
    onUpdate({
      business_address: searchAddress,
      business_latitude: mapPosition[0],
      business_longitude: mapPosition[1],
      business_location_name: localName,
    });
    toast.success("Localização confirmada!");
  };

  const handleClear = () => {
    setMapPosition(null);
    setSearchAddress("");
    setLocalName("");
    setConfirmed(false);
    onUpdate({
      business_address: "",
      business_latitude: null,
      business_longitude: null,
      business_location_name: "",
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-primary" />
          Localização do Negócio
        </CardTitle>
        <CardDescription>
          Configure o endereço para a IA enviar a localização no WhatsApp quando o cliente perguntar
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="location_name">Nome do Local</Label>
          <Input
            id="location_name"
            value={localName}
            onChange={(e) => {
              setLocalName(e.target.value);
              setConfirmed(false);
            }}
            placeholder="Ex: Academia FitPro, Clínica Bem Estar..."
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="business_address">Endereço Completo</Label>
          <div className="flex gap-2">
            <Input
              id="business_address"
              value={searchAddress}
              onChange={(e) => {
                setSearchAddress(e.target.value);
                setConfirmed(false);
              }}
              placeholder="Rua, número, bairro, cidade, estado..."
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleSearch())}
            />
            <Button onClick={handleSearch} disabled={searching} variant="secondary">
              {searching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>

        {mapPosition && (
          <>
            <div className="rounded-lg overflow-hidden border" style={{ height: 300 }}>
              <MapContainer
                center={mapPosition}
                zoom={16}
                style={{ height: "100%", width: "100%" }}
                scrollWheelZoom
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <DraggableMarker
                  position={mapPosition}
                  onPositionChange={handleMarkerDrag}
                />
                <MapUpdater center={mapPosition} />
              </MapContainer>
            </div>

            <p className="text-xs text-muted-foreground">
              📍 Arraste o marcador para ajustar a posição exata. Coordenadas: {mapPosition[0].toFixed(6)}, {mapPosition[1].toFixed(6)}
            </p>

            <div className="flex gap-2">
              <Button
                onClick={handleConfirm}
                disabled={confirmed}
                className="flex-1"
              >
                {confirmed ? (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Localização Confirmada
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Confirmar Localização
                  </>
                )}
              </Button>
              <Button variant="outline" onClick={handleClear}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </>
        )}

        {!mapPosition && (
          <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
            <MapPin className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Digite o endereço acima e clique em buscar para visualizar no mapa</p>
          </div>
        )}

        {confirmed && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
            <p className="font-medium text-primary">✅ Localização configurada</p>
            <p className="text-muted-foreground mt-1">
              Quando um cliente perguntar "onde fica?", "qual o endereço?" ou "como chego aí?", a IA enviará automaticamente a localização como um pin clicável no WhatsApp.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
