
'use client';

import { doc, updateDoc, collection, addDoc, query, where, getDocs, limit, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from './firebase';
import type { Formacao, FormadorStatus, Demanda } from './types';
import type { User } from '@/hooks/use-auth';

// Helper function to check for existing automated demands
const automatedDemandExists = async (formacaoId: string, gatilho: FormadorStatus): Promise<boolean> => {
    const q = query(
        collection(db, 'demandas'),
        where('formacaoOrigemId', '==', formacaoId),
        where('origemGatilho', '==', gatilho),
        limit(1)
    );
    const snapshot = await getDocs(q);
    return !snapshot.empty;
};

// Main function to change status and create automated demands
export const changeFormacaoStatus = async (
    formacao: Formacao,
    newStatus: FormadorStatus,
    currentUser: User | null
): Promise<void> => {
    if (!currentUser) {
        throw new Error("Usuário não autenticado.");
    }
    
    // 1. Update the formation status
    const formacaoRef = doc(db, 'formacoes', formacao.id);
    await updateDoc(formacaoRef, { status: newStatus });

    // 2. Create automated demand based on the new status
    let demandaData: Partial<Omit<Demanda, 'id'>> | null = null;

    const twoDaysFromNow = new Date();
    twoDaysFromNow.setDate(twoDaysFromNow.getDate() + 2);

    switch (newStatus) {
        case 'pos-formacao':
            if (!(await automatedDemandExists(formacao.id, 'pos-formacao'))) {
                demandaData = {
                    demanda: `Gerar relatório e coletar despesas da formação: ${formacao.titulo}`,
                    prazo: Timestamp.fromDate(twoDaysFromNow),
                    prioridade: 'Normal',
                    origemGatilho: 'pos-formacao',
                };
            }
            break;
        case 'concluido':
             if (!(await automatedDemandExists(formacao.id, 'concluido'))) {
                demandaData = {
                    demanda: `Enviar e-mail de agradecimento e feedback para a formação: ${formacao.titulo}`,
                    prazo: Timestamp.fromDate(twoDaysFromNow),
                    prioridade: 'Normal',
                    origemGatilho: 'concluido',
                };
            }
            break;
        // Add other cases like 'arquivado' if needed
        default:
            // No automated demand for this status
            break;
    }

    if (demandaData) {
        const newDemand: Omit<Demanda, 'id' | 'dataCriacao' | 'dataAtualizacao'> & { dataCriacao: any, dataAtualizacao: any } = {
            municipio: formacao.municipio,
            uf: formacao.uf,
            demanda: demandaData.demanda!,
            status: 'Pendente',
            responsavelId: currentUser.uid,
            responsavelNome: currentUser.nome || 'Admin',
            prioridade: demandaData.prioridade || 'Normal',
            prazo: demandaData.prazo,
            dataCriacao: serverTimestamp(),
            dataAtualizacao: serverTimestamp(),
            origem: 'automatica',
            formacaoOrigemId: formacao.id,
            origemGatilho: demandaData.origemGatilho,
        };
        await addDoc(collection(db, 'demandas'), newDemand);
    }
};
