'use client';

import Image from 'next/image';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import type { Formacao } from '@/lib/types';
import {
  cronogramaGeral,
  dataDoDia,
  normalizarLink,
  participantesAtivos,
  type DiaDoPeriodo,
  type FichaEditavel,
} from './ficha-modelo';

const LOGO_EDITORA = '/Imagem_do_WhatsApp_de_2025-08-14_à_s__17.07.16_9af64c95-removebg-preview.png';

const AVISO_LINKS =
  'A Editora LT informa que não se responsabiliza pela divulgação indevida dos links gerados para a participação do encontro, tampouco com eventuais invasões virtuais que possam comprometer a formação da equipe gestora da rede de ensino do Município.';

/**
 * O documento que vai para o município — o mesmo componente na pré-visualização e na
 * impressão (a página o renderiza duas vezes). Só leitura: nada aqui é campo de edição.
 *
 * As cores são fixas (branco/cinza), não do tema: é papel, e no PDF não pode depender do
 * modo escuro. Campo vazio aparece como `doc-falta` na tela e some na impressão (CSS da
 * página), ou seja, no PDF sai em branco.
 */
export function DocumentoFicha({
  ficha,
  formacao,
  periodo,
  quando,
  className,
}: {
  ficha: FichaEditavel;
  formacao: Formacao;
  periodo: DiaDoPeriodo[];
  quando: string;
  className?: string;
}) {
  const presencial = ficha.modalidade === 'presencial';
  const ativos = participantesAtivos(ficha);
  const local = [formacao.municipio, formacao.uf].filter(Boolean).join(' – ');

  return (
    <article
      aria-label="Documento"
      className={cn(
        'doc-folha mx-auto flex w-full max-w-[794px] flex-col gap-4 bg-white p-5 text-[12px] leading-relaxed text-neutral-900 shadow-md sm:p-10 sm:text-[12.5px]',
        className
      )}
    >
      <header className="doc-bloco flex items-center gap-4 border-b-2 border-neutral-900 pb-3">
        <Image src={LOGO_EDITORA} alt="Editora LT" width={56} height={56} priority className="h-14 w-14 shrink-0" />
        <div className="min-w-0">
          <p className="text-[10.5px] font-bold uppercase tracking-[0.12em] text-neutral-500">
            {presencial ? 'Divulgação' : 'Divulgação de links'}
          </p>
          <h1 className="text-[17px] font-bold leading-snug">{formacao.titulo}</h1>
          {local && <p className="text-neutral-600">{local}</p>}
        </div>
      </header>

      <p className="whitespace-pre-wrap">{ficha.introducao.trim() ? ficha.introducao : <Falta>mensagem de abertura</Falta>}</p>

      <div className="doc-bloco flex flex-col gap-0.5 rounded-sm bg-neutral-100 px-3 py-2.5">
        <p>
          <strong>Quando:</strong> {quando}
        </p>
        <p>
          <strong>Horário:</strong> {ficha.horario.trim() ? ficha.horario : <Falta>horário</Falta>}
        </p>
        <p className="mt-1.5 text-[11px] text-neutral-600">
          {presencial
            ? 'Pedimos a gentileza de se dirigir ao local correspondente ao seu ano/área de atuação.'
            : 'Pedimos a gentileza de acessar o link correspondente ao seu ano/área de atuação.'}
        </p>
      </div>

      {presencial ? <Presencial ficha={ficha} periodo={periodo} /> : <Online ficha={ficha} />}

      {/* O aviso fala de links: só faz sentido no online. */}
      {!presencial && ativos.length > 0 && (
        <p className="doc-bloco border-t border-neutral-300 pt-2.5 text-[10.5px] text-neutral-600">
          <strong className="text-neutral-700">Atenção:</strong> {AVISO_LINKS}
        </p>
      )}
    </article>
  );
}

