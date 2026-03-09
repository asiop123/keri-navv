import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, Save } from 'lucide-react';
import { toast } from 'sonner';

export default function AddVehicle() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    regNr: '', brand: '', model: '', lengthM: '', weightKg: '',
    maxLoadKg: '', axleWeightKg: '', nextInspectionDate: '', taxDate: '',
    insuranceCompany: '', insuranceNumber: '', insuranceExpiry: '',
  });

  const update = (key: string, value: string) => setForm(f => ({ ...f, [key]: value }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success('Fordon tillagt! (mockdata – sparas ej)');
    navigate('/fordon');
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <Button variant="ghost" onClick={() => navigate('/fordon')} className="text-muted-foreground">
        <ArrowLeft className="h-4 w-4 mr-2" /> Tillbaka
      </Button>

      <h1 className="text-2xl font-bold">Lägg till fordon</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-lg">Grunduppgifter</CardTitle></CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-4">
            <Field label="Registreringsnummer" value={form.regNr} onChange={v => update('regNr', v)} placeholder="ABC 123" required />
            <Field label="Märke" value={form.brand} onChange={v => update('brand', v)} placeholder="Volvo" required />
            <Field label="Modell" value={form.model} onChange={v => update('model', v)} placeholder="FH16" required />
            <Field label="Längd (m)" value={form.lengthM} onChange={v => update('lengthM', v)} placeholder="18" type="number" required />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-lg">Vikt & last</CardTitle></CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-4">
            <Field label="Tjänstevikt (kg)" value={form.weightKg} onChange={v => update('weightKg', v)} placeholder="15000" type="number" required />
            <Field label="Maxlast (kg)" value={form.maxLoadKg} onChange={v => update('maxLoadKg', v)} placeholder="25000" type="number" required />
            <Field label="Axeltryck (kg)" value={form.axleWeightKg} onChange={v => update('axleWeightKg', v)} placeholder="10000" type="number" required />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-lg">Datum</CardTitle></CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-4">
            <Field label="Nästa besiktning" value={form.nextInspectionDate} onChange={v => update('nextInspectionDate', v)} type="date" required />
            <Field label="Skattedatum" value={form.taxDate} onChange={v => update('taxDate', v)} type="date" required />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-lg">Försäkring</CardTitle></CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-4">
            <Field label="Försäkringsbolag" value={form.insuranceCompany} onChange={v => update('insuranceCompany', v)} placeholder="IF Försäkring" required />
            <Field label="Försäkringsnummer" value={form.insuranceNumber} onChange={v => update('insuranceNumber', v)} placeholder="IF-2024-12345" />
            <Field label="Giltigt t.o.m." value={form.insuranceExpiry} onChange={v => update('insuranceExpiry', v)} type="date" required />
          </CardContent>
        </Card>

        <Button type="submit" size="lg" className="w-full bg-secondary text-secondary-foreground hover:bg-secondary/90 font-semibold h-12">
          <Save className="h-5 w-5 mr-2" /> Spara fordon
        </Button>
      </form>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = 'text', required = false }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; required?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}{required && ' *'}</Label>
      <Input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} required={required} />
    </div>
  );
}
