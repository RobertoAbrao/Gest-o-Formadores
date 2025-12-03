'use client';

import { Calendar, Clock, MapPin, Image as ImageIcon, PlusCircle, Trash2 } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

interface AgendaItem {
  id: number;
  hora: string;
  titulo: string;
  sala: string;
}

const CardDivulgacao = ({
  titulo,
  subtitulo,
  municipio,
  data,
  agenda,
  imagemFundo,
}: {
  titulo: string;
  subtitulo: string;
  municipio: string;
  data: string;
  agenda: Omit<AgendaItem, 'id'>[];
  imagemFundo: string;
}) => {
  return (
    <div className="bg-gray-800 w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl font-sans">
      <div className="relative">
        <div className="absolute top-0 left-0 right-0 p-4 bg-[#4f46e5] text-white z-10 rounded-t-2xl">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-xl font-bold uppercase tracking-wider">{titulo}</h1>
              <h2 className="text-lg font-semibold uppercase">{subtitulo}</h2>
              <p className="text-md uppercase">{municipio}</p>
            </div>
            <div className="bg-white text-green-700 p-1 rounded-md text-xs font-bold flex flex-col items-center justify-center">
              <span className="font-extrabold text-sm">SABE</span>
              <span className="text-blue-600 font-bold -mt-1">BRASIL</span>
            </div>
          </div>
        </div>

        <Image
          src={imagemFundo || "/vista-da-sala-de-aula-da-escola.JPG"}
          alt="Imagem de fundo do evento"
          width={600}
          height={800}
          className="w-full h-auto object-cover"
          key={imagemFundo} 
        />

        <div className="absolute inset-0 bg-black bg-opacity-40"></div>

        <div className="absolute inset-0 z-20 flex flex-col justify-end text-white p-6 pt-32">
          <div className="absolute top-32 left-0 right-0 h-24 bg-gradient-to-t from-gray-900/50 to-transparent rounded-t-full"></div>
          
          <div className="relative z-10 bg-gray-900/50 backdrop-blur-sm p-6 rounded-2xl -mx-2">
            <h3 className="text-4xl font-bold text-center mb-6">{data}</h3>
            
            <div className="space-y-6">
              {agenda.map((item, index) => (
                <div key={index} className="flex items-start gap-4">
                  <p className="font-semibold text-lg w-20">{item.hora}</p>
                  <div className="flex-1">
                    <h4 className="font-bold text-lg">{item.titulo}</h4>
                    <a href="#" className="text-yellow-400 hover:text-yellow-300 transition-colors text-sm underline">
                      {item.sala}
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


export default function CardsPage() {
  const [titulo, setTitulo] = useState('Implantação');
  const [subtitulo, setSubtitulo] = useState('Coordenadores');
  const [municipio, setMunicipio] = useState('Luís Eduardo Magalhães');
  const [data, setData] = useState('18/02/2025');
  const [imagemFundo, setImagemFundo] = useState('/vista-da-sala-de-aula-da-escola.JPG');
  const [agenda, setAgenda] = useState<AgendaItem[]>([
    { id: 1, hora: '10:00h', titulo: 'COORDENADORES ANOS INICIAIS', sala: 'Sala 1 - COORDENADORES ANOS INICIAIS' },
    { id: 2, hora: '14:00h', titulo: 'COORDENADORES ANOS FINAIS', sala: 'Sala 2 - COORDENADORES ANOS FINAIS' },
  ]);

  const handleAgendaChange = (index: number, field: keyof Omit<AgendaItem, 'id'>, value: string) => {
    const newAgenda = [...agenda];
    newAgenda[index][field] = value;
    setAgenda(newAgenda);
  }

  const addAgendaItem = () => {
    setAgenda([...agenda, { id: Date.now(), hora: '', titulo: '', sala: '' }]);
  };

  const removeAgendaItem = (id: number) => {
    setAgenda(agenda.filter(item => item.id !== id));
  };


  return (
    <div className="flex flex-col gap-4 py-6 h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-headline">Cards de Divulgação</h1>
          <p className="text-muted-foreground">
            Preencha as informações para gerar seu card de divulgação.
          </p>
        </div>
      </div>
      <div className="grid md:grid-cols-2 gap-8 items-start">
        <Card>
          <CardHeader>
            <CardTitle>Editor de Informações</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="titulo">Título Principal</Label>
              <Input id="titulo" value={titulo} onChange={(e) => setTitulo(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subtitulo">Subtítulo</Label>
              <Input id="subtitulo" value={subtitulo} onChange={(e) => setSubtitulo(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="municipio">Município</Label>
              <Input id="municipio" value={municipio} onChange={(e) => setMunicipio(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="data">Data</Label>
              <Input id="data" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="imagemFundo">URL da Imagem de Fundo</Label>
              <div className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-muted-foreground" />
                <Input id="imagemFundo" value={imagemFundo} onChange={(e) => setImagemFundo(e.target.value)} placeholder="https://exemplo.com/imagem.jpg"/>
              </div>
            </div>

            <div className="space-y-4 pt-4 border-t">
               <div className="flex justify-between items-center">
                  <h3 className="font-semibold">Agenda do Evento</h3>
                  <Button variant="outline" size="sm" onClick={addAgendaItem}>
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Adicionar Item
                  </Button>
              </div>
              {agenda.map((item, index) => (
                <div key={item.id} className="p-4 border rounded-lg space-y-3 bg-muted/50 relative">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 h-7 w-7 text-destructive"
                    onClick={() => removeAgendaItem(item.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <h4 className="font-medium text-sm">Item {index + 1}</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor={`hora-${index}`}>Hora</Label>
                      <Input id={`hora-${index}`} value={item.hora} onChange={(e) => handleAgendaChange(index, 'hora', e.target.value)} />
                    </div>
                     <div className="space-y-2">
                      <Label htmlFor={`titulo-agenda-${index}`}>Título da Atividade</Label>
                      <Input id={`titulo-agenda-${index}`} value={item.titulo} onChange={(e) => handleAgendaChange(index, 'titulo', e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`sala-${index}`}>Descrição/Sala</Label>
                    <Textarea id={`sala-${index}`} value={item.sala} onChange={(e) => handleAgendaChange(index, 'sala', e.target.value)} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
        <div className="flex flex-col items-center justify-start pt-8">
          <CardDivulgacao 
            titulo={titulo}
            subtitulo={subtitulo}
            municipio={municipio}
            data={data}
            agenda={agenda}
            imagemFundo={imagemFundo}
          />
        </div>
      </div>
    </div>
  );
}