function Presencial({ ficha, periodo }: { ficha: FichaEditavel; periodo: DiaDoPeriodo[] }) {
  const cronograma = cronogramaGeral(ficha, periodo);
  const ativos = participantesAtivos(ficha);

  return (
    <>
      <section className="doc-bloco flex flex-col gap-1">
        <Titulo>Local do encontro</Titulo>
        <p className="whitespace-pre-wrap">{ficha.endereco.trim() ? ficha.endereco : <Falta>endereço do encontro</Falta>}</p>
      </section>

      <section className="flex flex-col gap-1.5">
        <Titulo>Cronograma geral</Titulo>
        <Tabela cabecalho={['Dia', 'Horário', 'Ano/Área', 'Formador(a)', 'Participantes']} numerica={4}>
          {cronograma.length > 0 ? (
            cronograma.map(({ dia, data, entradas }) =>
              entradas.map((e, i) => (
                <tr key={`${dia}-${i}`}>
                  {i === 0 && (
                    <Celula rowSpan={entradas.length}>
                      <strong>{dia}</strong>
                      {data && <span className="block text-[10.5px] text-neutral-500">{data}</span>}
                    </Celula>
                  )}
                  <Celula>{e.horario}</Celula>
                  <Celula>{e.area}</Celula>
                  <Celula>{e.formador}</Celula>
                  <Celula numerica>{e.participantes || ''}</Celula>
                </tr>
              ))
            )
          ) : (
            <tr>
              <Celula colSpan={5} className="py-4 text-center text-neutral-500">
                Nenhum horário completo na agenda.
              </Celula>
            </tr>
          )}
        </Tabela>
      </section>

      {ativos.length > 0 && (
        <section className="flex flex-col gap-3">
          <Titulo>Agenda por formador</Titulo>
          {ativos.map((p) => {
            const linhas = p.agenda.filter((r) => r.dia || r.horario.trim() || r.area.trim());
            return (
              <div key={p.key} className="doc-bloco flex flex-col gap-1.5">
                <h3 className="text-[12.5px] font-bold">{p.nome.trim() ? p.nome : <Falta>nome do formador</Falta>}</h3>
                {p.curriculo?.trim() && <p className="whitespace-pre-wrap text-[11px] text-neutral-600">{p.curriculo}</p>}
                <Tabela cabecalho={['Dia', 'Horário', 'Ano/Área', 'Participantes']} numerica={3}>
                  {linhas.length > 0 ? (
                    linhas.map((r, i) => {
                      const data = r.dia ? dataDoDia(r.dia, periodo) : '';
                      return (
                        <tr key={i}>
                          <Celula>
                            {r.dia ? r.dia : <Falta>dia</Falta>}
                            {data && <span className="block text-[10.5px] text-neutral-500">{data}</span>}
                          </Celula>
                          <Celula>{r.horario.trim() ? r.horario : <Falta>horário</Falta>}</Celula>
                          <Celula>{r.area}</Celula>
                          <Celula numerica>{r.participantes || ''}</Celula>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <Celula colSpan={4} className="py-3 text-center">
                        <Falta>sem horários</Falta>
                      </Celula>
                    </tr>
                  )}
                </Tabela>
              </div>
            );
          })}
        </section>
      )}
    </>
  );
}

function Online({ ficha }: { ficha: FichaEditavel }) {
  const ativos = participantesAtivos(ficha);
  const equipe = ativos.filter((p) => p.tipo === 'equipe');

  return (
    <>
      <section className="flex flex-col gap-1.5">
        <Titulo>Links de acesso (Google Meet)</Titulo>
        <Tabela cabecalho={['Ano/Área', 'Formador(a)', 'Link da videochamada']}>
          {ativos.length > 0 ? (
            ativos.map((p) => {
              // Normalizado também aqui: fichas salvas antes desta regra têm "meet.google.com/..."
              // sem https://, que no PDF não seria clicável.
              const link = normalizarLink(p.linkUrl);
              return (
                <tr key={p.key}>
                  <Celula>{p.anoArea.trim() ? p.anoArea : <Falta>ano/área</Falta>}</Celula>
                  <Celula>{p.nome.trim() ? p.nome : <Falta>nome</Falta>}</Celula>
                  <Celula className="break-all">
                    {!link ? (
                      <Falta>link a preencher</Falta>
                    ) : /^https?:\/\//.test(link) ? (
                      <a href={link} target="_blank" rel="noopener noreferrer" className="text-indigo-800 underline">
                        {link}
                      </a>
                    ) : (
                      link
                    )}
                  </Celula>
                </tr>
              );
            })
          ) : (
            <tr>
              <Celula colSpan={3} className="py-4 text-center">
                <Falta>nenhum formador</Falta>
              </Celula>
            </tr>
          )}
        </Tabela>
      </section>

      {equipe.length > 0 && (
        <section className="flex flex-col gap-1.5">
          <Titulo>Equipe de formadores</Titulo>
          <Tabela cabecalho={['Formador(a)', 'Currículo']} larguraPrimeira="32%">
            {equipe.map((p) => (
              <tr key={p.key}>
                <Celula>
                  <strong>{p.nome}</strong>
                </Celula>
                <Celula className="whitespace-pre-wrap text-[11px] text-neutral-600">{p.curriculo ?? ''}</Celula>
              </tr>
            ))}
          </Tabela>
        </section>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------

function Falta({ children }: { children: ReactNode }) {
  return <span className="doc-falta italic text-amber-700 underline decoration-dashed underline-offset-2">{children}</span>;
}

function Titulo({ children }: { children: ReactNode }) {
  return <h2 className="border-b border-neutral-300 pb-1 text-[13.5px] font-bold">{children}</h2>;
}

function Tabela({
  cabecalho,
  numerica,
  larguraPrimeira,
  children,
}: {
  cabecalho: string[];
  /** índice da coluna alinhada à direita */
  numerica?: number;
  larguraPrimeira?: string;
  children: ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[11.5px]">
        <thead>
          <tr>
            {cabecalho.map((c, i) => (
              <th
                key={c}
                style={i === 0 && larguraPrimeira ? { width: larguraPrimeira } : undefined}
                className={cn(
                  'border border-neutral-300 bg-neutral-100 px-2 py-1.5 text-left font-bold',
                  i === numerica && 'text-right'
                )}
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function Celula({
  children,
  numerica,
  className,
  ...resto
}: {
  children?: ReactNode;
  numerica?: boolean;
  className?: string;
  rowSpan?: number;
  colSpan?: number;
}) {
  return (
    <td
      {...resto}
      className={cn('border border-neutral-300 px-2 py-1.5 align-top', numerica && 'text-right tabular-nums', className)}
    >
      {children}
    </td>
  );
}
