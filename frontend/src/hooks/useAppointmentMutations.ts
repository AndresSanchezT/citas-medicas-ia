import { useState } from 'react';
import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { cancelAppointment, checkIn, completeAppointment, markNoShow, startConsultation, type Appointment } from '../api/appointments';

export function useAppointmentMutations(invalidateKey: QueryKey) {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: invalidateKey });

  // El resultado de la política (reembolso o pérdida del pago) se muestra en un modal
  // (ResultadoPoliticaModal) en vez de un window.alert(); solo se llena cuando hay algo
  // que informar (cita pagada).
  const [resultadoPolitica, setResultadoPolitica] = useState<Appointment | null>(null);

  const checkInMutation = useMutation({ mutationFn: checkIn, onSuccess: invalidate });
  const startMutation = useMutation({
    mutationFn: (vars: { id: number; hora?: string }) => startConsultation(vars.id, vars.hora),
    onSuccess: invalidate,
  });
  const completeMutation = useMutation({
    mutationFn: (vars: { id: number; hora?: string }) => completeAppointment(vars.id, vars.hora),
    onSuccess: invalidate,
  });
  const cancelMutation = useMutation({ mutationFn: cancelAppointment, onSuccess: invalidate });
  const noShowMutation = useMutation({
    mutationFn: markNoShow,
    onSuccess: (appointment) => {
      invalidate();
      if (appointment.pagado) setResultadoPolitica(appointment);
    },
  });

  const busy =
    checkInMutation.isPending ||
    startMutation.isPending ||
    completeMutation.isPending ||
    cancelMutation.isPending ||
    noShowMutation.isPending;

  return {
    busy,
    onCheckIn: (id: number) => checkInMutation.mutate(id),
    onStart: (id: number, hora?: string) => startMutation.mutate({ id, hora }),
    onComplete: (id: number, hora?: string) => completeMutation.mutate({ id, hora }),
    onCancel: (id: number) => cancelMutation.mutate(id),
    onNoShow: (id: number) => noShowMutation.mutate(id),
    resultadoPolitica,
    limpiarResultadoPolitica: () => setResultadoPolitica(null),
  };
}
