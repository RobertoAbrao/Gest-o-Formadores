'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useForm, type UseFormReturn } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { ProjetoImplatancao } from '@/lib/types';
import { buildDefaultValues, formSchema, type FormValues } from './projeto-form-schema';

/**
 * Cria a instância de formulário do projeto.
 *
 * Existe como hook separado para que a página `/agente` possa ser DONA da
 * instância: o robô guiado e o `FormProjeto` operam o mesmo formulário, e a
 * instância sobrevive à desmontagem dos painéis (as abas do Radix desmontam o
 * conteúdo inativo).
 *
 * `FormProjeto` continua criando a própria instância quando ninguém passa uma —
 * por isso as telas existentes não mudam.
 */
export function useProjetoForm(projeto?: ProjetoImplatancao | null): UseFormReturn<FormValues> {
  const defaultValues = useMemo(() => buildDefaultValues(projeto), [projeto]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues,
  });

  // Guarda de reset.
  //
  // O código original resetava sempre que `defaultValues` mudava de identidade.
  // Como `defaultValues` é derivado do objeto `projeto`, QUALQUER re-fetch (ou um
  // onSnapshot) recriava o objeto e descartava o que estivesse preenchido e não
  // salvo. Isso é fatal para o robô, que preenche em vários passos.
  //
  // Agora o reset só acontece quando o projeto REALMENTE muda (id diferente),
  // que é o caso em que recarregar os valores é o comportamento desejado.
  const projetoCarregadoId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const id = projeto?.id ?? null;
    if (projetoCarregadoId.current === id) return;
    projetoCarregadoId.current = id;
    form.reset(defaultValues);
  }, [projeto, defaultValues, form]);

  return form;
}
