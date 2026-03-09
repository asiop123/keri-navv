import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SavedTrip, deleteTrip } from '@/services/tripStorage';
import { Route, Trash2, Eye, Clock, MapPin } from 'lucide-react';
import { toast } from 'sonner';

interface TripHistoryProps {
  trips: SavedTrip[];
  onSelect: (trip: SavedTrip) => void;
  onDelete: (id: string) => void;
}

export default function TripHistory({ trips, onSelect, onDelete }: TripHistoryProps) {
  if (trips.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Route className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Inga sparade resor ännu.</p>
          <p className="text-xs text-muted-foreground">Beräkna en rutt och spara den för att se den här.</p>
        </CardContent>
      </Card>
    );
  }

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteTrip(id);
    onDelete(id);
    toast.success('Resa borttagen');
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.round((seconds % 3600) / 60);
    return `${h}h ${m}min`;
  };

  return (
    <div className="space-y-3">
      {trips.map(trip => (
        <Card
          key={trip.id}
          className="cursor-pointer hover:border-primary/40 transition-colors"
          onClick={() => onSelect(trip)}
        >
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary shrink-0" />
                  <span className="font-medium text-sm truncate">
                    {trip.startName} → {trip.waypointNames.length > 0 && trip.waypointNames.join(' → ') + ' → '}{trip.endName}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Route className="h-3 w-3" />
                    {trip.distanceKm} km
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatTime(trip.travelTimeSeconds)}
                  </span>
                  <span>{trip.vehicleLabel}</span>
                  <span>{(trip.totalWeightKg / 1000).toFixed(1)}t</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px]">
                    {trip.routeType === 'normal' ? 'Normal' : 'Snabbast'}
                  </Badge>
                  <span className="text-[10px] text-muted-foreground">
                    {new Date(trip.createdAt).toLocaleDateString('sv-SE')} {new Date(trip.createdAt).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onSelect(trip)}>
                  <Eye className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={(e) => handleDelete(trip.id, e)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
