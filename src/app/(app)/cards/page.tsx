
'use client';

import { Loader2, Download, PlusCircle, Trash2 } from "lucide-react";
import Image from "next/image";
import { useState, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

// Tipos para a nova estrutura
interface Activity {
  id: string;
  time: string;
  description: string;
}

interface Event {
  id: string;
  date: string;
  activities: Activity[];
}

interface Location {
  id: string;
  name: string;
  address: string;
  events: Event[];
}

interface CardData {
  mainTitle: string;
  backgroundImage: string;
  locations: Location[];
}


const CardDivulgacao = ({ data, cardRef }: { data: CardData, cardRef: React.RefObject<HTMLDivElement> }) => {
  return (
    <div className="w-[380px] bg-gray-800 rounded-2xl overflow-hidden shadow-2xl font-sans relative" ref={cardRef}>
      <Image
        src={data.backgroundImage || "/vista-da-sala-de-aula-da-escola.jpg"}
        alt="Imagem de fundo do evento"
        fill
        className="object-cover"
        key={data.backgroundImage}
      />
      <div className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm"></div>

      <div className="relative z-10 p-4 text-white space-y-4">
        <header className="flex justify-between items-start text-white bg-[#4f46e5]/50 p-3 rounded-xl">
            <h1 className="text-3xl font-bold uppercase tracking-wider">{data.mainTitle}</h1>
             <img
                src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAyCAYAAAAeP4ixAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAJDSURBVHgB7Zq9iZNAFMb/PY4JbWJjp2BlFCxCxV7BShCwsxYstBAsbC28QUJpI0SwsBEstLSwECy0sFFs/DVY2Ak2FrGxj7Xy5z83i7L3bneTyZCEH/gB9+Hde5vACfBIkSmJg3lgGhgA+gH9gG1Gg8W+Wj5cAl8D8h3wLlgDNoAFYOe+72sDcNk82IiswQ1wAewCB+Bt4B8IFUfA3T6sK+D1gQqNAd4G3gGfR8gD0BVgGjgDToA/I0xARvA6UB+8wJ55D4hXwIAD4EHgd+D1eI6L82L/vAi8DrwtQA4AV4GvgfM+aY2+A3wGvBFgP6uVB5YAK4A74I6I+gq4AbgGrsGv46wBfB20yA9TAbgT6p8VyrwD3C+bWk+GzxnPAvPgbC//hGuA5sB8bGyJ+BeY6/gD3gf2S1L0o3z8Kfl/S0Do8QBwFmgB/itwnaw3yT6uS4k2/aF8MhM/x8P4E/gLPA3sU1i3k5wF5P7EAFsEyUeAD0Y29D6u8R/t8PPgnM6GOUA2DTB/sIuY0j+7m2qY9m+AfYF5/B/gKHA44G0s9z0FvE1sL6mK2AFuBbwHLE0V40wD1gCLgI9SvyR4r/p8A3wFzG2iSwnA5+BpwHj0bY/gCf/3A8d9yWwDOgD53M02r0LPAW0fRso0p8C/wEvy4p3gJ3gI2AHeAMsA0MgA+oAJ+L1hM3jATgC7gNHv3+b6/gM8L6e7WJvG/g58A3wefA54L1BngA7AA/A9c45/gL3AduBw6AfeAn8LzO1WwB/gN+0xXgJ3AD3AEPh2I/B3wX2H++1t0+x3t1ALZ/F/i9wAswAZwEnoAKvAdy4A4wBnwM9AET4B3gY6/D9wGvgL5AATgChhA6LgX+L5F+DjwA/BfAXwJ/BfAGuBVwDfgS8C7gG8D8w14Hfgg4w/gq/E8MAB8AkwA24BvwG3gN+A34BvwPPAX8G3gTeA3YNm+73/a/wMfyX5L2Qe+HwAAAABJRU5ErkJggg=="
                alt="SABE Brasil Logo"
                width={50}
                height={50}
                className="shrink-0"
              />
        </header>

        <div className="space-y-4">
          {data.locations.map(location => (
            <div key={location.id} className="bg-green-700/80 p-4 rounded-xl">
              <div className="flex items-start gap-2 mb-3">
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="h-6 w-6 text-white shrink-0 mt-1"
                >
                    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                    <circle cx="12" cy="10" r="3" />
                </svg>
                <div>
                  <h3 className="font-bold text-lg">{location.name}</h3>
                  <p className="text-xs text-green-100">{location.address}</p>
                </div>
              </div>

              {location.events.map(event => (
                <div key={event.id} className="flex gap-4 items-start mt-2">
                    <div className="bg-blue-900/80 text-white rounded-lg p-2 text-center shrink-0">
                        <p className="font-bold text-md leading-tight">{event.date}</p>
                    </div>
                    <div className="w-full space-y-2">
                        {event.activities.map(activity => (
                             <div key={activity.id} className="flex gap-2 items-center text-sm w-full">
                                <div className="bg-blue-900/80 text-white rounded-lg px-2 py-1 shrink-0">
                                    <p>{activity.time}</p>
                                </div>
                                <div className="bg-white text-blue-900 rounded-lg px-3 py-1 font-semibold w-full text-center min-w-0">
                                    <p className="break-words">{activity.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};


export default function CardsPage() {
    const [cardData, setCardData] = useState<CardData>({
        mainTitle: 'DEVOLUTIVA SABE BRASIL',
        backgroundImage: 'https://picsum.photos/seed/1/600/800',
        locations: [
            {
                id: 'loc1',
                name: 'EM Pedro Paulo Corte Filho',
                address: 'Av. Salvador, Cidade Universitária, 221 - Jardim Universitário, LEM',
                events: [
                    {
                        id: 'evt1',
                        date: '20/10',
                        activities: [
                            { id: 'act1', time: '07h30-11h30', description: '1º ANO' }
                        ]
                    },
                    {
                        id: 'evt2',
                        date: '21/10',
                        activities: [
                            { id: 'act2', time: '07h30-11h30', description: '2º ANO' },
                            { id: 'act3', time: '13h30-17h30', description: 'ANOS INICIA MATEMÁTICA' }
                        ]
                    }
                ]
            },
            {
                id: 'loc2',
                name: 'EM Irani Leite Matutino Santos',
                address: 'R. Sr. do Bonfim, 2755 - Lote. Mimoso Do Oeste I, LEM',
                events: [
                     {
                        id: 'evt3',
                        date: '21/10',
                        activities: [
                            { id: 'act4', time: '07h30-11h30', description: 'ANOS FINAIS LÍNGUA PORTUGUESA' },
                            { id: 'act5', time: '13h30-17h30', description: 'ANOS FINAIS MATEMÁTICA' }
                        ]
                    }
                ]
            }
        ]
    });
    
    const cardRef = useRef<HTMLDivElement>(null);
    const [loadingPdf, setLoadingPdf] = useState(false);

    const handleSaveAsPdf = () => {
        if (!cardRef.current) return;
        setLoadingPdf(true);

        html2canvas(cardRef.current, { 
          useCORS: true,
          scale: 2 // Aumenta a resolução da imagem
        }).then((canvas) => {
            const imgData = canvas.toDataURL('image/png');
            const pdf = new jsPDF({
                orientation: 'portrait',
                unit: 'px',
                format: [canvas.width, canvas.height]
            });
            pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height);
            pdf.save('card-divulgacao.pdf');
            setLoadingPdf(false);
        });
    };

  const handleDataChange = (field: keyof CardData, value: string) => {
    setCardData(prev => ({ ...prev, [field]: value }));
  }
  
  // Handlers para Localizações
  const handleLocationChange = (locIndex: number, field: keyof Omit<Location, 'id' | 'events'>, value: string) => {
      const newLocations = [...cardData.locations];
      newLocations[locIndex][field] = value;
      setCardData(prev => ({ ...prev, locations: newLocations }));
  }
  const addLocation = () => {
      const newLocation: Location = { id: `loc${Date.now()}`, name: '', address: '', events: [] };
      setCardData(prev => ({ ...prev, locations: [...prev.locations, newLocation] }));
  }
  const removeLocation = (locIndex: number) => {
      const newLocations = cardData.locations.filter((_, index) => index !== locIndex);
      setCardData(prev => ({ ...prev, locations: newLocations }));
  }

  // Handlers para Eventos
  const handleEventChange = (locIndex: number, evtIndex: number, field: keyof Omit<Event, 'id' | 'activities'>, value: string) => {
      const newLocations = [...cardData.locations];
      newLocations[locIndex].events[evtIndex][field] = value;
      setCardData(prev => ({ ...prev, locations: newLocations }));
  }
  const addEvent = (locIndex: number) => {
      const newEvent: Event = { id: `evt${Date.now()}`, date: '', activities: [] };
      const newLocations = [...cardData.locations];
      newLocations[locIndex].events.push(newEvent);
      setCardData(prev => ({ ...prev, locations: newLocations }));
  }
  const removeEvent = (locIndex: number, evtIndex: number) => {
      const newLocations = [...cardData.locations];
      newLocations[locIndex].events = newLocations[locIndex].events.filter((_, index) => index !== evtIndex);
      setCardData(prev => ({ ...prev, locations: newLocations }));
  }

  // Handlers para Atividades
  const handleActivityChange = (locIndex: number, evtIndex: number, actIndex: number, field: keyof Omit<Activity, 'id'>, value: string) => {
      const newLocations = [...cardData.locations];
      newLocations[locIndex].events[evtIndex].activities[actIndex][field] = value;
      setCardData(prev => ({ ...prev, locations: newLocations }));
  }
  const addActivity = (locIndex: number, evtIndex: number) => {
      const newActivity: Activity = { id: `act${Date.now()}`, time: '', description: '' };
      const newLocations = [...cardData.locations];
      newLocations[locIndex].events[evtIndex].activities.push(newActivity);
      setCardData(prev => ({ ...prev, locations: newLocations }));
  }
  const removeActivity = (locIndex: number, evtIndex: number, actIndex: number) => {
      const newLocations = [...cardData.locations];
      newLocations[locIndex].events[evtIndex].activities = newLocations[locIndex].events[evtIndex].activities.filter((_, index) => index !== actIndex);
      setCardData(prev => ({ ...prev, locations: newLocations }));
  }

  return (
    <div className="flex flex-col gap-4 py-6 h-full">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight font-headline">Cards de Divulgação</h1>
            <p className="text-muted-foreground">
              Crie cards de divulgação dinâmicos para suas formações.
            </p>
          </div>
           <Button onClick={handleSaveAsPdf} disabled={loadingPdf}>
              {loadingPdf ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
              Salvar como PDF
          </Button>
        </div>
      <div className="grid md:grid-cols-2 gap-8 items-start">
        <Card>
          <CardHeader>
            <CardTitle>Editor de Informações</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="mainTitle">Título Principal</Label>
              <Input id="mainTitle" value={cardData.mainTitle} onChange={(e) => handleDataChange('mainTitle', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="backgroundImage">URL da Imagem de Fundo</Label>
              <Input id="backgroundImage" value={cardData.backgroundImage} onChange={(e) => handleDataChange('backgroundImage', e.target.value)} />
            </div>

            <Separator />

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold text-lg">Locais</h3>
                <Button variant="outline" size="sm" onClick={addLocation}>
                  <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Local
                </Button>
              </div>

              {cardData.locations.map((location, locIndex) => (
                <Card key={location.id} className="bg-muted/50 p-4">
                   <div className="flex justify-end mb-2">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeLocation(locIndex)}>
                          <Trash2 className="h-4 w-4" />
                      </Button>
                   </div>
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label htmlFor={`loc-name-${locIndex}`}>Nome do Local</Label>
                      <Input id={`loc-name-${locIndex}`} value={location.name} onChange={e => handleLocationChange(locIndex, 'name', e.target.value)} />
                    </div>
                     <div className="space-y-2">
                      <Label htmlFor={`loc-addr-${locIndex}`}>Endereço</Label>
                      <Input id={`loc-addr-${locIndex}`} value={location.address} onChange={e => handleLocationChange(locIndex, 'address', e.target.value)} />
                    </div>
                  </div>

                  <div className="space-y-4 mt-4 pt-4 border-t">
                      <div className="flex justify-between items-center">
                        <h4 className="font-medium">Eventos do Local</h4>
                         <Button variant="outline" size="sm" onClick={() => addEvent(locIndex)}>
                            <PlusCircle className="mr-2 h-4 w-4" /> Adicionar Evento
                        </Button>
                      </div>

                      {location.events.map((event, evtIndex) => (
                        <Card key={event.id} className="p-3 bg-background">
                            <div className="flex justify-end mb-2">
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeEvent(locIndex, evtIndex)}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                           <div className="space-y-2">
                                <Label htmlFor={`evt-date-${locIndex}-${evtIndex}`}>Data</Label>
                                <Input id={`evt-date-${locIndex}-${evtIndex}`} value={event.date} onChange={e => handleEventChange(locIndex, evtIndex, 'date', e.target.value)} />
                            </div>

                           <div className="space-y-3 mt-3 pt-3 border-t">
                                <div className="flex justify-between items-center">
                                    <h5 className="font-medium text-sm">Atividades do Dia</h5>
                                    <Button variant="outline" size="xs" onClick={() => addActivity(locIndex, evtIndex)}>
                                        <PlusCircle className="mr-1 h-3 w-3" /> Adicionar
                                    </Button>
                                </div>

                                {event.activities.map((activity, actIndex) => (
                                    <div key={activity.id} className="p-2 border rounded-md bg-muted/30 space-y-2 relative">
                                         <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-6 w-6 text-destructive" onClick={() => removeActivity(locIndex, evtIndex, actIndex)}>
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                        <div className="grid grid-cols-2 gap-2">
                                             <div>
                                                <Label htmlFor={`act-time-${locIndex}-${evtIndex}-${actIndex}`}>Horário</Label>
                                                <Input id={`act-time-${locIndex}-${evtIndex}-${actIndex}`} value={activity.time} onChange={e => handleActivityChange(locIndex, evtIndex, actIndex, 'time', e.target.value)} />
                                             </div>
                                              <div>
                                                <Label htmlFor={`act-desc-${locIndex}-${evtIndex}-${actIndex}`}>Descrição</Label>
                                                <Input id={`act-desc-${locIndex}-${evtIndex}-${actIndex}`} value={activity.description} onChange={e => handleActivityChange(locIndex, evtIndex, actIndex, 'description', e.target.value)} />
                                             </div>
                                        </div>
                                    </div>
                                ))}
                           </div>
                        </Card>
                      ))}
                  </div>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
        <div className="flex flex-col items-center justify-start pt-8">
          <CardDivulgacao data={cardData} cardRef={cardRef} />
        </div>
      </div>
    </div>
  );
}
