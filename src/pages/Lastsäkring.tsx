import { Card, CardContent } from '@/components/ui/card';
import { Weight } from 'lucide-react';

export default function Lastsäkring() {
  return (
    <div className="space-y-5 max-w-lg mx-auto pb-8">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Weight className="h-6 w-6 text-primary" />
          Lastsäkring
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Kalkylator för lastsäkring
        </p>
      </div>

      <Card>
        <CardContent className="p-8 text-center">
          <Weight className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            Lastsäkringskalkylatorn kommer snart
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
