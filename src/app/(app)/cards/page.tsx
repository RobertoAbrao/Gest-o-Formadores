'use client';

import { Calendar, Clock, MapPin } from "lucide-react";
import Image from "next/image";

const CardDivulgacao = () => {
  return (
    <div className="bg-gray-800 w-full max-w-sm rounded-2xl overflow-hidden shadow-2xl font-sans">
      <div className="relative">
        {/* Cabeçalho Roxo */}
        <div className="absolute top-0 left-0 right-0 p-4 bg-[#4f46e5] text-white z-10 rounded-t-2xl">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-xl font-bold uppercase tracking-wider">Implantação</h1>
              <h2 className="text-lg font-semibold uppercase">Coordenadores</h2>
              <p className="text-md uppercase">Luís Eduardo Magalhães</p>
            </div>
            <div className="bg-white text-green-700 p-1 rounded-md text-xs font-bold flex flex-col items-center justify-center">
              <span className="font-extrabold text-sm">SABE</span>
              <span className="text-blue-600 font-bold -mt-1">BRASIL</span>
            </div>
          </div>
        </div>

        {/* Imagem de Fundo */}
        <Image
          src="https://picsum.photos/seed/teacher/600/800"
          alt="Professora ajudando aluno"
          width={600}
          height={800}
          className="w-full h-auto object-cover"
          data-ai-hint="teacher student"
        />

        {/* Overlay Escuro */}
        <div className="absolute inset-0 bg-black bg-opacity-40"></div>

        {/* Conteúdo Principal */}
        <div className="absolute inset-0 z-20 flex flex-col justify-end text-white p-6 pt-32">
          {/* Curva no Topo */}
          <div className="absolute top-32 left-0 right-0 h-24 bg-gradient-to-t from-gray-900/50 to-transparent rounded-t-full"></div>
          
          <div className="relative z-10 bg-gray-900/50 backdrop-blur-sm p-6 rounded-2xl -mx-2">
            <h3 className="text-4xl font-bold text-center mb-6">18/02/2025</h3>
            
            <div className="space-y-6">
              {/* Item do Agenda 1 */}
              <div className="flex items-start gap-4">
                <p className="font-semibold text-lg w-20">10:00h</p>
                <div className="flex-1">
                  <h4 className="font-bold text-lg">COORDENADORES ANOS INICIAIS</h4>
                  <a href="#" className="text-yellow-400 hover:text-yellow-300 transition-colors text-sm underline">
                    Sala 1 - COORDENADORES ANOS INICIAIS
                  </a>
                </div>
              </div>

              {/* Item do Agenda 2 */}
              <div className="flex items-start gap-4">
                <p className="font-semibold text-lg w-20">14:00h</p>
                <div className="flex-1">
                  <h4 className="font-bold text-lg">COORDENADORES ANOS FINAIS</h4>
                  <a href="#" className="text-yellow-400 hover:text-yellow-300 transition-colors text-sm underline">
                    Sala 2 - COORDENADORES ANOS FINAIS
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


export default function CardsPage() {
  return (
    <div className="flex flex-col gap-4 py-6 h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight font-headline">Cards de Divulgação</h1>
          <p className="text-muted-foreground">
            Use este modelo para criar os cards para as formações.
          </p>
        </div>
      </div>
      <div className="flex flex-col items-center justify-center pt-8">
        <CardDivulgacao />
      </div>
    </div>
  );
}
