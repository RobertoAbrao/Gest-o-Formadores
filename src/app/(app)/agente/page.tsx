'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { FormProvider, useFormState } from 'react-hook-form';
import { Loader2, Search, ArrowLeft, Bot, ClipboardList } from 'lucide-react';

import { db } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FormProjeto, type FormProjetoHandle } from '@/components/projetos/form-projeto';
import { useProjetoForm } from '@/components/projetos/use-projeto-form';
import { WizardChat } from '@/components/agent/WizardChat';
import { useWizard } from '@/hooks/use-wizard';
import { useIsMobile } from '@/hooks/use-mobile';
import type { Formador, ProjetoImplatancao } from '@/lib/types';

export default function AgentePage() {
  const { toast } = useToast();
  const [projetos, setProjetos] = useState<ProjetoImplatancao[]>([]);
  const [formadores, setFormadores] = useState<Formador[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [projeto, setProjeto] = useState<ProjetoImplatancao | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [projSnap, formSnap] = await Promise.all([
          getDocs(collection(db, 'projetos')),
          getDocs(collection(db, 'formadores')),
        ]);
        setProjetos(projSnap.docs.map((d) => ({ ...(d.data() as ProjetoImplatancao), id: d.id })));
        setFormadores(formSnap.docs.map((d) => ({ ...(d.data() as Formador), id: d.id })));
      } catch (e) {
        console.error(e);
        toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível carregar os projetos.' });
      } finally {
        setCarregando(false);
      }
    })();
  }, [toast]);

  if (carregando) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!projeto) {
    return <EscolherProjeto projetos={projetos} onEscolher={setProjeto} />;
  }

  return (
    <Assistente
      key={projeto.id}
      projeto={projeto}
      formadores={formadores}
      onTrocarProjeto={() => setProjeto(null)}
    />
  );
}

// ---------------------------------------------------------------------------

function EscolherProjeto({
  projetos,
  onEscolher,
}: {
  projetos: ProjetoImplatancao[];
  onEscolher: (p: ProjetoImplatancao) => void;
}) {
  const [busca, setBusca] = useState('');

  const lista = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const ordenada = [...projetos].sort((a, b) =>
      `${a.municipio}${a.uf}`.localeCompare(`${b.municipio}${b.uf}`)
    );
    if (!termo) return ordenada;
    return ordenada.filter((p) => `${p.municipio} ${p.uf}`.toLowerCase().includes(termo));
  }, [projetos, busca]);

  return (
    <div className="mx-auto max-w-2xl py-2">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
          <Bot className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-lg font-semibold">Assistente</h1>
          <p className="text-sm text-muted-foreground">Preenchimento guiado, passo a passo.</p>
        </div>
      </div>

      <div className="relative mb-3">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar município ou estado…"
          className="pl-8"
        />
      </div>

      <p className="mb-2 text-sm text-muted-foreground">Com qual projeto vamos trabalhar?</p>

      <div className="flex flex-col gap-2">
        {lista.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onEscolher(p)}
            className="flex min-h-[56px] items-center justify-between rounded-lg border px-4 py-2 text-left transition-colors hover:bg-muted"
          >
            <span>
              <span className="block font-medium">
                {p.municipio}/{p.uf}
              </span>
              <span className="block text-xs text-muted-foreground">
                {(p.formadoresIds || []).length} formador(es) · {(p.implantacoes || []).length} implantação(ões)
              </span>
            </span>
            {p.versao && <Badge variant="secondary">{p.versao}</Badge>}
          </button>
        ))}
        {lista.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">Nenhum projeto encontrado.</p>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Assistente({
  projeto,
  formadores,
  onTrocarProjeto,
}: {
  projeto: ProjetoImplatancao;
  formadores: Formador[];
  onTrocarProjeto: () => void;
}) {
  const { toast } = useToast();
  const acoes = useRef<FormProjetoHandle>(null);

  // A PÁGINA é a dona da instância do formulário. Isso é o que permite alternar
  // as abas sem perder nada: o Radix desmonta a aba inativa, e se o useForm
  // morasse dentro do FormProjeto a instância morreria junto.
  const form = useProjetoForm(projeto);

  const [aba, setAba] = useState('robo');

  const aoInvalidar = useCallback(
    (errors: Record<string, unknown>) => {
      const campos = Object.keys(errors).join(', ');
      toast({
        variant: 'destructive',
        title: 'Não foi possível salvar',
        description: `Verifique no formulário: ${campos}.`,
      });
      setAba('formulario');
    },
    [toast]
  );

  return (
    <FormProvider {...form}>
      <ConteudoAssistente
        projeto={projeto}
        formadores={formadores}
        acoes={acoes}
        aba={aba}
        setAba={setAba}
        onTrocarProjeto={onTrocarProjeto}
        aoInvalidar={aoInvalidar}
        form={form}
      />
    </FormProvider>
  );
}

