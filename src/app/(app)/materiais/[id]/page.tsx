
'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { Material } from '@/lib/types';
import { Loader2, ArrowLeft, ExternalLink, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

type UrlInfo = {
    url: string;
    isFolder: boolean;
};

function getGoogleDriveUrlInfo(url: string): UrlInfo {
    // Regex para extrair o ID de uma pasta
    const folderRegex = /drive\.google\.com\/drive\/(?:u\/\d\/)?folders\/([a-zA-Z0-9_-]+)/;
    const folderMatch = url.match(folderRegex);

    if (folderMatch && folderMatch[1]) {
        // É uma pasta, retorna a URL de incorporação da pasta
        return {
            url: `https://drive.google.com/embeddedfolderview?id=${folderMatch[1]}`,
            isFolder: true,
        };
    }

    // Regex para extrair o ID de um arquivo
    const fileRegex = /drive\.google\.com\/(?:file\/d\/|open\?id=)([a-zA-Z0-9_-]+)/;
    const fileMatch = url.match(fileRegex);
    
    if (fileMatch && fileMatch[1]) {
        // É um arquivo, retorna a URL de preview
        return {
            url: `https://drive.google.com/file/d/${fileMatch[1]}/preview`,
            isFolder: false,
        };
    }
    
    // Se não for um link do Drive reconhecido, retorna o original assumindo que é um arquivo
    return {
        url: url,
        isFolder: false,
    };
}


export default function MaterialViewerPage() {
    const params = useParams();
    const materialId = params.id as string;
    const [material, setMaterial] = useState<Material | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!materialId) {
            setError('ID do material não encontrado.');
            setLoading(false);
            return;
        }
        const fetchMaterial = async () => {
            setLoading(true);
            try {
                const docRef = doc(db, 'materiais', materialId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    setMaterial({ id: docSnap.id, ...docSnap.data() } as Material);
                } else {
                    setError('Material não encontrado.');
                }
            } catch (err) {
                console.error('Error fetching material: ', err);
                setError('Falha ao carregar o material.');
            } finally {
                setLoading(false);
            }
        };
        fetchMaterial();
    }, [materialId]);
    
    const urlInfo = useMemo(() => {
        if (!material?.url) return null;
        return getGoogleDriveUrlInfo(material.url);
    }, [material]);

    if (loading) {
        return (
            <div className="flex h-screen w-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="ml-2">Carregando material...</p>
            </div>
        );
    }

    if (error) {
        return <div className="flex h-screen w-full items-center justify-center text-red-500">{error}</div>;
    }
    
    if (!material || !urlInfo) {
        return <div className="flex h-screen w-full items-center justify-center">Material não encontrado.</div>;
    }

    return (
        <div className="flex flex-col h-screen bg-muted/30">
            <header className="flex-shrink-0 bg-background border-b p-4">
                <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
                    <div className="flex-grow min-w-0">
                         <Button variant="outline" size="sm" asChild className="mb-2">
                            <Link href="/materiais">
                                <ArrowLeft className="mr-2 h-4 w-4" />
                                Voltar para Materiais
                            </Link>
                        </Button>
                        <h1 className="text-xl font-bold truncate" title={material.titulo}>{material.titulo}</h1>
                        <p className="text-sm text-muted-foreground truncate">{material.descricao}</p>
                    </div>
                     <Button variant="ghost" asChild>
                        <a href={material.url} target="_blank" rel="noopener noreferrer">
                           <ExternalLink className="mr-2 h-4 w-4" /> Abrir em nova aba
                        </a>
                    </Button>
                </div>
            </header>
            <main className="flex-grow p-4 flex items-center justify-center">
                <div className="w-full h-full">
                     <iframe
                        src={urlInfo.url}
                        className="w-full h-full rounded-md border"
                        allow="autoplay"
                        title={material.titulo}
                        onError={() => setError('Ocorreu um erro ao carregar o conteúdo. Verifique as permissões de compartilhamento.')}
                    ></iframe>
                </div>
            </main>
        </div>
    );
}
