'use client';

import { useCallback, useMemo, useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import type { RefObject } from 'react';
import type { Formador } from '@/lib/types';
import type { FormProjetoHandle } from '@/components/projetos/form-projeto';
import type { FormValues } from '@/components/projetos/projeto-form-schema';
import { acharFluxo, lerCampo, FLUXOS, type CtxWizard, type Fluxo, type Passo } from '@/lib/agent/wizard-flows';

export type EstadoWizard = 'menu' | 'em-fluxo' | 'fim-fluxo';

export interface Mensagem {
  id: string;
  autor: 'robo' | 'usuario';
  texto: string;
  ajuda?: string;
  /** Aviso: passo em que não havia dados para escolher. */
  alerta?: boolean;
}

interface EntradaHistorico {
  indicePasso: number;
  campo: string | null;
  valorAnterior: unknown;
}

interface Params {
  acoes: RefObject<FormProjetoHandle>;
  todosFormadores: Formador[];
  /** Projeto selecionado já existe no banco? O auto-save depende disso. */
  projetoSalvo: boolean;
}

let contador = 0;
const novoId = () => `m${++contador}`;

export function useWizard({ acoes, todosFormadores, projetoSalvo }: Params) {
  const form = useFormContext<FormValues>();

  // Leitura REATIVA dos valores. De propósito não vem pelo ref: um ref não
  // dispara re-render, então os chips de status apareceriam congelados.
  const values = useWatch({ control: form.control }) as FormValues;

  const [estado, setEstado] = useState<EstadoWizard>('menu');
  const [fluxoId, setFluxoId] = useState<string | null>(null);
  const [indicePasso, setIndicePasso] = useState(0);
  const [alvo, setAlvo] = useState(0);
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [historico, setHistorico] = useState<EntradaHistorico[]>([]);
  const [salvando, setSalvando] = useState(false);
  const [erroSalvar, setErroSalvar] = useState<string | null>(null);

  const fluxo: Fluxo | null = fluxoId ? acharFluxo(fluxoId) ?? null : null;

  const formadoresDoProjeto = useMemo(() => {
    const ids = values?.formadoresIds || [];
    return todosFormadores.filter((f) => ids.includes(f.id));
  }, [values?.formadoresIds, todosFormadores]);

  const ctx: CtxWizard = useMemo(
    () => ({ values: values || ({} as FormValues), formadoresDoProjeto, todosFormadores, alvo }),
    [values, formadoresDoProjeto, todosFormadores, alvo]
  );

  const passo: Passo | null = fluxo && estado === 'em-fluxo' ? fluxo.passos[indicePasso] ?? null : null;

  const dizer = useCallback((texto: string, extra?: Partial<Mensagem>) => {
    setMensagens((m) => [...m, { id: novoId(), autor: 'robo', texto, ...extra }]);
  }, []);

  const responderNoLog = useCallback((texto: string) => {
    setMensagens((m) => [...m, { id: novoId(), autor: 'usuario', texto }]);
  }, []);

  // -------------------------------------------------------------------------
  // Gravação
  // -------------------------------------------------------------------------

  /**
   * Grava o recorte da etapa do fluxo atual. Toda decisão do usuário passa por
   * aqui: no celular o app pode morrer a qualquer momento, e perder um fluxo de
   * seis passos é pior que gravar seis vezes.
   */
  const gravarEtapaAtual = useCallback(
    async (fluxoAlvo: Fluxo): Promise<boolean> => {
      if (!projetoSalvo) {
        setErroSalvar('Este projeto ainda não existe no banco. Salve-o primeiro pela tela Projetos.');
        return false;
      }
      setSalvando(true);
      setErroSalvar(null);
      try {
        const ok = (await acoes.current?.salvarEtapas([fluxoAlvo.etapa])) ?? false;
        if (!ok) setErroSalvar('Não consegui salvar. Verifique a conexão — o passo continua aqui.');
        return ok;
      } finally {
        setSalvando(false);
      }
    },
    [acoes, projetoSalvo]
  );

  // -------------------------------------------------------------------------
  // Navegação
  // -------------------------------------------------------------------------

  const irParaMenu = useCallback(() => {
    setEstado('menu');
    setFluxoId(null);
    setIndicePasso(0);
    setHistorico([]);
  }, []);

  const perguntarPasso = useCallback(
    (f: Fluxo, indice: number, ctxAtual: CtxWizard) => {
      const p = f.passos[indice];
      if (!p) return;
      const vazio = p.semDados?.(ctxAtual) ?? null;
      dizer(p.pergunta(ctxAtual), {
        ajuda: vazio ?? p.ajuda?.(ctxAtual) ?? undefined,
        alerta: !!vazio,
      });
    },
    [dizer]
  );

  const iniciarFluxo = useCallback(
    (id: string) => {
      const f = acharFluxo(id);
      if (!f) return;

      let alvoInicial = 0;
      if (f.criarAlvo) {
        const { alvo: a, append } = f.criarAlvo(ctx.values);
        // Passa pelo useFieldArray do formulário; setValue no array não sincroniza as linhas.
        const indiceReal = acoes.current?.adicionarImplantacao(append) ?? a;
        alvoInicial = indiceReal;
      }

      responderNoLog(`${f.icone} ${f.rotulo}`);
      setFluxoId(id);
      setAlvo(alvoInicial);
      setIndicePasso(0);
      setHistorico([]);
      setEstado('em-fluxo');
      acoes.current?.irParaSecao(f.secao);
      perguntarPasso(f, 0, { ...ctx, alvo: alvoInicial });
    },
    [ctx, acoes, responderNoLog, perguntarPasso]
  );

  /** Aplica a resposta do passo atual, grava e avança. */
  const avancar = useCallback(
    async (valorBruto: unknown, rotuloNoLog: string, pulando: boolean) => {
      if (!fluxo || !passo) return;

      responderNoLog(rotuloNoLog);

      let alvoNovo = alvo;
      let campoEscrito: string | null = null;
      let valorAnterior: unknown = undefined;

      if (passo.defineAlvo) {
        alvoNovo = Number(valorBruto);
        setAlvo(alvoNovo);
      }

      const ctxPasso: CtxWizard = { ...ctx, alvo: alvoNovo };
      const campo = passo.campo?.(ctxPasso) ?? null;

      if (campo) {
        const valorFinal = pulando
          ? passo.valorAoPular?.(ctxPasso)
          : passo.valor?.(valorBruto, ctxPasso);

        if (valorFinal !== undefined) {
          valorAnterior = lerCampo(form.getValues(), campo);
          campoEscrito = campo;
          form.setValue(campo as never, valorFinal as never, {
            shouldDirty: true,
            shouldValidate: false,
          });
          const gravou = await gravarEtapaAtual(fluxo);
          if (!gravou) {
            // Desfaz na tela para o formulário não mostrar algo que não está no banco.
            form.setValue(campo as never, valorAnterior as never, { shouldDirty: true });
            return;
          }
        }
      }

      setHistorico((h) => [...h, { indicePasso, campo: campoEscrito, valorAnterior }]);

      const proximo = indicePasso + 1;
      if (proximo >= fluxo.passos.length) {
        setEstado('fim-fluxo');
        dizer(`Pronto — ${fluxo.rotulo} ${fluxo.criarAlvo ? '' : alvoNovo || ''} salva.`.replace(/\s+/g, ' ').trim());
      } else {
        setIndicePasso(proximo);
        perguntarPasso(fluxo, proximo, { ...ctx, alvo: alvoNovo });
      }
    },
    [fluxo, passo, alvo, ctx, form, indicePasso, gravarEtapaAtual, responderNoLog, dizer, perguntarPasso]
  );

  const responder = useCallback(
    (valor: unknown, rotulo: string) => avancar(valor, rotulo, false),
    [avancar]
  );

  const pular = useCallback(() => {
    if (!passo) return;
    return avancar(undefined, passo.rotuloPular || 'Pular', true);
  }, [passo, avancar]);

  /**
   * Volta um passo E desfaz o que ele gravou.
   * Sem o desfazer, o banco guardaria um valor que a conversa já esqueceu.
   */
  const voltar = useCallback(async () => {
    if (!fluxo || historico.length === 0) {
      irParaMenu();
      return;
    }
    const ultima = historico[historico.length - 1];
    setHistorico((h) => h.slice(0, -1));

    if (ultima.campo) {
      form.setValue(ultima.campo as never, ultima.valorAnterior as never, { shouldDirty: true });
      await gravarEtapaAtual(fluxo);
    }

    setEstado('em-fluxo');
    setIndicePasso(ultima.indicePasso);
    setMensagens((m) => {
      // Remove a pergunta e a resposta do passo desfeito.
      const corte = [...m];
      while (corte.length && corte[corte.length - 1].autor !== 'robo') corte.pop();
      corte.pop();
      return corte;
    });
    perguntarPasso(fluxo, ultima.indicePasso, { ...ctx, alvo });
  }, [fluxo, historico, form, gravarEtapaAtual, irParaMenu, perguntarPasso, ctx, alvo]);

  // -------------------------------------------------------------------------
  // Ações finais (formação vinculada)
  // -------------------------------------------------------------------------

  const criarFormacaoVinculada = useCallback(async () => {
    if (!fluxo?.formacaoVinculada) return;
    setSalvando(true);
    setErroSalvar(null);
    try {
      // Ordem obrigatória: o handler lê os valores e grava o formacaoId de volta
      // NO FORMULÁRIO. Sem o segundo save, a formação existe no banco e o projeto
      // não guarda o vínculo — e o robô ofereceria criar de novo, duplicando.
      const salvouAntes = (await acoes.current?.submit()) ?? false;
      if (!salvouAntes) {
        setErroSalvar('Não consegui salvar o projeto antes de criar a formação.');
        return;
      }

      if (fluxo.formacaoVinculada === 'devolutiva') {
        await acoes.current?.criarFormacaoDevolutiva(alvo as 1 | 2 | 3 | 4);
      } else {
        await acoes.current?.criarFormacaoImplantacao(alvo);
      }

      const salvouDepois = (await acoes.current?.salvarEtapas([fluxo.etapa])) ?? false;
      if (!salvouDepois) {
        setErroSalvar('A formação foi criada, mas o vínculo não salvou. Salve o projeto manualmente.');
        return;
      }
      dizer('Formação criada e vinculada ao projeto. Ela já aparece no Quadro, com a demanda para o responsável.');
    } finally {
      setSalvando(false);
    }
  }, [fluxo, alvo, acoes, dizer]);

  const reiniciar = useCallback(() => {
    setMensagens([]);
    irParaMenu();
  }, [irParaMenu]);

  return {
    estado,
    fluxo,
    passo,
    ctx,
    mensagens,
    salvando,
    erroSalvar,
    podeVoltar: historico.length > 0 || estado === 'em-fluxo',
    fluxos: FLUXOS,
    iniciarFluxo,
    responder,
    pular,
    voltar,
    irParaMenu,
    criarFormacaoVinculada,
    reiniciar,
    dizer,
  };
}
