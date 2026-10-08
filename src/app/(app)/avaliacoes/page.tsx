'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { collection, getDocs } from 'firebase/firestore';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { Download, Loader2, Search, Mail, Users, CalendarRange } from 'lucide-react';

import { db } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Avaliacao } from '@/lib/types';

type Autorizacao = 'Sim' | 'Não' | 'Não informado';

interface Contato {
  email: string;
  nome: string;
  /** Item 5 do formulário. Vem da avaliação mais recente da pessoa: quem era
   *  coordenador em 2024 pode ser diretor hoje. */
  funcao: string;
  cidade: string;
  uf: string;
  avaliacoes: number;
  primeira: Date | null;
  ultima: Date | null;
  autoriza: Autorizacao;
}

/** Converte Timestamp do Firestore em Date sem quebrar se o campo não existir. */
const paraData = (t: unknown): Date | null => {
  const ts = t as { toDate?: () => Date } | null | undefined;
  if (!ts?.toDate) return null;
  try {
    return ts.toDate();
  } catch {
    return null;
  }
};

const fmt = (d: Date | null) => (d ? format(d, 'dd/MM/yyyy') : '—');

export default function AvaliacoesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');

  useEffect(() => {
    if (user && user.perfil !== 'administrador') {
      router.replace('/materiais');
    }
  }, [user, router]);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      // Sem orderBy de propósito: no Firestore, ordenar por um campo DESCARTA os
      // documentos que não têm esse campo — e em uma exportação de e-mails perder
      // registro em silêncio é o pior resultado possível. Ordena-se depois, aqui.
      const snap = await getDocs(collection(db, 'avaliacoes'));
      setAvaliacoes(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Avaliacao));
    } catch (error) {
      console.error('Erro ao carregar avaliações:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao carregar',
        description: 'Não foi possível ler as avaliações.',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (user?.perfil === 'administrador') carregar();
  }, [user, carregar]);

  /** Avaliações da mais recente para a mais antiga; sem data vão para o fim. */
  const ordenadas = useMemo(() => {
    return [...avaliacoes].sort((a, b) => {
      const da = paraData(a.dataCriacao)?.getTime() ?? null;
      const db_ = paraData(b.dataCriacao)?.getTime() ?? null;
      if (da === null && db_ === null) return 0;
      if (da === null) return 1;
      if (db_ === null) return -1;
      return db_ - da;
    });
  }, [avaliacoes]);

  /**
   * Uma pessoa pode ter avaliado várias formações, em anos diferentes.
   * A chave é o e-mail normalizado — sem isso, "Maria@x.com" e "maria@x.com "
   * virariam dois contatos e a lista sairia com repetição.
   */
  const contatos = useMemo<Contato[]>(() => {
    const mapa = new Map<string, Contato>();

    for (const a of ordenadas) {
      const email = (a.email || '').trim().toLowerCase();
      if (!email) continue;

      const data = paraData(a.dataCriacao) ?? paraData(a.dataFormacao);
      const existente = mapa.get(email);

      if (!existente) {
        mapa.set(email, {
          email,
          nome: a.nomeCompleto || '',
          funcao: a.funcao || '',
          cidade: a.cidade || '',
          uf: a.uf || '',
          avaliacoes: 1,
          primeira: data,
          ultima: data,
          // A lista está da mais recente para a mais antiga, então a primeira
          // resposta encontrada é a preferência mais atual da pessoa.
          autoriza: a.aceiteComunicacoes ?? 'Não informado',
        });
        continue;
      }

      existente.avaliacoes += 1;
      // Preenche a função se a avaliação mais recente não trazia (campo antigo vazio).
      if (!existente.funcao && a.funcao) existente.funcao = a.funcao;
      if (data) {
        if (!existente.primeira || data < existente.primeira) existente.primeira = data;
        if (!existente.ultima || data > existente.ultima) existente.ultima = data;
      }
      // Só preenche se ainda não houver resposta: a mais recente vence.
      if (existente.autoriza === 'Não informado' && a.aceiteComunicacoes) {
        existente.autoriza = a.aceiteComunicacoes;
      }
    }

    return [...mapa.values()].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  }, [ordenadas]);

  /** Contagem por ano — serve para conferir que nenhum ano ficou de fora. */
  const porAno = useMemo(() => {
    const contagem = new Map<string, number>();
    for (const a of avaliacoes) {
      const data = paraData(a.dataCriacao) ?? paraData(a.dataFormacao);
      const chave = data ? String(data.getFullYear()) : 'Sem data';
      contagem.set(chave, (contagem.get(chave) ?? 0) + 1);
    }
    return [...contagem.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [avaliacoes]);

  const resumo = useMemo(() => {
    const sim = contatos.filter((c) => c.autoriza === 'Sim').length;
    const nao = contatos.filter((c) => c.autoriza === 'Não').length;
    return { sim, nao, semResposta: contatos.length - sim - nao };
  }, [contatos]);

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return contatos;
    return contatos.filter(
      (c) =>
        c.email.includes(termo) ||
        c.nome.toLowerCase().includes(termo) ||
        c.funcao.toLowerCase().includes(termo) ||
        c.cidade.toLowerCase().includes(termo) ||
        c.uf.toLowerCase().includes(termo)
    );
  }, [contatos, busca]);

  const exportar = (apenasAutorizados: boolean) => {
    const lista = apenasAutorizados ? contatos.filter((c) => c.autoriza === 'Sim') : contatos;

    if (lista.length === 0) {
      toast({
        variant: 'destructive',
        title: 'Nada para exportar',
        description: apenasAutorizados
          ? 'Ninguém autorizou receber e-mails ainda.'
          : 'Nenhuma avaliação encontrada.',
      });
      return;
    }

    const abaContatos = lista.map((c) => ({
      'E-mail': c.email,
      'Nome': c.nome,
      'Função pedagógica': c.funcao,
      'Cidade': c.cidade,
      'UF': c.uf,
      'Avaliações respondidas': c.avaliacoes,
      'Primeira avaliação': fmt(c.primeira),
      'Última avaliação': fmt(c.ultima),
      'Autoriza e-mail': c.autoriza,
    }));

    // Segunda aba com as respostas linha a linha: a aba de contatos junta a
    // pessoa que avaliou várias formações, e às vezes é preciso ver cada uma.
    const abaRespostas = ordenadas.map((a) => {
      const data = paraData(a.dataCriacao) ?? paraData(a.dataFormacao);
      return {
        'Data': fmt(data),
        'Ano': data ? data.getFullYear() : 'Sem data',
        'E-mail': (a.email || '').trim().toLowerCase(),
        'Nome': a.nomeCompleto || '',
        'Função pedagógica': a.funcao || '',
        'Cidade': a.cidade || '',
        'UF': a.uf || '',
        'Formação': a.formacaoTitulo || '',
        'Formador': a.formadorNome || '',
        'Autoriza e-mail': a.aceiteComunicacoes ?? 'Não informado',
      };
    });

    const planilha = XLSX.utils.book_new();
    const folhaContatos = XLSX.utils.json_to_sheet(abaContatos);
    folhaContatos['!cols'] = Object.keys(abaContatos[0]).map((coluna) => ({
      wch: Math.max(
        coluna.length,
        ...abaContatos.map((linha) => String(linha[coluna as keyof typeof linha] ?? '').length)
      ),
    }));

    XLSX.utils.book_append_sheet(planilha, folhaContatos, 'Contatos');
    XLSX.utils.book_append_sheet(planilha, XLSX.utils.json_to_sheet(abaRespostas), 'Respostas');

    const sufixo = apenasAutorizados ? 'autorizados' : 'todos';
    XLSX.writeFile(planilha, `E-mails avaliacoes - ${sufixo} - ${format(new Date(), 'dd-MM-yyyy')}.xlsx`);

    toast({
      title: 'Arquivo gerado',
      description: `${lista.length} e-mail(s) exportado(s).`,
    });
  };

  if (!user || user.perfil !== 'administrador') {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 py-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-headline">E-mails das Avaliações</h1>
        <p className="text-muted-foreground">
          Todas as respostas do formulário público, de todos os anos. Uma pessoa que avaliou
          várias formações aparece uma vez só.
        </p>
      </div>

      {loading ? (
        <div className="flex h-[50vh] items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" /> Avaliações respondidas
                </CardDescription>
                <CardTitle className="text-3xl">{avaliacoes.length}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription className="flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" /> E-mails diferentes
                </CardDescription>
                <CardTitle className="text-3xl">{contatos.length}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Autorizam receber e-mail</CardDescription>
                <CardTitle className="text-3xl text-emerald-600">{resumo.sim}</CardTitle>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardDescription>Não autorizam / não informaram</CardDescription>
                <CardTitle className="text-3xl">
                  {resumo.nao} <span className="text-base font-normal text-muted-foreground">/ {resumo.semResposta}</span>
                </CardTitle>
              </CardHeader>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarRange className="h-4 w-4" /> Avaliações por ano
              </CardTitle>
              <CardDescription>
                Confira aqui se todos os anos que você espera aparecem. Nenhum filtro de data é
                aplicado — a lista traz a coleção inteira.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {porAno.map(([ano, total]) => (
                <Badge key={ano} variant={ano === 'Sem data' ? 'destructive' : 'secondary'} className="text-sm">
                  {ano}: {total}
                </Badge>
              ))}
            </CardContent>
          </Card>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative sm:max-w-sm sm:flex-1">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar por e-mail, nome ou cidade…"
                className="pl-8"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => exportar(false)}>
                <Download className="mr-2 h-4 w-4" />
                Exportar todos ({contatos.length})
              </Button>
              <Button variant="outline" onClick={() => exportar(true)}>
                <Download className="mr-2 h-4 w-4" />
                Só quem autorizou ({resumo.sim})
              </Button>
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>E-mail</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Função pedagógica</TableHead>
                      <TableHead>Cidade/UF</TableHead>
                      <TableHead className="text-center">Avaliações</TableHead>
                      <TableHead>Última</TableHead>
                      <TableHead>Autoriza e-mail</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visiveis.map((c) => (
                      <TableRow key={c.email}>
                        <TableCell className="font-medium">{c.email}</TableCell>
                        <TableCell>{c.nome}</TableCell>
                        <TableCell>{c.funcao || <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {[c.cidade, c.uf].filter(Boolean).join('/')}
                        </TableCell>
                        <TableCell className="text-center">{c.avaliacoes}</TableCell>
                        <TableCell className="whitespace-nowrap">{fmt(c.ultima)}</TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              c.autoriza === 'Sim'
                                ? 'default'
                                : c.autoriza === 'Não'
                                  ? 'destructive'
                                  : 'secondary'
                            }
                          >
                            {c.autoriza}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {visiveis.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                          Nenhum contato encontrado.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