/**
 * Separado do `Assistente` só para ficar DENTRO do FormProvider — `useWizard`
 * depende de `useFormContext`, que exige um provider acima.
 */
function ConteudoAssistente({
  projeto,
  formadores,
  acoes,
  aba,
  setAba,
  onTrocarProjeto,
  aoInvalidar,
  form,
}: {
  projeto: ProjetoImplatancao;
  formadores: Formador[];
  acoes: React.RefObject<FormProjetoHandle>;
  aba: string;
  setAba: (v: string) => void;
  onTrocarProjeto: () => void;
  aoInvalidar: (errors: Record<string, unknown>) => void;
  form: ReturnType<typeof useProjetoForm>;
}) {
  const wizard = useWizard({ acoes, todosFormadores: formadores, projetoSalvo: !!projeto.id });
  const isMobile = useIsMobile();

  // useFormState em vez de form.formState: o formulário foi criado no componente
  // pai, e a assinatura do Proxy de formState não alcança este componente.
  const { dirtyFields } = useFormState({ control: form.control });
  const naoSalvos = Object.keys(dirtyFields).length;

  const nomeProjeto = `${projeto.municipio}/${projeto.uf}`;

  // Renderizado UMA vez só. Montar os dois layouts (um com `hidden`) criaria duas
  // instâncias do formulário, duplicando as âncoras #sec-* e os fetches.
  const painelFormulario = (
    <div className="h-full overflow-y-auto overscroll-contain p-3">
      <FormProjeto
        ref={acoes}
        projeto={projeto}
        form={form}
        onInvalid={aoInvalidar}
        onSuccess={() => {
          /* Nada a fechar: a página fica aberta durante todo o fluxo. */
        }}
      />
    </div>
  );

  const painelRobo = <WizardChat wizard={wizard} nomeProjeto={nomeProjeto} />;

  return (
    // 100dvh (não 100vh): no celular o 100vh inclui a barra do navegador e joga
    // a área de ação para fora da tela. `-mx-4` foge do padding do <main>.
    <div className="-mx-4 flex h-[calc(100dvh-3.5rem)] flex-col sm:-mx-6 md:h-[calc(100dvh-3.75rem)]">
      <div className="flex shrink-0 items-center gap-2 border-b px-3 py-2">
        <Button variant="ghost" size="sm" onClick={onTrocarProjeto} className="h-9">
          <ArrowLeft className="mr-1 h-4 w-4" /> Trocar projeto
        </Button>
      </div>

      {isMobile ? (
        <Tabs value={aba} onValueChange={setAba} className="flex min-h-0 flex-1 flex-col">
          <TabsList className="mx-3 mt-2 grid shrink-0 grid-cols-2">
            <TabsTrigger value="robo" className="min-h-[40px]">
              <Bot className="mr-1.5 h-4 w-4" /> Robô
            </TabsTrigger>
            <TabsTrigger value="formulario" className="min-h-[40px]">
              <ClipboardList className="mr-1.5 h-4 w-4" /> Formulário
              {naoSalvos > 0 && (
                <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-[10px]">
                  {naoSalvos}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* forceMount + hidden: o Radix desmontaria a aba inativa, e o formulário
              perderia os campos renderizados no meio do fluxo. A instância do form
              sobrevive de qualquer jeito (vive na página), mas remontar a cada troca
              de aba refaz os fetches e perde a posição de rolagem. */}
          <TabsContent
            forceMount
            value="robo"
            className="mt-2 min-h-0 flex-1 data-[state=inactive]:hidden"
          >
            {painelRobo}
          </TabsContent>
          <TabsContent
            forceMount
            value="formulario"
            className="mt-2 min-h-0 flex-1 data-[state=inactive]:hidden"
          >
            {painelFormulario}
          </TabsContent>
        </Tabs>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-2">
          <div className="min-h-0 border-r">{painelRobo}</div>
          <div className="min-h-0">{painelFormulario}</div>
        </div>
      )}
    </div>
  );
}
